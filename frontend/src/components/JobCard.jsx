/**
 * JobCard.jsx — Displays a single job listing card
 *
 * Legal note: Thumbnails are loaded directly from the TikTok CDN URL stored
 * in the DB. We never re-host or copy media. Every card links back to the
 * original post and credits the creator.
 */

// Maps DB enum values to emoji + short label pairs for badges
const CATEGORY_LABELS = {
  SOFTWARE_DEV:       { emoji: '💻', label: 'Software Dev' },
  DATA_AI:            { emoji: '🧠', label: 'Data & AI' },
  UX_UI:              { emoji: '🎨', label: 'UX / UI' },
  IT_SUPPORT_NETWORK: { emoji: '🔧', label: 'IT Support' },
  QA_TESTING:         { emoji: '🧪', label: 'QA Testing' },
  DIGITAL_MARKETING:  { emoji: '📣', label: 'Marketing' },
  OTHER:              { emoji: '📁', label: 'Other' },
};

/**
 * Format an ISO date string as relative time (e.g. "3 days ago").
 * Falls back to a locale date string if the Intl API is unavailable.
 */
function formatRelativeTime(isoString) {
  if (!isoString) return null;

  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30)  return `${diffDays} days ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * @param {object} job  — row from job_listings joined with raw_ingested_posts
 * @param {function} onClick — called when the user clicks to see full details
 */
export default function JobCard({ job, onClick }) {
  const category = CATEGORY_LABELS[job.category] ?? CATEGORY_LABELS.OTHER;
  const postedAgo = formatRelativeTime(job.published_at ?? job.created_at);

  return (
    <article
      className="card overflow-hidden flex flex-col cursor-pointer
                 hover:shadow-md hover:-translate-y-0.5
                 transition-all duration-200"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`${job.title} at ${job.company_name ?? 'Unknown company'}`}
    >
      {/* Thumbnail — loaded from TikTok CDN, not re-hosted */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {job.thumbnail_url ? (
          <img
            src={job.thumbnail_url}
            alt={`Thumbnail for ${job.title}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {category.emoji}
          </div>
        )}

        {/* Internship badge — overlaid on thumbnail */}
        {job.is_internship === 1 && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full
                           bg-purple-600 text-white text-xs font-semibold">
            Internship
          </span>
        )}

        {/* TikTok source badge */}
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full
                         bg-black/70 text-white text-xs font-medium">
          TikTok
        </span>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col flex-1 gap-2">

        {/* Category badge */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                         bg-brand-50 text-brand-700 text-xs font-medium w-fit">
          {category.emoji} {category.label}
        </span>

        {/* Title + company */}
        <div>
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">
            {job.title}
          </h3>
          {job.company_name && (
            <p className="text-sm text-gray-500 mt-0.5">{job.company_name}</p>
          )}
        </div>

        {/* Meta row: location + salary */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-auto pt-1">
          {job.location && (
            <span className="flex items-center gap-1">
              📍 {job.location}
            </span>
          )}
          {job.salary_range && (
            <span className="flex items-center gap-1 text-green-700 font-medium">
              💵 {job.salary_range}
            </span>
          )}
        </div>

        {/* Footer: attribution + original link */}
        <div className="border-t border-gray-100 pt-2 mt-1
                        flex items-center justify-between gap-2">
          {/* Creator credit */}
          <a
            href={job.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-brand-500 transition-colors truncate"
            onClick={(e) => e.stopPropagation()} // Don't open modal when clicking creator
            aria-label={`View @${job.author_handle}'s original TikTok post`}
          >
            @{job.author_handle ?? 'unknown'}
          </a>

          <div className="flex items-center gap-2 shrink-0">
            {postedAgo && (
              <span className="text-xs text-gray-400">{postedAgo}</span>
            )}
            {/* Primary CTA: view original TikTok */}
            <a
              href={job.post_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn-primary py-1 px-2 text-xs"
              aria-label="View original post on TikTok"
            >
              View ↗
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
