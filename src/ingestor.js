/**
 * ingestor.js — Gate 3: AI multimodal classification pipeline
 *
 * Sends the post caption + thumbnail image to Gemini 2.5 Flash in a single
 * multimodal request. Returns structured JSON that we persist to SQLite.
 *
 * Key design choices:
 *   - Single-pass: classify AND extract fields in one API call (saves latency + cost)
 *   - Structured output: Gemini returns validated JSON matching our schema
 *   - Batch via db.transaction(): multiple post inserts in one SQLite write-lock
 */

import { GoogleGenAI, Type } from '@google/genai';
import {
  findRawPostByExternalId,
  insertRawPost,
  updateRawPostStatus,
  insertJobListing,
} from './db.js';
import { shouldSendToAi } from './filter.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── Gemini Response Schema ───────────────────────────────────────────────────
// This schema is enforced by the API — the model MUST return a JSON object
// matching these types, so we can safely call JSON.parse() on the response.

const JOB_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    is_job_post: {
      type: Type.BOOLEAN,
      description: 'True if this post is advertising a job opening or internship.',
    },
    is_tech_related: {
      type: Type.BOOLEAN,
      description: 'True if the role requires technical/IT skills.',
    },
    is_internship: {
      type: Type.BOOLEAN,
      description: 'True if the post is specifically for an intern or internship position.',
    },
    title: {
      type: Type.STRING,
      description: 'Job title (e.g. "React Developer", "UX Designer Intern"). Translate to English if in Khmer.',
    },
    company_name: {
      type: Type.STRING,
      description: 'Company or organization name. Empty string if not found.',
    },
    category: {
      type: Type.STRING,
      enum: ['SOFTWARE_DEV', 'DATA_AI', 'UX_UI', 'IT_SUPPORT_NETWORK', 'QA_TESTING', 'DIGITAL_MARKETING', 'OTHER'],
      description: 'Best-fit job category.',
    },
    location: {
      type: Type.STRING,
      description: 'Job location. Default to "Phnom Penh" for Cambodia posts.',
    },
    salary_range: {
      type: Type.STRING,
      description: 'Salary or compensation range if mentioned, e.g. "$300–$500/month". Empty string if not found.',
    },
    contact_info: {
      type: Type.STRING,
      description: 'Telegram username, phone number, email, or "Apply via link" from the post or poster image.',
    },
    summary: {
      type: Type.STRING,
      description: 'A concise 1–2 sentence summary of the role in English.',
    },
    confidence_score: {
      type: Type.NUMBER,
      description: 'Your confidence (0.0–1.0) that this is a legitimate tech job/internship post.',
    },
    rejection_reason: {
      type: Type.STRING,
      description: 'If is_job_post or is_tech_related is false, briefly explain why. Otherwise empty string.',
    },
  },
  required: [
    'is_job_post', 'is_tech_related', 'is_internship', 'title',
    'company_name', 'category', 'location', 'salary_range', 'contact_info',
    'summary', 'confidence_score', 'rejection_reason',
  ],
};

// ─── AI Analysis ─────────────────────────────────────────────────────────────

/**
 * Send a post's caption + thumbnail to Gemini 2.5 Flash for classification
 * and structured data extraction in a single multimodal request.
 *
 * @param {string} caption      — raw post caption
 * @param {string} thumbnailUrl — URL to the video thumbnail image
 * @returns {Promise<object>}   — parsed JSON matching JOB_EXTRACTION_SCHEMA
 */
export async function analyzeWithAi(caption, thumbnailUrl) {
  // Build the content parts array — always include caption text
  const contentParts = [
    {
      text: `You are analyzing a TikTok post from Cambodia to determine if it is a legitimate tech job or internship listing.

Post Caption:
"""
${caption || '(no caption)'}
"""

Analyze the caption text AND the thumbnail image (often a Canva/designed poster with key job details).
Extract all job information you can find. Respond only with the required JSON object.`,
    },
  ];

  // Attach thumbnail image if a URL was provided
  if (thumbnailUrl) {
    try {
      const imageResponse = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(5000) });
      // Gemini rejects the whole request on an unsupported mimeType, so only
      // attach formats it accepts (TikTok CDN sometimes serves octet-stream).
      const contentType = (imageResponse.headers.get('content-type') ?? '').split(';')[0].trim();
      const supported   = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
      if (imageResponse.ok && supported.includes(contentType)) {
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64Data  = Buffer.from(arrayBuffer).toString('base64');

        // Prepend image so the model sees it before the text prompt
        contentParts.unshift({
          inlineData: { mimeType: contentType, data: base64Data },
        });
      }
    } catch (fetchErr) {
      // Non-fatal: proceed with caption-only analysis if thumbnail fetch fails
      console.warn(`[AI] Could not fetch thumbnail ${thumbnailUrl}:`, fetchErr.message);
    }
  }

  const candidateModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-flash-latest',
  ].filter(Boolean);

  let lastError;
  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: contentParts }],
        config: {
          responseMimeType: 'application/json', // Required when using responseSchema
          responseSchema: JOB_EXTRACTION_SCHEMA,
        },
      });

      return JSON.parse(response.text);
    } catch (err) {
      lastError = err;
      const isQuota = err.message?.includes('RESOURCE_EXHAUSTED') || err.message?.includes('429');
      if (isQuota) {
        console.warn(`[AI] Free tier rate quota hit on ${model}. Cooling down for 30s...`);
        await new Promise((resolve) => setTimeout(resolve, 30000));
        try {
          const retryRes = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: contentParts }],
            config: {
              responseMimeType: 'application/json',
              responseSchema: JOB_EXTRACTION_SCHEMA,
            },
          });
          return JSON.parse(retryRes.text);
        } catch (retryErr) {
          lastError = retryErr;
        }
      }
      console.warn(`[AI] Model ${model} failed (${err.message}). Trying fallback...`);
    }
  }

  throw lastError;
}

let lastAiCallTimestamp = 0;
const MIN_AI_INTERVAL_MS = 4000; // Paced to adhere to 15 req/min free-tier quota

/**
 * Paces AI calls only when needed based on elapsed time since the previous call.
 * Avoids any delay on the first call or when sufficient time has naturally elapsed.
 */
async function paceAiCall() {
  const now = Date.now();
  const elapsed = now - lastAiCallTimestamp;
  if (elapsed < MIN_AI_INTERVAL_MS && lastAiCallTimestamp > 0) {
    await new Promise((resolve) => setTimeout(resolve, MIN_AI_INTERVAL_MS - elapsed));
  }
  lastAiCallTimestamp = Date.now();
}

// ─── Batch Processor ──────────────────────────────────────────────────────────

/**
 * Process an array of scraped posts through the full 3-gate pipeline.
 *
 * Gate 1: DB dedup  (skip posts we've already seen, unless prior run had ERROR)
 * Gate 2: Filter    (local regex heuristic — zero cost)
 * Gate 3: AI        (Gemini multimodal classification)
 *
 * All DB writes for a single batch run inside a single transaction for
 * atomicity and performance.
 *
 * @param {object[]} posts — raw posts from the scraper
 * @param {object}   [options]
 * @param {Function} [options.onProgress] — callback for real-time progress
 * @returns {Promise<object>} — summary counts
 */
export async function processScrapedPosts(posts, { onProgress } = {}) {
  const summary = { processed: 0, approved: 0, rejected: 0, skipped: 0, errors: 0 };

  // Process posts sequentially to avoid hitting Gemini rate limits.
  // Each post may make one network call (thumbnail fetch) + one AI API call.
  for (const post of posts) {
    summary.processed++;

    onProgress?.({
      stage: 'ingesting',
      message: `Analyzing post ${summary.processed}/${posts.length}...`,
      current: summary.processed,
      total: posts.length,
      summary: { ...summary },
    });

    // ── Gate 1: DB Deduplication ─────────────────────────────────────────────
    const existing = await findRawPostByExternalId(post.platform ?? 'TIKTOK', post.id);
    let rawPostId;

    if (existing) {
      if (existing.status !== 'ERROR') {
        summary.skipped++;
        console.log(`[Gate 1] Skipping already-seen post ${post.id} (status: ${existing.status})`);
        continue;
      }
      // If previous status was ERROR, allow retry using the existing raw post ID
      rawPostId = existing.id;
      console.log(`[Gate 1] Retrying previously errored post ${post.id}`);
    } else {
      // Insert into raw_ingested_posts immediately so re-runs don't double-process
      try {
        const result = await insertRawPost({
          platform:       post.platform ?? 'TIKTOK',
          externalPostId: post.id,
          postUrl:        post.url ?? post.webVideoUrl ?? '',
          authorHandle:   post.authorMeta?.name ?? post.author ?? null,
          rawCaption:     post.text ?? post.caption ?? null,
          hashtags:       post.hashtags ?? [],
          thumbnailUrl:   post.covers?.default ?? post.thumbnailUrl ?? null,
          postedAt:       post.createTimeISO ?? post.postedAt ?? null,
        });
        rawPostId = result.id;
      } catch (insertErr) {
        // Race condition guard: another process may have inserted between our check and insert
        if (insertErr.message?.includes('UNIQUE constraint failed')) {
          summary.skipped++;
          continue;
        }
        console.error(`[Gate 1] Failed to insert raw post ${post.id}:`, insertErr.message);
        summary.errors++;
        continue;
      }
    }

    // ── Gate 2: Local Filter ─────────────────────────────────────────────────
    const caption  = post.text ?? post.caption ?? '';
    const hashtags = (post.hashtags ?? []).map((h) =>
      typeof h === 'string' ? h : (h.name ?? '')
    );

    const filterResult = shouldSendToAi(caption, hashtags);

    if (!filterResult.pass) {
      await updateRawPostStatus(rawPostId, 'REJECTED', `filter:${filterResult.reason}`);
      summary.rejected++;
      console.log(`[Gate 2] Rejected post ${post.id}: ${filterResult.reason}`);
      continue;
    }

    console.log(`[Gate 2] Post ${post.id} passed filter (${filterResult.reason}), sending to AI...`);

    // ── Gate 3: AI Classification ────────────────────────────────────────────
    try {
      // Dynamic pacing: only sleeps if less than 4s elapsed since the last AI call
      await paceAiCall();

      const thumbnailUrl = post.covers?.default ?? post.thumbnailUrl ?? null;
      const aiResult     = await analyzeWithAi(caption, thumbnailUrl);

      const isApproved = aiResult.is_job_post && aiResult.is_tech_related;

      if (isApproved) {
        // Two sequential awaits — effectively atomic since posts are processed one at a time
        await updateRawPostStatus(rawPostId, 'APPROVED', null);
        await insertJobListing(rawPostId, {
          ...aiResult,
          publishedAt: post.createTimeISO ?? post.postedAt ?? null,
        });
        summary.approved++;
        console.log(`[Gate 3] ✓ Approved: "${aiResult.title}" at "${aiResult.company_name}"`);
      } else {
        const reason = aiResult.rejection_reason || `is_job_post=${aiResult.is_job_post}, is_tech_related=${aiResult.is_tech_related}`;
        await updateRawPostStatus(rawPostId, 'REJECTED', `ai:${reason}`);
        summary.rejected++;
        console.log(`[Gate 3] ✗ Rejected by AI: ${reason}`);
      }
    } catch (aiErr) {
      await updateRawPostStatus(rawPostId, 'ERROR', aiErr.message);
      summary.errors++;
      console.error(`[Gate 3] AI error for post ${post.id}:`, aiErr.message);
    }
  }

  console.log('[Ingestor] Batch complete:', summary);
  return summary;
}
