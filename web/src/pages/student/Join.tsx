import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { apiErrorMessage, formatDateTime } from '../../lib/format';
import { studentStore, type JoinResponse, type PublicQuizResponse } from '../../lib/student';
import { BrandMark } from '../../components/Icon';
import { Button } from '../../components/ui';
import type { ResultPayload } from '../../lib/student';

export default function JoinPage() {
  const { joinCode = '' } = useParams();
  const navigate = useNavigate();
  const [quizData, setQuizData] = useState<PublicQuizResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [session, setSession] = useState<{ name: string; attempts: ResultPayload[]; remaining: number } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .get<PublicQuizResponse>(`/student/quiz/${joinCode}`)
      .then((payload) => {
        if (!active) return;
        setQuizData(payload);
        const initial: Record<string, string> = {};
        for (const field of payload.fields) initial[field.key] = '';
        setValues((prev) => ({ ...initial, ...prev }));
      })
      .catch((err) => {
        if (active) setLoadError(apiErrorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [joinCode]);

  useEffect(() => {
    const token = studentStore.participantToken(joinCode);
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .get<{ participant: { name: string }; attempts: ResultPayload[] }>(`/student/me?token=${encodeURIComponent(token)}`)
      .then((data) => {
        const completed = data.attempts.filter((a) => a.status !== 'in_progress').length;
        setSession({
          name: data.participant.name,
          attempts: data.attempts,
          remaining: Math.max(0, (quizData?.quiz ? 1 : 1) - completed),
        });
      })
      .catch(() => studentStore.clearAttempt(joinCode))
      .finally(() => setCheckingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  const quiz = quizData?.quiz;
  const openAttempt = session?.attempts.find((a) => a.status === 'in_progress');
  const submittedAttempt = useMemo(
    () => session?.attempts.filter((a) => a.status !== 'in_progress').slice(-1)[0],
    [session],
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!quizData) return;
    const nextErrors: Record<string, string> = {};
    for (const field of quizData.fields) {
      const value = (values[field.key] ?? '').trim();
      if (field.required && !value) nextErrors[field.key] = `${field.label} is required.`;
      if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        nextErrors[field.key] = 'Enter a valid email address.';
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setJoining(true);
    setFormError(null);
    try {
      const result = await api.post<JoinResponse>(`/student/quiz/${joinCode}/join`, { fields: values });
      studentStore.saveParticipant(joinCode, result.participantToken);
      setSession({ name: result.participant.name, attempts: [], remaining: Math.max(1, result.quiz ? 1 : 1) });
      navigate(`/j/${joinCode}/attempt`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'attempt_limit_reached') {
        setFormError(err.message);
      } else {
        setFormError(apiErrorMessage(err));
      }
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="student-shell">
      <div className="student-frame no-dock">
        <div className="student-head">
          <div className="brand-mark">Q</div>
          <div>
            <div className="name">QUIZ PLATFORM</div>
            <div className="sub">SRM TRP · EMBEDX</div>
          </div>
          <div className="head-right">
            <Link to="/" style={{ color: 'rgba(255,255,255,.55)', fontSize: 11 }}>
              Home
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="student-card">
            <div className="student-body center" style={{ padding: 40 }}>
              <span className="spinner" /> <span className="muted">Loading quiz…</span>
            </div>
          </div>
        ) : loadError ? (
          <div className="student-card">
            <div className="student-hero">
              <div className="eyebrow">Link unavailable</div>
              <h1>We couldn’t open this quiz</h1>
            </div>
            <div className="student-body">
              <p className="muted">{loadError}</p>
              <Link to="/" className="btn btn-primary btn-block">
                Go to the platform home
              </Link>
            </div>
          </div>
        ) : quizData && quiz ? (
          <>
            <div className="student-card">
              <div className="student-hero">
                <div className="eyebrow">{quiz.status === 'active' ? 'Assessment live' : 'Assessment'}</div>
                <h1>{quiz.title}</h1>
                {quiz.description ? <p>{quiz.description}</p> : null}
                <div className="hero-meta">
                  <span className="hero-chip">{quiz.questionCount} questions</span>
                  <span className="hero-chip">{quiz.totalMarks} marks</span>
                  <span className="hero-chip">{quiz.durationMinutes} min</span>
                  <span className="hero-chip">Pass {quiz.passPercentage}%</span>
                </div>
              </div>

              <div className="student-body">
                {quiz.announcement ? (
                  <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
                    <span>📣</span>
                    <span>{quiz.announcement}</span>
                  </div>
                ) : null}

                {checkingSession ? (
                  <div className="center" style={{ padding: 18 }}>
                    <span className="spinner" />
                  </div>
                ) : session ? (
                  <div>
                    <div className="alert alert-success">
                      <span>✓</span>
                      <span>
                        Welcome back, <b>{session.name}</b>. Your registration is confirmed.
                      </span>
                    </div>
                    {openAttempt ? (
                      <>
                        <p className="student-note">
                          You have an attempt in progress. The timer is server-managed and continues to run.
                        </p>
                        <Button variant="primary" size="lg" block onClick={() => navigate(`/j/${joinCode}/attempt`)}>
                          Resume attempt
                        </Button>
                      </>
                    ) : submittedAttempt ? (
                      <>
                        <p className="student-note">You have already submitted this quiz.</p>
                        <Button variant="primary" size="lg" block onClick={() => navigate(`/j/${joinCode}/result`)}>
                          View your result
                        </Button>
                      </>
                    ) : (
                      <>
                        <h2 style={{ fontSize: 17 }}>Before you begin</h2>
                        <p className="student-note" style={{ marginBottom: 14 }}>
                          {quiz.instructions ||
                            'Answer all questions. Your answers save automatically. Do not leave this screen during the attempt.'}
                        </p>
                        <Button variant="primary" size="lg" block onClick={() => navigate(`/j/${joinCode}/attempt`)}>
                          Start the quiz
                        </Button>
                      </>
                    )}
                  </div>
                ) : !quizData.registration.open ? (
                  <div className="alert alert-warn">
                    <span>⏳</span>
                    <span>
                      {quizData.registration.reason ?? 'Registration is not open yet.'}
                      {quizData.registration.startsInSeconds
                        ? ` Opens ${formatDateTime(quiz.startAt)}.`
                        : ''}
                    </span>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    <h2 style={{ fontSize: 17, marginBottom: 2 }}>Register to participate</h2>
                    <p className="student-note" style={{ marginBottom: 16 }}>
                      Use the same details as your college record — they appear on your certificate.
                    </p>
                    {formError ? <div className="alert alert-error">{formError}</div> : null}
                    {quizData.fields.map((field) => {
                      const id = `f-${field.key}`;
                      const common = {
                        id,
                        name: field.key,
                        value: values[field.key] ?? '',
                        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
                          setValues((prev) => ({ ...prev, [field.key]: e.target.value }));
                          setErrors((prev) => ({ ...prev, [field.key]: '' }));
                        },
                        required: field.required,
                        autoComplete: field.key === 'email' ? 'email' : field.key === 'name' ? 'name' : 'off',
                        placeholder: field.patternHint ?? field.label,
                      };
                      return (
                        <div className="field" key={field.key}>
                          <label className="field-label" htmlFor={id}>
                            {field.label}
                            {field.required ? <span className="req">*</span> : null}
                          </label>
                          {field.type === 'select' && field.options ? (
                            <select className="select" {...common}>
                              <option value="">Select…</option>
                              {field.options.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="input"
                              type={field.type === 'number' ? 'tel' : field.type}
                              inputMode={field.type === 'number' ? 'numeric' : undefined}
                              {...common}
                            />
                          )}
                          {errors[field.key] ? (
                            <div className="field-error">{errors[field.key]}</div>
                          ) : field.patternHint ? (
                            <div className="field-hint">{field.patternHint}</div>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="anti-cheat-note" style={{ margin: '6px 0 14px' }}>
                      <span>🛡</span>
                      <span>
                        This quiz records focus and visibility changes to protect assessment integrity. By continuing you
                        consent to this logging. No camera, microphone or location access is requested.
                      </span>
                    </div>

                    <Button type="submit" variant="primary" size="lg" block loading={joining}>
                      Register & continue
                    </Button>
                    <p className="tiny muted center" style={{ marginTop: 10 }}>
                      One attempt per student unless the host allows more. Duplicate registrations with the same register
                      number are blocked.
                    </p>
                  </form>
                )}
              </div>
            </div>

            <div className="center" style={{ padding: '14px 0 0' }}>
              <Link to="/verify" className="tiny" style={{ color: 'rgba(255,255,255,.5)' }}>
                Verify a certificate
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
