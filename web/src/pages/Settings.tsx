import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, Field, Input, Loading, Select, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSession } from '../lib/session';
import type { WorkspaceSettings } from '../lib/types';

type Draft = WorkspaceSettings['workspace'] & { sharedSecret: string };

export default function Settings() {
  const toast = useToast();
  const { can } = useSession();
  const { data, loading, error, reload } = useApi<WorkspaceSettings>('/admin/settings');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; tabs?: string[] } | null>(null);

  useEffect(() => {
    if (data && !draft) setDraft({ ...data.workspace, sharedSecret: '' });
  }, [data, draft]);

  const editable = can('super_admin');

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...draft };
      delete payload.sharedSecretSet;
      if (!draft.sharedSecret) delete payload.sharedSecret;
      await api.patch('/admin/settings/workspace', payload);
      toast('Workspace settings saved.', 'success');
      setDraft(null);
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await api.post<{ ok: boolean; message: string; provider: string; tabs: string[] }>(
        '/admin/settings/test-connection',
      );
      setTestResult({
        ok: result.ok,
        message: `${result.provider}: ${result.message}`,
        tabs: result.tabs,
      });
      toast(result.ok ? 'Connection successful.' : 'Connection could not be verified.', result.ok ? 'success' : 'error');
    } catch (err) {
      setTestResult({ ok: false, message: apiErrorMessage(err) });
      toast(apiErrorMessage(err), 'error');
    } finally {
      setTesting(false);
    }
  };

  if (loading && !data) {
    return (
      <AdminLayout title="Settings" crumb="Administration · workspace">
        <Loading label="Loading workspace settings…" />
      </AdminLayout>
    );
  }

  const workspace = data?.workspace;
  if (!draft) {
    return (
      <AdminLayout title="Settings" crumb="Administration · workspace">
        <div className="alert alert-error">{error ?? 'Settings could not be loaded.'}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Settings"
      crumb="Administration · Google Workspace & delivery"
      actions={
        <>
          <Button variant="subtle" size="sm" onClick={testConnection} loading={testing}>
            Test connection
          </Button>
          <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!editable}>
            Save settings
          </Button>
        </>
      }
    >
      {!editable ? (
        <div className="alert alert-warn">
          Only a super administrator can change workspace settings. You can review the current configuration below.
        </div>
      ) : null}

      <div className="callout callout-gold" style={{ marginBottom: 16 }}>
        <b>Existing Workspace resources</b>
        Template <code className="mono">{workspace?.templateId}</code> is copied for every certificate — the original is
        never modified. Sheet writes go through the configured bridge; secrets are stored server-side only and never
        returned to this browser.
      </div>

      {testResult ? (
        <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}>
          <span>{testResult.ok ? '✓' : '!'}</span>
          <div>
            <div>{testResult.message}</div>
            {testResult.tabs?.length ? <div className="tiny">Tabs found: {testResult.tabs.join(', ')}</div> : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <Card title="Integration provider" subtitle="How the server talks to Google Sheets, Slides and Gmail.">
          <Field label="Provider" hint="Mock writes to the local SQLite mirror and generates PDFs locally — used for development.">
            <Select value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value as Draft['provider'] })} disabled={!editable}>
              <option value="mock">Mock (local development)</option>
              <option value="apps_script">Apps Script bridge (recommended)</option>
              <option value="google_api">Google APIs (service account)</option>
            </Select>
          </Field>
          <Field label="Bridge webhook URL" hint="Deployed Apps Script web app /exec URL.">
            <Input value={draft.webhookUrl} onChange={(e) => setDraft({ ...draft, webhookUrl: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Shared secret" hint={workspace?.sharedSecretSet ? 'A secret is configured. Enter a new value to replace it.' : 'Not configured yet.'}>
            <Input
              type="password"
              placeholder={workspace?.sharedSecretSet ? '•••••••• (unchanged)' : 'Set a random shared secret'}
              value={draft.sharedSecret}
              onChange={(e) => setDraft({ ...draft, sharedSecret: e.target.value })}
              disabled={!editable}
            />
          </Field>
          <Field label="Impersonate email" hint="Google Workspace domain-wide delegation subject for Sheets/Slides/Gmail APIs.">
            <Input value={draft.impersonateEmail} onChange={(e) => setDraft({ ...draft, impersonateEmail: e.target.value })} disabled={!editable} />
          </Field>
        </Card>

        <Card title="Workspace resources" subtitle="IDs of the existing college assets.">
          <Field label="Spreadsheet ID">
            <Input value={draft.spreadsheetId} onChange={(e) => setDraft({ ...draft, spreadsheetId: e.target.value })} disabled={!editable} />
          </Field>
          <div className="grid grid-2">
            <Field label="Form responses tab">
              <Input value={draft.responsesTab} onChange={(e) => setDraft({ ...draft, responsesTab: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="Results tab">
              <Input value={draft.resultsTab} onChange={(e) => setDraft({ ...draft, resultsTab: e.target.value })} disabled={!editable} />
            </Field>
          </div>
          <Field label="Slides certificate template ID" hint="Always copied; the original template is preserved.">
            <Input value={draft.templateId} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Generated certificates folder ID">
            <Input value={draft.outputFolderId} onChange={(e) => setDraft({ ...draft, outputFolderId: e.target.value })} disabled={!editable} />
          </Field>
        </Card>

        <Card title="Certificate numbering" subtitle="Continues the existing series.">
          <div className="grid grid-3">
            <Field label="Prefix">
              <Input value={draft.certificatePrefix} onChange={(e) => setDraft({ ...draft, certificatePrefix: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="Year">
              <Input
                type="number"
                value={draft.certificateYear}
                onChange={(e) => setDraft({ ...draft, certificateYear: Number(e.target.value) })}
                disabled={!editable}
              />
            </Field>
            <Field label="Start number">
              <Input
                type="number"
                value={draft.certificateStartNumber}
                onChange={(e) => setDraft({ ...draft, certificateStartNumber: Number(e.target.value) })}
                disabled={!editable}
              />
            </Field>
          </div>
          <div className="code-chip" style={{ display: 'inline-flex' }}>
            Next: {draft.certificatePrefix}-{draft.certificateYear}-{String(draft.certificateStartNumber).padStart(4, '0')}
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            The number only increments when a certificate is actually issued. Failed generations release nothing, so the
            sequence never has holes.
          </p>
        </Card>

        <Card title="Delivery & branding" subtitle="Applies to emails, certificates and projector screens.">
          <div className="grid grid-2">
            <Field label="From address">
              <Input value={draft.emailFrom} onChange={(e) => setDraft({ ...draft, emailFrom: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="From name">
              <Input value={draft.emailFromName} onChange={(e) => setDraft({ ...draft, emailFromName: e.target.value })} disabled={!editable} />
            </Field>
          </div>
          <Field label="Organisation name">
            <Input value={draft.organizationName} onChange={(e) => setDraft({ ...draft, organizationName: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Institution line">
            <Input value={draft.institutionLine} onChange={(e) => setDraft({ ...draft, institutionLine: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Department">
            <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} disabled={!editable} />
          </Field>
          <div className="grid grid-2">
            <Field label="Public app base URL" hint="Used for join links and QR codes.">
              <Input value={draft.appBaseUrl} onChange={(e) => setDraft({ ...draft, appBaseUrl: e.target.value })} disabled={!editable} />
            </Field>
            <Field label="Certificate verify URL">
              <Input value={draft.verifyBaseUrl} onChange={(e) => setDraft({ ...draft, verifyBaseUrl: e.target.value })} disabled={!editable} />
            </Field>
          </div>
        </Card>
      </div>

      <Card title="Email safety" subtitle="Prevents accidental mail-outs while the platform is being configured.">
        <div className="row" style={{ justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: '56ch' }}>
            <div className="strong small">Test mode</div>
            <p className="tiny muted" style={{ margin: '2px 0 0' }}>
              When enabled, every outgoing email is redirected to the address below, regardless of the participant. The
              delivery log records the intended recipient and the redirect.
            </p>
          </div>
          <Badge tone={draft.emailTestMode ? 'amber' : 'green'}>{draft.emailTestMode ? 'ON — redirecting' : 'OFF — live delivery'}</Badge>
        </div>
        <div className="grid grid-2" style={{ marginTop: 12 }}>
          <Field label="Redirect all email to" hint="Use the coordinator's own inbox during testing.">
            <Input value={draft.emailRedirectTo} onChange={(e) => setDraft({ ...draft, emailRedirectTo: e.target.value })} disabled={!editable} />
          </Field>
          <Field label="Test mode">
            <Select
              value={draft.emailTestMode ? '1' : '0'}
              onChange={(e) => setDraft({ ...draft, emailTestMode: e.target.value === '1' })}
              disabled={!editable}
            >
              <option value="1">Enabled — redirect all messages</option>
              <option value="0">Disabled — send to real participants</option>
            </Select>
          </Field>
        </div>
        <Button variant="subtle" size="sm" onClick={() => setDraft({ ...draft, emailTestMode: true })} disabled={!editable}>
          <Icon name="shield" size={14} /> Keep me in test mode
        </Button>
      </Card>

      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <Button variant="primary" onClick={save} loading={saving} disabled={!editable}>
          Save workspace settings
        </Button>
      </div>
    </AdminLayout>
  );
}
