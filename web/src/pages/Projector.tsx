import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { clock, formatTime, relativeTime, statusLabel } from '../lib/format';
import { BrandMark, Icon } from '../components/Icon';
import { Button, useToast } from '../components/ui';

interface Presentation {
  quiz: {
    title: string;
    joinCode: string;
    status: string;
    startAt: string | null;
    endAt: string | null;
    durationMinutes: number;
    announcement: string | null;
    totalMarks: number;
    questionCount: number;
  };
  joinUrl: string;
  participants: { registered: number; joined: number; attending: number; submitted: number };
  announcements: { message: string; created_at: string }[];
  organization: { name: string; department: string; line: string };
  serverTime: string;
}

export default function ProjectorPage() {
  const { joinCode = '' } = useParams();
  const [data, setData] = useState<Presentation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const payload = await api.get<Presentation>(`/public/presentation/${joinCode}`);
      setData(payload);
      setError(null);
    } catch {
      setError('This presentation link is not active. Ask the host to reopen the session.');
    }
  }, [joinCode]);

  useEffect(() => {
    void load();
    const poll = window.setInterval(() => void load(), 5000);
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  const startAt = data?.quiz.startAt ? new Date(data.quiz.startAt).getTime() : null;
  const countdown = startAt ? Math.max(0, Math.floor((startAt - now.getTime()) / 1000)) : 0;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast('Fullscreen is not available in this browser.', 'error');
    }
  };

  return (
    <div className="projector">
      <div className="projector-head">
        <div className="projector-brand">
          <div className="brand-mark">Q</div>
          <div>
            <div className="name">{data?.organization.name ?? 'SRM TRP Engineering College'}</div>
            <div className="dept">{data?.organization.department ?? 'EMBEDX · Assessment Platform'}</div>
          </div>
        </div>
        <div className="spacer" />
        <div className="row" style={{ gap: 10, color: 'rgba(255,255,255,.6)', fontSize: 12 }}>
          <span className="live-dot" />
          <span style={{ letterSpacing: '.12em', textTransform: 'uppercase' }}>{data ? statusLabel(data.quiz.status) : 'Connecting'}</span>
          <span className="mono">{formatTime(now.toISOString())} IST</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" variant="subtle" onClick={toggleFullscreen}>
            {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </Button>
          <Button size="sm" variant="subtle" onClick={() => window.open(`/j/${joinCode}`, '_blank', 'noopener')}>
            <Icon name="external" size={13} /> Student view
          </Button>
        </div>
      </div>

      {error ? (
        <div className="projector-main" style={{ display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: 520 }}>
            <h1 className="projector-title" style={{ fontSize: 40 }}>
              Session unavailable
            </h1>
            <p className="projector-sub">{error}</p>
            <Link className="btn btn-gold" to="/">
              Back to the platform
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="projector-main">
            <div>
              <div style={{ fontSize: 11, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--gold-300)' }}>
                Scan · Register · Attempt
              </div>
              <h1 className="projector-title">{data?.quiz.title ?? 'Loading assessment…'}</h1>
              <p className="projector-sub">
                {data
                  ? `${data.quiz.questionCount} questions · ${data.quiz.totalMarks} marks · ${data.quiz.durationMinutes} minutes. Keep this screen visible; your timer starts when you begin.`
                  : 'Fetching the live session…'}
              </p>

              <div className="projector-stats" style={{ marginTop: 26 }}>
                <div className="projector-stat">
                  <b>{data?.participants.registered ?? 0}</b>
                  <span>Registered</span>
                </div>
                <div className="projector-stat">
                  <b>{data?.participants.attending ?? 0}</b>
                  <span>Attempting</span>
                </div>
                <div className="projector-stat">
                  <b>{data?.participants.submitted ?? 0}</b>
                  <span>Submitted</span>
                </div>
                <div className="projector-stat">
                  <b>{startAt && countdown > 0 ? clock(countdown) : data ? `${data.quiz.durationMinutes}m` : '—'}</b>
                  <span>{startAt && countdown > 0 ? 'Starts in' : 'Duration'}</span>
                </div>
              </div>

              {data?.quiz.announcement ? (
                <div className="announcement-strip">
                  <b>Announcement · </b>
                  {data.quiz.announcement}
                </div>
              ) : null}
              {data?.announcements.slice(0, 2).map((a) => (
                <div key={a.created_at} className="tiny" style={{ color: 'rgba(255,255,255,.45)', marginTop: 10 }}>
                  {relativeTime(a.created_at)} · {a.message}
                </div>
              ))}
            </div>

            <div className="join-panel">
              <div className="join-code-label">Scan to join</div>
              {data ? (
                <img src={`/api/public/qr/${data.quiz.joinCode}.png?size=620`} alt={`QR code to join ${data.quiz.title}`} style={{ marginTop: 10 }} />
              ) : (
                <div style={{ height: 300 }} />
              )}
              <div className="join-code-label" style={{ marginTop: 12 }}>
                or enter the code
              </div>
              <div className="join-code">{data?.quiz.joinCode ?? '······'}</div>
              <div className="join-link">{data?.joinUrl}</div>
            </div>
          </div>

          <div className="projector-foot">
            <span>{data?.organization.name ?? 'SRM TRP Engineering College (Autonomous)'}</span>
            <span>·</span>
            <span>{data?.organization.line ?? ''}</span>
            <div className="spacer" />
            <span>Certificates are generated automatically for eligible participants.</span>
            <BrandMark compact />
          </div>
        </>
      )}
    </div>
  );
}
