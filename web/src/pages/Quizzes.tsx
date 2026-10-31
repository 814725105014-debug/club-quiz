import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Select,
  useToast,
} from '../components/ui';
import { QuizForm } from '../components/QuizForm';
import { useApi } from '../lib/hooks';
import { api, ApiError } from '../lib/api';
import { formatDateTime, quizStatusTone, statusLabel } from '../lib/format';
import type { Quiz } from '../lib/types';
import { Icon } from '../components/Icon';
import { useSession } from '../lib/session';

export default function QuizzesPage() {
  const { data, loading, error, reload } = useApi<{ quizzes: Quiz[] }>('/admin/quizzes');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [manage, setManage] = useState<Quiz | null>(null);
  const [confirm, setConfirm] = useState<{ quiz: Quiz; action: 'delete' | 'archive' | 'unarchive' | 'publish' | 'duplicate' } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useSession();

  const quizzes = useMemo(() => {
    const list = data?.quizzes ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((q) => {
      const matchesTerm = !term || q.title.toLowerCase().includes(term) || q.join_code.toLowerCase().includes(term);
      const matchesStatus = !status || q.status === status;
      return matchesTerm && matchesStatus;
    });
  }, [data, search, status]);

  const runAction = async () => {
    if (!confirm) return;
    const { quiz, action } = confirm;
    setBusy(true);
    try {
      if (action === 'delete') {
        await api.del(`/admin/quizzes/${quiz.id}`);
        toast('Quiz deleted.', 'success');
      } else if (action === 'duplicate') {
        const copy = await api.post<{ quiz: Quiz }>(`/admin/quizzes/${quiz.id}/duplicate`);
        toast(`Duplicated as “${copy.quiz.title}”.`, 'success');
        navigate(`/admin/quizzes/${copy.quiz.id}`);
      } else if (action === 'publish') {
        await api.post(`/admin/quizzes/${quiz.id}/actions`, { action: 'publish' });
        toast('Quiz published — registration is now open.', 'success');
      } else {
        await api.post(`/admin/quizzes/${quiz.id}/actions`, { action });
        toast(action === 'archive' ? 'Quiz archived.' : 'Quiz restored to draft.', 'success');
      }
      reload();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(false);
      setConfirm(null);
      setManage(null);
    }
  };

  const downloadQr = (quiz: Quiz) => {
    window.open(`/api/admin/quizzes/${quiz.id}/qr.png?size=1000`, '_blank', 'noopener');
  };

  return (
    <AdminLayout
      title="Quizzes"
      crumb="Assessment catalogue"
      actions={
        can('quiz_admin') ? (
          <Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={14} /> New quiz
          </Button>
        ) : null
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <Card>
        <div className="row" style={{ marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
            <Input
              placeholder="Search title or join code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 34 }}
            />
            <span style={{ position: 'absolute', left: 11, top: 10, color: 'var(--muted)' }}>
              <Icon name="search" size={15} />
            </span>
          </div>
          <div className="segmented">
            {[
              ['', 'All'],
              ['draft', 'Draft'],
              ['published', 'Published'],
              ['active', 'Live'],
              ['completed', 'Completed'],
            ].map(([value, label]) => (
              <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>
                {label}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <span className="tiny muted">{quizzes.length} quiz{quizzes.length === 1 ? '' : 'zes'}</span>
        </div>

        {loading && !data ? (
          <Loading />
        ) : quizzes.length === 0 ? (
          <EmptyState
            icon="◇"
            title={data?.quizzes.length ? 'No quizzes match this filter' : 'Create your first quiz'}
            message={
              data?.quizzes.length
                ? 'Try a different search term or clear the status filter.'
                : 'Add questions, set a schedule and publish. Participants join with a six-character code or QR scan.'
            }
            action={
              can('quiz_admin') ? (
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  New quiz
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Status</th>
                  <th>Questions</th>
                  <th>Participants</th>
                  <th>Submissions</th>
                  <th>Join code</th>
                  <th>Opens</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id}>
                    <td>
                      <Link to={`/admin/quizzes/${quiz.id}`} className="cell-strong" style={{ color: 'inherit' }}>
                        {quiz.title}
                      </Link>
                      <div className="cell-sub">
                        {quiz.duration_minutes} min · pass {quiz.pass_percentage}%
                        {quiz.archived_at ? ' · archived' : ''}
                      </div>
                    </td>
                    <td>
                      <Badge tone={quizStatusTone(quiz.status)}>{statusLabel(quiz.status)}</Badge>
                    </td>
                    <td>{quiz.totalQuestions ?? 0}</td>
                    <td>{quiz.participantCount ?? 0}</td>
                    <td>{quiz.submissionCount ?? 0}</td>
                    <td>
                      <span className="code-chip">{quiz.join_code}</span>
                    </td>
                    <td className="muted small">{quiz.start_at ? formatDateTime(quiz.start_at) : 'Anytime'}</td>
                    <td className="right">
                      <div className="row-tight" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="subtle" onClick={() => navigate(`/admin/quizzes/${quiz.id}/host`)}>
                          <Icon name="play" size={12} /> Host
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setManage(quiz)} aria-label="More actions">
                          <Icon name="settings" size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a quiz" size="lg">
        <QuizForm
          savingLabel="Create quiz"
          onSaved={(quiz) => {
            setCreateOpen(false);
            navigate(`/admin/quizzes/${quiz.id}`);
          }}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>

      <Modal open={Boolean(manage)} onClose={() => setManage(null)} title={manage?.title ?? 'Manage quiz'}>
        {manage ? (
          <div className="stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small muted">Join code</span>
              <div className="row-tight">
                <span className="code-chip">{manage.join_code}</span>
                <CopyButton value={`${window.location.origin}/j/${manage.join_code}`} label="Copy link" />
              </div>
            </div>
            <div className="grid grid-2" style={{ gap: 8 }}>
              <Button variant="subtle" onClick={() => navigate(`/admin/quizzes/${manage.id}`)}>
                <Icon name="edit" size={14} /> Open editor
              </Button>
              <Button variant="subtle" onClick={() => navigate(`/admin/quizzes/${manage.id}/host`)}>
                <Icon name="play" size={14} /> Host console
              </Button>
              <Button variant="subtle" onClick={() => window.open(`/present/${manage.join_code}`, '_blank', 'noopener')}>
                <Icon name="qr" size={14} /> Projector view
              </Button>
              <Button variant="subtle" onClick={() => downloadQr(manage)}>
                <Icon name="download" size={14} /> Download QR
              </Button>
              <Button
                variant="subtle"
                onClick={() => setConfirm({ quiz: manage, action: 'duplicate' })}
                disabled={!can('quiz_admin')}
              >
                <Icon name="copy" size={14} /> Duplicate
              </Button>
              {manage.status === 'draft' ? (
                <Button variant="primary" onClick={() => setConfirm({ quiz: manage, action: 'publish' })} disabled={!can('quiz_admin')}>
                  <Icon name="check" size={14} /> Publish
                </Button>
              ) : (
                <Button
                  variant="subtle"
                  onClick={() => setConfirm({ quiz: manage, action: manage.archived_at ? 'unarchive' : 'archive' })}
                  disabled={!can('quiz_admin')}
                >
                  <Icon name="stop" size={14} /> {manage.archived_at ? 'Restore' : 'Archive'}
                </Button>
              )}
            </div>
            <hr className="divider" />
            <Button variant="danger" block onClick={() => setConfirm({ quiz: manage, action: 'delete' })} disabled={!can('quiz_admin')}>
              <Icon name="trash" size={14} /> Delete quiz
            </Button>
            <div className="tiny muted">
              Deletion is blocked once participants have attempted the quiz — archive it instead so records remain
              auditable.
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        busy={busy}
        title={
          confirm?.action === 'delete'
            ? 'Delete this quiz?'
            : confirm?.action === 'publish'
              ? 'Publish this quiz?'
              : confirm?.action === 'duplicate'
                ? 'Duplicate this quiz?'
                : confirm?.action === 'archive'
                  ? 'Archive this quiz?'
                  : 'Restore this quiz?'
        }
        message={
          confirm?.action === 'delete' ? (
            <>
              <b>{confirm.quiz.title}</b> and its questions will be permanently removed. This is only possible while no
              attempts exist.
            </>
          ) : confirm?.action === 'publish' ? (
            <>
              Registration opens immediately and participants can join with code <b>{confirm.quiz.join_code}</b>. Make sure
              questions and scoring are final.
            </>
          ) : confirm?.action === 'duplicate' ? (
            <>A draft copy will be created with the same questions but a fresh join code.</>
          ) : confirm?.action === 'archive' ? (
            <>Archived quizzes disappear from the live console; records and certificates remain intact.</>
          ) : (
            <>The quiz returns to draft so you can edit it before publishing again.</>
          )
        }
        confirmLabel={confirm?.action === 'delete' ? 'Delete permanently' : 'Continue'}
        tone={confirm?.action === 'delete' ? 'danger' : 'primary'}
        onConfirm={runAction}
        onClose={() => setConfirm(null)}
      />
    </AdminLayout>
  );
}
