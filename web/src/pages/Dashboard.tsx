import { Link, useNavigate } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import { Badge, Card, EmptyState, Loading, StatCard, Button } from '../components/ui';
import { useApi } from '../lib/hooks';
import { formatDateTime, percent, quizStatusTone, relativeTime, statusLabel } from '../lib/format';
import type { DashboardStats } from '../lib/types';
import { Icon } from '../components/Icon';

export default function DashboardPage() {
  const { data, loading, error } = useApi<DashboardStats>('/admin/dashboard');
  const navigate = useNavigate();

  return (
    <AdminLayout
      title="Dashboard"
      crumb="Command centre"
      actions={
        <>
          <Link to="/admin/live" className="btn btn-subtle btn-sm">
            <Icon name="play" size={14} /> Live console
          </Link>
          <Link to="/admin/quizzes" className="btn btn-primary btn-sm">
            <Icon name="plus" size={14} /> New quiz
          </Link>
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading && !data ? (
        <Loading label="Loading the command centre…" />
      ) : data ? (
        <>
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <StatCard
              label="Published quizzes"
              value={data.stats.quizzes.published ?? 0}
              meta={`${data.stats.quizzes.active ?? 0} live · ${data.stats.quizzes.draft ?? 0} draft`}
              icon={<Icon name="quiz" />}
            />
            <StatCard
              label="Registrations"
              value={data.stats.participants}
              meta={`${data.stats.attempts} attempts started`}
              icon={<Icon name="users" />}
            />
            <StatCard
              label="Submissions"
              value={data.stats.submissions}
              meta={`Average ${percent(data.stats.averageScore)}`}
              icon={<Icon name="chart" />}
            />
            <StatCard
              label="Certificates"
              value={data.stats.certificates.generated}
              meta={`${data.stats.certificates.emailed} delivered · ${data.stats.certificates.pending} pending`}
              icon={<Icon name="certificate" />}
            />
          </div>

          <div className="grid grid-sidebar">
            <div className="stack" style={{ gap: 16 }}>
              <Card
                title="Upcoming & live sessions"
                subtitle="Scheduled, published and running assessments"
                actions={
                  <Link to="/admin/quizzes" className="btn btn-ghost btn-sm">
                    All quizzes <Icon name="external" size={13} />
                  </Link>
                }
                noPad
              >
                {data.upcoming.length === 0 ? (
                  <EmptyState
                    icon="◷"
                    title="No sessions scheduled"
                    message="Create a quiz, add questions and publish it to open registration."
                    action={<Link className="btn btn-primary btn-sm" to="/admin/quizzes">Create a quiz</Link>}
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Quiz</th>
                          <th>Status</th>
                          <th>Starts</th>
                          <th>Join code</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {data.upcoming.map((quiz) => (
                          <tr key={quiz.id}>
                            <td className="cell-strong">{quiz.title}</td>
                            <td>
                              <Badge tone={quizStatusTone(quiz.status)}>{statusLabel(quiz.status)}</Badge>
                            </td>
                            <td className="muted small">{quiz.start_at ? formatDateTime(quiz.start_at) : 'Manual'}</td>
                            <td>
                              <span className="code-chip">{quiz.join_code}</span>
                            </td>
                            <td className="right">
                              <div className="row-tight" style={{ justifyContent: 'flex-end' }}>
                                <Button size="sm" variant="subtle" onClick={() => navigate(`/admin/quizzes/${quiz.id}/host`)}>
                                  Host
                                </Button>
                                <Button size="sm" variant="subtle" onClick={() => navigate(`/admin/quizzes/${quiz.id}`)}>
                                  Open
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

              <Card title="Recent activity" subtitle="Every administrative action is recorded in the audit trail">
                {data.activity.length === 0 ? (
                  <EmptyState icon="◌" title="Quiet in here" message="Actions you take will appear here." />
                ) : (
                  <div className="feed">
                    {data.activity.map((entry) => (
                      <div className="feed-item" key={entry.id}>
                        <span className="feed-time">{relativeTime(entry.created_at)}</span>
                        <span>
                          <b style={{ fontWeight: 600 }}>{entry.action.replace(/[._]/g, ' ')}</b>
                          {entry.entity ? <span className="muted"> · {entry.entity}</span> : null}
                          <span className="muted tiny" style={{ display: 'block' }}>
                            {entry.actor_email ?? 'system'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div className="stack" style={{ gap: 16 }}>
              <Card title="Workspace health" subtitle="Google integrations & queues">
                <div className="stack" style={{ gap: 12 }}>
                  <HealthRow label="Certificate approvals" value={`${data.stats.certificates.generated} generated`} tone="green" />
                  <HealthRow
                    label="Email delivery"
                    value={`${data.stats.emails.sent} sent · ${data.stats.emails.failed} failed`}
                    tone={data.stats.emails.failed ? 'red' : 'green'}
                  />
                  <HealthRow
                    label="Sheet sync queue"
                    value={`${data.stats.syncQueue.pending} pending · ${data.stats.syncQueue.failed} failed`}
                    tone={data.stats.syncQueue.failed ? 'amber' : 'green'}
                  />
                  <HealthRow
                    label="Proctoring events"
                    value={`${data.stats.violations} recorded`}
                    tone={data.stats.violations ? 'amber' : 'green'}
                  />
                </div>
                <hr className="divider" />
                <Link to="/admin/sheets" className="btn btn-subtle btn-sm btn-block">
                  <Icon name="sheet" size={14} /> Open spreadsheet sync
                </Link>
              </Card>

              <Card title="Quick actions">
                <div className="stack" style={{ gap: 8 }}>
                  <Link to="/admin/quizzes" className="btn btn-subtle btn-block" style={{ justifyContent: 'flex-start' }}>
                    <Icon name="plus" size={15} /> Create a quiz
                  </Link>
                  <Link to="/admin/certificates" className="btn btn-subtle btn-block" style={{ justifyContent: 'flex-start' }}>
                    <Icon name="certificate" size={15} /> Issue & retry certificates
                  </Link>
                  <Link to="/admin/fields" className="btn btn-subtle btn-block" style={{ justifyContent: 'flex-start' }}>
                    <Icon name="edit" size={15} /> Edit registration form
                  </Link>
                  <Link to="/admin/results" className="btn btn-subtle btn-block" style={{ justifyContent: 'flex-start' }}>
                    <Icon name="chart" size={15} /> Export results
                  </Link>
                </div>
              </Card>

              <div className="card card-pad" style={{ background: 'linear-gradient(150deg,#2a1539,#4b1d63)', color: '#fff', border: 0 }}>
                <div className="tiny" style={{ letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold-300)' }}>
                  Integrity note
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 12.8, color: 'rgba(255,255,255,.75)' }}>
                  Browser-based proctoring records visibility and focus changes, but it cannot block app switching or
                  screenshots on phones. Use the flagged-attempt review in the host console alongside supervised
                  delivery for high-stakes exams.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'red' }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="small muted">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
