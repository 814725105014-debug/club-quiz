import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { apiErrorMessage, formatDateTime } from '../lib/format';
import { Button } from '../components/ui';

interface VerifyResponse {
  valid: boolean;
  status: string;
  certificateId: string | null;
  participantName: string | null;
  courseName: string | null;
  quizTitle: string | null;
  issuedAt: string | null;
  organization: string | null;
  message: string;
}

export default function VerifyPage() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(certificateId));
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!certificateId) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    api
      .get<VerifyResponse>(`/public/verify/${encodeURIComponent(certificateId)}`)
      .then((data) => {
        if (active) {
          setResult(data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setResult({
            valid: false,
            status: 'not_found',
            certificateId: decodeURIComponent(certificateId),
            participantName: null,
            courseName: null,
            quizTitle: null,
            issuedAt: null,
            organization: null,
            message: 'No certificate with this ID exists in the records.',
          });
        } else {
          setError(apiErrorMessage(err));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [certificateId]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (value) navigate(`/verify/${encodeURIComponent(value)}`);
  };

  return (
    <div className="verify-shell">
      <div className="verify-card">
        <div className="verify-head">
          <div className="brand-mark" style={{ margin: '0 auto 12px' }}>Q</div>
          <h1>Certificate verification</h1>
          <p>SRM TRP Engineering College · EMBEDX</p>
        </div>
        <div className="verify-body">
          {loading ? (
            <div className="center" style={{ padding: 24 }}>
              <span className="spinner" /> <span className="muted small">Verifying…</span>
            </div>
          ) : error ? (
            <div className="alert alert-error">{error}</div>
          ) : result ? (
            <>
              <div className={`verify-status ${result.valid ? 'ok' : 'bad'}`}>
                <span className="tick">{result.valid ? '✓' : '✕'}</span>
                <div>
                  <b>{result.valid ? 'Authentic certificate' : 'Certificate not valid'}</b>
                  <div className="tiny" style={{ marginTop: 2 }}>
                    {result.message}
                  </div>
                </div>
              </div>
              <dl className="kv">
                <dt>Certificate ID</dt>
                <dd>{result.certificateId ?? '—'}</dd>
                <dt>Participant</dt>
                <dd>{result.participantName ?? '—'}</dd>
                <dt>Course</dt>
                <dd>{result.courseName ?? result.quizTitle ?? '—'}</dd>
                <dt>Issued on</dt>
                <dd>{result.issuedAt ? formatDateTime(result.issuedAt) : '—'}</dd>
                <dt>Issued by</dt>
                <dd>{result.organization ?? 'SRM TRP Engineering College'}</dd>
              </dl>
              {result.valid && result.certificateId ? (
                <a
                  className="btn btn-subtle btn-block"
                  style={{ marginTop: 16 }}
                  href={`/api/public/certificates/${encodeURIComponent(result.certificateId)}/download`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open certificate PDF
                </a>
              ) : null}
            </>
          ) : null}

          <form onSubmit={submit} style={{ marginTop: 22 }}>
            <label className="field-label" htmlFor="verify-code">
              Verify another certificate
            </label>
            <div className="row" style={{ gap: 8 }}>
              <input
                id="verify-code"
                className="input"
                style={{ flex: 1 }}
                placeholder="e.g. SRMTRP/EEE/VAC/-2026-0015"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button type="submit" variant="primary">
                Verify
              </Button>
            </div>
            <p className="tiny muted" style={{ marginTop: 8 }}>
              The certificate ID is printed below the QR code on the certificate.
            </p>
          </form>

          <p className="tiny muted center" style={{ marginTop: 18 }}>
            <Link to="/">QUIZ PLATFORM home</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
