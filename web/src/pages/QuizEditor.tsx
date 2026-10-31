import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  EmptyState,
  Input,
  Loading,
  Modal,
  Tabs,
  Textarea,
  useToast,
} from '../components/ui';
import { QuizForm } from '../components/QuizForm';
import { QuestionForm } from '../components/QuestionForm';
import { useApi } from '../lib/hooks';
import { api, ApiError, downloadFile } from '../lib/api';
import { formatDateTime, percent, quizStatusTone, statusLabel, statusTone } from '../lib/format';
import type { Question, Quiz } from '../lib/types';
import { Icon } from '../components/Icon';
import { useSession } from '../lib/session';

interface QuizDetail {
  quiz: Quiz;
  totals: { questions: number; marks: number };
  questions: Question[];
  joinUrl: string;
  presentationUrl: string;
  certificatePreviewId: string;
}

type ParticipantRow = {
  id: string;
  name: string;
  email: string;
  reg_number: string | null;
  department: string | null;
  created_at: string;
  attempt_id: string | null;
  status: string | null;
  score: number | null;
  total_marks: number | null;
  percentage: number | null;
  passed: number | null;
  started_at: string | null;
  submitted_at: string | null;
  violations_count: number | null;
  certificate_status: string | null;
  certificate_id: string | null;
  email_status: string | null;
};

interface Analytics {
  attempts: number;
  submissions: number;
  average: number;
  highest: number;
  lowest: number;
  passRate: number;
  questionStats: { id: string; text: string; marks: number; responses: number; correct: number; incorrect: number; accuracy: number }[];
  certificates: { total: number; generated: number; pending: number; failed: number; emailed: number };
}

export default function QuizEditorPage() {
  const { quizId = '' } = useParams();
  const { data, loading, error, reload } = useApi<QuizDetail>(quizId ? `/admin/quizzes/${quizId}` : null);
  const { can } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState('overview');
  const [questionModal, setQuestionModal] = useState<{ open: boolean; question?: Question }>({ open: false });
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: 'delete-question' | 'action'; question?: Question; action?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const quiz = data?.quiz;
  const questions = data?.questions ?? [];

  const totals = useMemo(() => {
    const marks = questions.reduce((sum, q) => sum + Number(q.marks), 0);
    return { questions: questions.length, marks };
  }, [questions]);

  const runAction = async (action: string) => {
    if (!quiz) return;
    setBusy(true);
    try {
      await api.post(`/admin/quizzes/${quiz.id}/actions`, { action });
      toast(`Quiz action “${action.replace(/_/g, ' ')}” applied.`, 'success');
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const moveQuestion = async (index: number, direction: -1 | 1) => {
    if (!quiz) return;
    const next = [...questions];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.post(`/admin/quizzes/${quiz.id}/questions/reorder`, { orderedIds: next.map((q) => q.id) });
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not reorder questions.', 'error');
    }
  };

  const removeQuestion = async () => {
    const question = confirm?.question;
    if (!question) return;
    setBusy(true);
    try {
      await api.del(`/admin/questions/${question.id}`);
      toast('Question removed.', 'success');
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove the question.', 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const importCsv = async () => {
    if (!quiz || !csv.trim()) return;
    setImportBusy(true);
    try {
      const result = await api.post<{ summary: { imported: number; skipped: { row: number; reason: string }[] } }>(
        `/admin/quizzes/${quiz.id}/questions/import`,
        { csv },
      );
      const skipped = result.summary.skipped ?? [];
      toast(
        `Imported ${result.summary.imported} question(s)${skipped.length ? `, skipped ${skipped.length} row(s)` : ''}.`,
        skipped.length ? 'info' : 'success',
      );
      setImportOpen(false);
      setCsv('');
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Import failed.', 'error');
    } finally {
      setImportBusy(false);
    }
  };

  const readFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
  };

  return (
    <AdminLayout
      title={quiz?.title ?? 'Quiz editor'}
      crumb={
        <Link to="/admin/quizzes" style={{ color: 'inherit' }}>
          ← All quizzes
        </Link>
      }
      actions={
        quiz ? (
          <>
            <Button size="sm" variant="subtle" onClick={() => window.open(`/present/${quiz.join_code}`, '_blank', 'noopener')}>
              <Icon name="qr" size={14} /> Projector
            </Button>
            <Button size="sm" variant="subtle" onClick={() => navigate(`/admin/quizzes/${quiz.id}/host`)}>
              <Icon name="play" size={14} /> Host console
            </Button>
          </>
        ) : null
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading && !data ? <Loading /> : null}

      {quiz && data ? (
        <>
          <div className="quiz-hero">
            <div style={{ minWidth: 240, flex: 1 }}>
              <div className="row-tight" style={{ marginBottom: 8 }}>
                <Badge tone={quizStatusTone(quiz.status)}>{statusLabel(quiz.status)}</Badge>
                <span className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>
                  Updated {formatDateTime(quiz.updated_at)}
                </span>
              </div>
              <h1>{quiz.title}</h1>
              <div className="meta">
                <span>{totals.questions} questions · {totals.marks} marks</span>
                <span>Duration {quiz.duration_minutes} min</span>
                <span>Pass {quiz.pass_percentage}%</span>
                <span>Join code <b style={{ color: 'var(--gold-300)' }}>{quiz.join_code}</b></span>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <div className="mini-stat">
                <b>{quiz.participantCount ?? 0}</b>
                <span>Registered</span>
              </div>
              <div className="mini-stat">
                <b>{quiz.submissionCount ?? 0}</b>
                <span>Submitted</span>
              </div>
              <div className="mini-stat">
                <b>{totals.questions}</b>
                <span>Questions</span>
              </div>
            </div>
            <div className="quiz-hero-actions">
              <CopyButton value={data.joinUrl} label="Copy join link" />
              {quiz.status === 'draft' && can('quiz_admin') ? (
                <Button variant="gold" size="sm" onClick={() => setConfirm({ kind: 'action', action: 'publish' })}>
                  Publish
                </Button>
              ) : null}
              {quiz.status === 'active' ? (
                <Button variant="gold" size="sm" onClick={() => setConfirm({ kind: 'action', action: 'pause' })}>
                  Pause
                </Button>
              ) : null}
              {quiz.status === 'paused' ? (
                <Button variant="gold" size="sm" onClick={() => setConfirm({ kind: 'action', action: 'resume' })}>
                  Resume
                </Button>
              ) : null}
            </div>
          </div>

          <Card noPad bodyClass="">
            <div style={{ padding: '0 16px' }}>
              <Tabs
                tabs={[
                  { id: 'overview', label: 'Details' },
                  { id: 'questions', label: 'Questions', badge: questions.length },
                  { id: 'participants', label: 'Participants', badge: quiz.participantCount ?? 0 },
                  { id: 'analytics', label: 'Analytics' },
                  { id: 'distribution', label: 'Join & QR' },
                ]}
                active={tab}
                onChange={setTab}
              />
            </div>
            <div className="card-body">
              {tab === 'overview' ? (
                <QuizForm
                  quiz={quiz}
                  onSaved={() => {
                    reload();
                    toast('Saved.', 'success');
                  }}
                />
              ) : null}

              {tab === 'questions' ? (
                <div>
                  <div className="row" style={{ marginBottom: 14 }}>
                    <div>
                      <h3 style={{ fontSize: 17 }}>Question bank</h3>
                      <div className="tiny muted">
                        {totals.questions} questions · {totals.marks} marks · answer keys never leave the server
                      </div>
                    </div>
                    <div className="spacer" />
                    <Button size="sm" variant="subtle" onClick={() => setImportOpen(true)} disabled={!can('quiz_admin')}>
                      <Icon name="upload" size={14} /> Import CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => downloadFile(`/admin/quizzes/${quiz.id}/questions/export.csv`, 'questions.csv').catch(() => toast('Export failed.', 'error'))}
                    >
                      <Icon name="download" size={14} /> Export
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => setQuestionModal({ open: true })} disabled={!can('quiz_admin')}>
                      <Icon name="plus" size={14} /> Add question
                    </Button>
                  </div>

                  {questions.length === 0 ? (
                    <EmptyState
                      icon="✎"
                      title="No questions yet"
                      message="Add questions individually or import a CSV. Each question needs at least two options and one correct answer."
                      action={
                        <Button variant="primary" onClick={() => setQuestionModal({ open: true })} disabled={!can('quiz_admin')}>
                          Add the first question
                        </Button>
                      }
                    />
                  ) : (
                    <div>
                      {questions.map((question, index) => (
                        <div className="question-item" key={question.id}>
                          <div className="question-index">{index + 1}</div>
                          <div className="question-body">
                            <div className="question-text">{question.text}</div>
                            <div className="row-tight" style={{ marginBottom: 8 }}>
                              <Badge tone="grey" dot={false}>
                                {question.type === 'multi' ? 'Multiple answers' : question.type === 'truefalse' ? 'True / False' : 'Single choice'}
                              </Badge>
                              <span className="tiny muted">{question.marks} mark{Number(question.marks) === 1 ? '' : 's'}</span>
                              <span className="tiny muted">· {question.difficulty}</span>
                              {question.image_url ? <span className="tiny muted">· image</span> : null}
                            </div>
                            <div className="option-grid">
                              {question.options.map((option, optionIndex) => (
                                <div key={option.id} className={`option-line ${option.is_correct ? 'correct' : ''}`}>
                                  <span className="opt-letter">{String.fromCharCode(65 + optionIndex)}</span>
                                  <span>{option.text}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="question-actions">
                            <div className="row-tight">
                              <button className="btn btn-ghost btn-sm btn-icon" disabled={index === 0} onClick={() => moveQuestion(index, -1)} title="Move up">
                                ↑
                              </button>
                              <button
                                className="btn btn-ghost btn-sm btn-icon"
                                disabled={index === questions.length - 1}
                                onClick={() => moveQuestion(index, 1)}
                                title="Move down"
                              >
                                ↓
                              </button>
                            </div>
                            <div className="row-tight">
                              <Button
                                size="sm"
                                variant="subtle"
                                onClick={() => setQuestionModal({ open: true, question })}
                                disabled={!can('quiz_admin')}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirm({ kind: 'delete-question', question })}
                                disabled={!can('quiz_admin')}
                                aria-label="Delete question"
                              >
                                <Icon name="trash" size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              {tab === 'participants' ? <ParticipantsTab quizId={quiz.id} /> : null}
              {tab === 'analytics' ? <AnalyticsTab quizId={quiz.id} /> : null}

              {tab === 'distribution' ? (
                <div className="grid grid-2">
                  <div>
                    <h3 style={{ fontSize: 17, marginBottom: 4 }}>Share the quiz</h3>
                    <p className="small muted">
                      Participants scan the QR code or open the short link and register with their college details.
                    </p>
                    <div className="stack" style={{ gap: 12, marginTop: 14 }}>
                      <div>
                        <div className="field-label">Join link</div>
                        <div className="row" style={{ gap: 6 }}>
                          <input className="input" readOnly value={data.joinUrl} onFocus={(e) => e.target.select()} />
                          <CopyButton value={data.joinUrl} />
                        </div>
                      </div>
                      <div>
                        <div className="field-label">Join code</div>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="code-chip" style={{ fontSize: 16 }}>{quiz.join_code}</span>
                          <CopyButton value={quiz.join_code} />
                        </div>
                      </div>
                      <div>
                        <div className="field-label">Projector view</div>
                        <div className="row" style={{ gap: 6 }}>
                          <input className="input" readOnly value={`${window.location.origin}${data.presentationUrl.replace(/^https?:\/\/[^/]+/, '')}`} />
                          <Button size="sm" variant="subtle" onClick={() => window.open(`/present/${quiz.join_code}`, '_blank', 'noopener')}>
                            Open
                          </Button>
                        </div>
                      </div>
                      <div className="anti-cheat-note">
                        <span>ℹ</span>
                        <span>
                          Rotate the join code after an event to close the old link. Existing registrations and results are
                          unaffected.
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={async () => {
                          try {
                            await api.post(`/admin/quizzes/${quiz.id}/join-code/regenerate`, { confirm: true });
                            toast('New join code generated.', 'success');
                            reload();
                          } catch (err) {
                            toast(err instanceof ApiError ? err.message : 'Could not rotate the code.', 'error');
                          }
                        }}
                      >
                        Rotate join code
                      </Button>
                    </div>
                  </div>
                  <div className="center">
                    <img
                      src={`/api/public/qr/${quiz.join_code}.png?size=520`}
                      alt={`QR code for ${quiz.title}`}
                      style={{ width: '100%', maxWidth: 320, borderRadius: 14, border: '1px solid var(--line)' }}
                    />
                    <div className="row" style={{ justifyContent: 'center', marginTop: 10 }}>
                      <Button size="sm" variant="subtle" onClick={() => window.open(`/api/admin/quizzes/${quiz.id}/qr.png?size=1400`, '_blank', 'noopener')}>
                        <Icon name="download" size={14} /> Download PNG
                      </Button>
                    </div>
                    <p className="tiny muted" style={{ marginTop: 10 }}>
                      Certificate preview ID · <span className="mono">{data.certificatePreviewId}</span>
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Modal
            open={questionModal.open}
            onClose={() => setQuestionModal({ open: false })}
            title={questionModal.question ? 'Edit question' : 'Add a question'}
            size="lg"
          >
            {questionModal.open ? (
              <QuestionForm
                quizId={quiz.id}
                question={questionModal.question}
                onCancel={() => setQuestionModal({ open: false })}
                onSaved={() => {
                  setQuestionModal({ open: false });
                  reload();
                }}
              />
            ) : null}
          </Modal>

          <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import questions from CSV" size="lg">
            <div className="alert alert-info">
              Columns: <b>question, option_a, option_b, option_c, option_d, option_e, option_f, correct, type, marks, negative_marks, difficulty, explanation</b>.
              <br />
              <span className="tiny">
                Separate multiple correct letters with <code>;</code> (for multiple-answer questions) and wrap values
                containing commas in double quotes. Download the template to start.
              </span>
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <Button
                size="sm"
                variant="subtle"
                onClick={() =>
                  downloadFile('/admin/quizzes/template.csv', 'quiz_questions_template.csv').catch(() => undefined)
                }
              >
                Download blank template
              </Button>
              <Button size="sm" variant="subtle" onClick={() => fileRef.current?.click()}>
                Choose file…
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void readFile(file);
                }}
              />
            </div>
            <Textarea
              label="CSV content"
              rows={10}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
              placeholder={'question,option_a,option_b,answer,correct,...\n"What is 2+2?","3","4","4","B"...'}
              className="mono"
            />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="subtle" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={importCsv} loading={importBusy} disabled={!csv.trim()}>
                Import questions
              </Button>
            </div>
          </Modal>

          <ConfirmDialog
            open={Boolean(confirm)}
            busy={busy}
            title={confirm?.kind === 'delete-question' ? 'Delete this question?' : `Apply “${confirm?.action?.replace(/_/g, ' ')}”?`}
            message={
              confirm?.kind === 'delete-question' ? (
                <>The question and its options are removed. Existing attempt records keep their saved answers.</>
              ) : confirm?.action === 'publish' ? (
                <>Participants will be able to register and join immediately. You can pause or end the quiz from the host console.</>
              ) : (
                <>This changes the quiz lifecycle state. The action is recorded in the audit trail.</>
              )
            }
            confirmLabel={confirm?.kind === 'delete-question' ? 'Delete question' : 'Apply'}
            tone={confirm?.kind === 'delete-question' ? 'danger' : 'primary'}
            onClose={() => setConfirm(null)}
            onConfirm={() => {
              if (confirm?.kind === 'delete-question') void removeQuestion();
              else if (confirm?.action) void runAction(confirm.action);
            }}
          />
        </>
      ) : null}
    </AdminLayout>
  );
}

function ParticipantsTab({ quizId }: { quizId: string }) {
  const { data, loading, error } = useApi<{ participants: ParticipantRow[] }>(`/admin/quizzes/${quizId}/participants`);
  const rows = data?.participants ?? [];

  if (loading && !data) return <Loading />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!rows.length)
    return (
      <EmptyState
        icon="◎"
        title="No registrations yet"
        message="Share the join link or display the QR code in the projector view. New registrations appear here in real time."
      />
    );

  return (
    <div className="table-wrap" style={{ margin: '-18px -20px' }}>
      <table className="table">
        <thead>
          <tr>
            <th>Participant</th>
            <th>Register no.</th>
            <th>Status</th>
            <th>Score</th>
            <th>Flags</th>
            <th>Certificate</th>
            <th>Registered</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="cell-strong">{row.name}</div>
                <div className="cell-sub">{row.email}</div>
              </td>
              <td className="mono small">{row.reg_number ?? '—'}</td>
              <td>
                {row.status ? <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge> : <Badge tone="grey">Not started</Badge>}
              </td>
              <td>
                {row.percentage !== null ? (
                  <>
                    <div className="cell-strong">{percent(row.percentage)}</div>
                    <div className="cell-sub">
                      {row.score}/{row.total_marks} · {row.passed ? 'Pass' : 'Fail'}
                    </div>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>{row.violations_count ? <Badge tone="amber">{row.violations_count}</Badge> : <span className="muted">0</span>}</td>
              <td>
                {row.certificate_id ? (
                  <>
                    <Badge tone={statusTone(row.certificate_status)}>{statusLabel(row.certificate_status)}</Badge>
                    <div className="cell-sub mono">{row.certificate_id}</div>
                  </>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td className="muted small">{formatDateTime(row.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsTab({ quizId }: { quizId: string }) {
  const { data, loading, error } = useApi<{ analytics: Analytics }>(`/admin/quizzes/${quizId}/analytics`);

  if (loading && !data) return <Loading />;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  const a = data.analytics;
  return (
    <div>
      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">Submissions</div>
          <div className="stat-value">{a.submissions}</div>
          <div className="stat-meta">{a.attempts} attempts started</div>
        </div>
        <div className="stat">
          <div className="stat-label">Pass rate</div>
          <div className="stat-value">{percent(a.passRate)}</div>
          <div className="stat-meta">pass mark applied on submit</div>
        </div>
        <div className="stat">
          <div className="stat-label">Average</div>
          <div className="stat-value">{percent(a.average)}</div>
          <div className="stat-meta">low {percent(a.lowest)} · high {percent(a.highest)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Certificates</div>
          <div className="stat-value">{a.certificates.generated}</div>
          <div className="stat-meta">
            {a.certificates.pending} pending · {a.certificates.failed} failed
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 10 }}>Question-wise accuracy</h3>
      {a.questionStats.length === 0 ? (
        <EmptyState icon="◫" title="No questions" message="Add questions to see item-level analytics." />
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {a.questionStats.map((q, index) => (
            <div key={q.id}>
              <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontSize: 13.2 }}>
                  <span className="muted mono tiny">Q{index + 1}</span> {q.text.length > 120 ? `${q.text.slice(0, 120)}…` : q.text}
                </div>
                <div className="small nowrap">
                  <b>{q.accuracy.toFixed(1)}%</b> <span className="muted">({q.correct}/{q.responses})</span>
                </div>
              </div>
              <div className="progress" style={{ marginTop: 5 }}>
                <span
                  style={{
                    width: `${Math.min(100, q.accuracy)}%`,
                    background: q.accuracy >= 70 ? 'var(--green-600)' : q.accuracy >= 40 ? 'var(--gold-500)' : 'var(--red-600)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
