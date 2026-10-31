/**
 * Renders every route of the SPA against the live API using jsdom, so a broken page
 * fails CI instead of failing in front of students. Run with: npx tsx scripts/ui-smoke.tsx
 */
import { JSDOM } from 'jsdom';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:4000';
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: BASE,
  pretendToBeVisual: true,
});

const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
g.location = dom.window.location;
g.history = dom.window.history;
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.MutationObserver = dom.window.MutationObserver;
g.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
g.requestAnimationFrame = (cb: FrameRequestCallback) => dom.window.setTimeout(() => cb(Date.now()), 16) as unknown as number;
g.cancelAnimationFrame = (id: number) => dom.window.clearTimeout(id);
g.IS_REACT_ACT_ENVIRONMENT = false;
dom.window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as unknown as typeof dom.window.matchMedia;
dom.window.scrollTo = () => undefined;

// --- authenticated fetch shim -------------------------------------------------
const realFetch = globalThis.fetch;
const login = await realFetch(`${BASE}/api/admin/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: process.env.SMOKE_EMAIL ?? 'admin@srmtrp.example.edu',
    password: process.env.SMOKE_PASSWORD ?? 'ChangeMe!2026',
  }),
});
if (!login.ok) throw new Error(`login failed: ${login.status}`);
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(';')[0])
  .find((c) => c.startsWith('qp_session='));
if (!cookie) throw new Error('no session cookie');
await login.text();

g.fetch = ((input: string | URL | Request, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const absolute = url.startsWith('http') ? url : `${BASE}${url}`;
  const headers = new Headers(init.headers);
  headers.set('Cookie', cookie);
  return realFetch(absolute, { ...init, headers });
}) as typeof fetch;

// --- import the app after the DOM exists --------------------------------------
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { BrowserRouter } = await import('react-router-dom');
const { default: App } = await import('../web/src/App');

// Resolve the demo quiz dynamically: ids change whenever the database is reseeded.
let demoQuizId = '';
try {
  const quizzes = (await (await fetch(`${BASE}/api/admin/quizzes`, { headers: { Cookie: cookie } })).json()) as {
    quizzes?: { id: string; join_code: string }[];
  };
  demoQuizId = quizzes.quizzes?.find((q) => q.join_code === 'DEMO01')?.id ?? quizzes.quizzes?.[0]?.id ?? '';
} catch {
  demoQuizId = '';
}

const routes = [
  '/',
  '/admin/login',
  '/admin',
  '/admin/quizzes',
  '/admin/live',
  '/admin/participants',
  '/admin/results',
  '/admin/certificates',
  '/admin/fields',
  '/admin/sheets',
  '/admin/emails',
  '/admin/settings',
  '/admin/users',
  '/admin/audit',
  '/verify',
  '/present/DEMO01',
  '/j/DEMO01',
  ...(demoQuizId ? [`/admin/quizzes/${demoQuizId}`, `/admin/quizzes/${demoQuizId}/host`] : []),
];

const problems: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  const text = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
  if (/Warning: An update to|not wrapped in act|React Router Future Flag/.test(text)) return;
  problems.push(`console.error: ${text}`);
  originalError(...args);
};

const rootEl = dom.window.document.getElementById('root')!;
for (const route of routes) {
  dom.window.history.pushState({}, '', route);
  rootEl.innerHTML = '';
  const root = createRoot(rootEl);
  try {
    root.render(React.createElement(BrowserRouter, null, React.createElement(App)));
  } catch (err) {
    problems.push(`${route} threw during render: ${(err as Error).message}`);
  }
  await new Promise((resolve) => dom.window.setTimeout(resolve, 1600));
  const text = (rootEl.textContent ?? '').replace(/\s+/g, ' ').trim();
  const errorBanner = rootEl.querySelector('.alert-error')?.textContent?.trim();
  if (text.length < 40) problems.push(`${route} rendered almost nothing (${text.length} chars): "${text}"`);
  if (errorBanner) problems.push(`${route} showed error banner: ${errorBanner}`);
  console.log(`${route.padEnd(48)} ${text.length.toString().padStart(5)} chars  ${errorBanner ? 'ERROR BANNER' : 'ok'}  :: ${text.slice(-120)}`);
  root.unmount();
}

if (problems.length) {
  console.log('\nPROBLEMS:');
  for (const p of problems) console.log(' -', p);
  process.exitCode = 1;
} else {
  console.log('\nAll routes rendered without errors.');
}
process.exit(process.exitCode ?? 0);
