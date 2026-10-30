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
import { initializeSchema, queryJobListings, getJobById, updateRawPostThumbnail } from './db.js';
import { scrapeAndIngestTikTok }                          from './scraper.js';
import { generateJobPosterSvg }                           from './poster.js';

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
 * GET /api/jobs/:id/thumbnail
 * Serves an optimized image for the job card:
 * 1. Checks if stored thumbnail URL is valid
 * 2. If expired/failed, auto-refreshes from TikTok video page & updates DB
 * 3. Fallback: generates high-res themed SVG card so cards always look beautiful
 */
app.get('/api/jobs/:id/thumbnail', async (req, res) => {
  const id  = toInt(req.params.id, null);
  const job = id === null ? null : await getJobById(id);

  if (!job) {
    return res.status(404).send('Not found');
  }

  // 1. Try fetching current stored thumbnail
  if (job.thumbnail_url) {
    try {
      const imgRes = await fetch(job.thumbnail_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.tiktok.com/',
        },
        signal: AbortSignal.timeout(3500),
      });

      if (imgRes.ok) {
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        const buffer = await imgRes.arrayBuffer();
        return res.send(Buffer.from(buffer));
      }
    } catch {
      // Continue to auto-refresh
    }
  }

  // 2. Try auto-refreshing expired signed URL from TikTok page
  if (job.post_url) {
    try {
      const pageRes = await fetch(job.post_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(4000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const matches = html.match(/https:\/\/[^"']*(?:tiktokcdn|byteoversea)[^"']*(?:image|cover|tos)[^"']*/gi);
        if (matches && matches.length > 0) {
          const freshUrl = matches[0].replace(/&amp;/g, '&');
          updateRawPostThumbnail(job.raw_post_id ?? job.id, freshUrl).catch(() => {});

          const freshImgRes = await fetch(freshUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
              'Referer': 'https://www.tiktok.com/',
            },
            signal: AbortSignal.timeout(3500),
          });
          if (freshImgRes.ok) {
            const contentType = freshImgRes.headers.get('content-type') || 'image/jpeg';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
            const buffer = await freshImgRes.arrayBuffer();
            return res.send(Buffer.from(buffer));
          }
        }
      }
    } catch {
      // Fall through to SVG
    }
  }

  // 3. Fallback: return styled category SVG poster
  const svg = generateJobPosterSvg(job);
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// ─── Scrape Job Status & Background Runner ──────────────────────────────────
let activeScrape = {
  running: false,
  stage: 'idle', // 'idle' | 'scraping' | 'ingesting' | 'done' | 'error'
  message: '',
  current: 0,
  total: 0,
  startedAt: null,
  completedAt: null,
  summary: null,
  error: null,
};

/**
 * GET /api/scrape/status
 * Check current progress or outcome of the background scraper.
 */
app.get('/api/scrape/status', (req, res) => {
  res.json({ success: true, data: activeScrape });
});

/**
 * POST /api/scrape/trigger
 * Trigger a live TikTok scrape in the background via Apify — local dev only.
 * Runs asynchronously to prevent HTTP timeouts and reports progress via /api/scrape/status.
 */
app.post('/api/scrape/trigger', async (req, res) => {
  if (process.env.VERCEL) {
    return res.status(403).json({
      success: false,
      error: 'Live scraping is disabled here; it runs on a schedule via GitHub Actions.',
    });
  }

  if (activeScrape.running) {
    return res.status(409).json({
      success: false,
      error: 'A scrape is already in progress.',
      data: activeScrape,
    });
  }

  const { resultsPerPage, fast } = req.body || {};
  // Default to 5 results per query and fast mode (top 3 targets instead of 9)
  const perPage = toInt(resultsPerPage, 5, 50);
  const isFast  = fast !== false;

  activeScrape = {
    running: true,
    stage: 'scraping',
    message: isFast ? 'Starting quick TikTok crawler on Apify...' : 'Starting full TikTok crawler on Apify...',
    current: 0,
    total: 0,
    startedAt: new Date().toISOString(),
    completedAt: null,
    summary: null,
    error: null,
  };

  console.log(`[API] Live scrape started in background (fast=${isFast}, resultsPerPage=${perPage})`);

  // Run in background without blocking the HTTP response
  (async () => {
    try {
      const result = await scrapeAndIngestTikTok({
        resultsPerPage: perPage,
        fast: isFast,
        onProgress: (p) => {
          activeScrape.stage = p.stage ?? activeScrape.stage;
          activeScrape.message = p.message ?? activeScrape.message;
          activeScrape.current = p.current ?? activeScrape.current;
          activeScrape.total = p.total ?? activeScrape.total;
          if (p.summary) activeScrape.summary = p.summary;
        },
      });

      activeScrape.running = false;
      activeScrape.stage = 'done';
      activeScrape.completedAt = new Date().toISOString();
      activeScrape.summary = result.summary;
      activeScrape.message = `Sync completed: ${result.summary?.approved ?? 0} new jobs approved, ${result.summary?.rejected ?? 0} rejected.`;
      console.log('[API] Background scrape completed successfully');
    } catch (err) {
      console.error('[API] Background scrape error:', err);
      activeScrape.running = false;
      activeScrape.stage = 'error';
      activeScrape.completedAt = new Date().toISOString();
      activeScrape.error = err.message;
      activeScrape.message = `Sync failed: ${err.message}`;
    }
  })();

  res.status(202).json({
    success: true,
    message: 'Scrape started in background.',
    data: activeScrape,
  });
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
