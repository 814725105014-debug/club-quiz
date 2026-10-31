import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Input, Loading, Modal, Select, StatCard, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api, downloadFile } from '../lib/api';
import { apiErrorMessage, durationLabel, formatDateTime, percent } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { Quiz, ResultRow } from '../lib/types';

interface ResultsResponse {
  rows: ResultRow[];
  total: number;
}

interface DetailResponse {
  attempt: Record<string, unknown>;
  answers: {
    id: string;
    question_text: string;
    question_type: string;
    question_marks: number;
    selected_options: string;
    is_correct: number | null;
    marks_awarded: number | null;
    marked_for_review: number;
  }[];
  violations: { id: number; type: string; severity: string; created_at: string; metadata: string | null }[];
  emails: { id: string; template_key: string; to_email: string; actual_recipient: string; status: string; error: string | null; created_at: string }[];
}

export default function Results() {
  const toast = useToast();
  const quizzes = useApi<{ quizzes: Quiz[] }>('/admin/quizzes');
  const [quizId, setQuizId] = useState('');
  const [search, setSearch] = useState('');
  const [result, setResult] = useState('');
  const [certificateStatus, setCertificateStatus] = useState('');
  const [sort, setSort] = useState('submitted_desc');
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  const query = new URLSearchParams({
    ...(quizId ? { quizId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(result ? { result } : {}),
    ...(certificateStatus ? { certificateStatus } : {}),
    sort,
    limit: '200',
  }).toString();

  const { data, loading, error, reload } = useApi<ResultsResponse>(`/admin/results?${query}`, [
    quizId,
    search,
    result,
    certificateStatus,
    sort,
  ]);

  const rows = data?.rows ?? [];
  const passed = rows.filter((r) => r.passed).length;
  const average = rows.length ? rows.reduce((sum, r) => sum + r.percentage, 0) / rows.length : 0;
  const withCert = rows.filter((r) => r.certificateStatus === 'generated').length;

  const exportCsv = async () => {
    try {
      await downloadFile(
        `/admin/results/export.csv?${new URLSearchParams({
          ...(quizId ? { quizId } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
        }).toString()}`,
        'quiz-results.csv',
      );
      toast('Results exported.', 'success');
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  return (
    <AdminLayout
      title="Results & reports"
      crumb="Delivery · scores, attempts and certificates"
      actions={
        <Button variant="subtle" size="sm" onClick={exportCsv}>
          <Icon name="download" size={14} /> Export CSV
        </Button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Submissions" value={data?.total ?? 0} meta={`${rows.length} on this page`} icon={<Icon name="chart" />} />
        <StatCard label="Pass rate" value={rows.length ? `${percent((passed / rows.length) * 100, 0)}` : '—'} meta={`${passed} passed`} />
        <StatCard label="Average" value={rows.length ? percent(average) : '—'} meta="Across filtered attempts" />
        <StatCard label="Certificates" value={withCert} meta={`${rows.filter((r) => r.certificateStatus === 'pending').length} pending`} />
      </div>

      <Card title="Attempts" subtitle="Server-computed scores. Filter, inspect or export without opening Sheets." noPad>
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <Input placeholder="Search participant…" value={search} onChange={(e) => setSearch(e.target.value)} className="grow" />
          <Select value={quizId} onChange={(e) => setQuizId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">All quizzes</option>
            {(quizzes.data?.quizzes ?? []).map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </Select>
          <Select value={result} onChange={(e) => setResult(e.target.value)} style={{ width: 130 }}>
            <option value="">All results</option>
            <option value="pass">Passed</option>
            <option value="fail">Failed</option>
          </Select>
          <Select value={certificateStatus} onChange={(e) => setCertificateStatus(e.target.value)} style={{ width: 170 }}>
            <option value="">Any certificate</option>
            <option value="generated">Generated</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="none">Not applicable</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} style={{ width: 160 }}>
            <option value="submitted_desc">Newest first</option>
            <option value="score_desc">Score high→low</option>
            <option value="score_asc">Score low→high</option>
            <option value="name_asc">Name A→Z</option>
          </Select>
          <Button size="sm" variant="ghost" onClick={reload}>
            Refresh
          </Button>
        </div>

        {loading && !data ? (
          <Loading label="Loading results…" />
        ) : rows.length === 0 ? (
          <EmptyState icon="◎" title="No attempts match" message="Adjust the filters or wait for students to submit." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Quiz</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th>Submitted</th>
                  <th>Flags</th>
                  <th>Certificate</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.attemptId}>
                    <td>
                      <div className="strong small">{row.name}</div>
                      <div className="tiny muted">{row.email}</div>
                      <div className="tiny muted mono">{row.regNumber ?? '—'}</div>
                    </td>
                    <td className="small" style={{ maxWidth: '20ch' }}>{row.quizTitle}</td>
                    <td>
                      <div className="strong">{row.score}/{row.totalMarks}</div>
                      <div className="tiny muted">{percent(row.percentage)}</div>
                    </td>
                    <td>
                      <Badge tone={row.passed ? 'green' : 'red'}>{row.passed ? 'Pass' : 'Fail'}</Badge>
                      {row.status === 'auto_submitted' ? <div className="tiny muted">auto-submitted</div> : null}
                    </td>
                    <td>
                      <div className="small">{formatDateTime(row.submittedAt)}</div>
                      <div className="tiny muted">{row.durationSeconds ? durationLabel(row.durationSeconds) : ''}</div>
                    </td>
                    <td>
                      {row.violations > 0 ? <Badge tone="amber">{row.violations}</Badge> : <span className="tiny muted">clean</span>}
                    </td>
                    <td>
                      {row.certificateStatus ? (
                        <Badge tone={row.certificateStatus === 'generated' ? 'green' : row.certificateStatus === 'failed' ? 'red' : 'amber'}>
                          {row.certificateStatus}
                        </Badge>
                      ) : (
                        <span className="tiny muted">—</span>
                      )}
                      {row.certificateId ? <div className="tiny mono muted">{row.certificateId}</div> : null}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" onClick={() => setOpenAttempt(row.attemptId)}>
                        <Icon name="eye" size={14} /> Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AttemptDetail attemptId={openAttempt} onClose={() => setOpenAttempt(null)} />
    </AdminLayout>
  );
}

function AttemptDetail({ attemptId, onClose }: { attemptId: string | null; onClose: () => void }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!attemptId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<DetailResponse>(`/admin/results/${attemptId}`)
      .then(setData)
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [attemptId]);

  const attempt = data?.attempt as
    | {
        name: string;
        email: string;
        reg_number: string | null;
        quiz_title: string;
        score: number;
        total_marks: number;
        percentage: number;
        passed: number;
        status: string;
        submitted_at: string | null;
        duration_seconds: number | null;
        violations_count: number;
        certificate_id: string | null;
        certificate_status: string | null;
        certificate_error: string | null;
        pdf_url: string | null;
      }
    | undefined;

  return (
    <Modal open={Boolean(attemptId)} onClose={onClose} title="Attempt review" size="lg">
      {loading ? (
        <Loading label="Loading attempt…" />
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : attempt ? (
        <>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div className="strong">{attempt.name}</div>
              <div className="tiny muted">{attempt.email} · {attempt.reg_number ?? 'no register number'}</div>
              <div className="tiny muted">{attempt.quiz_title}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="strong" style={{ fontSize: 22 }}>
                {attempt.score}/{attempt.total_marks}
              </div>
              <div className="tiny muted">
                {percent(attempt.percentage)} · {attempt.passed ? 'PASS' : 'FAIL'}
              </div>
            </div>
          </div>

          <div className="grid grid-3" style={{ margin: '14px 0' }}>
            <div className="mini-stat">
              <span>Status</span>
              <b>{attempt.status.replace('_', ' ')}</b>
            </div>
            <div className="mini-stat">
              <span>Submitted</span>
              <b>{formatDateTime(attempt.submitted_at)}</b>
            </div>
            <div className="mini-stat">
              <span>Proctoring events</span>
              <b>{attempt.violations_count}</b>
            </div>
          </div>

          {attempt.certificate_status ? (
            <div className="alert alert-info" style={{ fontSize: 12.5 }}>
              <span>🎓</span>
              <span>
                Certificate <b>{attempt.certificate_id ?? '—'}</b> · status {attempt.certificate_status}
                {attempt.certificate_error ? ` · ${attempt.certificate_error}` : ''}
              </span>
            </div>
          ) : null}

          <h4 style={{ marginTop: 6 }}>Question breakdown</h4>
          <div className="attempt-answers">
            {data?.answers.map((answer, index) => (
              <div className="attempt-answer" key={answer.id}>
                <div className="aa-head">
                  <span className="tiny muted">Q{index + 1}</span>
                  <span className={`badge ${answer.is_correct ? 'badge-green' : 'badge-red'}`}>
                    {answer.is_correct ? 'correct' : 'incorrect'}
                  </span>
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                    {answer.marks_awarded ?? 0}/{answer.question_marks} marks
                  </span>
                </div>
                <div className="small">{answer.question_text}</div>
                <div className="tiny muted mono">selected: {answer.selected_options}</div>
              </div>
            ))}
            {data?.answers.length === 0 ? <p className="tiny muted">No answers were recorded.</p> : null}
          </div>

          <h4 style={{ marginTop: 14 }}>Proctoring timeline</h4>
          {data?.violations.length ? (
            <div className="timeline">
              {data.violations.map((violation) => (
                <div className="timeline-row" key={violation.id}>
                  <span className="dot" />
                  <span className="small">{violation.type.replace(/_/g, ' ')}</span>
                  <span className="tiny muted" style={{ marginLeft: 'auto' }}>
                    {formatDateTime(violation.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="tiny muted">No proctoring events were recorded.</p>
          )}

          <h4 style={{ marginTop: 14 }}>Email history</h4>
          {data?.emails.length ? (
            <div className="table-wrap">
              <table className="table table-compact">
                <tbody>
                  {data.emails.map((email) => (
                    <tr key={email.id}>
                      <td className="small">{email.template_key.replace(/_/g, ' ')}</td>
                      <td className="tiny muted">{email.actual_recipient}</td>
                      <td>
                        <Badge tone={email.status === 'sent' || email.status === 'redirected' ? 'green' : email.status === 'failed' ? 'red' : 'amber'}>
                          {email.status}
                        </Badge>
                      </td>
                      <td className="tiny muted">{formatDateTime(email.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="tiny muted">No emails were sent for this attempt.</p>
          )}
        </>
      ) : null}
    </Modal>
  );
}
