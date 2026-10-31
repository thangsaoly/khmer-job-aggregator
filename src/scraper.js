/**
 * scraper.js — Live TikTok Scraper via Apify
 *
 * Scrapes genuine TikTok posts using Apify's clockworks/tiktok-scraper actor.
 * Targets Cambodian hiring hashtags and tech keywords, then sends
 * results directly into the 3-gate AI ingestion pipeline.
 */

import { ApifyClient } from 'apify-client';
import { processScrapedPosts } from './ingestor.js';

const apify = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

// Full coverage targets for scheduled batch scrapes (GitHub Actions / manual deep scrape)
const ALL_HASHTAGS = [
  'ជួលបុគ្គលិក',
  'រើសបុគ្គលិក',
  'ដំណឹងជ្រើសរើសបុគ្គលិក',
  'hiringcambodia',
  'jobcambodia',
  'internshipcambodia',
];

const ALL_SEARCH_QUERIES = [
  'hiring developer cambodia',
  'internship IT phnom penh',
  'ការងារ IT ភ្នំពេញ',
];

// High-yield top targets for fast interactive UI sync (3 targets instead of 9, ~3x faster)
const FAST_HASHTAGS = [
  'hiringcambodia',
  'internshipcambodia',
];

const FAST_SEARCH_QUERIES = [
  'hiring developer cambodia',
];

/**
 * Run a live scrape against TikTok using Apify, then ingest the results.
 *
 * @param {object}   options
 * @param {number}   [options.resultsPerPage=8] Max results per query/hashtag (keep ≤10 to fit
 *                                             Apify's free $5/month credit; see scripts/scrape.js)
 * @param {boolean}  [options.fast=false] Use high-yield top targets for quick execution
 * @param {Function} [options.onProgress] Real-time progress callback
 * @returns {Promise<{ scrapedCount: number, summary: object }>}
 */
export async function scrapeAndIngestTikTok({ resultsPerPage = 8, fast = false, onProgress } = {}) {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN is not set in environment.');
  }

  const hashtags = fast ? FAST_HASHTAGS : ALL_HASHTAGS;
  const searchQueries = fast ? FAST_SEARCH_QUERIES : ALL_SEARCH_QUERIES;

  // Budget guard on the Apify Free plan: interactive edge-triggered scrapes
  // must not be able to burn the monthly $5 credit on one UI click.
  const perPage = fast ? Math.min(resultsPerPage, 10) : resultsPerPage;

  console.log(`[Scraper] Starting live TikTok scrape on Apify (fast=${fast}, perPage=${perPage}, targets=${hashtags.length + searchQueries.length})...`);
  onProgress?.({
    stage: 'scraping',
    message: fast ? 'Quick-crawling TikTok via Apify (top targets)...' : 'Scraping TikTok posts via Apify...',
    current: 0,
    total: 0,
  });

  // Run the actor on Apify
  const run = await apify.actor('clockworks/tiktok-scraper').call(
    {
      hashtags,
      searchQueries,
      resultsPerPage: perPage,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadAvatars: false,
    },
    {
      waitSecs: 300, // Wait up to 5 minutes for the run
    }
  );

  console.log(`[Scraper] Apify run completed with status: ${run.status}`);

  if (run.status !== 'SUCCEEDED') {
    throw new Error(`Apify run failed with status: ${run.status}`);
  }

  // Fetch dataset items from Apify
  const dataset = apify.dataset(run.defaultDatasetId);
  const { items } = await dataset.listItems({ clean: true });

  console.log(`[Scraper] Received ${items.length} raw posts from TikTok scraper.`);

  // Normalize each TikTok item to our pipeline format
  const normalizedPosts = items
    .filter((item) => item && item.id)
    .map((item) => {
      const authorName = item.authorMeta?.name || item.author || '';
      const videoUrl = item.webVideoUrl || (authorName ? `https://www.tiktok.com/@${authorName}/video/${item.id}` : `https://www.tiktok.com/video/${item.id}`);

      // Extract raw hashtags as string array
      const rawHashtags = (item.hashtags || []).map((h) =>
        typeof h === 'string' ? h : (h?.name || '')
      ).filter(Boolean);

      // Best available thumbnail image from TikTok CDN
      const coverUrl = item.videoMeta?.coverUrl || item.covers?.default || item.covers?.origin || '';

      return {
        id: String(item.id),
        platform: 'TIKTOK',
        url: videoUrl,
        author: authorName,
        text: item.text || '',
        hashtags: rawHashtags,
        thumbnailUrl: coverUrl,
        postedAt: item.createTimeISO || (item.createTime ? new Date(item.createTime * 1000).toISOString() : new Date().toISOString()),
      };
    });

  console.log(`[Scraper] Processing ${normalizedPosts.length} normalized posts through 3-gate AI pipeline...`);
  onProgress?.({
    stage: 'ingesting',
    message: `Apify scraped ${normalizedPosts.length} posts. Analyzing with AI...`,
    current: 0,
    total: normalizedPosts.length,
  });

  const summary = await processScrapedPosts(normalizedPosts, { onProgress });

  return {
    scrapedCount: normalizedPosts.length,
    summary,
  };
}
