import { useState, useEffect, useRef } from 'react';
import { fetchJobById } from '../lib/api.js';
import { getCategory } from '../lib/categories.js';
import { formatDateTime, formatIndex } from '../lib/format.js';
import { IconAlert, IconArrowUpRight, IconCash, IconClose, IconFilm, IconPin } from './Icons.jsx';

/**
 * JobDetailModal — the full record.
 *
 * Fetches the full job (including raw_caption and original_posted_at)
 * from the API when the modal opens. This keeps the card list response lean.
 *
 * @param {number}   jobId   — ID of the job to display
 * @param {function} onClose — called to close the modal
 */
export default function JobDetailModal({ jobId, onClose }) {
  const [job, setJob]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [thumbFailed, setThumbFailed] = useState(false);

  const panelRef = useRef(null);
  const closeRef = useRef(null);

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

  // Lock page scroll behind the overlay
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  // Escape closes; Tab is trapped inside the panel
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const items = panel.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (items.length === 0) return;

      const first = items[0];
      const last  = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Move focus into the panel once it exists
  useEffect(() => {
    if (!loading) closeRef.current?.focus();
  }, [loading]);

  const category = job ? getCategory(job.category) : null;
  const salary   = job?.salary_range?.trim();

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto
                 bg-ink-950/85 p-3 backdrop-blur-md sm:items-center sm:p-6"
      onClick={onClose}
    >
      {/* Panel — clicks inside don't close */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Job details"
        onClick={(e) => e.stopPropagation()}
        className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl border
                   border-ink-700 bg-ink-900 shadow-modal"
        style={category ? { '--cat': category.rgb } : undefined}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-3 border-b border-ink-700/70 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {job && (
              <>
                <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-dim">
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: `rgb(${category.rgb})`,
                      boxShadow: `0 0 10px rgb(${category.rgb})`,
                    }}
                  />
                  № {formatIndex(job.id)}
                </span>
                <span className="hidden h-3 w-px bg-ink-700 sm:block" />
                <span className="hidden truncate font-mono text-[11px] uppercase tracking-[0.18em] sm:block"
                      style={{ color: `rgb(${category.rgb})` }}>
                  {category.full}
                </span>
              </>
            )}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="btn btn-quiet !px-2 !py-1.5"
          >
            <IconClose />
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center gap-3 px-6 py-24 text-fg-mute">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-700 border-t-ember-500" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em]">Retrieving record</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
            <IconAlert className="h-6 w-6 text-ember-500" />
            <p className="font-display text-base font-semibold text-fg">Failed to load record</p>
            <p className="text-sm text-fg-mute">{error}</p>
            <button type="button" onClick={onClose} className="btn mt-3">Close</button>
          </div>
        )}

        {job && !loading && (
          <div className="flex max-h-[78vh] flex-col overflow-y-auto sm:grid sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]">

            {/* ── Left: poster + provenance ── */}
            <div className="order-2 border-t border-ink-700/70 p-4 sm:order-1 sm:border-b-0 sm:border-r sm:p-6">
              {!thumbFailed ? (
                <div className="relative aspect-video overflow-hidden rounded-xl border border-ink-700 bg-ink-850 sm:aspect-[4/5]">
                  <img
                    src={`/api/jobs/${job.id}/thumbnail`}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
                  />
                  <img
                    src={`/api/jobs/${job.id}/thumbnail`}
                    alt={`Hiring poster for ${job.title}`}
                    referrerPolicy="no-referrer"
                    onError={() => setThumbFailed(true)}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  className="relative flex aspect-video flex-col justify-between overflow-hidden rounded-xl border border-ink-700 p-5 sm:aspect-[4/5]"
                  style={{
                    background: `radial-gradient(ellipse at 85% 15%, rgba(var(--cat), 0.25) 0%, rgba(10, 12, 16, 0.95) 70%)`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider font-semibold"
                      style={{
                        backgroundColor: 'rgba(var(--cat), 0.15)',
                        color: 'rgb(var(--cat))',
                        border: '1px solid rgba(var(--cat), 0.3)',
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: 'rgb(var(--cat))' }} />
                      {category?.label ?? 'Tech'}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-mute/60">
                      Khmer Tech
                    </span>
                  </div>

                  <div className="my-auto text-center py-6">
                    <div
                      className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl font-mono text-xl font-bold shadow-lg mb-3"
                      style={{
                        backgroundColor: 'rgba(var(--cat), 0.2)',
                        color: 'rgb(var(--cat))',
                        border: '1px solid rgba(var(--cat), 0.4)',
                      }}
                    >
                      {(job?.company_name ? job.company_name.trim().charAt(0) : 'K').toUpperCase()}
                    </div>
                    <p className="text-sm font-semibold text-fg-dim">
                      {job?.company_name || 'Hiring Company'}
                    </p>
                    <p className="mt-1 text-base font-bold text-fg sm:text-lg leading-snug">
                      {job?.title}
                    </p>
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-fg-mute">
                    <span>📍 {job?.location || 'Phnom Penh'}</span>
                    <span style={{ color: 'rgb(var(--cat))' }} className="font-semibold tracking-wider">
                      TIKTOK POSTER ↗
                    </span>
                  </div>
                </div>
              )}

              {/* Provenance */}
              <dl className="mt-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <dt className="mono-label">Source</dt>
                  <dd className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim">
                    <IconFilm className="h-3.5 w-3.5" />
                    TikTok
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="mono-label">Creator</dt>
                  <dd className="min-w-0 truncate font-mono text-[11px] text-fg-dim">
                    @{job.author_handle ?? 'unknown'}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="mono-label">Posted</dt>
                  <dd className="font-mono text-[11px] text-fg-dim">
                    {formatDateTime(job.original_posted_at ?? job.published_at) ?? 'Unknown'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* ── Right: the record ── */}
            <div className="order-1 p-4 sm:order-2 sm:p-6">
              <h2 className="font-display text-xl font-semibold leading-snug text-fg sm:text-2xl">
                {job.title}
              </h2>

              {job.company_name && (
                <p className="mt-1.5 text-sm text-fg-dim">{job.company_name}</p>
              )}

              {/* Key details */}
              <dl className="mt-5 divide-y divide-ink-700/50 border-y border-ink-700/50">
                {job.location && (
                  <div className="flex items-baseline gap-4 py-2.5">
                    <dt className="mono-label w-20 shrink-0">Location</dt>
                    <dd className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
                      <IconPin className="h-3.5 w-3.5 shrink-0 text-fg-mute" />
                      <span className="truncate">{job.location}</span>
                    </dd>
                  </div>
                )}

                {salary && (
                  <div className="flex items-baseline gap-4 py-2.5">
                    <dt className="mono-label w-20 shrink-0">Salary</dt>
                    <dd className="flex items-center gap-1.5 text-sm font-semibold text-mint-400">
                      <IconCash className="h-3.5 w-3.5 shrink-0" />
                      {salary}
                    </dd>
                  </div>
                )}

                {job.contact_info && (
                  <div className="flex items-baseline gap-4 py-2.5">
                    <dt className="mono-label w-20 shrink-0">Contact</dt>
                    <dd className="break-all text-sm text-fg">{job.contact_info}</dd>
                  </div>
                )}

                {job.is_internship === 1 && (
                  <div className="flex items-baseline gap-4 py-2.5">
                    <dt className="mono-label w-20 shrink-0">Type</dt>
                    <dd className="font-mono text-[11px] uppercase tracking-[0.14em] text-ice-400">
                      Internship
                    </dd>
                  </div>
                )}
              </dl>

              {job.summary && (
                <div className="mt-5">
                  <h3 className="mono-label mb-2">Summary</h3>
                  <p className="text-sm leading-relaxed text-fg-dim">{job.summary}</p>
                </div>
              )}

              {/* AI confidence */}
              {job.confidence_score != null && (
                <div className="mt-5 flex items-center gap-3">
                  <span className="mono-label shrink-0">Confidence</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(job.confidence_score * 100)}%`,
                        background: `rgb(var(--cat, var(--c-ember-500)))`,
                      }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-fg-dim">
                    {Math.round(job.confidence_score * 100)}%
                  </span>
                </div>
              )}

              {/* Primary CTA */}
              <a
                href={job.post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ember mt-6 w-full !py-3 !text-xs"
              >
                View original post
                <IconArrowUpRight className="h-4 w-4" />
              </a>

              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-fg-mute">
                Content belongs to the creator
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
