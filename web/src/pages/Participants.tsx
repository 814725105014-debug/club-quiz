import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Modal, Select, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api, downloadFile } from '../lib/api';
import { apiErrorMessage, formatDateTime, initials, percent } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { ParticipantRecord, Quiz } from '../lib/types';

interface ParticipantRow extends ParticipantRecord {
  quiz_title: string;
  quiz_id: string;
  attempt_status: string | null;
  reg_number: string | null;
  department: string | null;
  violations_count: number;
}

export default function Participants() {
  const toast = useToast();
  const quizzes = useApi<{ quizzes: Quiz[] }>('/admin/quizzes');
  const [quizId, setQuizId] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ParticipantRow | null>(null);

  const query = new URLSearchParams({
    ...(quizId ? { quizId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
  }).toString();

  const { data, loading, error, reload } = useApi<{ participants: ParticipantRow[] }>(
    `/admin/participants?${query}`,
    [quizId, search],
  );

  const rows = data?.participants ?? [];

  const exportCsv = async () => {
    try {
      await downloadFile('/admin/participants/export.csv', 'participants.csv');
      toast('Participant list downloaded.', 'success');
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  const syncAttempt = async (attemptId: string | null) => {
    if (!attemptId) return;
    try {
      await api.post(`/admin/sync/attempt/${attemptId}`);
      toast('Result row queued for spreadsheet sync.', 'success');
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  return (
    <AdminLayout
      title="Participants"
      crumb="Delivery · registration records"
      actions={
        <Button variant="subtle" size="sm" onClick={exportCsv}>
          <Icon name="download" size={14} /> Export CSV
        </Button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card
        title="Registered participants"
        subtitle="Records are stored in the platform database; edits propagate to the spreadsheet and certificates."
        noPad
      >
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <Input
            placeholder="Search name, email or register number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="grow"
          />
          <Select value={quizId} onChange={(e) => setQuizId(e.target.value)} style={{ minWidth: 220 }}>
            <option value="">All quizzes</option>
            {(quizzes.data?.quizzes ?? []).map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </Select>
          <span className="tiny muted">{rows.length} record(s)</span>
        </div>

        {loading && !data ? (
          <Loading label="Loading participants…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="◍"
            title="No registrations found"
            message="Participants appear here as soon as they register from the join link or QR code."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Register no.</th>
                  <th>Department</th>
                  <th>Quiz</th>
                  <th>Attempt</th>
                  <th>Score</th>
                  <th>Certificate</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.id}-${row.attempt_id ?? 'none'}`}>
                    <td>
                      <div className="row" style={{ gap: 9 }}>
                        <div className="avatar">{initials(row.name)}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="strong small">{row.name}</div>
                          <div className="tiny muted">{row.email}</div>
                          <div className="tiny muted">Registered {formatDateTime(row.created_at)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="small mono">{row.reg_number ?? '—'}</td>
                    <td className="small">{row.department ?? '—'}</td>
                    <td className="small" style={{ maxWidth: '22ch' }}>
                      {row.quiz_title}
                    </td>
                    <td>
                      <Badge
                        tone={
                          row.attempt_status === 'submitted'
                            ? 'green'
                            : row.attempt_status === 'in_progress'
                              ? 'blue'
                              : row.attempt_status === 'auto_submitted'
                                ? 'amber'
                                : 'grey'
                        }
                      >
                        {row.attempt_status ?? 'not started'}
                      </Badge>
                      {row.violations_count ? <div className="tiny muted">{row.violations_count} flags</div> : null}
                    </td>
                    <td className="small">
                      {row.percentage === null || row.percentage === undefined ? (
                        '—'
                      ) : (
                        <>
                          <div className="strong">{percent(row.percentage)}</div>
                          <div className="tiny muted">
                            {row.score ?? 0}/{row.total_marks ?? 0} · {row.passed ? 'pass' : 'fail'}
                          </div>
                        </>
                      )}
                    </td>
                    <td>
                      {row.certificate_status ? (
                        <>
                          <Badge tone={row.certificate_status === 'generated' ? 'green' : row.certificate_status === 'failed' ? 'red' : 'amber'}>
                            {row.certificate_status}
                          </Badge>
                          {row.certificate_id ? <div className="tiny mono muted">{row.certificate_id}</div> : null}
                        </>
                      ) : (
                        <span className="tiny muted">—</span>
                      )}
                    </td>
                    <td className="tiny">{row.email_status ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Edit
                      </Button>
                      {row.attempt_id ? (
                        <Button size="sm" variant="ghost" onClick={() => void syncAttempt(row.attempt_id)} title="Queue spreadsheet sync">
                          <Icon name="sheet" size={13} />
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

      <EditParticipant
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast('Participant updated and spreadsheet sync queued.', 'success');
          reload();
        }}
      />
    </AdminLayout>
  );
}

function EditParticipant({
  row,
  onClose,
  onSaved,
}: {
  row: ParticipantRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', regNumber: '', department: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (row) {
      setForm({
        name: row.name,
        email: row.email,
        regNumber: row.reg_number ?? '',
        department: row.department ?? '',
      });
    }
  }, [row]);

  const submit = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await api.patch(`/admin/participants/${row.id}`, {
        name: form.name,
        email: form.email,
        regNumber: form.regNumber || null,
        department: form.department || null,
      });
      onSaved();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title="Edit participant"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Save participant
          </Button>
        </>
      }
    >
      <Field label="Full name" hint="Name as it should appear on the certificate.">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Email address">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <div className="grid grid-2">
        <Field label="Register number">
          <Input value={form.regNumber} onChange={(e) => setForm({ ...form, regNumber: e.target.value })} />
        </Field>
        <Field label="Department">
          <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
        </Field>
      </div>
      <p className="tiny muted">
        Changes are audited and re-queued for spreadsheet sync. Existing issued certificates keep the name they were
        issued with; regenerate a certificate if the printed name must change.
      </p>
    </Modal>
  );
}
