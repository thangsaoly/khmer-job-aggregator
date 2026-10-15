/**
 * server.js — Express v5 REST API
 *
 * IMPORTANT: 'dotenv/config' must be the FIRST import to load .env before
 * any other module accesses process.env (ESM hoisting means imports run
 * before top-level code, so regular dotenv.config() calls are too late).
 *
 * All DB functions are now async (Turso/LibSQL client).
 * Scheduled scraping runs in GitHub Actions (.github/workflows/scrape.yml).
 */
import 'dotenv/config';

import express from 'express';
import cors    from 'cors';
import { initializeSchema, queryJobListings, getJobById } from './db.js';
import { scrapeAndIngestTikTok }                          from './scraper.js';

const app  = express();
const PORT = process.env.PORT ?? 3001;

// Schema init is memoized so it runs once per process — on Vercel there is no
// app.listen() callback, so every request awaits this promise instead.
let schemaReady;
function ensureSchema() {
  schemaReady ??= initializeSchema().catch((err) => {
    schemaReady = undefined; // allow a retry on the next request
    throw err;
  });
  return schemaReady;
}

/** Parse a non-negative integer query param, falling back on bad input. */
function toInt(value, fallback, max = Infinity) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : fallback;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(async (req, res, next) => {
  await ensureSchema();
  next();
});

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
app.get('/api/jobs', async (req, res) => {
  const { category, isInternship, location, q, limit, offset } = req.query;

  const jobs = await queryJobListings({
    category:     category     || undefined,
    isInternship: isInternship !== undefined ? isInternship === 'true' : undefined,
    location:     location     || undefined,
    q:            q            || undefined,
    limit:        toInt(limit, 20, 100),
    offset:       toInt(offset, 0),
  });

  res.json({ success: true, count: jobs.length, data: jobs });
});

/**
 * GET /api/jobs/:id
 * Returns a single job with full raw post data (for attribution + original URL).
 */
app.get('/api/jobs/:id', async (req, res) => {
  const id  = toInt(req.params.id, null);
  const job = id === null ? null : await getJobById(id);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found.' });
  }

  res.json({ success: true, data: job });
});

/**
 * POST /api/scrape/trigger
 * Trigger a live TikTok scrape immediately via Apify — local dev only.
 * A scrape takes several minutes (far beyond serverless time limits) and
 * spends paid Apify + Gemini quota, so in production it runs from the
 * GitHub Actions workflow in .github/workflows/scrape.yml instead.
 */
app.post('/api/scrape/trigger', async (req, res) => {
  if (process.env.VERCEL) {
    return res.status(403).json({
      success: false,
      error: 'Live scraping is disabled here; it runs on a schedule via GitHub Actions.',
    });
  }

  const { resultsPerPage } = req.body || {};
  console.log('[API] Live scrape triggered manually');
  const result = await scrapeAndIngestTikTok({
    resultsPerPage: toInt(resultsPerPage, 15, 50),
  });
  res.json({ success: true, result });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[API Error]', err);
  res.status(err.status ?? 500).json({
    success: false,
    error: err.message ?? 'Internal Server Error',
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

// On Vercel the platform imports the app and handles the HTTP layer itself.
if (!process.env.VERCEL) {
  ensureSchema()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`
  ╔════════════════════════════════════════════╗
  ║  Khmer Job Aggregator API                  ║
  ║  Running at http://localhost:${PORT}          ║
  ║                                            ║
  ║  GET  /api/jobs            List jobs       ║
  ║  GET  /api/jobs/:id        Job detail      ║
  ║  POST /api/scrape/trigger  Live scrape     ║
  ╚════════════════════════════════════════════╝
        `);
      });
    })
    .catch((err) => {
      console.error('[Fatal] Failed to initialize database schema:', err);
      process.exit(1);
    });
}

export default app;
