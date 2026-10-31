import { Fragment, useMemo, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Card, EmptyState, Input, Loading, Select } from '../components/ui';
import { useApi } from '../lib/hooks';
import { formatDateTime, relativeTime } from '../lib/format';

interface AuditEntry {
  id: number;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: '', label: 'All activity' },
  { value: 'auth', label: 'Sign-in / security' },
  { value: 'quiz', label: 'Quizzes' },
  { value: 'question', label: 'Questions' },
  { value: 'participant', label: 'Participants' },
  { value: 'attempt', label: 'Attempts' },
  { value: 'certificate', label: 'Certificates' },
  { value: 'email', label: 'Email' },
  { value: 'settings', label: 'Settings' },
  { value: 'user', label: 'Team' },
  { value: 'sheet', label: 'Spreadsheet sync' },
];

export default function Audit() {
  const { data, loading, error } = useApi<{ entries: AuditEntry[] }>('/admin/audit?limit=500');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.entries ?? []).filter((entry) => {
      const matchesCategory = !category || entry.action.startsWith(`${category}.`);
      const matchesTerm =
        !term ||
        entry.action.toLowerCase().includes(term) ||
        (entry.actor_email ?? '').toLowerCase().includes(term) ||
        (entry.entity ?? '').toLowerCase().includes(term) ||
        (entry.detail ?? '').toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [data, search, category]);

  return (
    <AdminLayout
      title="Audit trail"
      crumb="Administration · every privileged action"
      actions={<span className="tiny muted">{rows.length} of {data?.entries.length ?? 0} events</span>}
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <Card
        title="Activity log"
        subtitle="Login attempts, quiz lifecycle, live controls, certificate issuance and spreadsheet writes are all recorded with actor, IP and timestamp."
        noPad
      >
        <div className="filters" style={{ padding: '14px 16px 0' }}>
          <Input
            placeholder="Search action, actor or detail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="grow"
          />
          <Select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 210 }}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        {loading ? (
          <Loading label="Loading the audit trail…" />
        ) : rows.length === 0 ? (
          <EmptyState icon="◎" title="No matching events" message="Try a different filter or perform an action in the dashboard." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>When</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>IP</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <Fragment key={entry.id}>
                    <tr className="audit-row" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                      <td>
                        <div className="small">{formatDateTime(entry.created_at)}</div>
                        <div className="tiny muted">{relativeTime(entry.created_at)}</div>
                      </td>
                      <td>
                        <code className="mono small">{entry.action}</code>
                      </td>
                      <td>
                        <div className="small">{entry.entity ?? '—'}</div>
                        {entry.entity_id ? <div className="tiny muted mono">{entry.entity_id.slice(0, 18)}</div> : null}
                      </td>
                      <td className="small">{entry.actor_email ?? 'system'}</td>
                      <td className="tiny muted mono">{entry.ip ?? '—'}</td>
                      <td className="tiny muted" style={{ textAlign: 'right' }}>
                        {entry.detail ? (expanded === entry.id ? '−' : '+') : ''}
                      </td>
                    </tr>
                    {expanded === entry.id && entry.detail ? (
                      <tr>
                        <td colSpan={6} style={{ background: '#fbf9fc' }}>
                          <pre className="json-block">{entry.detail}</pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}
