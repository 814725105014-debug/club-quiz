import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';
import { ApiError, errorHandler, notFound } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { quizzesRouter, questionsRouter } from './routes/quizzes.js';
import { resultsRouter } from './routes/results.js';
import { settingsRouter } from './routes/settings.js';
import { studentRouter } from './routes/student.js';
import { publicRouter } from './routes/public.js';
import { getWorkspaceConfig } from './services/config.js';

/**
 * Origin allowlist for state-changing requests. Production trusts only the configured
 * public base URL; development additionally accepts localhost and sandbox preview hosts.
 */
function isAllowedOrigin(origin: string): boolean {
  const allowed = new Set<string>([
    new URL(getWorkspaceConfig().appBaseUrl).origin,
    `http://localhost:${env.port}`,
    `http://127.0.0.1:${env.port}`,
  ]);
  if (allowed.has(origin)) return true;
  if (env.isProduction) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return url.protocol === 'http:' || url.protocol === 'https:';
    return host === 'arena.ai' || host.endsWith('.arena.ai') || host.endsWith('.e2b.app');
  } catch {
    return false;
  }
}

export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // The sandbox preview embeds the app in an iframe under *.e2b.app. Production stays locked down.
  const frameAncestors = env.isProduction
    ? ["'none'"]
    : ["'self'", 'https://*.e2b.app', 'https://arena.ai', 'https://*.arena.ai'];
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          // Firebase Authentication needs its own origins: the SDK scripts, reCAPTCHA,
          // the auth iframe on the project's authDomain and the token/Firestore endpoints.
          'script-src': ["'self'", 'https://www.gstatic.com', 'https://www.google.com/recaptcha/'],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https://www.gstatic.com'],
          'font-src': ["'self'", 'data:'],
          'connect-src': [
            "'self'",
            'https://identitytoolkit.googleapis.com',
            'https://securetoken.googleapis.com',
            'https://www.googleapis.com',
            'https://firestore.googleapis.com',
            'wss://firestore.googleapis.com',
          ],
          'frame-src': [
            "'self'",
            'https://*.firebaseapp.com',
            'https://accounts.google.com',
            'https://www.google.com',
          ],
          'frame-ancestors': frameAncestors,
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
        },
      },
      frameguard: env.isProduction ? { action: 'deny' } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(cookieParser());

  // Origin guard for state-changing requests (defence in depth on top of SameSite cookies).
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.headers.origin;
    if (!origin) return next(); // same-origin requests and non-browser clients
    if (!isAllowedOrigin(origin)) {
      next(new ApiError(403, 'Request origin is not allowed.', 'bad_origin'));
      return;
    }
    return next();
  });

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down.', code: 'rate_limited' },
  });
  app.use('/api', globalLimiter);

  app.use('/api/admin/auth', authRouter);
  app.use('/api/admin/quizzes', quizzesRouter);
  app.use('/api/admin/questions', questionsRouter);
  app.use('/api/admin', resultsRouter);
  app.use('/api/admin', settingsRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/public', publicRouter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), provider: getWorkspaceConfig().provider });
  });

  app.use('/api', notFound);

  // Serve the built SPA (production) with a client-side-routing fallback.
  const webDist = path.resolve(process.cwd(), 'dist', 'web');
  if (fs.existsSync(webDist)) {
    app.use(
      express.static(webDist, {
        index: false,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
          else if (filePath.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      if (req.path.includes('.')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .status(200)
        .type('text/html')
        .send('<h1>QUIZ PLATFORM API</h1><p>The API is running. Build the frontend with <code>npm run build:web</code> or run <code>npm run dev:web</code>.</p>');
    });
  }

  app.use((req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) notFound(req, res);
    else res.status(404).send('Not found');
  });
  app.use(errorHandler);
  return app;
}
