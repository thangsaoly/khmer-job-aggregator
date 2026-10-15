import { useState, useEffect } from 'react';
import { fetchJobById } from '../lib/api.js';

const CATEGORY_LABELS = {
  SOFTWARE_DEV:       { emoji: '💻', label: 'Software Development' },
  DATA_AI:            { emoji: '🧠', label: 'Data & AI' },
  UX_UI:              { emoji: '🎨', label: 'UX / UI Design' },
  IT_SUPPORT_NETWORK: { emoji: '🔧', label: 'IT Support & Network' },
  QA_TESTING:         { emoji: '🧪', label: 'QA & Testing' },
  DIGITAL_MARKETING:  { emoji: '📣', label: 'Digital Marketing' },
  OTHER:              { emoji: '📁', label: 'Other' },
};

/**
 * JobDetailModal — full-screen overlay with complete job details.
 *
 * Fetches the full job (including raw_caption and original_posted_at)
 * from the API when the modal opens. This keeps the card list response lean.
 *
 * @param {number}   jobId    — ID of the job to display
 * @param {function} onClose  — called to close the modal
 */
export default function JobDetailModal({ jobId, onClose }) {
  const [job, setJob]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch full job data when modal opens
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await fetchJobById(jobId);
        if (!cancelled) setJob(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [jobId]);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const category = job ? (CATEGORY_LABELS[job.category] ?? CATEGORY_LABELS.OTHER) : null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
                 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Job details"
    >
      {/* Modal panel — stop click propagation so clicks inside don't close */}
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <span className="text-sm text-gray-500">Job Detail</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {loading && (
            <div className="flex justify-center items-center py-12 text-gray-400">
              <span className="animate-spin text-2xl mr-2">⏳</span>
              Loading...
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-500">
              <p className="text-lg mb-2">⚠️ Failed to load job</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {job && (
            <div className="space-y-5">
              {/* Thumbnail */}
              {job.thumbnail_url && (
                <div className="rounded-xl overflow-hidden aspect-video bg-gray-100">
                  <img
                    src={job.thumbnail_url}
                    alt={`Poster for ${job.title}`}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Badges row */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-sm font-medium">
                  {category.emoji} {category.label}
                </span>
                {job.is_internship === 1 && (
                  <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm font-medium">
                    🎓 Internship
                  </span>
                )}
              </div>

              {/* Title + Company */}
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-snug">
                  {job.title}
                </h2>
                {job.company_name && (
                  <p className="text-gray-600 mt-1">{job.company_name}</p>
                )}
              </div>

              {/* Key details grid */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {job.location && (
                  <>
                    <dt className="text-gray-500 font-medium">📍 Location</dt>
                    <dd className="text-gray-900">{job.location}</dd>
                  </>
                )}
                {job.salary_range && (
                  <>
                    <dt className="text-gray-500 font-medium">💵 Salary</dt>
                    <dd className="text-green-700 font-semibold">{job.salary_range}</dd>
                  </>
                )}
                {job.contact_info && (
                  <>
                    <dt className="text-gray-500 font-medium">📬 Contact</dt>
                    <dd className="text-gray-900 break-all">{job.contact_info}</dd>
                  </>
                )}
              </dl>

              {/* AI summary */}
              {job.summary && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Summary
                  </h3>
                  <p className="text-gray-800 leading-relaxed">{job.summary}</p>
                </div>
              )}

              {/* Confidence score */}
              {job.confidence_score != null && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>AI confidence:</span>
                  <span className="font-medium text-gray-600">
                    {Math.round(job.confidence_score * 100)}%
                  </span>
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-400 rounded-full"
                      style={{ width: `${job.confidence_score * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Primary CTA — prominent link back to TikTok */}
              <a
                href={job.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full justify-center py-3 text-base"
              >
                <span>📱</span>
                View Original Post on TikTok
              </a>

              {/* Creator attribution */}
              <p className="text-center text-xs text-gray-400">
                Posted by{' '}
                <a
                  href={job.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-500 hover:underline"
                >
                  @{job.author_handle ?? 'unknown'}
                </a>{' '}
                · Original content belongs to the creator
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
