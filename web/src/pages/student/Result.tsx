import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { apiErrorMessage, clock, durationLabel, formatDateTime, percent } from '../../lib/format';
import { studentStore, type ResultPayload } from '../../lib/student';
import { Button } from '../../components/ui';

interface SummaryResponse {
  participant: { id: string; name: string; email: string; regNumber: string | null; department: string | null };
  quiz: { id: string; title: string; durationMinutes: number; resultVisibility: string; allowRegistration: number; status: string };
  attempts: ResultPayload[];
}

export default function ResultPage() {
  const { joinCode = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const participantToken = studentStore.participantToken(joinCode);

  const load = useCallback(async () => {
    if (!participantToken) return;
    try {
      const payload = await api.get<SummaryResponse>(`/student/me?token=${encodeURIComponent(participantToken)}`);
      setData(payload);
      setError(null);
      const active = payload.attempts.find((a) => a.status === 'in_progress');
      if (active) navigate(`/j/${joinCode}/attempt`, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [participantToken, joinCode, navigate]);

  useEffect(() => {
    if (!participantToken) {
      navigate(`/j/${joinCode}`, { replace: true });
      return undefined;
    }
    void load();
    return undefined;
  }, [participantToken, joinCode, navigate, load]);

  const attempt = useMemo(() => {
    if (!data) return null;
    const finished = data.attempts.filter((a) => a.status !== 'in_progress');
    return finished.slice(-1)[0] ?? null;
  }, [data]);

  const certPending = attempt?.certificate && ['pending', 'queued'].includes(attempt.certificate.status);

  useEffect(() => {
    if (!certPending) return undefined;
    const timer = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(timer);
  }, [certPending, load]);

  if (loading) {
    return (
      <div className="student-shell">
        <div className="student-frame no-dock">
          <div className="student-card">
            <div className="student-body center" style={{ padding: 40 }}>
              <span className="spinner" /> <span className="muted">Loading your result…</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="student-shell">
        <div className="student-frame no-dock">
          <div className="student-card">
            <div className="student-body">
              <div className="alert alert-error">{error ?? 'We could not find your attempt.'}</div>
              <Link to={`/j/${joinCode}`} className="btn btn-primary btn-block">
                Back to the quiz
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="student-shell">
        <div className="student-frame no-dock">
          <div className="student-card">
            <div className="student-hero">
              <div className="eyebrow">No submission yet</div>
              <h1>{data.quiz.title}</h1>
            </div>
            <div className="student-body">
              <p className="muted small">You have registered but not submitted this quiz.</p>
              <Link to={`/j/${joinCode}`} className="btn btn-primary btn-block">
                Go to the quiz
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hidden = attempt.score === null || attempt.percentage === null;
  const passed = attempt.passed === true;
  const failed = attempt.passed === false;
  const cert = attempt.certificate;
  const certReady = cert && cert.status === 'generated' && cert.certificateId;

  return (
    <div className="student-shell">
      <div className="student-frame no-dock">
        <div className="student-head">
          <div className="brand-mark">Q</div>
          <div>
            <div className="name">{data.quiz.title}</div>
            <div className="sub">Result · {data.participant.name}</div>
          </div>
        </div>

        <div className="student-card">
          <div className="student-hero">
            <div className="eyebrow">{hidden ? 'Submitted' : passed ? 'Passed' : 'Completed'}</div>
            <h1>{hidden ? 'Your responses are recorded' : passed ? 'Congratulations!' : 'Attempt submitted'}</h1>
            <p>{attempt.message}</p>
          </div>
          <div className="student-body">
            {hidden ? (
              <div className="alert alert-info">
                <span>🔒</span>
                <span>
                  Scores for this quiz are{attempt.visibility === 'after_end' ? ' published after the quiz closes' : ' not shown to participants'}. Your
                  submission has been saved on the server.
                </span>
              </div>
            ) : (
              <div className="result-grid">
                <div className="result-tile">
                  <div className="label">Score</div>
                  <div className="value">
                    {attempt.score}
                    <span className="unit">/{attempt.totalMarks}</span>
                  </div>
                </div>
                <div className="result-tile">
                  <div className="label">Percentage</div>
                  <div className="value">{percent(attempt.percentage)}</div>
                </div>
                <div className="result-tile">
                  <div className="label">Status</div>
                  <div className="value" style={{ color: passed ? 'var(--green-600)' : failed ? 'var(--red-600)' : 'inherit' }}>
                    {passed ? 'Pass' : failed ? 'Fail' : '—'}
                  </div>
                </div>
                <div className="result-tile">
                  <div className="label">Time taken</div>
                  <div className="value">{attempt.durationSeconds ? durationLabel(attempt.durationSeconds) : '—'}</div>
                </div>
              </div>
            )}

            <div className="kv-list" style={{ marginTop: 16 }}>
              <div>
                <span>Submitted</span>
                <b>{formatDateTime(attempt.submittedAt)}</b>
              </div>
              <div>
                <span>Attempt status</span>
                <b>{attempt.status === 'auto_submitted' ? 'Auto-submitted' : 'Submitted'}</b>
              </div>
              <div>
                <span>Proctoring events</span>
                <b>{attempt.violations}</b>
              </div>
              <div>
                <span>Participant</span>
                <b>{data.participant.name}</b>
              </div>
            </div>

            {cert ? (
              <div className="cert-panel">
                <div className="cert-panel-head">
                  <div className="cert-icon">🎓</div>
                  <div>
                    <div className="cert-title">Certificate of completion</div>
                    <div className="tiny muted">
                      {certReady
                        ? `Issued as ${cert.certificateId}`
                        : cert.status === 'failed'
                          ? 'Generation failed — the coordinator has been notified'
                          : cert.status === 'not_eligible'
                            ? 'Not eligible under this quiz’s certificate rule'
                            : 'Generating your certificate…'}
                    </div>
                  </div>
                </div>
                {certReady ? (
                  <>
                    <a
                      className="btn btn-gold btn-block"
                      href={`/api/public/certificates/${encodeURIComponent(cert.certificateId!)}/download`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View / download certificate
                    </a>
                    <Link className="btn btn-subtle btn-block" to={`/verify/${encodeURIComponent(cert.certificateId!)}`}>
                      Verify certificate
                    </Link>
                    <p className="tiny muted center" style={{ marginTop: 8 }}>
                      Email status: <b>{cert.emailStatus}</b>
                      {cert.emailStatus === 'redirected' ? ' (sent to the platform admin in test mode)' : ''}
                    </p>
                  </>
                ) : cert.status === 'failed' ? (
                  <p className="tiny muted">
                    Please contact the course coordinator with your registration number. No action is needed on your side.
                  </p>
                ) : (
                  <div className="row" style={{ gap: 8 }}>
                    <span className="spinner" />
                    <span className="tiny muted">This page refreshes automatically once your certificate is ready.</span>
                  </div>
                )}
              </div>
            ) : null}

            <button className="btn btn-ghost btn-sm btn-block" onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? 'Hide' : 'Show'} attempt details
            </button>
            {showDetails ? (
              <div className="kv-list" style={{ marginTop: 8 }}>
                {data.attempts.map((a, i) => (
                  <div key={a.attemptId}>
                    <span>Attempt {i + 1}</span>
                    <b>
                      {a.status === 'in_progress' ? 'In progress' : `${a.score ?? '—'}/${a.totalMarks}`} · {a.submittedAt ? formatDateTime(a.submittedAt) : '—'}
                    </b>
                  </div>
                ))}
                <div>
                  <span>Elapsed</span>
                  <b>{attempt.durationSeconds ? clock(attempt.durationSeconds) : '—'}</b>
                </div>
              </div>
            ) : null}

            <div className="row" style={{ marginTop: 16, gap: 8 }}>
              <Link to={`/j/${joinCode}`} className="btn btn-subtle" style={{ flex: 1 }}>
                Quiz page
              </Link>
              <Link to="/" className="btn btn-subtle" style={{ flex: 1 }}>
                Home
              </Link>
            </div>
            <Button
              variant="ghost"
              size="sm"
              block
              style={{ marginTop: 10 }}
              onClick={() => window.print()}
            >
              Print this page
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
