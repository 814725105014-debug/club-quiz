import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, EmptyState, Field, Input, Loading, Textarea, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { apiErrorMessage, formatDateTime, relativeTime } from '../lib/format';
import { useApi } from '../lib/hooks';

type TemplateKey = 'certificate_delivery' | 'submission_confirmation' | 'certificate_regenerated';
interface Template {
  subject: string;
  body: string;
}
interface TemplatesResponse {
  templates: Record<TemplateKey, Template>;
  defaults: Record<TemplateKey, Template>;
  variables: string[];
}
interface EmailRow {
  id: string;
  template_key: string;
  to_email: string;
  actual_recipient: string;
  subject: string;
  status: string;
  error: string | null;
  attempt_count: number;
  created_at: string;
  sent_at: string | null;
  certificate_id: string | null;
}

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  certificate_delivery: 'Certificate delivery',
  submission_confirmation: 'Submission confirmation',
  certificate_regenerated: 'Certificate reissue',
};

export default function Emails() {
  const toast = useToast();
  const [tab, setTab] = useState<'templates' | 'log'>('templates');

  return (
    <AdminLayout title="Email log" crumb="Workspace · delivery & templates">
      <div className="tabs-row" style={{ marginBottom: 16 }}>
        <div className="tabs">
          <button className={`tab ${tab === 'templates' ? 'active' : ''}`} onClick={() => setTab('templates')}>
            Templates
          </button>
          <button className={`tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
            Delivery log
          </button>
        </div>
        <span className="tiny muted">
          Test mode redirects every message to the configured admin inbox.
        </span>
      </div>
      {tab === 'templates' ? <Templates onSaved={() => toast('Template saved.', 'success')} /> : <DeliveryLog />}
    </AdminLayout>
  );
}

function Templates({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const { data, loading } = useApi<TemplatesResponse>('/admin/email-templates');
  const [key, setKey] = useState<TemplateKey>('certificate_delivery');
  const [draft, setDraft] = useState<Template>({ subject: '', body: '' });
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState('');

  useEffect(() => {
    if (data?.templates?.[key]) setDraft(data.templates[key]);
  }, [data, key]);

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/email-templates/${key}`, draft);
      onSaved();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      const result = await api.post<{ recipient: string; testMode: boolean }>('/admin/emails/test', {
        to: testTo || undefined,
      });
      toast(`Test email queued to ${result.recipient}${result.testMode ? ' (test mode)' : ''}.`, 'success');
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  if (loading && !data) return <Loading label="Loading templates…" />;

  const variables = data?.variables ?? [];

  return (
    <div className="grid grid-sidebar">
      <Card title="Message templates" subtitle="Editable subjects and bodies used by automated delivery.">
        <div className="stack" style={{ gap: 8 }}>
          {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((templateKey) => (
            <button
              key={templateKey}
              className={`template-pick ${key === templateKey ? 'active' : ''}`}
              onClick={() => setKey(templateKey)}
            >
              <span className="tpl-icon">
                <Icon name="mail" size={15} />
              </span>
              <span>
                <b>{TEMPLATE_LABELS[templateKey]}</b>
                <em>{data?.templates?.[templateKey]?.subject ?? '—'}</em>
              </span>
            </button>
          ))}
        </div>
        <hr className="divider" />
        <Field label="Send a test message" hint="In test mode the message is redirected to the admin inbox, never to students.">
          <div className="row" style={{ gap: 8 }}>
            <Input
              placeholder="admin@srmtrp.example.edu"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="subtle" onClick={sendTest}>
              Send test
            </Button>
          </div>
        </Field>
      </Card>

      <Card
        title={TEMPLATE_LABELS[key]}
        subtitle="Placeholders are replaced at delivery time."
        actions={
          <Button size="sm" variant="primary" onClick={save} loading={saving}>
            Save template
          </Button>
        }
      >
        <Field label="Subject line">
          <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </Field>
        <Field label="HTML body">
          <Textarea
            rows={16}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
          />
        </Field>
        <div className="tpl-vars">
          {variables.map((variable) => (
            <button
              key={variable}
              className="var-chip"
              onClick={() => setDraft({ ...draft, body: `${draft.body}${variable}` })}
              title="Insert into body"
            >
              {variable}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const fallback = data?.defaults?.[key];
              if (fallback) setDraft(fallback);
            }}
          >
            Reset to default
          </Button>
          <span className="tiny muted">Templates are HTML; plain paragraphs and links are safest.</span>
        </div>
      </Card>
    </div>
  );
}

function DeliveryLog() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useApi<{ emails: EmailRow[] }>(
    `/admin/emails?${new URLSearchParams({ ...(status ? { status } : {}), ...(search ? { search } : {}) }).toString()}`,
    [status, search],
  );

  const resend = async (id: string) => {
    try {
      await api.post(`/admin/emails/${id}/resend`);
      toast('Email queued for delivery.', 'success');
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  return (
    <Card
      title="Delivery log"
      subtitle="Every automated and manual message, including redirected test-mode deliveries."
      actions={
        <Button size="sm" variant="subtle" onClick={reload}>
          Refresh
        </Button>
      }
      noPad
    >
      <div className="filters" style={{ padding: '14px 16px 0' }}>
        <Input placeholder="Search recipient or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="grow" />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 180 }}>
          <option value="">All statuses</option>
          {['queued', 'sent', 'redirected', 'failed', 'pending', 'skipped'].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      {error ? <div className="alert alert-error" style={{ margin: 16 }}>{error}</div> : null}
      {loading && !data ? (
        <Loading label="Loading delivery history…" />
      ) : (data?.emails.length ?? 0) === 0 ? (
        <EmptyState icon="✉" title="No emails yet" message="Messages appear here when certificates are issued or confirmations are sent." />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Template</th>
                <th>Subject</th>
                <th>Status</th>
                <th>When</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data!.emails.map((email) => (
                <tr key={email.id}>
                  <td>
                    <div className="small strong">{email.to_email}</div>
                    {email.actual_recipient !== email.to_email ? (
                      <div className="tiny muted">redirected to {email.actual_recipient}</div>
                    ) : null}
                  </td>
                  <td className="small">{email.template_key.replace(/_/g, ' ')}</td>
                  <td className="small">
                    {email.subject}
                    {email.error ? <div className="tiny" style={{ color: 'var(--red-600)' }}>{email.error}</div> : null}
                  </td>
                  <td>
                    <Badge
                      tone={
                        email.status === 'sent' || email.status === 'redirected'
                          ? 'green'
                          : email.status === 'failed'
                            ? 'red'
                            : 'amber'
                      }
                    >
                      {email.status}
                    </Badge>
                    {email.attempt_count > 1 ? <div className="tiny muted">{email.attempt_count} attempts</div> : null}
                  </td>
                  <td>
                    <div className="small">{formatDateTime(email.sent_at ?? email.created_at)}</div>
                    <div className="tiny muted">{relativeTime(email.sent_at ?? email.created_at)}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button size="sm" variant="ghost" onClick={() => void resend(email.id)}>
                      Resend
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
