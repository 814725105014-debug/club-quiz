import { useEffect, useState } from 'react';
import { AdminLayout } from '../components/Layout';
import { Badge, Button, Card, Checkbox, EmptyState, Field, Input, Loading, Modal, Select, useToast } from '../components/ui';
import { Icon } from '../components/Icon';
import { api } from '../lib/api';
import { apiErrorMessage } from '../lib/format';
import { useApi } from '../lib/hooks';
import type { FieldRow } from '../lib/types';

type FieldDraft = {
  key: string;
  label: string;
  type: FieldRow['type'];
  required: boolean;
  enabled: boolean;
  pattern: string;
  patternHint: string;
  options: string;
  mapsToSheetColumn: string;
  mapsToPlaceholder: string;
};

const EMPTY: FieldDraft = {
  key: '',
  label: '',
  type: 'text',
  required: true,
  enabled: true,
  pattern: '',
  patternHint: '',
  options: '',
  mapsToSheetColumn: '',
  mapsToPlaceholder: '',
};

export default function Fields() {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ fields: FieldRow[] }>('/admin/fields');
  const [editing, setEditing] = useState<FieldRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<FieldRow | null>(null);
  const [busy, setBusy] = useState(false);

  const fields = data?.fields ?? [];

  const move = async (index: number, direction: -1 | 1) => {
    const next = [...fields];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try {
      await api.post('/admin/fields/reorder', { orderedIds: next.map((f) => f.id) });
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  const toggle = async (field: FieldRow) => {
    try {
      await api.patch(`/admin/fields/${field.id}`, { enabled: !field.enabled });
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/admin/fields/${deleting.id}`);
      toast('Field removed from the registration form.', 'success');
      setDeleting(null);
      reload();
    } catch (err) {
      toast(apiErrorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout
      title="Registration form"
      crumb="Workspace · participant fields"
      actions={
        <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
          <Icon name="plus" size={14} /> Add field
        </Button>
      }
    >
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="callout callout-info" style={{ marginBottom: 16 }}>
        <b>Field changes are non-destructive</b>
        Renaming a label or disabling a field never deletes stored participant data or reorders spreadsheet columns.
        Core fields (name, email, register number, department) can be relabelled but not deleted; new fields map to a new
        spreadsheet column only when you give them one.
      </div>

      <div className="grid grid-sidebar">
        <Card title="Form fields" subtitle="Order here is the order students see on mobile." noPad>
          {loading && !data ? (
            <Loading label="Loading fields…" />
          ) : fields.length === 0 ? (
            <EmptyState icon="▤" title="No fields" message="Add registration fields to collect participant details." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 54 }}>Order</th>
                    <th>Field</th>
                    <th>Validation</th>
                    <th>Sheet column</th>
                    <th>State</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field, index) => (
                    <tr key={field.id}>
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => void move(index, -1)} disabled={index === 0} aria-label="Move up">
                            ↑
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => void move(index, 1)}
                            disabled={index === fields.length - 1}
                            aria-label="Move down"
                          >
                            ↓
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="strong small">
                          {field.label}
                          {field.is_core ? <span className="badge badge-purple" style={{ marginLeft: 6 }}>core</span> : null}
                        </div>
                        <div className="tiny muted mono">{field.key} · {field.type}</div>
                      </td>
                      <td>
                        <div className="tiny muted mono" style={{ maxWidth: '30ch', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {field.pattern ?? (field.type === 'email' ? 'email format' : '—')}
                        </div>
                        {field.pattern_hint ? <div className="tiny muted">{field.pattern_hint}</div> : null}
                      </td>
                      <td className="tiny">{field.maps_to_sheet_column ?? '—'}</td>
                      <td>
                        <Badge tone={field.enabled ? 'green' : 'grey'}>{field.enabled ? 'Shown' : 'Hidden'}</Badge>
                        {field.required ? <div className="tiny muted">required</div> : null}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(field)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void toggle(field)}>
                          {field.enabled ? 'Hide' : 'Show'}
                        </Button>
                        {!field.is_core ? (
                          <Button size="sm" variant="ghost" onClick={() => setDeleting(field)}>
                            <Icon name="trash" size={13} />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Student preview" subtitle="Exactly what appears on the phone.">
          <div className="phone-preview">
            <div className="pp-head">
              <b>Register to participate</b>
              <span>Use the same details as your college record.</span>
            </div>
            {fields.filter((f) => f.enabled).map((field) => (
              <div className="pp-field" key={field.id}>
                <span>
                  {field.label}
                  {field.required ? <i>*</i> : null}
                </span>
                <div className="pp-input">{field.type === 'select' ? 'Select…' : field.pattern_hint ?? field.label}</div>
              </div>
            ))}
            <div className="pp-button">Register &amp; continue</div>
          </div>
        </Card>
      </div>

      <FieldModal
        open={creating || Boolean(editing)}
        field={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={(message) => {
          setCreating(false);
          setEditing(null);
          toast(message, 'success');
          reload();
        }}
      />

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Remove this field?"
        footer={
          <>
            <Button variant="subtle" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              Remove field
            </Button>
          </>
        }
      >
        <p className="small">
          <b>{deleting?.label}</b> will disappear from the registration form. Existing participant records keep their
          stored values and the spreadsheet column is untouched.
        </p>
      </Modal>
    </AdminLayout>
  );
}

function FieldModal({
  open,
  field,
  onClose,
  onSaved,
}: {
  open: boolean;
  field: FieldRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<FieldDraft>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (field) {
      setDraft({
        key: field.key,
        label: field.label,
        type: field.type,
        required: Boolean(field.required),
        enabled: Boolean(field.enabled),
        pattern: field.pattern ?? '',
        patternHint: field.pattern_hint ?? '',
        options: field.options ?? '',
        mapsToSheetColumn: field.maps_to_sheet_column ?? '',
        mapsToPlaceholder: field.maps_to_placeholder ?? '',
      });
    } else {
      setDraft(EMPTY);
    }
  }, [open, field]);

  const submit = async () => {
    setBusy(true);
    try {
      const payload = {
        key: draft.key.trim(),
        label: draft.label.trim(),
        type: draft.type,
        required: draft.required,
        enabled: draft.enabled,
        pattern: draft.pattern.trim() || null,
        patternHint: draft.patternHint.trim() || null,
        options: draft.options.trim() || null,
        mapsToSheetColumn: draft.mapsToSheetColumn.trim() || null,
        mapsToPlaceholder: draft.mapsToPlaceholder.trim() || null,
      };
      if (field) {
        await api.patch(`/admin/fields/${field.id}`, payload);
        onSaved('Field updated.');
      } else {
        await api.post('/admin/fields', payload);
        onSaved('Field added.');
      }
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
      title={field ? `Edit “${field.label}”` : 'Add registration field'}
      size="lg"
      footer={
        <>
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            {field ? 'Save field' : 'Add field'}
          </Button>
        </>
      }
    >
      <div className="grid grid-2">
        <Field label="Label" hint="Shown above the input.">
          <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </Field>
        <Field label="Key" hint={field?.is_core ? 'Core field keys cannot change.' : 'Lowercase identifier, e.g. department.'}>
          <Input
            value={draft.key}
            disabled={Boolean(field?.is_core)}
            onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          />
        </Field>
        <Field label="Input type">
          <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as FieldDraft['type'] })}>
            <option value="text">Text</option>
            <option value="email">Email</option>
            <option value="number">Number</option>
            <option value="tel">Phone</option>
            <option value="select">Dropdown</option>
          </Select>
        </Field>
        <Field label="Dropdown options" hint="Comma-separated, only for dropdown fields.">
          <Input value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} placeholder="CSE, ECE, EEE, MECH" />
        </Field>
        <Field label="Validation pattern" hint="Optional JavaScript regular expression.">
          <Input value={draft.pattern} onChange={(e) => setDraft({ ...draft, pattern: e.target.value })} placeholder="^[0-9]{12}$" />
        </Field>
        <Field label="Pattern hint" hint="Helper text shown under the input.">
          <Input value={draft.patternHint} onChange={(e) => setDraft({ ...draft, patternHint: e.target.value })} placeholder="12-digit register number" />
        </Field>
        <Field label="Spreadsheet column" hint="Existing column header in Form Responses. Leave blank for no sync.">
          <Input
            value={draft.mapsToSheetColumn}
            onChange={(e) => setDraft({ ...draft, mapsToSheetColumn: e.target.value })}
            placeholder="Department"
          />
        </Field>
        <Field label="Certificate placeholder" hint="Advanced: maps this value into the Slides template.">
          <Input
            value={draft.mapsToPlaceholder}
            onChange={(e) => setDraft({ ...draft, mapsToPlaceholder: e.target.value })}
            placeholder="{{NAME}}"
          />
        </Field>
      </div>
      <div className="row" style={{ gap: 18, marginTop: 4 }}>
        <Checkbox label="Required" checked={draft.required} onChange={(next) => setDraft({ ...draft, required: next })} />
        <Checkbox label="Visible on the form" checked={draft.enabled} onChange={(next) => setDraft({ ...draft, enabled: next })} />
      </div>
    </Modal>
  );
}
