/**
 * api.js — Thin client for the Express backend REST API
 *
 * All API base paths are relative so the Vite dev proxy (/api → localhost:3001)
 * works automatically. The same code works unchanged in production behind a
 * reverse proxy.
 */

const BASE = '/api';

/**
 * Fetch a paginated list of job listings with optional filters.
 *
 * @param {object} filters
 * @param {string}  [filters.category]       — e.g. 'SOFTWARE_DEV'
 * @param {boolean} [filters.isInternship]
 * @param {string}  [filters.location]
 * @param {string}  [filters.q]              — keyword search
 * @param {number}  [filters.limit=20]
 * @param {number}  [filters.offset=0]
 * @returns {Promise<{ success: boolean, count: number, data: object[] }>}
 */
export async function fetchJobs(filters = {}) {
  const params = new URLSearchParams();

  if (filters.category)                        params.set('category',     filters.category);
  if (filters.isInternship !== undefined)      params.set('isInternship', String(filters.isInternship));
  if (filters.location)                        params.set('location',     filters.location);
  if (filters.q)                               params.set('q',            filters.q);
  if (filters.limit  !== undefined)            params.set('limit',        String(filters.limit));
  if (filters.offset !== undefined)            params.set('offset',       String(filters.offset));

  const response = await fetch(`${BASE}/jobs?${params.toString()}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? `API error ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch a single job by its ID (includes raw post data for attribution).
 *
 * @param {number} id
 * @returns {Promise<{ success: boolean, data: object }>}
 */
export async function fetchJobById(id) {
  const response = await fetch(`${BASE}/jobs/${id}`);

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error ?? `API error ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger a background TikTok scrape (dev mode).
 *
 * @param {object}  [options]
 * @param {number}  [options.resultsPerPage=5]
 * @param {boolean} [options.fast=true]
 * @returns {Promise<{ success: boolean, message: string, data: object }>}
 */
export async function triggerScrape(options = { resultsPerPage: 5, fast: true }) {
  const response = await fetch(`${BASE}/scrape/trigger`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 409) {
    throw new Error(data.error ?? `Scrape request failed with status ${response.status}`);
  }

  return data;
}

/**
 * Check the status and progress of the background TikTok scraper.
 *
 * @returns {Promise<{ success: boolean, data: object }>}
 */
export async function fetchScrapeStatus() {
  const response = await fetch(`${BASE}/scrape/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch scrape status (${response.status})`);
  }
  return response.json();
}

