/**
 * server.js — Express v5 REST API + node-cron scheduler
 *
 * IMPORTANT: 'dotenv/config' must be the FIRST import to load .env before
 * any other module accesses process.env (ESM hoisting means imports run
 * before top-level code, so regular dotenv.config() calls are too late).
 */
import 'dotenv/config';

import express    from 'express';
import cors       from 'cors';
import cron       from 'node-cron';
import { queryJobListings, getJobById } from './db.js';
import { processScrapedPosts }          from './ingestor.js';
import { scrapeAndIngestTikTok }        from './scraper.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/jobs
 * Query parameters (all optional):
 *   category      — e.g. SOFTWARE_DEV, DATA_AI, UX_UI, IT_SUPPORT_NETWORK, QA_TESTING, DIGITAL_MARKETING
 *   isInternship  — "true" | "false"
 *   location      — partial string match, e.g. "Phnom Penh"
 *   q             — keyword search across title, company, summary
 *   limit         — default 20
 *   offset        — default 0 (for pagination)
 */
app.get('/api/jobs', (req, res) => {
  const { category, isInternship, location, q, limit, offset } = req.query;

  const jobs = queryJobListings({
    category:    category    || undefined,
    isInternship: isInternship !== undefined ? isInternship === 'true' : undefined,
    location:    location    || undefined,
    q:           q           || undefined,
    limit:       limit       ? parseInt(limit, 10)  : 20,
    offset:      offset      ? parseInt(offset, 10) : 0,
  });

  res.json({ success: true, count: jobs.length, data: jobs });
});

/**
 * GET /api/jobs/:id
 * Returns a single job with full raw post data (for attribution + original URL).
 */
app.get('/api/jobs/:id', (req, res) => {
  const job = getJobById(parseInt(req.params.id, 10));

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found.' });
  }

  res.json({ success: true, data: job });
});

/**
 * POST /api/ingest/mock
 * Manual test trigger — accepts a JSON array of mock TikTok posts and runs
 * them through the full 3-gate pipeline.
 *
 * Example body:
 * [
 *   {
 *     "id": "vid_123",
 *     "url": "https://www.tiktok.com/@user/video/123",
 *     "author": "techrecruiter_kh",
 *     "text": "We are hiring React Developer in Phnom Penh! #hiringcambodia",
 *     "hashtags": ["hiringcambodia", "developer"],
 *     "thumbnailUrl": "https://...",
 *     "postedAt": "2026-10-01T08:00:00Z"
 *   }
 * ]
 */
app.post('/api/ingest/mock', async (req, res) => {
  const posts = req.body;

  if (!Array.isArray(posts) || posts.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Request body must be a non-empty array of post objects.',
    });
  }

  // Express v5 catches async rejections automatically — no try/catch needed here
  const summary = await processScrapedPosts(posts);
  res.json({ success: true, summary });
});

/**
 * POST /api/scrape/trigger
 * Trigger a live TikTok scrape immediately via Apify.
 */
app.post('/api/scrape/trigger', async (req, res) => {
  const { resultsPerPage } = req.body || {};
  console.log('[API] Live scrape triggered manually');
  const result = await scrapeAndIngestTikTok({
    resultsPerPage: resultsPerPage ? parseInt(resultsPerPage, 10) : 15,
  });
  res.json({ success: true, result });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express v5 propagates async errors automatically, so this catches everything.

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[API Error]', err);
  res.status(err.status ?? 500).json({
    success: false,
    error: err.message ?? 'Internal Server Error',
  });
});

// ─── Cron Scheduler ───────────────────────────────────────────────────────────

/**
 * Runs every 6 hours to fetch fresh TikTok posts via Apify.
 * noOverlap: true ensures a slow scrape run won't overlap with the next trigger.
 */
cron.schedule(
  '0 */6 * * *',
  async () => {
    console.log(`[Cron] Starting 6-hour TikTok scrape at ${new Date().toISOString()}`);
    try {
      const result = await scrapeAndIngestTikTok({ resultsPerPage: 20 });
      console.log('[Cron] Scrape completed successfully:', result);
    } catch (err) {
      console.error('[Cron] Scrape failed:', err.message);
    }
  },
  {
    timezone: 'Asia/Phnom_Penh',
    noOverlap: true, // Prevents concurrent runs if a scrape takes longer than 6 hours
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║  Khmer Job Aggregator API                  ║
  ║  Running at http://localhost:${PORT}          ║
  ║                                            ║
  ║  GET  /api/jobs          List jobs         ║
  ║  GET  /api/jobs/:id      Job detail        ║
  ║  POST /api/ingest/mock   Test pipeline     ║
  ╚════════════════════════════════════════════╝
  `);
});
