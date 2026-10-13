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

// High-value Cambodian hiring hashtags & keywords on TikTok
const TARGET_HASHTAGS = [
  'ជួលបុគ្គលិក',
  'រើសបុគ្គលិក',
  'ដំណឹងជ្រើសរើសបុគ្គលិក',
  'hiringcambodia',
  'jobcambodia',
  'internshipcambodia',
];

const TARGET_SEARCH_QUERIES = [
  'hiring developer cambodia',
  'internship IT phnom penh',
  'ការងារ IT ភ្នំពេញ',
];

/**
 * Run a live scrape against TikTok using Apify, then ingest the results.
 *
 * @param {object} options
 * @param {number} [options.resultsPerPage=20] Max results per query/hashtag
 * @returns {Promise<{ scrapedCount: number, summary: object }>}
 */
export async function scrapeAndIngestTikTok({ resultsPerPage = 20 } = {}) {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error('APIFY_API_TOKEN is not set in environment.');
  }

  console.log(`[Scraper] Starting live TikTok scrape on Apify...`);

  // Run the actor on Apify
  const run = await apify.actor('clockworks/tiktok-scraper').call(
    {
      hashtags: TARGET_HASHTAGS,
      searchQueries: TARGET_SEARCH_QUERIES,
      resultsPerPage,
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
  const summary = await processScrapedPosts(normalizedPosts);

  return {
    scrapedCount: normalizedPosts.length,
    summary,
  };
}
