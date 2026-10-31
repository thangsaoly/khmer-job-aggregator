/**
 * scrape.js — One-shot live scrape for GitHub Actions (or `npm run scrape`).
 *
 * Runs outside Vercel because a full Apify + Gemini pass takes several
 * minutes, well past serverless function limits.
 */
import 'dotenv/config';

import { initializeSchema } from '../src/db.js';
import { scrapeAndIngestTikTok } from '../src/scraper.js';

// Default sized so the monthly total fits inside the Apify Free plan's $5 credit:
// 9 targets x 8 results x ~30 days = ~2,160 results/month (~$3.60-4.30 at clockworks' ~$1.70-2/1,000).
// '20' here historically meant ~21,600 results/month (~$37+) — keep it below 10 on the Free plan.
const resultsPerPage = Number.parseInt(process.env.RESULTS_PER_PAGE ?? '8', 10) || 8;

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
