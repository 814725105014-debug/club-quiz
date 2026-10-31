import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSession } from '../lib/session';
import { apiErrorMessage } from '../lib/format';
import { Button, Input } from '../components/ui';
import { BrandMark } from '../components/Icon';

export default function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
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
          <p className="auth-sub">Use the institution account issued to your role.</p>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <form onSubmit={submit} autoComplete="on">
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
