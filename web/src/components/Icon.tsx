import type { SVGProps } from 'react';

const PATHS: Record<string, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v4h-7zM14 11h7v10h-7zM3 14h7v7H3z',
  quiz: 'M9 3h6a2 2 0 0 1 2 2v14l-5-3-5 3V5a2 2 0 0 1 2-2Z M9 8h6',
  users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 20v-2a4 4 0 0 0-3-3.87 M16 2.13a4 4 0 0 1 0 7.75',
  certificate: 'M6 3h12a1 1 0 0 1 1 1v12H5V4a1 1 0 0 1 1-1Z M9 7h6 M9 10h6 M9 13h3 M8 16v5l4-2 4 2v-5',
  chart: 'M3 3v18h18 M7 15v3 M12 10v8 M17 6v12',
  sheet: 'M4 4h16v16H4z M4 9h16 M4 14h16 M10 4v16',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65 1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9v.09a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z',
  mail: 'M4 5h16v14H4z M4 6l8 6 8-6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z M9 12l2 2 4-4',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
  plus: 'M12 5v14 M5 12h14',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  download: 'M12 4v12 M7 11l5 5 5-5 M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1',
  qr: 'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h2v2h-2z M18 14h2v2h-2z M14 18h2v2h-2z M18 18h2v2h-2z',
  play: 'M6 4l14 8-14 8z',
  pause: 'M8 4h3v16H8z M13 4h3v16h-3z',
  stop: 'M6 6h12v12H6z',
  copy: 'M9 9h11v11H9z M4 15V4h11',
  external: 'M14 3h7v7 M21 3l-9 9 M18 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5',
  menu: 'M3 6h18 M3 12h18 M3 18h18',
  close: 'M5 5l14 14 M19 5L5 19',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 2 1 21h22L12 2Z M12 9v5 M12 18v.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 6v6l4 2',
  link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
  eye: 'M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trash: 'M3 6h18 M8 6V4h8v2 M6 6l1 15h10l1-15 M10 11v6 M14 11v6',
  edit: 'M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z M21 21l-4.35-4.35',
  arrowLeft: 'M19 12H5 M12 19l-7-7 7-7',
  spark: 'M12 2v6 M12 16v6 M2 12h6 M16 12h6 M5 5l4 4 M15 15l4 4 M19 5l-4 4 M9 15l-4 4',
};

export function Icon({
  name,
  size = 18,
  ...rest
}: { name: keyof typeof PATHS | string; size?: number } & SVGProps<SVGSVGElement>) {
  const path = PATHS[name] ?? PATHS.spark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {path.split(' M').map((segment, i) => (
        <path key={i} d={i === 0 ? segment : `M${segment}`} />
      ))}
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <div className="brand-mark">Q</div>
      {compact ? null : (
        <div>
          <div className="brand-name">QUIZ PLATFORM</div>
          <div className="brand-sub">SRM TRP · EMBEDX</div>
        </div>
      )}
    </div>
  );
}
