import { useState } from 'react';
import { getCategory } from '../lib/categories.js';
import { formatAge, formatIndex } from '../lib/format.js';
import { IconArrowUpRight, IconCash, IconPin } from './Icons.jsx';

/**
 * JobCard.jsx — one indexed record on the dispatch board.
 *
 * The poster is the hiring ad itself, so it leads: the card is the document,
 * and the panel underneath is its index entry. Nothing is overlaid on the
 * poster — the creator's own layout stays readable — so all metadata lives in
 * the panel below.
 *
 * TikTok cover frames are portrait (9:16), so a landscape slot crops them.
 * The crop is biased toward the top of the frame, where hiring posts put the
 * role title. The panel below carries the details the crop loses.
 *
 * Legal note: thumbnails are loaded directly from the TikTok CDN URL stored
 * in the DB. We never re-host or copy media. Every card links back to the
 * original post and credits the creator.
 *
 * @param {object}   job     — row from job_listings joined with raw_ingested_posts
 * @param {function} onClick — called when the user clicks to see full details
 */
export default function JobCard({ job, onClick }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const category = getCategory(job.category);
  const postedAgo = formatAge(job.published_at ?? job.created_at);
  const isInternship = job.is_internship === 1;
  const salary = job.salary_range?.trim();

  // Route through proxy endpoint for automatic signing, caching, and fallback
  const thumbnailSrc = `/api/jobs/${job.id}/thumbnail`;

  return (
    <article
      className="record group flex flex-col"
      style={{ '--cat': category.rgb }}
      onClick={onClick}
    >
      <span className="record-spine" aria-hidden="true" />

      {/* ── Poster — the hiring ad ── */}
      <div className="record-thumb relative aspect-video w-full overflow-hidden border-b border-ink-700/50 bg-ink-950">
        {!thumbFailed ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-ink-850" />
            )}
            <img
              src={thumbnailSrc}
              alt={`Hiring poster for ${job.title}`}
              loading="lazy"
              referrerPolicy="no-referrer"
              onLoad={() => setImgLoaded(true)}
              onError={() => setThumbFailed(true)}
              className={`absolute inset-0 h-full w-full object-cover object-[center_25%] transition-opacity duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </>
        ) : (
          <FallbackPoster job={job} category={category} />
        )}
      </div>

      {/* ── Index entry ── */}
      <div className="flex flex-1 flex-col p-4">

        {/* Archive number, discipline, age */}
        <div className="flex items-center gap-x-3 gap-y-1">
          <span className="mono-label">№ {formatIndex(job.id)}</span>
          <span className="h-2.5 w-px bg-ink-700" />
          <span
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em]"
            style={{ color: `rgb(${category.rgb})` }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: `rgb(${category.rgb})` }}
            />
            {category.label}
          </span>
          {postedAgo && (
            <span className="mono-label ml-auto shrink-0">{postedAgo}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="mt-2.5 font-display text-[17px] font-semibold leading-snug text-fg">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="line-clamp-2 text-left transition-colors duration-200 hover:text-ember-300"
          >
            {job.title}
          </button>
        </h3>

        {/* Company + internship flag */}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[13px] text-fg-dim">
            {job.company_name || <span className="text-fg-mute">Company not listed</span>}
          </span>
          {isInternship && (
            <span className="shrink-0 rounded border border-ice-400/35 bg-ice-400/10 px-1.5 py-px
                             font-mono text-[9px] uppercase tracking-[0.14em] text-ice-400">
              Internship
            </span>
          )}
        </div>

        {/* Location + salary */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-fg-mute">
          {job.location && (
            <span className="flex min-w-0 items-center gap-1.5" title={job.location}>
              <IconPin className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">{job.location}</span>
            </span>
          )}

          {salary && (
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-mint-400">
              <IconCash className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">{salary}</span>
            </span>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-ink-700/50 pt-3">
          <a
            href={job.post_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate font-mono text-[11px] text-fg-mute transition-colors hover:text-ice-400"
            aria-label={`View @${job.author_handle}'s original TikTok post`}
          >
            @{job.author_handle ?? 'unknown'}
          </a>

          <a
            href={job.post_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="group/apply inline-flex shrink-0 items-center gap-1 rounded-md border border-ink-700
                       px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-dim
                       transition-all duration-200 ease-out hover:border-ember-500/60 hover:bg-ember-500/10 hover:text-ember-300"
            aria-label="View original post on TikTok"
          >
            Apply
            <IconArrowUpRight className="h-3 w-3 transition-transform duration-200 ease-out group-hover/apply:translate-x-0.5 group-hover/apply:-translate-y-0.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

/**
 * Stand-in for missing thumbnails — a branded, editorial card graphic
 * with category-themed ambient gradients and crisp typography.
 */
function FallbackPoster({ job, category }) {
  const initial = (job?.company_name ? job.company_name.trim().charAt(0) : 'K').toUpperCase();

  return (
    <div
      className="relative flex h-full w-full flex-col justify-between p-3.5 overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at 85% 15%, rgba(var(--cat), 0.25) 0%, rgba(10, 12, 16, 0.95) 70%)`,
      }}
    >
      {/* Decorative Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top row: category pill + Khmer tech tag */}
      <div className="relative z-10 flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider font-semibold"
          style={{
            backgroundColor: 'rgba(var(--cat), 0.15)',
            color: 'rgb(var(--cat))',
            border: '1px solid rgba(var(--cat), 0.3)',
          }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'rgb(var(--cat))' }} />
          {category?.label ?? 'Tech'}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-mute/50">
          Khmer Tech
        </span>
      </div>

      {/* Middle row: company avatar + job title preview */}
      <div className="relative z-10 my-auto">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold"
            style={{
              backgroundColor: 'rgba(var(--cat), 0.2)',
              color: 'rgb(var(--cat))',
              border: '1px solid rgba(var(--cat), 0.35)',
            }}
          >
            {initial}
          </span>
          <span className="text-xs font-medium text-fg-dim truncate">
            {job?.company_name || 'Hiring Company'}
          </span>
        </div>
        <p className="line-clamp-2 text-sm font-bold text-fg leading-snug">
          {job?.title}
        </p>
      </div>

      {/* Bottom row: location + indicator */}
      <div className="relative z-10 flex items-center justify-between font-mono text-[9px] text-fg-mute">
        <span>📍 {job?.location || 'Phnom Penh'}</span>
        <span style={{ color: 'rgb(var(--cat))' }} className="font-semibold tracking-wider">
          DISPATCH ↗
        </span>
      </div>
    </div>
  );
}
