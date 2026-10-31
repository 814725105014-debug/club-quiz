import { env } from '../env.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function addSeconds(iso: string, seconds: number): string {
  return new Date(new Date(iso).getTime() + seconds * 1000).toISOString();
}

export function isPast(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() <= Date.now();
}

export function msBetween(fromIso: string, toIso: string): number {
  return new Date(toIso).getTime() - new Date(fromIso).getTime();
}

export function secondsBetween(fromIso: string, toIso: string): number {
  return Math.round(msBetween(fromIso, toIso) / 1000);
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: env.timezone,
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: env.timezone,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  return dateTimeFormatter.format(new Date(iso));
}

export function isoFromLocalInput(value: string): string {
  // datetime-local inputs arrive as "YYYY-MM-DDTHH:mm" in the host's local wall clock
  // (Asia/Kolkata by default for this deployment). Normalise to a UTC ISO string.
  if (!value) return '';
  if (value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value)) return new Date(value).toISOString();
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const offsetMs = timezoneOffsetMinutes(new Date(), env.timezone) * 60_000;
  const utcMs = new Date(`${withSeconds}Z`).getTime() - offsetMs;
  return new Date(utcMs).toISOString();
}

/** Minutes that the given timezone is ahead of UTC at the supplied instant. */
export function timezoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, number> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value);
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, map.hour % 24, map.minute, map.second);
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Value for an <input type="datetime-local"> in the deployment timezone. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const offset = timezoneOffsetMinutes(d, env.timezone);
  const local = new Date(d.getTime() + offset * 60_000);
  return local.toISOString().slice(0, 16);
}
