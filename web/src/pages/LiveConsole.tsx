import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Loading } from '../components/ui';
import { Icon } from '../components/Icon';
import { useApi, usePolling } from '../lib/hooks';
import { formatDateTime, quizStatusTone, statusLabel } from '../lib/format';
import type { Quiz } from '../lib/types';
import { useToast } from '../components/ui';

interface QuizzesResponse {
  quizzes: Quiz[];
}

export default function LiveConsole() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<QuizzesResponse>('/admin/quizzes');
  usePolling(reload, 12_000);

  const quizzes = (data?.quizzes ?? []).filter((q) => ['active', 'paused', 'published', 'scheduled'].includes(q.status));
  const live = quizzes.filter((q) => q.status === 'active' || q.status === 'paused');

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied.`, 'success');
    } catch {
      window.prompt(`Copy ${label}:`, value);
    }
  };

  return (
    <AdminLayout title="Live console" crumb="Delivery · hosting & projectors">
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading && !data ? (
        <Loading label="Loading sessions…" />
      ) : (
        <>
          <div className="callout callout-gold" style={{ marginBottom: 16 }}>
            <b>Project the join instructions, not the quiz.</b> Open a quiz’s Presentation mode on the projector; students
            scan the QR or open the join link on their phones. Live counters update every few seconds.
          </div>

          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <div className="stat">
              <div className="stat-label">Live now</div>
              <div className="stat-value">{live.filter((q) => q.status === 'active').length}</div>
              <div className="stat-meta">{live.filter((q) => q.status === 'paused').length} paused</div>
            </div>
            <div className="stat">
              <div className="stat-label">Upcoming / published</div>
              <div className="stat-value">{quizzes.filter((q) => q.status !== 'active' && q.status !== 'paused').length}</div>
              <div className="stat-meta">Scheduled or open for registration</div>
            </div>
          </div>

          <Card title="Sessions" subtitle="Start the quiz from the host panel, then open Presentation mode." noPad>
            {quizzes.length === 0 ? (
              <EmptyState
                icon="▶"
                title="Nothing to host right now"
                message="Publish a quiz first. Published quizzes appear here with their join link and projector."
                action={
                  <Link to="/admin/quizzes" className="btn btn-primary btn-sm">
                    Go to quizzes
                  </Link>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Quiz</th>
                      <th>Status</th>
                      <th>Join code</th>
                      <th>Start / duration</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quizzes.map((quiz) => (
                      <tr key={quiz.id}>
                        <td>
                          <Link to={`/admin/quizzes/${quiz.id}`} className="strong">
                            {quiz.title}
                          </Link>
                          <div className="tiny muted">
                            {quiz.totalQuestions ?? 0} questions · {quiz.totalMarks ?? 0} marks
                          </div>
                        </td>
                        <td>
                          <Badge tone={quizStatusTone(quiz.status)}>{statusLabel(quiz.status)}</Badge>
                        </td>
                        <td>
                          <button className="code-chip" onClick={() => void copy(quiz.join_code, 'Join code')}>
                            {quiz.join_code}
                            <Icon name="copy" size={12} />
                          </button>
                        </td>
                        <td>
                          <div className="small">{formatDateTime(quiz.start_at)}</div>
                          <div className="tiny muted">{quiz.duration_minutes} minutes</div>
                        </td>
                        <td>
                          <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                            <Link className="btn btn-subtle btn-sm" to={`/present/${quiz.join_code}`} target="_blank">
                              <Icon name="qr" size={13} /> Present
                            </Link>
                            <Link className="btn btn-primary btn-sm" to={`/admin/quizzes/${quiz.id}/host`}>
                              <Icon name="play" size={13} /> Host
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <Card title="Projector checklist" subtitle="What a coordinator should confirm before opening the hall">
              <ol className="steps">
                <li>Publish the quiz and confirm the join code on the projector matches the host panel.</li>
                <li>Ask students to register before the start time; registration closes automatically at the quiz end.</li>
                <li>Open Presentation mode and enter fullscreen (F11) — the QR must be scannable from the back row.</li>
                <li>Start the quiz only after announcing the rules; the timer starts per student, on the server.</li>
              </ol>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => window.open(window.location.origin + '/admin/quizzes', '_blank')}
                style={{ marginTop: 10 }}
              >
                Open quiz manager in a new tab
              </Button>
            </Card>
            <Card title="Proctoring disclosure" subtitle="What the platform can and cannot see">
              <p className="small">
                The web app logs tab switches, window blur, copy/paste and context-menu events. It cannot block OS gestures,
                app switching, screenshots or a second device. Use the flagged-attempt list during review, not as proof of
                misconduct.
              </p>
              <p className="small muted">
                For stricter delivery, see <b>docs/SECURE_DELIVERY.md</b> for the kiosk / secure-browser comparison.
              </p>
            </Card>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
