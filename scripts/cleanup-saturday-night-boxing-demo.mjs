import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

const EVENT_ID = 'e14f8b6c-f072-4fac-ac5b-ad347af15905';
const DEMO_EMAIL_PATTERN = /^demo\.boxer\d{3}\.snse1@example\.com$/;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !dbPassword) {
  throw new Error('Missing Supabase env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD.');
}

const projectRef = supabaseUrl.match(/https:\/\/([^.]+)/)?.[1];
if (!projectRef) throw new Error('Could not read Supabase project ref from NEXT_PUBLIC_SUPABASE_URL.');

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = new pg.Client({
  host: 'aws-1-us-east-2.pooler.supabase.com',
  port: 6543,
  user: `postgres.${projectRef}`,
  password: dbPassword,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

async function listDemoUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    for (const user of data.users ?? []) {
      if (DEMO_EMAIL_PATTERN.test(user.email ?? '')) users.push(user);
    }

    if (!data.users || data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const demoUsers = await listDemoUsers();

  await db.connect();
  try {
    const counts = await db.query(
      `
      select
        (select count(*)::int from public.event_registrations where event_id = $1) as registrations,
        (select count(*)::int from public.matches where event_id = $1) as matches,
        (select count(*)::int from public.bouts where event_id = $1) as bouts,
        (select count(*)::int from public.event_mats where event_id = $1) as event_mats
      `,
      [EVENT_ID]
    );

    console.log(JSON.stringify({
      dryRun,
      eventId: EVENT_ID,
      eventData: counts.rows[0],
      demoUsers: demoUsers.map((user) => ({ id: user.id, email: user.email })),
    }, null, 2));

    if (dryRun) return;

    await db.query('begin');
    await db.query('delete from public.bouts where event_id = $1', [EVENT_ID]);
    await db.query('delete from public.matches where event_id = $1', [EVENT_ID]);
    await db.query('delete from public.event_registrations where event_id = $1', [EVENT_ID]);
    await db.query('delete from public.event_mats where event_id = $1', [EVENT_ID]);
    await db.query('commit');

    for (const user of demoUsers) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) throw error;
    }

    console.log(`Removed demo event data and ${demoUsers.length} fake demo users.`);
  } catch (error) {
    try {
      await db.query('rollback');
    } catch {
      // Ignore rollback errors when no transaction is active.
    }
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
