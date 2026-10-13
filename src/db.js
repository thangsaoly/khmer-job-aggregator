/**
 * db.js — Database initialization and query helpers
 *
 * Uses better-sqlite3 (synchronous SQLite) in WAL mode so that the
 * background cron writer never blocks the Express API reader.
 *
 * Two-table deduplication pattern:
 *   raw_ingested_posts  — every post ever seen, with status
 *   job_listings        — clean structured jobs (approved posts only)
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Resolve the project root so jobs.db sits next to src/, not inside it
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'jobs.db');

// ─── Initialize ──────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);

// WAL mode: readers don't block writers, writers don't block readers
db.pragma('journal_mode = WAL');
// SQLite disables FK enforcement per-connection by default — always turn it on
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  -- Every post ever scraped. Gate 1 dedup checks this table.
  CREATE TABLE IF NOT EXISTS raw_ingested_posts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    platform         TEXT NOT NULL CHECK(platform IN ('TIKTOK','TELEGRAM','FACEBOOK','WEB')),
    external_post_id TEXT NOT NULL,
    post_url         TEXT NOT NULL,
    author_handle    TEXT,
    raw_caption      TEXT,
    hashtags         TEXT,              -- JSON array, e.g. '["hiring","internship"]'
    thumbnail_url    TEXT,
    posted_at        TEXT,              -- ISO 8601 string from source
    status           TEXT NOT NULL DEFAULT 'PENDING'
                       CHECK(status IN ('PENDING','APPROVED','REJECTED','ERROR')),
    rejection_reason TEXT,
    scraped_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(platform, external_post_id)  -- the dedup key
  );

  -- Clean, AI-extracted job data. Only exists for APPROVED raw posts.
  CREATE TABLE IF NOT EXISTS job_listings (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_post_id      INTEGER NOT NULL,
    title            TEXT NOT NULL,
    company_name     TEXT,
    category         TEXT NOT NULL DEFAULT 'OTHER'
                       CHECK(category IN (
                         'SOFTWARE_DEV','DATA_AI','UX_UI',
                         'IT_SUPPORT_NETWORK','QA_TESTING','DIGITAL_MARKETING','OTHER'
                       )),
    is_internship    INTEGER NOT NULL DEFAULT 0 CHECK(is_internship IN (0,1)),
    location         TEXT NOT NULL DEFAULT 'Phnom Penh',
    salary_range     TEXT,
    contact_info     TEXT,
    summary          TEXT,
    confidence_score REAL,
    published_at     TEXT,             -- mirrors raw_ingested_posts.posted_at
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (raw_post_id) REFERENCES raw_ingested_posts(id) ON DELETE CASCADE
  );

  -- Composite index optimized for the primary API query pattern
  CREATE INDEX IF NOT EXISTS idx_job_listings_filters
    ON job_listings(category, is_internship, location, published_at DESC);
`);

// ─── Prepared Statements ─────────────────────────────────────────────────────

const stmts = {
  findRawByExternalId: db.prepare(`
    SELECT id, status FROM raw_ingested_posts
    WHERE platform = @platform AND external_post_id = @externalPostId
    LIMIT 1
  `),

  insertRawPost: db.prepare(`
    INSERT INTO raw_ingested_posts
      (platform, external_post_id, post_url, author_handle, raw_caption,
       hashtags, thumbnail_url, posted_at)
    VALUES
      (@platform, @externalPostId, @postUrl, @authorHandle, @rawCaption,
       @hashtags, @thumbnailUrl, @postedAt)
  `),

  updateRawStatus: db.prepare(`
    UPDATE raw_ingested_posts
    SET status = @status, rejection_reason = @rejectionReason
    WHERE id = @id
  `),

  insertJobListing: db.prepare(`
    INSERT INTO job_listings
      (raw_post_id, title, company_name, category, is_internship,
       location, salary_range, contact_info, summary, confidence_score, published_at)
    VALUES
      (@rawPostId, @title, @companyName, @category, @isInternship,
       @location, @salaryRange, @contactInfo, @summary, @confidenceScore, @publishedAt)
  `),
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Gate 1 — Check if a post has already been ingested.
 * @returns {{ id: number, status: string } | undefined}
 */
export function findRawPostByExternalId(platform, externalPostId) {
  return stmts.findRawByExternalId.get({ platform, externalPostId });
}

/**
 * Insert a newly scraped post into raw_ingested_posts.
 * @param {object} post
 * @returns {{ id: number }} The new row's lastInsertRowid
 */
export function insertRawPost(post) {
  const result = stmts.insertRawPost.run({
    platform:       post.platform,
    externalPostId: post.externalPostId,
    postUrl:        post.postUrl,
    authorHandle:   post.authorHandle ?? null,
    rawCaption:     post.rawCaption ?? null,
    hashtags:       post.hashtags ? JSON.stringify(post.hashtags) : null,
    thumbnailUrl:   post.thumbnailUrl ?? null,
    postedAt:       post.postedAt ?? null,
  });
  return { id: result.lastInsertRowid };
}

/**
 * Update the status of a raw post after AI classification.
 * @param {number} id
 * @param {'APPROVED'|'REJECTED'|'ERROR'} status
 * @param {string|null} rejectionReason
 */
export function updateRawPostStatus(id, status, rejectionReason = null) {
  stmts.updateRawStatus.run({ id, status, rejectionReason });
}

/**
 * Insert a classified job into job_listings.
 * @param {number} rawPostId
 * @param {object} jobData — fields from AI extraction
 */
export function insertJobListing(rawPostId, jobData) {
  stmts.insertJobListing.run({
    rawPostId,
    title:           jobData.title,
    companyName:     jobData.company_name ?? null,
    category:        jobData.category ?? 'OTHER',
    isInternship:    jobData.is_internship ? 1 : 0,
    location:        jobData.location ?? 'Phnom Penh',
    salaryRange:     jobData.salary_range ?? null,
    contactInfo:     jobData.contact_info ?? null,
    summary:         jobData.summary ?? null,
    confidenceScore: jobData.confidence_score ?? null,
    publishedAt:     jobData.publishedAt ?? null,
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
 * @returns {object[]}
 */
export function queryJobListings({ category, isInternship, location, q, limit = 20, offset = 0 } = {}) {
  const conditions = [];
  const params = {};

  if (category) {
    conditions.push('j.category = @category');
    params.category = category.toUpperCase();
  }
  if (isInternship !== undefined) {
    conditions.push('j.is_internship = @isInternship');
    params.isInternship = isInternship ? 1 : 0;
  }
  if (location) {
    conditions.push('j.location LIKE @location');
    params.location = `%${location}%`;
  }
  if (q) {
    conditions.push('(j.title LIKE @q OR j.company_name LIKE @q OR j.summary LIKE @q)');
    params.q = `%${q}%`;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Join with raw_ingested_posts to include post_url and author_handle for attribution
  const rows = db.prepare(`
    SELECT
      j.id, j.title, j.company_name, j.category, j.is_internship,
      j.location, j.salary_range, j.contact_info, j.summary,
      j.confidence_score, j.published_at, j.created_at,
      r.post_url, r.author_handle, r.thumbnail_url, r.platform
    FROM job_listings j
    JOIN raw_ingested_posts r ON j.raw_post_id = r.id
    ${whereClause}
    ORDER BY j.published_at DESC, j.created_at DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  return rows;
}

/**
 * Get a single job by ID (with raw post data for full attribution).
 * @param {number} id
 * @returns {object|undefined}
 */
export function getJobById(id) {
  return db.prepare(`
    SELECT
      j.*, r.post_url, r.author_handle, r.thumbnail_url,
      r.platform, r.raw_caption, r.posted_at as original_posted_at
    FROM job_listings j
    JOIN raw_ingested_posts r ON j.raw_post_id = r.id
    WHERE j.id = @id
  `).get({ id });
}

export default db;
