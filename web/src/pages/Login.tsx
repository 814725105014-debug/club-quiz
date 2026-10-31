import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { apiErrorMessage } from '../lib/format';
import { Button, Input } from '../components/ui';
import { BrandMark } from '../components/Icon';
import type { RecaptchaVerifier } from 'firebase/auth';

type Tab = 'password' | 'google' | 'phone';

export default function LoginPage() {
  const { login, loginWithGoogle, resetPassword, authMode, runtime } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';
  const firebaseMode = authMode === 'firebase';
  const phoneEnabled = Boolean(runtime?.phoneAuthEnabled);

  const finish = () => navigate(from, { replace: true });

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      finish();
    } catch (err) {
      setError(err instanceof Error ? err.message : apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    void run(() => login(email.trim(), password));
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resetPassword(email.trim());
      setNotice(
        firebaseMode
          ? 'Password reset email sent. Check the inbox for that address (and spam).'
          : 'If that email belongs to an administrator, a reset link has been sent.',
      );
      setResetOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <div className="eyebrow">SRM TRP Engineering College · Autonomous</div>
          <h1>Assessment with a signature finish.</h1>
          <p>
            A mobile-first quiz engine and an automated certification pipeline built on your existing Google
            Workspace — Slides certificate template, Sheets response register and Gmail delivery.
          </p>
          <div className="auth-points">
            <div className="auth-point">
              <span className="dot">1</span>
              <span>Scan-to-join quizzes with server-authoritative timing and automatic answer saving.</span>
            </div>
            <div className="auth-point">
              <span className="dot">2</span>
              <span>Live host console, question-wise analytics and one-click certificate dispatch.</span>
            </div>
            <div className="auth-point">
              <span className="dot">3</span>
              <span>Every certificate carries a verification QR that resolves to a public check page.</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.4)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
          EMBEDX · Department of Electrical & Electronics Engineering
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <div style={{ marginBottom: 26 }}>
            <BrandMark />
          </div>
          <h2>Administrator sign in</h2>
          <p className="auth-sub">
            {firebaseMode
              ? `Secured by Firebase Authentication · project ${runtime?.projectId ?? 'embedx-assessment'}`
              : 'Use the institution account issued to your role.'}
          </p>

          {firebaseMode ? (
            <div className="tabs" role="tablist" style={{ marginBottom: 18 }}>
              <button role="tab" aria-selected={tab === 'password'} className={`tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>
                Email &amp; password
              </button>
              <button role="tab" aria-selected={tab === 'google'} className={`tab ${tab === 'google' ? 'active' : ''}`} onClick={() => setTab('google')}>
                Google
              </button>
              <button role="tab" aria-selected={tab === 'phone'} className={`tab ${tab === 'phone' ? 'active' : ''}`} onClick={() => setTab('phone')}>
                Phone
              </button>
            </div>
          ) : null}

          {error ? <div className="alert alert-error">{error}</div> : null}
          {notice ? <div className="alert alert-success">{notice}</div> : null}

          {tab === 'password' || !firebaseMode ? (
            <>
              <form onSubmit={submitPassword} autoComplete="on">
                <Input
                  label="Email address"
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@srmtrp.edu.in"
                />
                <Input
                  label="Password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                />
                <Button type="submit" variant="primary" size="lg" block loading={busy}>
                  Sign in
                </Button>
              </form>

              {resetOpen ? (
                <form onSubmit={submitReset} style={{ marginTop: 14 }}>
                  <Input
                    label="Send a reset link to"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@srmtrp.edu.in"
                  />
                  <div className="row" style={{ gap: 8 }}>
                    <Button type="submit" variant="subtle" size="sm" loading={busy} block>
                      Send reset link
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <button type="button" className="link-button" style={{ marginTop: 10 }} onClick={() => setResetOpen(true)}>
                  Forgot your password?
                </button>
              )}
            </>
          ) : null}

          {firebaseMode && tab === 'google' ? (
            <div>
              <p className="small muted" style={{ marginTop: 0 }}>
                Use the Google account that an administrator registered for you. The account picker always appears, so a
                shared laptop cannot reuse someone else’s session.
              </p>
              <Button
                variant="subtle"
                size="lg"
                block
                loading={busy}
                onClick={() => void run(() => loginWithGoogle())}
              >
                <span aria-hidden style={{ fontWeight: 700, marginRight: 8 }}>
                  G
                </span>
                Continue with Google
              </Button>
            </div>
          ) : null}

          {firebaseMode && tab === 'phone' ? (
            phoneEnabled ? (
              <PhonePanel onDone={finish} onError={setError} />
            ) : (
              <div className="callout callout-info">
                <b>Phone sign-in is prepared but switched off.</b>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  Firebase requires the Blaze billing plan for phone authentication, and each SMS is charged. The code
                  path (number → reCAPTCHA → OTP) is implemented in <code>web/src/lib/firebase.ts</code>; enable the
                  provider in the Firebase console and flip <code>phoneAuthEnabled</code> in the runtime config to turn
                  it on. Administrators can sign in with email/password or Google in the meantime.
                </p>
              </div>
            )
          ) : null}

          {!firebaseMode ? (
            <div className="callout callout-info" style={{ marginTop: 14 }}>
              <b>Firebase Authentication is available for this project.</b>
              <p className="small" style={{ margin: '6px 0 0' }}>
                The app is currently running on the built-in cookie session. Set <code>AUTH_MODE=firebase</code> and the
                service-account credentials on the API host to switch administrators to Firebase sign-in with Google.
              </p>
            </div>
          ) : null}

          <div className="auth-foot">
            <Link to="/">Student entry</Link>
            <span style={{ margin: '0 8px' }}>·</span>
            <Link to="/verify">Verify a certificate</Link>
          </div>
          <div className="auth-foot" style={{ marginTop: 10 }}>
            Access is rate-limited and audited. Contact the department administrator if your account is locked.
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Phone (OTP) sign-in. Rendered only when the runtime config reports the provider as
 * enabled — phone auth needs the Blaze plan, so it stays off until that is approved.
 */
function PhonePanel({ onDone, onError }: { onDone: () => void; onError: (message: string) => void }) {
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'number' | 'code'>('number');
  const [busy, setBusy] = useState(false);
  const verifier = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      verifier.current?.clear();
      verifier.current = null;
    };
  }, []);

  const send = async () => {
    setBusy(true);
    try {
      const fb = await import('../lib/firebase');
      verifier.current = verifier.current ?? fb.createRecaptchaVerifier('recaptcha-container');
      await fb.startPhoneSignIn(phone, verifier.current);
      setStage('code');
    } catch (err) {
      const fb = await import('../lib/firebase');
      onError(fb.firebaseAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const fb = await import('../lib/firebase');
      await fb.confirmPhoneCode(code);
      onDone();
    } catch (err) {
      const fb = await import('../lib/firebase');
      onError(fb.firebaseAuthErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div id="recaptcha-container" />
      {stage === 'number' ? (
        <>
          <Input
            label="Mobile number"
            hint="International format, e.g. +91 98765 43210."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
          />
          <Button variant="primary" size="lg" block loading={busy} onClick={() => void send()}>
            Send verification code
          </Button>
        </>
      ) : (
        <>
          <Input
            label="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <Button variant="primary" size="lg" block loading={busy} onClick={() => void confirm()}>
            Verify and sign in
          </Button>
        </>
      )}
    </div>
  );
}
