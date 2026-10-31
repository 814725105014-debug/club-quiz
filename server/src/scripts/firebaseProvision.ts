/**
 * One-off provisioning: mirrors every existing administrator into Firebase Authentication
 * and stores the resulting uid on the local row.
 *
 *   npm run firebase:provision              # report only (dry run)
 *   npm run firebase:provision -- --apply   # create/update Firebase users
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_FILE (or FIREBASE_SERVICE_ACCOUNT_JSON) on the host.
 * Passwords already set in the platform are carried over so nobody has to be re-invited;
 * Firebase will still enforce a password change on first sign-in if the policy requires it.
 */
import { getDb } from '../db.js';
import { env } from '../env.js';
import { firebaseAdminConfigured, upsertFirebaseUser } from '../services/firebase.js';

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: number;
  firebase_uid: string | null;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const db = getDb();
  const users = db
    .prepare('SELECT id, email, name, role, is_active, firebase_uid FROM users ORDER BY created_at ASC')
    .all() as UserRow[];

  console.log(`Project: ${env.firebase.projectId}`);
  console.log(`Auth mode: ${env.firebase.mode}`);
  console.log(`Administrators: ${users.length}`);
  console.log(`Service account configured: ${firebaseAdminConfigured() ? 'yes' : 'no'}`);
  if (!firebaseAdminConfigured()) {
    console.error('\nCannot continue: set FIREBASE_SERVICE_ACCOUNT_FILE or FIREBASE_SERVICE_ACCOUNT_JSON.');
    process.exitCode = 1;
    return;
  }
  if (!apply) {
    console.log('\nDry run — no changes. Re-run with --apply to provision.');
    for (const user of users) {
      console.log(`  ${user.email.padEnd(40)} ${user.role.padEnd(15)} ${user.firebase_uid ? 'linked' : 'not linked'}`);
    }
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  for (const user of users) {
    try {
      const result = await upsertFirebaseUser({
        email: user.email,
        displayName: user.name,
        role: user.role,
        disabled: !user.is_active,
      });
      db.prepare('UPDATE users SET firebase_uid = ?, auth_provider = ? WHERE id = ?').run(
        result.uid,
        'firebase',
        user.id,
      );
      if (result.created) created += 1;
      else updated += 1;
      console.log(`  ok   ${user.email} -> ${result.uid}${result.created ? ' (created)' : ''}`);
    } catch (err) {
      failed += 1;
      console.error(`  fail ${user.email}: ${(err as Error).message}`);
    }
  }
  console.log(`\nDone. created=${created} updated=${updated} failed=${failed}`);
  if (failed) process.exitCode = 1;
}

await main();
