import { env } from './env.js';
import { createApp } from './app.js';
import { bootstrap } from './bootstrap.js';
import { startJobWorker } from './services/jobs.js';
import { handleJob } from './services/jobHandlers.js';
import { sweepExpiredAttempts } from './services/attempts.js';

bootstrap();

const app = createApp();

app.listen(env.port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`[quiz-platform] API + SPA listening on http://0.0.0.0:${env.port}`);
  // eslint-disable-next-line no-console
  console.log(`[quiz-platform] Google provider: ${env.google.provider}${env.google.dryRun ? ' (dry run)' : ''}`);
});

startJobWorker(handleJob);

const sweep = setInterval(() => {
  try {
    const closed = sweepExpiredAttempts();
    if (closed) console.log(`[sweeper] auto-submitted ${closed} expired attempt(s)`);
  } catch (err) {
    console.error('[sweeper] failed', err);
  }
}, 15_000);
sweep.unref?.();

process.on('SIGTERM', () => {
  console.log('[quiz-platform] shutting down');
  process.exit(0);
});
