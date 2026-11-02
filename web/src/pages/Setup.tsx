import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/Layout';
import { Badge, Card, Loading } from '../components/ui';
import { Icon } from '../components/Icon';
import { useApi } from '../lib/hooks';
import type { Tone } from '../lib/format';

type Status = 'ok' | 'warn' | 'fail' | 'off';

interface Check {
  id: string;
  label: string;
  group: 'identity' | 'google' | 'email' | 'certificates' | 'data';
  status: Status;
  detail: string;
  action?: string;
  docs?: string;
}

interface SetupResponse {
  summary: { ok: number; warn: number; fail: number };
  ready: boolean;
  checks: Check[];
  environment: {
    node: string;
    timezone: string;
    nodeEnv: string;
    provider: string;
    authMode: string;
    projectId: string;
    firestoreMirror: boolean;
    databasePath: string;
    appBaseUrl: string;
    emailTestMode: boolean;
  };
}

const TONE: Record<Status, Tone> = { ok: 'green', warn: 'amber', fail: 'red', off: 'grey' };
const ICON: Record<Status, string> = { ok: '✓', warn: '!', fail: '✕', off: '–' };

const GROUP_LABEL: Record<Check['group'], string> = {
  identity: 'Identity',
  google: 'Google Workspace',
  email: 'Email',
  certificates: 'Certificates',
  data: 'Data & queue',
};

export default function Setup() {
  const { data, loading, error, reload } = useApi<SetupResponse>('/admin/setup');

  return (
    <AdminLayout
      title="Readiness"
      crumb="Administration · what is configured, what is missing"
      actions={
        <button className="btn btn-subtle btn-sm" onClick={reload}>
          <Icon name="spark" size={13} /> Re-check
        </button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading && !data ? <Loading label="Checking integrations…" /> : null}

      {data ? (
        <>
          <div className={`callout ${data.ready ? 'callout-gold' : 'callout-info'}`} style={{ marginBottom: 16 }}>
            <b>
              {data.ready
                ? `Ready — ${data.summary.ok} check(s) passed`
                : `${data.summary.fail} blocking issue(s), ${data.summary.warn} warning(s)`}
            </b>
            <p className="small" style={{ margin: '6px 0 0' }}>
              {data.ready
                ? 'Nothing blocking. Review the warnings below before issuing certificates to participants.'
                : 'Resolve the items marked in red first. Warnings are safe to run with, but should be cleared before a live exam.'}
            </p>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <div className="stat">
              <div className="stat-label">Environment</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{data.environment.nodeEnv}</div>
              <div className="stat-meta">Node {data.environment.node}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Sign-in</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{data.environment.authMode}</div>
              <div className="stat-meta">Firebase project {data.environment.projectId}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Certificates</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{data.environment.provider}</div>
              <div className="stat-meta">
                {data.environment.firestoreMirror ? 'Firestore mirror on' : 'Firestore mirror off'}
              </div>
            </div>
          </div>

          <Card title="Checks" subtitle="Live state, re-read on every visit — not a static checklist." noPad>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Area</th>
                    <th>Check</th>
                    <th>Detail</th>
                    <th style={{ textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((check) => (
                    <tr key={check.id}>
                      <td className="tiny muted" style={{ verticalAlign: 'top' }}>
                        {GROUP_LABEL[check.group]}
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <div className="strong small">{check.label}</div>
                      </td>
                      <td style={{ verticalAlign: 'top' }}>
                        <div className="small">{check.detail}</div>
                        {check.action ? (
                          <div className="tiny" style={{ color: 'var(--muted)', marginTop: 3 }}>
                            → {check.action}
                          </div>
                        ) : null}
                        {check.docs ? (
                          <div className="tiny" style={{ marginTop: 3 }}>
                            <span className="mono muted">{check.docs}</span>
                          </div>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <Badge tone={TONE[check.status]} dot={false}>
                          {ICON[check.status]} {check.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-2" style={{ marginTop: 16 }}>
            <Card title="Before the first real certificate" subtitle="Four steps that cannot be automated from here">
              <ol className="steps">
                <li>
                  Install the Apps Script bridge (or configure a service account) and set the provider to
                  <span className="mono"> apps_script</span> / <span className="mono">google_api</span>.
                </li>
                <li>Run the provider test above until it reports reachable and lists all three tabs.</li>
                <li>
                  Issue one certificate to your own address and open the PDF — check the name, course, date, QR and that
                  the signature area is gone.
                </li>
                <li>Only then turn email test mode off.</li>
              </ol>
              <Link to="/admin/settings" className="btn btn-subtle btn-sm" style={{ marginTop: 10 }}>
                Open workspace settings
              </Link>
            </Card>
            <Card title="Environment detail" subtitle="Useful when filing a support request">
              <div className="kv-list">
                <div>
                  <span>Public base URL</span>
                  <b className="mono small">{data.environment.appBaseUrl}</b>
                </div>
                <div>
                  <span>Timezone</span>
                  <b>{data.environment.timezone}</b>
                </div>
                <div>
                  <span>Database</span>
                  <b className="mono small">{data.environment.databasePath}</b>
                </div>
                <div>
                  <span>Email test mode</span>
                  <b>{data.environment.emailTestMode ? 'on' : 'off'}</b>
                </div>
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>
                This page never displays credentials. Service-account paths and bridge secrets stay in the API
                environment.
              </p>
            </Card>
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}
