import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, CopyButton, EmptyState, Loading, Textarea, useToast } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { formatDateTime, formatTime, percent, relativeTime, statusLabel, statusTone } from '../lib/format';
import type { Quiz } from '../lib/types';
import { Icon } from '../components/Icon';

interface LivePayload {
  quiz: {
    durationMinutes: number;
    status: string;
    allowRegistration: boolean;
    closeAt: string | null;
    violationWarnAfter: number;
    violationAutoSubmitCount: number;
    updatedAt: string;
  };
  participantCount: number;
  joined: number;
  inProgress: number;
  submitted: number;
  notStarted: number;
  avgPercentage: number;
  participants: {
    id: string;
    status: string;
    started_at: string;
    submitted_at: string | null;
    score: number;
    total_marks: number;
    percentage: number;
    passed: number;
    violations_count: number;
    name: string;
    email: string;
    reg_number: string | null;
    duration_seconds: number | null;
    auto_submitted: number;
  }[];
  violations: {
    id: string;
    type: string;
    severity: string;
    created_at: string;
    name: string;
    attempt_id: string;
  }[];
  announcements: { id: string; message: string; created_at: string }[];
}

export default function HostPage() {
  const { quizId = '' } = useParams();
  const [live, setLive] = useState<LivePayload | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [overview, quizDetail] = await Promise.all([
        api.get<LivePayload>(`/admin/quizzes/${quizId}/live`),
        api.get<{ quiz: Quiz }>(`/admin/quizzes/${quizId}`),
      ]);
      setLive(overview);
      setQuiz(quizDetail.quiz);
      setUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the live overview.');
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!liveMode) return undefined;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [liveMode, load]);

  const action = async (name: string) => {
    setBusy(name);
    try {
      await api.post(`/admin/quizzes/${quizId}/actions`, { action: name });
      toast(`Quiz ${name.replace(/_/g, ' ')} applied.`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Action failed.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const extend = async (minutes: number) => {
    setBusy(`extend-${minutes}`);
    try {
      const result = await api.post<{ extendedAttempts: number }>(`/admin/quizzes/${quizId}/extend`, { minutes });
      toast(`Added ${minutes} minute(s) to ${result.extendedAttempts} running attempt(s).`, 'success');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not extend the timer.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const postAnnouncement = async () => {
    if (!announcement.trim()) return;
    setBusy('announce');
    try {
      await api.post(`/admin/quizzes/${quizId}/announcements`, { message: announcement.trim() });
      setAnnouncement('');
      toast('Announcement broadcast to participants and the projector.', 'success');
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not post the announcement.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const status = quiz?.status ?? live?.quiz.status ?? 'draft';

  return (
    <AdminLayout
      title="Host console"
      crumb={quiz ? quiz.title : 'Live session'}
      actions={
        <>
          <Button size="sm" variant={liveMode ? 'subtle' : 'primary'} onClick={() => setLiveMode((v) => !v)}>
            <span className={`live-dot`} style={{ opacity: liveMode ? 1 : 0.3, marginRight: 6 }} />
            {liveMode ? 'Live updates on' : 'Live updates paused'}
          </Button>
          {quiz ? (
            <Button size="sm" variant="subtle" onClick={() => window.open(`/present/${quiz.join_code}`, '_blank', 'noopener')}>
              <Icon name="qr" size={14} /> Projector
            </Button>
          ) : null}
        </>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {!live && !error ? <Loading label="Connecting to the live session…" /> : null}

      {live && quiz ? (
        <>
          <div className="quiz-hero">
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="row-tight" style={{ marginBottom: 8 }}>
                <Badge tone={status === 'active' ? 'green' : status === 'paused' ? 'amber' : 'grey'}>{statusLabel(status)}</Badge>
                <span className="tiny" style={{ color: 'rgba(255,255,255,.6)' }}>
                  Updated {updatedAt ? formatTime(updatedAt.toISOString()) : '—'} · auto-refresh {liveMode ? 'on' : 'paused'}
                </span>
              </div>
              <h1>{quiz.title}</h1>
              <div className="meta">
                <span>Join code <b style={{ color: 'var(--gold-300)' }}>{quiz.join_code}</b></span>
                <span>{live.participantCount} registered</span>
                <span>{live.joined} joined</span>
                <span>{live.inProgress} in progress</span>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <CopyButton value={`${window.location.origin}/j/${quiz.join_code}`} label="Copy join link" />
              <Link to={`/admin/quizzes/${quiz.id}`} className="btn btn-gold btn-sm">
                Edit quiz
              </Link>
            </div>
          </div>

          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="stat-label">Registered</div>
              <div className="stat-value">{live.participantCount}</div>
              <div className="stat-meta">{live.notStarted} not started</div>
            </div>
            <div className="stat">
              <div className="stat-label">Attending now</div>
              <div className="stat-value">{live.inProgress}</div>
              <div className="stat-meta">{live.joined} attempts opened</div>
            </div>
            <div className="stat">
              <div className="stat-label">Submitted</div>
              <div className="stat-value">{live.submitted}</div>
              <div className="stat-meta">auto + manual submissions</div>
            </div>
            <div className="stat">
              <div className="stat-label">Average score</div>
              <div className="stat-value">{percent(live.avgPercentage)}</div>
              <div className="stat-meta">
                pass mark {quiz.pass_percentage}% · {quiz.duration_minutes} min
              </div>
            </div>
          </div>

          <div className="grid grid-sidebar">
            <div className="stack" style={{ gap: 16 }}>
              <Card
                title="Session controls"
                subtitle="Changes apply immediately to every connected device"
              >
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => action('start')}
                    loading={busy === 'start'}
                    disabled={['active', 'completed'].includes(status)}
                  >
                    <Icon name="play" size={14} /> Start
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => action('pause')} loading={busy === 'pause'} disabled={status !== 'active'}>
                    <Icon name="pause" size={14} /> Pause
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => action('resume')} loading={busy === 'resume'} disabled={status !== 'paused'}>
                    <Icon name="play" size={14} /> Resume
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => action('end')} loading={busy === 'end'} disabled={status === 'completed' || status === 'archived'}>
                    <Icon name="stop" size={14} /> End & grade
                  </Button>
                  <div className="spacer" />
                  <Button variant="subtle" size="sm" onClick={() => extend(5)} loading={busy === 'extend-5'}>
                    <Icon name="clock" size={14} /> +5 min
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => extend(10)} loading={busy === 'extend-10'}>
                    +10 min
                  </Button>
                </div>
                <hr className="divider" />
                <div className="row" style={{ gap: 8 }}>
                  <Button
                    variant="subtle"
                    size="sm"
                    onClick={() => action(live.quiz.allowRegistration ? 'close_registration' : 'open_registration')}
                    loading={busy === 'close_registration' || busy === 'open_registration'}
                  >
                    {live.quiz.allowRegistration ? 'Close registration' : 'Re-open registration'}
                  </Button>
                  <span className="small muted">
                    Registration is <b>{live.quiz.allowRegistration ? 'open' : 'closed'}</b>
                    {live.quiz.closeAt ? ` · closes ${formatDateTime(live.quiz.closeAt)}` : ''}
                  </span>
                </div>
                {status === 'draft' ? (
                  <div className="alert alert-warn" style={{ marginTop: 12, marginBottom: 0 }}>
                    This quiz is still a draft. Publish it from the editor before participants can join.
                  </div>
                ) : null}
              </Card>

              <Card
                title="Participants"
                subtitle={`${live.participants.length} attempt${live.participants.length === 1 ? '' : 's'} in this session`}
                noPad
              >
                {live.participants.length === 0 ? (
                  <EmptyState
                    icon="◎"
                    title="No one has joined yet"
                    message={`Display the projector view and ask participants to scan the QR or enter code ${quiz.join_code}.`}
                  />
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Participant</th>
                          <th>Status</th>
                          <th>Score</th>
                          <th>Flags</th>
                          <th>Started</th>
                          <th>Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {live.participants.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <div className="cell-strong">{p.name}</div>
                              <div className="cell-sub">
                                {p.reg_number ?? p.email}
                                {p.auto_submitted ? ' · auto-submitted' : ''}
                              </div>
                            </td>
                            <td>
                              <Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge>
                            </td>
                            <td>
                              {p.status === 'in_progress' ? (
                                <span className="muted">—</span>
                              ) : (
                                <>
                                  <b>{percent(p.percentage)}</b>
                                  <div className="cell-sub">
                                    {p.score}/{p.total_marks} · {p.passed ? 'Pass' : 'Fail'}
                                  </div>
                                </>
                              )}
                            </td>
                            <td>
                              {p.violations_count ? <Badge tone="amber">{p.violations_count}</Badge> : <span className="muted">0</span>}
                            </td>
                            <td className="muted small">{formatTime(p.started_at)}</td>
                            <td className="muted small">{p.submitted_at ? relativeTime(p.submitted_at) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="stack" style={{ gap: 16 }}>
              <Card title="Announcements" subtitle="Broadcast to every participant screen + projector">
                <Textarea
                  rows={2}
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Five minutes remaining — submit your answers."
                  maxLength={500}
                />
                <Button size="sm" variant="primary" onClick={postAnnouncement} loading={busy === 'announce'} disabled={!announcement.trim()}>
                  Post announcement
                </Button>
                <hr className="divider" />
                {live.announcements.length === 0 ? (
                  <div className="small muted">No announcements yet.</div>
                ) : (
                  <div className="feed">
                    {live.announcements.map((a) => (
                      <div className="feed-item" key={a.id}>
                        <span className="feed-time">{relativeTime(a.created_at)}</span>
                        <span>{a.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Proctoring feed" subtitle="Visibility, focus and gesture events">
                {live.violations.length === 0 ? (
                  <div className="small muted">No integrity events recorded. The browser cannot block app switching — use supervision for high-stakes sessions.</div>
                ) : (
                  <div className="feed">
                    {live.violations.map((v) => (
                      <div className="feed-item" key={v.id}>
                        <span className="feed-time">{relativeTime(v.created_at)}</span>
                        <span>
                          <b style={{ textTransform: 'capitalize' }}>{v.type.replace(/_/g, ' ')}</b>
                          <span className="muted"> · {v.name}</span>
                          <span className="tiny muted" style={{ display: 'block' }}>
                            {v.severity}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}
