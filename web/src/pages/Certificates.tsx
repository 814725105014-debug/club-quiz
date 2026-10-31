import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Input, Loading, Select, StatCard, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api, downloadFile } from '../lib/api';
import { apiErrorMessage, formatDateTime } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSession } from '../lib/session';
import type { CertificateRecord, Quiz } from '../lib/types';

export default function Certificates() {
  const toast = useToast();
  const { can } = useSession();
  const quizzes = useApi<{ quizzes: Quiz[] }>('/admin/quizzes');
  const [quizId, setQuizId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = new URLSearchParams({
    ...(quizId ? { quizId } : {}),
    ...(status ? { status } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }).toString();

  const { data, loading, error, reload } = useApi<{ certificates: CertificateRecord[] }>(
    `/admin/certificates?${query}`,
    [quizId, status, search],
  );

  const rows = data?.certificates ?? [];
  const counts = {
    generated: rows.filter((c) => c.status === 'generated').length,
    pending: rows.filter((c) => c.status === 'pending' || c.status === 'generating').length,
    failed: rows.filter((c) => c.status === 'failed').length,
    emailed: rows.filter((c) => c.email_status === 'sent' || c.email_status === 'redirected').length,
  };

  const act = async (id: string, action: 'retry' | 'retry-email' | 'regenerate', message: string) => {
    setBusyId(id);
    try {
      await api.post(`/admin/certificates/${id}/${action}`);
      toast(message, 'success');
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const download = async (row: CertificateRecord) => {
    try {
      await downloadFile(`/admin/certificates/${row.id}/download`, `${row.certificate_id.replace(/[^A-Za-z0-9]+/g, '-')}.pdf`);
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  return (
    <AdminLayout
      title="Certificates"
      crumb="Delivery · automated certification"
      actions={
        <Button variant="subtle" size="sm" onClick={reload}>
          <Icon name="spark" size={14} /> Refresh status
        </Button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="Generated" value={counts.generated} meta="PDF in Drive folder" icon={<Icon name="certificate" />} />
        <StatCard label="In progress" value={counts.pending} meta="Slides → PDF → Drive" />
        <StatCard label="Failed" value={counts.failed} meta="Retry after fixing" />
        <StatCard label="Emailed" value={counts.emailed} meta="Sent or redirected" />
      </div>

      <div className="callout callout-gold" style={{ marginBottom: 16 }}>
        <b>Generated from your existing template</b>
        Each certificate copies the college Slides template, replaces the approved placeholders, exports a PDF into the
        configured Drive folder, writes the row to the spreadsheet and emails the participant. The template itself is never
        modified.
      </div>

      <Card
        title="Issued certificates"
        subtitle="Certificate ID, delivery and error state for every attempt."
        noPad
      >
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <Input placeholder="Search participant or certificate ID…" value={search} onChange={(e) => setSearch(e.target.value)} className="grow" />
          <Select value={quizId} onChange={(e) => setQuizId(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">All quizzes</option>
            {(quizzes.data?.quizzes ?? []).map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 160 }}>
            <option value="">All statuses</option>
            <option value="generated">Generated</option>
            <option value="pending">Pending</option>
            <option value="generating">Generating</option>
            <option value="failed">Failed</option>
          </Select>
        </div>

        {loading && !data ? (
          <Loading label="Loading certificates…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="🎓"
            title="No certificates issued yet"
            message="Certificates are created automatically when an attempt meets the quiz's certificate rule."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Certificate</th>
                  <th>Participant</th>
                  <th>Quiz</th>
                  <th>Generation</th>
                  <th>Email</th>
                  <th>Issued</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="small mono strong">{row.certificate_id}</div>
                      <div className="tiny muted">{row.slide_file_id ? `slide ${row.slide_file_id.slice(0, 12)}…` : 'no slide copy'}</div>
                    </td>
                    <td>
                      <div className="strong small">{row.participant_name}</div>
                      <div className="tiny muted">{row.participant_email}</div>
                      <div className="tiny muted mono">{row.reg_number ?? ''}</div>
                    </td>
                    <td className="small" style={{ maxWidth: '20ch' }}>{row.quiz_title}</td>
                    <td>
                      <Badge tone={row.status === 'generated' ? 'green' : row.status === 'failed' ? 'red' : 'amber'}>{row.status}</Badge>
                      {row.error ? <div className="tiny" style={{ color: 'var(--red-600)', maxWidth: '26ch' }}>{row.error}</div> : null}
                    </td>
                    <td>
                      <Badge tone={row.email_status === 'sent' || row.email_status === 'redirected' ? 'green' : row.email_status === 'failed' ? 'red' : 'grey'}>
                        {row.email_status}
                      </Badge>
                      {row.email_error ? <div className="tiny" style={{ color: 'var(--red-600)' }}>{row.email_error}</div> : null}
                    </td>
                    <td className="small">{row.issued_at ? formatDateTime(row.issued_at) : '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {row.status === 'generated' ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => void download(row)} title="Download PDF">
                            <Icon name="download" size={14} />
                          </Button>
                          <Link className="btn btn-ghost btn-sm" to={`/verify/${encodeURIComponent(row.certificate_id)}`} target="_blank">
                            Verify
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!can('quiz_admin') || busyId === row.id}
                            onClick={() => void act(row.id, 'retry-email', 'Certificate email re-queued.')}
                          >
                            Resend
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!can('quiz_admin') || busyId === row.id}
                          onClick={() => void act(row.id, 'retry', 'Certificate regeneration queued.')}
                        >
                          Retry
                        </Button>
                      )}
                      {can('quiz_admin') ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.id}
                          onClick={() => {
                            if (window.confirm(`Regenerate ${row.certificate_id}? The same certificate ID is reused and the PDF is replaced.`)) {
                              void act(row.id, 'regenerate', 'Certificate regeneration queued.');
                            }
                          }}
                          title="Regenerate the PDF with the same certificate ID"
                        >
                          <Icon name="spark" size={13} />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-2" style={{ marginTop: 16 }}>
        <Card title="How issuance works" subtitle="Fully automated, resumable and auditable.">
          <ol className="steps">
            <li>Attempt is graded server-side; the certificate rule decides eligibility.</li>
            <li>The next certificate number is reserved atomically and formatted as <span className="mono">{'{PREFIX}-{YEAR}-{NNNN}'}</span>.</li>
            <li>The Slides template is copied, placeholders replaced and a PDF exported to the Drive folder.</li>
            <li>The Form Responses row is upserted by Certificate ID and the participant is emailed.</li>
            <li>Any failure retries with backoff; the coordinator can retry or regenerate manually.</li>
          </ol>
        </Card>
        <Card title="Verification" subtitle="Publicly checkable without exposing other records.">
          <p className="small">
            Each certificate carries a QR code and a verification URL. Anyone can confirm the holder’s name, course and
            issue date — never scores, email addresses or other participants.
          </p>
          <Link to="/verify" className="btn btn-subtle btn-sm" target="_blank">
            Open verification page <Icon name="external" size={13} />
          </Link>
        </Card>
      </div>
    </AdminLayout>
  );
}
