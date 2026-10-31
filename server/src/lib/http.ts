import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parse<T>(schema: ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      throw new ApiError(400, details[0]?.message ?? 'Invalid input', 'validation_error', details);
    }
    throw err;
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  const anyErr = err as { message?: string; code?: string };
  if (anyErr?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({ error: 'A record with these details already exists.', code: 'duplicate' });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[api] unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server.', code: 'internal_error' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', code: 'not_found' });
}

/**
 * Base URL to embed in QR codes and join links. In production this is the configured
 * public base URL; during local/preview development it follows the incoming host so a
 * projector rendered from a sandbox preview links to that same preview.
 */
export function requestBaseUrl(req: Request, configuredBaseUrl: string, isProduction: boolean): string {
  if (isProduction) return configuredBaseUrl;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const proto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0]?.trim() || req.protocol;
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0]?.trim() || req.get('host');
  if (!host) return configuredBaseUrl;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return configuredBaseUrl;
  return `${proto}://${host}`;
}
