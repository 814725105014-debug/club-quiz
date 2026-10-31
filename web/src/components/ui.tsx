import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import type { Tone } from '../lib/format';

/* --------------------------------- Button -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'gold' | 'ghost' | 'subtle' | 'danger' | 'default';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
};

export function Button({
  variant = 'default',
  size = 'md',
  block,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variant !== 'default' ? `btn-${variant}` : '',
    size !== 'md' ? `btn-${size}` : '',
    block ? 'btn-block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <span className={`spinner ${variant === 'primary' ? 'spinner-light' : ''}`} /> : null}
      {children}
    </button>
  );
}

/* --------------------------------- Badge --------------------------------- */

export function Badge({ tone = 'grey', children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return <span className={`badge badge-${tone} ${dot ? '' : 'badge-plain'}`}>{children}</span>;
}

/* ---------------------------------- Card --------------------------------- */

export function Card({
  children,
  className = '',
  title,
  subtitle,
  actions,
  footer,
  bodyClass = '',
  noPad,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  bodyClass?: string;
  noPad?: boolean;
}) {
  return (
    <div className={`card ${className}`}>
      {title || actions ? (
        <div className="card-head">
          <div>
            <h3>{title}</h3>
            {subtitle ? <div className="tiny muted" style={{ marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          {actions ? <div className="card-head-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children ? <div className={noPad ? bodyClass : `card-body ${bodyClass}`}>{children}</div> : null}
      {footer ? <div className="card-foot">{footer}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  meta,
  icon,
}: {
  label: string;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stat-label">{label}</div>
        {icon ? <div style={{ opacity: 0.55, fontSize: 16 }}>{icon}</div> : null}
      </div>
      <div className="stat-value">{value}</div>
      {meta ? <div className="stat-meta">{meta}</div> : null}
    </div>
  );
}

/* --------------------------------- Fields -------------------------------- */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
  className = '',
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="req">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <div className="field-error">{error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <input id={id} className={`input ${className}`} {...rest} />
    </Field>
  );
}

export function Textarea({
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode; error?: string | null }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea id={id} className={`textarea ${className}`} {...rest} />
    </Field>
  );
}

export function Select({
  label,
  hint,
  error,
  required,
  children,
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <select id={id} className={`select ${className}`} {...rest}>
        {children}
      </select>
    </Field>
  );
}

export function Checkbox({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="check" style={disabled ? { opacity: 0.55 } : undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="check-title">{label}</span>
        {hint ? <span className="check-hint" style={{ display: 'block' }}>{hint}</span> : null}
      </span>
    </label>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  closeLabel = 'Close',
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${size === 'lg' ? 'modal-lg' : ''}`} role="dialog" aria-modal="true" ref={ref}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label={closeLabel}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="subtle" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div style={{ fontSize: 13.6 }}>{message}</div>
    </Modal>
  );
}

/* ---------------------------------- Tabs --------------------------------- */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: ReactNode; badge?: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={active === tab.id}
          className={`tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge !== undefined ? <span style={{ marginLeft: 6, opacity: 0.7 }}>{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ States ---------------------------------- */

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block">
      <span className="spinner" /> {label}
    </div>
  );
}

export function EmptyState({
  icon = '◇',
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action}
    </div>
  );
}

/* --------------------------------- Toasts -------------------------------- */

type Toast = { id: number; message: string; tone: 'info' | 'success' | 'error' };

const ToastContext = createContext<{ toast: (message: string, tone?: Toast['tone']) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Toast['tone'] = 'info') => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-layer" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === 'success' ? 'toast-success' : t.tone === 'error' ? 'toast-error' : ''}`}>
            <span>{t.tone === 'success' ? '✓' : t.tone === 'error' ? '!' : 'ℹ'}</span>
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx.toast;
}

/* ------------------------------- misc bits ------------------------------- */

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this value:', value);
    }
  };
  return (
    <Button size="sm" variant="subtle" onClick={copy}>
      {copied ? 'Copied ✓' : label}
    </Button>
  );
}
