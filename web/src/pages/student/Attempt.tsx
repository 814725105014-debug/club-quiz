import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../lib/api';
import { apiErrorMessage, clock, formatTime } from '../../lib/format';
import {
  studentStore,
  type AttemptState,
  type ViolationResponse,
} from '../../lib/student';
import { Button, Modal } from '../../components/ui';

type AnswerState = { selected: string[]; markedForReview: boolean };

type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

interface PendingSave {
  questionId: string;
  selected: string[];
  markedForReview: boolean;
}

export default function AttemptPage() {
  const { joinCode = '' } = useParams();
  const navigate = useNavigate();
  const [attemptToken, setAttemptToken] = useState<string | null>(null);
  const [state, setState] = useState<AttemptState | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  const deadlineRef = useRef(0);
  const autoRef = useRef(false);
  const lastViolationRef = useRef<Record<string, number>>({});
  const queueRef = useRef<PendingSave[]>([]);
  const stateRef = useRef<AttemptState | null>(null);

  stateRef.current = state;

  const flushQueue = useCallback(async () => {
    if (!attemptToken || queueRef.current.length === 0) return;
    const pending = [...queueRef.current];
    queueRef.current = [];
    for (const item of pending) {
      try {
        await api.post('/student/attempts/answer', {
          token: attemptToken,
          questionId: item.questionId,
          selected: item.selected,
          markedForReview: item.markedForReview,
        });
      } catch {
        queueRef.current.push(item);
      }
    }
    setSaving(queueRef.current.length ? 'offline' : 'saved');
  }, [attemptToken]);

  const save = useCallback(
    async (questionId: string, selected: string[], markedForReview: boolean) => {
      if (!attemptToken) return;
      setSaving('saving');
      try {
        const result = await api.post<{ ok: boolean }>('/student/attempts/answer', {
          token: attemptToken,
          questionId,
          selected,
          markedForReview,
        });
        if (result.ok) {
          setSaving(queueRef.current.length ? 'offline' : 'saved');
          window.setTimeout(() => setSaving((prev) => (prev === 'saved' ? 'idle' : prev)), 2200);
        }
      } catch {
        queueRef.current.push({ questionId, selected, markedForReview });
        setSaving('offline');
      }
    },
    [attemptToken],
  );

  /* ------------------------------ bootstrap ------------------------------ */

  useEffect(() => {
    let active = true;
    const participantToken = studentStore.participantToken(joinCode);
    if (!participantToken) {
      navigate(`/j/${joinCode}`, { replace: true });
      return undefined;
    }

    (async () => {
      try {
        const started = await api.post<{ attemptToken: string; attemptId: string; resumed: boolean }>(
          '/student/attempts/start',
          { participantToken },
        );
        if (!active) return;
        studentStore.saveAttempt(joinCode, started.attemptToken);
        setAttemptToken(started.attemptToken);
        const next = await api.get<AttemptState>(`/student/attempts/state?token=${encodeURIComponent(started.attemptToken)}`);
        if (!active) return;
        if (next.submitted) {
          navigate(`/j/${joinCode}/result`, { replace: true });
          return;
        }
        applyState(next);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 401 || err.code === 'invalid_token')) {
          studentStore.clearAttempt(joinCode);
          navigate(`/j/${joinCode}`, { replace: true });
          return;
        }
        setError(apiErrorMessage(err));
      } finally {
        if (active) setBooting(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinCode]);

  const applyState = (next: AttemptState) => {
    setState(next);
    setAnswers(() => {
      const map: Record<string, AnswerState> = {};
      for (const question of next.questions) {
        const saved = next.answers[question.id];
        map[question.id] = {
          selected: saved?.selected ?? [],
          markedForReview: saved?.markedForReview ?? false,
        };
      }
      return map;
    });
    if (next.attempt.warning) setWarning(next.attempt.warning);
    deadlineRef.current = Date.now() + Math.max(0, next.attempt.remainingSeconds) * 1000;
    setRemaining(Math.max(0, next.attempt.remainingSeconds));
  };

  /* -------------------------------- timer -------------------------------- */

  const doSubmit = useCallback(
    async (reason: 'manual' | 'timeout') => {
      if (!attemptToken || autoRef.current) return;
      autoRef.current = true;
      setSubmitting(true);
      try {
        await flushQueue();
        await api.post('/student/attempts/submit', { token: attemptToken, reason });
        studentStore.clearAttempt(joinCode);
        navigate(`/j/${joinCode}/result`, { replace: true });
      } catch (err) {
        autoRef.current = false;
        setSubmitting(false);
        setError(apiErrorMessage(err));
      }
    },
    [attemptToken, flushQueue, joinCode, navigate],
  );

  useEffect(() => {
    if (booting) return undefined;
    const timer = window.setInterval(() => {
      if (!deadlineRef.current) return;
      const seconds = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0 && stateRef.current && !autoRef.current) {
        void doSubmit('timeout');
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [booting, doSubmit]);

  /* --------------------------- server resync ---------------------------- */

  const resync = useCallback(async () => {
    if (!attemptToken) return;
    try {
      const next = await api.get<AttemptState>(`/student/attempts/state?token=${encodeURIComponent(attemptToken)}`);
      if (next.submitted) {
        studentStore.clearAttempt(joinCode);
        navigate(`/j/${joinCode}/result`, { replace: true });
        return;
      }
      setState(next);
      deadlineRef.current = Date.now() + Math.max(0, next.attempt.remainingSeconds) * 1000;
      setRemaining(Math.max(0, next.attempt.remainingSeconds));
      if (next.attempt.warning) setWarning(next.attempt.warning);
    } catch {
      /* transient */
    }
  }, [attemptToken, joinCode, navigate]);

  useEffect(() => {
    if (booting) return undefined;
    const timer = window.setInterval(() => void resync(), 45_000);
    return () => window.clearInterval(timer);
  }, [booting, resync]);

  /* --------------------------- anti-cheat hooks -------------------------- */

  const recordViolation = useCallback(
    async (type: string, metadata?: Record<string, unknown>) => {
      if (!attemptToken || !stateRef.current || stateRef.current.attempt.status !== 'in_progress') return;
      const now = Date.now();
      if (lastViolationRef.current[type] && now - lastViolationRef.current[type] < 2500) return;
      lastViolationRef.current[type] = now;
      try {
        const result = await api.post<ViolationResponse>('/student/attempts/violation', {
          token: attemptToken,
          type,
          metadata,
        });
        if (result.warning) setWarning(result.warning);
        if (result.autoSubmitted) {
          setAutoMessage(result.warning ?? 'Your attempt was submitted automatically.');
          studentStore.clearAttempt(joinCode);
          window.setTimeout(() => navigate(`/j/${joinCode}/result`, { replace: true }), 2200);
        }
      } catch {
        /* never block the quiz on telemetry */
      }
    },
    [attemptToken, joinCode, navigate],
  );

  useEffect(() => {
    if (booting) return undefined;

    const onVisibility = () => {
      if (document.hidden) void recordViolation('visibility_hidden', { at: new Date().toISOString() });
      else void resync();
    };
    const onBlur = () => void recordViolation('window_blur');
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      void recordViolation('context_menu');
    };
    const onCopy = (e: ClipboardEvent) => {
      void recordViolation('clipboard_copy', { target: (e.target as HTMLElement)?.tagName });
    };
    const onPaste = () => void recordViolation('clipboard_paste');
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stateRef.current?.attempt.status === 'in_progress') {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [booting, recordViolation, resync]);

  useEffect(() => {
    const onOnline = () => void flushQueue();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushQueue]);

  /* ------------------------------ interaction ---------------------------- */

  const questions = state?.questions ?? [];
  const question = questions[index];
  const answer = question ? answers[question.id] : undefined;
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.selected.length ?? 0) > 0).length,
    [questions, answers],
  );
  const unanswered = questions.length - answeredCount;
  const markedCount = useMemo(
    () => questions.filter((q) => answers[q.id]?.markedForReview).length,
    [questions, answers],
  );

  const choose = (optionId: string) => {
    if (!question || !answer || submitting) return;
    const isMulti = question.type === 'multi';
    let selected: string[];
    if (isMulti) {
      selected = answer.selected.includes(optionId)
        ? answer.selected.filter((id) => id !== optionId)
        : [...answer.selected, optionId];
    } else {
      selected = answer.selected.includes(optionId) ? [] : [optionId];
    }
    setAnswers((prev) => ({ ...prev, [question.id]: { ...answer, selected } }));
    void save(question.id, selected, answer.markedForReview);
  };

  const toggleMark = () => {
    if (!question || !answer) return;
    const marked = !answer.markedForReview;
    setAnswers((prev) => ({ ...prev, [question.id]: { ...answer, markedForReview: marked } }));
    void save(question.id, answer.selected, marked);
  };

  const clearResponse = () => {
    if (!question || !answer) return;
    setAnswers((prev) => ({ ...prev, [question.id]: { ...answer, selected: [] } }));
    void save(question.id, [], answer.markedForReview);
  };

  const timerTone = remaining <= 60 ? 'danger' : remaining <= 300 ? 'warn' : '';

  return (
    <div className="student-shell">
      <div className="student-frame">
        <div className="student-head">
          <div className="brand-mark">Q</div>
          <div>
            <div className="name">{state?.quiz.title ?? 'Assessment'}</div>
            <div className="sub">{questions.length ? `Question ${index + 1} of ${questions.length}` : 'Preparing'}</div>
          </div>
          <div className="head-right">
            <span className={`timer ${timerTone}`}>
              <span>⏱</span> {clock(remaining)}
            </span>
          </div>
        </div>

        {booting ? (
          <div className="student-card">
            <div className="student-body center" style={{ padding: 36 }}>
              <span className="spinner" /> <span className="muted">Preparing your attempt…</span>
            </div>
          </div>
        ) : error ? (
          <div className="student-card">
            <div className="student-body">
              <div className="alert alert-error">{error}</div>
              <Link className="btn btn-primary btn-block" to={`/j/${joinCode}`}>
                Back to the quiz page
              </Link>
            </div>
          </div>
        ) : question && answer ? (
          <>
            <div className="progress" style={{ marginBottom: 12, background: 'rgba(255,255,255,.14)' }}>
              <span style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
            </div>

            <div className="q-card">
              <div className="q-number">
                <span>Question {index + 1}</span>
                <span>·</span>
                <span>{question.marks} mark{Number(question.marks) === 1 ? '' : 's'}</span>
                {question.type === 'multi' ? (
                  <>
                    <span>·</span>
                    <span>Select all that apply</span>
                  </>
                ) : null}
                {answer.markedForReview ? <span className="badge badge-amber" style={{ marginLeft: 'auto' }}>Marked</span> : null}
              </div>
              <div className="q-text">{question.text}</div>
              {question.imageUrl ? <img className="q-image" src={question.imageUrl} alt="Question illustration" /> : null}
              {question.options.map((option, optionIndex) => {
                const selected = answer.selected.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`option ${selected ? 'selected' : ''}`}
                    onClick={() => choose(option.id)}
                    aria-pressed={selected}
                  >
                    <span className="letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option.text}</span>
                  </button>
                );
              })}

              <div className="q-tools">
                <button className="btn btn-sm btn-subtle" onClick={toggleMark}>
                  {answer.markedForReview ? 'Unmark for review' : 'Mark for review'}
                </button>
                {answer.selected.length ? (
                  <button className="btn btn-sm btn-ghost" onClick={clearResponse}>
                    Clear response
                  </button>
                ) : null}
                <span className="tiny muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
                  {saving === 'saving'
                    ? 'Saving…'
                    : saving === 'offline'
                      ? 'Offline — will retry'
                      : saving === 'error'
                        ? 'Save failed'
                        : 'Answers save automatically'}
                </span>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
              <Button variant="subtle" onClick={() => setPaletteOpen(true)}>
                Question palette · {answeredCount}/{questions.length}
              </Button>
              {markedCount ? <span className="tiny" style={{ color: 'var(--gold-300)' }}>{markedCount} marked for review</span> : null}
            </div>
          </>
        ) : (
          <div className="student-card">
            <div className="student-body center">
              <p className="muted">This quiz has no questions yet.</p>
              <Link className="btn btn-subtle" to="/">
                Back to home
              </Link>
            </div>
          </div>
        )}

        {!booting && question ? (
          <div className="student-dock">
            <div className="student-dock-inner">
              <Button variant="subtle" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                ← Prev
              </Button>
              <div style={{ flex: 1 }} />
              {index === questions.length - 1 ? (
                <Button variant="gold" onClick={() => setSubmitOpen(true)}>
                  Review & submit
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}>
                  Next →
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <Modal
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        title="Question palette"
        footer={
          <>
            <Button variant="subtle" onClick={() => setPaletteOpen(false)}>
              Keep working
            </Button>
            <Button
              variant="gold"
              onClick={() => {
                setPaletteOpen(false);
                setSubmitOpen(true);
              }}
            >
              Review & submit
            </Button>
          </>
        }
      >
        <div className="palette-grid">
          {questions.map((q, i) => {
            const a = answers[q.id];
            const classes = [
              'palette-cell',
              a?.selected.length ? 'answered' : '',
              a?.markedForReview ? 'marked' : '',
              i === index ? 'current' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={q.id}
                className={classes}
                onClick={() => {
                  setIndex(i);
                  setPaletteOpen(false);
                }}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="palette-legend">
          <span><i className="swatch" style={{ background: 'var(--green-100)', borderColor: '#b9e0cc' }} /> Answered</span>
          <span><i className="swatch" style={{ background: 'var(--amber-100)', borderColor: '#efd6a1' }} /> Marked for review</span>
          <span><i className="swatch" /> Not answered</span>
        </div>
        <hr className="divider" />
        <div className="small">
          <b>{answeredCount}</b> answered · <b>{unanswered}</b> unanswered · <b>{markedCount}</b> marked
        </div>
      </Modal>

      <Modal
        open={submitOpen}
        onClose={() => (submitting ? undefined : setSubmitOpen(false))}
        title="Submit your attempt?"
        footer={
          <>
            <Button variant="subtle" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              Keep working
            </Button>
            <Button variant="primary" onClick={() => void doSubmit('manual')} loading={submitting}>
              Submit final answers
            </Button>
          </>
        }
      >
        <p className="small">
          You have answered <b>{answeredCount}</b> of <b>{questions.length}</b> questions.
        </p>
        {unanswered > 0 ? (
          <div className="alert alert-warn">
            <span>⚠</span>
            <span>
              {unanswered} question{unanswered === 1 ? '' : 's'} remain unanswered and will score zero. You can still go
              back before submitting.
            </span>
          </div>
        ) : (
          <div className="alert alert-success">
            <span>✓</span>
            <span>Every question has an answer.</span>
          </div>
        )}
        <div className="anti-cheat-note">
          <span>🛡</span>
          <span>
            {state?.attempt.violations ?? 0} proctoring event(s) recorded for this attempt. Submitting is final; your score
            is calculated on the server.
          </span>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Time remaining: <b>{clock(remaining)}</b>
        </p>
      </Modal>

      {warning ? (
        <div className="warning-overlay" role="alertdialog" aria-live="assertive">
          <div className="warning-box">
            <div className="warning-icon">⚠</div>
            <h3>Integrity notice</h3>
            <p>{warning}</p>
            <p className="tiny muted">
              Leaving this screen is recorded. The host decides whether events affect your result. Browser logging cannot
              prevent screenshots or app switching.
            </p>
            <Button variant="primary" block onClick={() => setWarning(null)}>
              I understand — continue
            </Button>
          </div>
        </div>
      ) : null}

      {autoMessage ? (
        <div className="warning-overlay">
          <div className="warning-box">
            <div className="warning-icon">⏹</div>
            <h3>Attempt submitted</h3>
            <p>{autoMessage}</p>
            <p className="tiny muted">Redirecting to your result…</p>
          </div>
        </div>
      ) : null}

      {state ? (
        <div className="center no-print" style={{ padding: '10px 0 0' }}>
          <span className="tiny" style={{ color: 'rgba(255,255,255,.35)' }}>
            Started {formatTime(state.attempt.startedAt)} IST · server-synchronised timer
          </span>
        </div>
      ) : null}
    </div>
  );
}
