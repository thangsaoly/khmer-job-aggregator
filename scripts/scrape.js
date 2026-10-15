/**
 * scrape.js — One-shot live scrape for GitHub Actions (or `npm run scrape`).
 *
 * Runs outside Vercel because a full Apify + Gemini pass takes several
 * minutes, well past serverless function limits.
 */
import 'dotenv/config';

import { initializeSchema } from '../src/db.js';
import { scrapeAndIngestTikTok } from '../src/scraper.js';

const resultsPerPage = Number.parseInt(process.env.RESULTS_PER_PAGE ?? '20', 10) || 20;

try {
  await initializeSchema();
  const result = await scrapeAndIngestTikTok({ resultsPerPage });
  console.log('[Scrape] Done:', JSON.stringify(result));

  // Every post failing at Gate 3 means Gemini is broken (bad key, quota) — fail the job
  const { summary } = result;
  if (summary.errors > 0 && summary.approved + summary.rejected === 0) {
    console.error('[Scrape] All AI classifications failed.');
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.error('[Scrape] Failed:', err);
  process.exit(1);
}
