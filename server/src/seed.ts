import { env } from './env.js';
import { bootstrap } from './bootstrap.js';
import { dashboardStats } from './services/stats.js';

bootstrap({ demo: true });

const stats = dashboardStats();
// eslint-disable-next-line no-console
console.log('Seed complete.');
// eslint-disable-next-line no-console
console.log(JSON.stringify({ database: env.databasePath, admin: env.admin.email, stats }, null, 2));
