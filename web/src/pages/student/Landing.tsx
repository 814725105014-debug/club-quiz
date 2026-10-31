import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim().toUpperCase();
    if (value) navigate(`/j/${encodeURIComponent(value)}`);
  };

  return (
    <div className="student-shell">
      <div className="student-frame no-dock" style={{ justifyContent: 'center' }}>
        <div className="landing-brand">
          <div className="brand-mark lg">Q</div>
          <div>
            <div className="landing-name">QUIZ PLATFORM</div>
            <div className="landing-sub">SRM TRP Engineering College · EMBEDX</div>
          </div>
        </div>

        <div className="student-card" style={{ marginTop: 18 }}>
          <div className="student-hero">
            <div className="eyebrow">Assessments & certification</div>
            <h1>Join your quiz</h1>
            <p>Enter the 6-character join code shown by your host or scan the QR code on the projector.</p>
          </div>
          <div className="student-body">
            <form onSubmit={submit}>
              <label className="field-label" htmlFor="join-code">
                Quiz join code
              </label>
              <input
                id="join-code"
                className="join-code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                placeholder="DEMO01"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
              />
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={code.trim().length < 4}>
                Continue
              </button>
            </form>

            <div className="landing-divider">
              <span>or</span>
            </div>

            <div className="landing-links">
              <Link to="/verify" className="landing-link">
                <span className="ico">🎓</span>
                <span>
                  <b>Verify a certificate</b>
                  <em>Check the authenticity of an issued certificate</em>
                </span>
              </Link>
              <Link to="/admin/login" className="landing-link">
                <span className="ico">🛠</span>
                <span>
                  <b>Coordinator sign in</b>
                  <em>Create quizzes, host live sessions, issue certificates</em>
                </span>
              </Link>
            </div>
          </div>
        </div>

        <p className="tiny center" style={{ color: 'rgba(255,255,255,.42)', marginTop: 18 }}>
          Your answers are timed and graded on the server. Scores are never sent to your browser before submission.
        </p>
      </div>
    </div>
  );
}
