/**
 * db.js — Database client using @libsql/client (Turso / LibSQL)
 *
 * Supports two modes via environment variables:
 *   - Local dev:  TURSO_DB_URL=file:./jobs.db  (no token needed)
 *   - Production: TURSO_DB_URL=libsql://...     TURSO_DB_AUTH_TOKEN=...
 *
 * All exported functions are now async because the LibSQL client is async.
 */

import { createClient } from '@libsql/client';

// ─── Client Initialization ────────────────────────────────────────────────────

const DB_URL = process.env.TURSO_DB_URL || 'file:./jobs.db';

// On Vercel / GitHub Actions the filesystem is thrown away after each run, so a
// local SQLite file would silently lose every scraped job. Fail loudly instead.
if ((process.env.VERCEL || process.env.CI) && DB_URL.startsWith('file:')) {
  throw new Error('TURSO_DB_URL must point to a remote Turso database (libsql://...) in production/CI.');
}

const db = createClient({
  url:       DB_URL,
  authToken: process.env.TURSO_DB_AUTH_TOKEN || undefined,
});

// ─── Schema Setup ─────────────────────────────────────────────────────────────

/**
 * Must be called once on startup to ensure tables and indexes exist.
 * Returns a promise so the server can await it before accepting requests.
 */
export async function initializeSchema() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS raw_ingested_posts (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      platform         TEXT NOT NULL,
      external_post_id TEXT NOT NULL,
      post_url         TEXT NOT NULL,
      author_handle    TEXT,
      raw_caption      TEXT,
      hashtags         TEXT,
      thumbnail_url    TEXT,
      posted_at        TEXT,
      status           TEXT NOT NULL DEFAULT 'PENDING',
      rejection_reason TEXT,
      scraped_at       TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(platform, external_post_id)
    );

    CREATE TABLE IF NOT EXISTS job_listings (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      raw_post_id      INTEGER NOT NULL,
      title            TEXT NOT NULL,
      company_name     TEXT,
      category         TEXT NOT NULL DEFAULT 'OTHER',
      is_internship    INTEGER NOT NULL DEFAULT 0,
      location         TEXT NOT NULL DEFAULT 'Phnom Penh',
      salary_range     TEXT,
      contact_info     TEXT,
      summary          TEXT,
      confidence_score REAL,
      published_at     TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (raw_post_id) REFERENCES raw_ingested_posts(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_job_listings_filters
      ON job_listings(category, is_internship, location, published_at DESC);
  `);
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Gate 1 — Check if a post has already been ingested.
 * @returns {{ id: number, status: string } | null}
 */
export async function findRawPostByExternalId(platform, externalPostId) {
  const result = await db.execute({
    sql:  'SELECT id, status FROM raw_ingested_posts WHERE platform = ? AND external_post_id = ? LIMIT 1',
    args: [platform, externalPostId],
  });
  return result.rows[0] ?? null;
}

/**
 * Insert a newly scraped post into raw_ingested_posts.
 * @returns {{ id: number }} The new row's lastInsertRowid
 */
export async function insertRawPost(post) {
  const result = await db.execute({
    sql: `
      INSERT INTO raw_ingested_posts
        (platform, external_post_id, post_url, author_handle, raw_caption,
         hashtags, thumbnail_url, posted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      post.platform,
      post.externalPostId,
      post.postUrl,
      post.authorHandle ?? null,
      post.rawCaption   ?? null,
      post.hashtags ? JSON.stringify(post.hashtags) : null,
      post.thumbnailUrl ?? null,
      post.postedAt     ?? null,
    ],
  });
  return { id: Number(result.lastInsertRowid) };
}

/**
 * Update the status of a raw post after AI classification.
 * @param {number} id
 * @param {'APPROVED'|'REJECTED'|'ERROR'} status
 * @param {string|null} rejectionReason
 */
export async function updateRawPostStatus(id, status, rejectionReason = null) {
  await db.execute({
    sql:  'UPDATE raw_ingested_posts SET status = ?, rejection_reason = ? WHERE id = ?',
    args: [status, rejectionReason, id],
  });
}

/**
 * Insert a classified job into job_listings.
 * @param {number} rawPostId
 * @param {object} jobData — fields from AI extraction
 */
export async function insertJobListing(rawPostId, jobData) {
  await db.execute({
    sql: `
      INSERT INTO job_listings
        (raw_post_id, title, company_name, category, is_internship,
         location, salary_range, contact_info, summary, confidence_score, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      rawPostId,
      jobData.title,
      jobData.company_name    ?? null,
      jobData.category        ?? 'OTHER',
      jobData.is_internship   ? 1 : 0,
      jobData.location        ?? 'Phnom Penh',
      jobData.salary_range    ?? null,
      jobData.contact_info    ?? null,
      jobData.summary         ?? null,
      jobData.confidence_score ?? null,
      jobData.publishedAt     ?? null,
    ],
  });
}

/**
 * Query job listings with optional filters for the REST API.
 *
 * @param {object} filters
 * @param {string}  [filters.category]
 * @param {boolean} [filters.isInternship]
 * @param {string}  [filters.location]
 * @param {string}  [filters.q]           — keyword search (title/company/summary)
 * @param {number}  [filters.limit=20]
 * @param {number}  [filters.offset=0]
 * @returns {Promise<object[]>}
 */
export async function queryJobListings({
  category,
  isInternship,
  location,
  q,
  limit = 20,
  offset = 0,
} = {}) {
  const conditions = [];
  const args = [];

  if (category) {
    conditions.push('j.category = ?');
    args.push(category.toUpperCase());
  }
  if (isInternship !== undefined) {
    conditions.push('j.is_internship = ?');
    args.push(isInternship ? 1 : 0);
  }
  if (location) {
    conditions.push('j.location LIKE ?');
    args.push(`%${location}%`);
  }
  if (q) {
    conditions.push('(j.title LIKE ? OR j.company_name LIKE ? OR j.summary LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Limit and offset go at the end of args
  args.push(limit, offset);

  const result = await db.execute({
    sql: `
      SELECT
        j.id, j.title, j.company_name, j.category, j.is_internship,
        j.location, j.salary_range, j.contact_info, j.summary,
        j.confidence_score, j.published_at, j.created_at,
        r.post_url, r.author_handle, r.thumbnail_url, r.platform
      FROM job_listings j
      JOIN raw_ingested_posts r ON j.raw_post_id = r.id
      ${whereClause}
      ORDER BY j.published_at DESC, j.created_at DESC
      LIMIT ? OFFSET ?
    `,
    args,
  });

  return result.rows;
}

/**
 * Get a single job by ID (with raw post data for full attribution).
 * @param {number} id
 * @returns {Promise<object|null>}
 */
export async function getJobById(id) {
  const result = await db.execute({
    sql: `
      SELECT
        j.*, r.post_url, r.author_handle, r.thumbnail_url,
        r.platform, r.raw_caption, r.posted_at as original_posted_at
      FROM job_listings j
      JOIN raw_ingested_posts r ON j.raw_post_id = r.id
      WHERE j.id = ?
    `,
    args: [id],
  });
  return result.rows[0] ?? null;
}

export async function updateRawPostThumbnail(rawPostId, thumbnailUrl) {
  await db.execute({
    sql: 'UPDATE raw_ingested_posts SET thumbnail_url = ? WHERE id = ?',
    args: [thumbnailUrl, rawPostId],
  });
}

export { db };
export default db;

