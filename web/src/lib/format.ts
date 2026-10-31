const TZ = 'Asia/Kolkata';

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Converts a local (Asia/Kolkata) datetime-local string into an ISO instant. */
export function fromKolkataInput(value: string): string | null {
  if (!value) return null;
  // input format: YYYY-MM-DDTHH:mm — interpret as IST (+05:30)
  const date = new Date(`${value}:00+05:30`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Converts an ISO instant into a value usable by <input type="datetime-local"> in IST. */
export function toKolkataInput(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function relativeTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return '—';
  const diff = date - Date.now();
  const abs = Math.abs(diff);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 1000],
    ['minute', 60_000],
    ['hour', 3_600_000],
    ['day', 86_400_000],
    ['month', 2_592_000_000],
    ['year', 31_536_000_000],
  ];
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) if (abs >= unit[1]) chosen = unit;
  return formatter.format(Math.round(diff / chosen[1]), chosen[0]);
}

export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function durationLabel(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

export function percent(value?: number | null, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(digits)}%`;
}

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  scheduled: 'Scheduled',
  active: 'Live',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
  in_progress: 'In progress',
  submitted: 'Submitted',
  auto_submitted: 'Auto-submitted',
  pending: 'Pending',
  queued: 'Queued',
  generating: 'Generating',
  generated: 'Generated',
  failed: 'Failed',
  sent: 'Sent',
  redirected: 'Redirected (test)',
  skipped: 'Skipped',
  done: 'Done',
  open: 'Open',
  closed: 'Closed',
};

export function statusLabel(status?: string | null): string {
  if (!status) return '—';
  return STATUS_LABEL[status] ?? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export type Tone = 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'grey';

export function statusTone(status?: string | null): Tone {
  switch (status) {
    case 'active':
    case 'published':
    case 'generated':
    case 'sent':
    case 'done':
    case 'open':
      return 'green';
    case 'paused':
    case 'scheduled':
    case 'queued':
    case 'pending':
    case 'redirected':
    case 'generating':
      return 'amber';
    case 'failed':
    case 'archived':
      return 'red';
    case 'completed':
    case 'submitted':
    case 'auto_submitted':
      return 'purple';
    case 'draft':
    case 'skipped':
    case 'closed':
    default:
      return 'grey';
  }
}

export function quizStatusTone(status: string): Tone {
  if (status === 'active') return 'green';
  if (status === 'paused') return 'amber';
  if (status === 'scheduled') return 'blue';
  if (status === 'completed') return 'purple';
  if (status === 'archived') return 'grey';
  return 'grey';
}

export function apiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
