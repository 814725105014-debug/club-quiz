import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, Field, Input, Loading, Modal, Select, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { apiErrorMessage, formatDateTime } from '../lib/format';
import { useApi } from '../lib/hooks';
import { useSession, ROLE_LABEL } from '../lib/session';
import type { Role } from '../lib/types';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

const ROLE_HELP: Record<Role, string> = {
  super_admin: 'Full access including team management and workspace settings.',
  quiz_admin: 'Manage quizzes, questions, certificates, fields and sync.',
  quiz_host: 'Host live sessions, control quizzes, view participants.',
  results_viewer: 'Read-only access to results, certificates and audit.',
};

export default function Users() {
  const toast = useToast();
  const { user, can } = useSession();
  const { data, loading, error, reload } = useApi<{ users: UserRow[] }>('/admin/users');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  if (!can('super_admin')) {
    return (
      <AdminLayout title="Team & access" crumb="Administration">
        <div className="alert alert-warn">
          Only a super administrator can manage the team. Ask the platform owner to grant access.
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Team & access"
      crumb="Administration · role-based access control"
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> Add administrator
        </Button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}
      <Card
        title="Administrators"
        subtitle="Passwords are hashed with scrypt; signing out revokes the session immediately. Role changes apply on the next request."
        noPad
      >
        {loading && !data ? (
          <Loading label="Loading administrators…" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th style={{ textAlign: 'right' }}>Manage</th>
                </tr>
              </thead>
              <tbody>
                {(data?.users ?? []).map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="strong small">
                        {row.name}
                        {row.id === user?.id ? <span className="badge badge-purple" style={{ marginLeft: 8 }}>you</span> : null}
                      </div>
                      <div className="tiny muted">{row.email}</div>
                    </td>
                    <td>
                      <div className="small">{ROLE_LABEL[row.role]}</div>
                      <div className="tiny muted" style={{ maxWidth: '36ch' }}>{ROLE_HELP[row.role]}</div>
                    </td>
                    <td>
                      <Badge tone={row.is_active ? 'green' : 'grey'}>{row.is_active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="small">{row.last_login_at ? formatDateTime(row.last_login_at) : 'Never'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="callout callout-info" style={{ marginTop: 16 }}>
        <b>Least privilege by default</b>
        Quiz hosts can host sessions but cannot change workspace settings or manage other administrators. Results viewers
        cannot modify anything.
      </div>

      <CreateUserModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          toast('Administrator added.', 'success');
          reload();
        }}
      />
      <EditUserModal
        row={editing}
        currentUserId={user?.id}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          toast('Administrator updated.', 'success');
          reload();
        }}
      />
    </AdminLayout>
  );
}

function CreateUserModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', role: 'quiz_host' as Role, password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post('/admin/users', form);
      setForm({ name: '', email: '', role: 'quiz_host', password: '' });
      onSaved();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add administrator"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create account
          </Button>
        </>
      }
    >
      <Field label="Full name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dr. R. Kumar" />
      </Field>
      <Field label="Email address" hint="Used as the sign-in identifier.">
        <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Role" hint={ROLE_HELP[form.role]}>
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Temporary password" hint="At least 10 characters. Share it over a secure channel; they can change it in settings.">
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>
    </Modal>
  );
}

function EditUserModal({
  row,
  currentUserId,
  onClose,
  onSaved,
}: {
  row: UserRow | null;
  currentUserId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<{ name: string; role: Role; isActive: boolean; password: string }>({
    name: '',
    role: 'quiz_host',
    isActive: true,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (row) setForm({ name: row.name, role: row.role, isActive: Boolean(row.is_active), password: '' });
  }, [row]);

  const submit = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await api.patch(`/admin/users/${row.id}`, {
        name: form.name,
        role: form.role,
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {}),
      });
      onSaved();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(row)}
      onClose={onClose}
      title={row ? `Edit ${row.email}` : 'Edit administrator'}
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Save changes
          </Button>
        </>
      }
    >
      <Field label="Full name">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Role" hint={ROLE_HELP[form.role]}>
        <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Account status"
        hint={row?.id === currentUserId ? 'You cannot disable your own account.' : 'Disabled accounts are signed out immediately.'}
      >
        <Select value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}>
          <option value="1">Active</option>
          <option value="0">Disabled</option>
        </Select>
      </Field>
      <Field label="Reset password" hint="Leave blank to keep the current password. Resetting revokes existing sessions.">
        <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </Field>
    </Modal>
  );
}
