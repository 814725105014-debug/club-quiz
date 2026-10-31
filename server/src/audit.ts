import type { Request } from 'express';
import { getDb } from './db.js';

export function recordAudit(
  req: Request | undefined,
  action: string,
  entity: string,
  entityId: string,
  detail?: unknown,
): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_log (actor_id, actor_email, action, entity, entity_id, detail, ip)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req?.admin?.id ?? null,
        req?.admin?.email ?? 'system',
        action,
        entity,
        entityId,
        detail === undefined ? null : JSON.stringify(detail).slice(0, 4000),
        req?.ip ?? null,
      );
  } catch (err) {
    // Audit failures must never break the request path.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to record event', action, err);
  }
}

export function recordSystemAudit(action: string, entity: string, entityId: string, detail?: unknown): void {
  recordAudit(undefined, action, entity, entityId, detail);
}
