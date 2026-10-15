/**
 * migrate-to-turso.js — Copy the local jobs.db into the remote Turso database.
 *
 * Usage:
 *   TURSO_DB_URL=libsql://... TURSO_DB_AUTH_TOKEN=... node scripts/migrate-to-turso.js
 *
 * Copies raw_ingested_posts too, so already-seen posts stay deduplicated and
 * are not re-sent to Gemini. Safe to re-run: existing rows are skipped.
 */
import 'dotenv/config';

import { createClient } from '@libsql/client';
import db, { initializeSchema } from '../src/db.js';

if (!process.env.TURSO_DB_URL?.startsWith('libsql://')) {
  console.error('Set TURSO_DB_URL to your remote libsql:// URL.');
  process.exit(1);
}

const local = createClient({ url: process.env.LOCAL_DB_URL ?? 'file:./jobs.db' });

async function copyTable(table) {
  const { rows, columns } = await local.execute(`SELECT * FROM ${table} ORDER BY id`);
  const placeholders = columns.map(() => '?').join(', ');
  const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
  await db.batch(rows.map((row) => ({ sql, args: columns.map((c) => row[c]) })), 'write');
  console.log(`[Migrate] ${table}: ${rows.length} rows copied (duplicates skipped)`);
}

await initializeSchema();
await copyTable('raw_ingested_posts'); // parents first — job_listings references them
await copyTable('job_listings');
process.exit(0);
