import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchJobs, triggerScrape, fetchScrapeStatus } from './lib/api.js';
import { formatAge, formatIndex } from './lib/format.js';
import FilterBar        from './components/FilterBar.jsx';
import JobCard          from './components/JobCard.jsx';
import JobDetailModal   from './components/JobDetailModal.jsx';
import { DispatchMark, IconAlert, IconArrowUpRight, IconChevronDown, IconRefresh } from './components/Icons.jsx';

const JOBS_PER_PAGE = 20;

const INITIAL_FILTERS = {
  category:    '',
  isInternship: undefined,
  location:    '',
  q:           '',
  limit:       JOBS_PER_PAGE,
  offset:      0,
};

export default function App() {
  const [filters,        setFilters]       = useState(INITIAL_FILTERS);
  const [jobs,           setJobs]          = useState([]);
  const [hasMore,        setHasMore]       = useState(false);
  const [loading,        setLoading]       = useState(true);
  const [appending,      setAppending]     = useState(false);
  const [error,          setError]         = useState(null);
  const [selectedJobId,  setSelectedJobId] = useState(null);
  const [offset,         setOffset]        = useState(0);
  const [notice,         setNotice]        = useState(null);
  const [syncState,      setSyncState]     = useState({
    running: false,
    stage: 'idle',
    message: '',
    current: 0,
    total: 0,
  });

  const pollTimerRef = useRef(null);

  // Fetch jobs whenever filters change (including pagination offset)
  const loadJobs = useCallback(async (currentFilters, append = false) => {
    if (append) setAppending(true);
    else        setLoading(true);
    setError(null);

    try {
      const { data, count } = await fetchJobs(currentFilters);

      setJobs((prev) => append ? [...prev, ...data] : data);
      setHasMore(count === JOBS_PER_PAGE); // If we got a full page, there might be more
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setAppending(false);
    }
  }, []);

  // Reload from scratch when filters change. Pagination does NOT go through
  // `filters` — otherwise this effect would wipe the list on "Load more".
  useEffect(() => {
    setJobs([]);
    setOffset(0);
    loadJobs({ ...filters, offset: 0 }, false);
  }, [filters, loadJobs]);

  // Poll background scraper status until completed
  const pollScrapeStatus = useCallback(async () => {
    try {
      const res = await fetchScrapeStatus();
      if (!res.success || !res.data) return;
      const data = res.data;

      setSyncState({
        running: data.running,
        stage: data.stage || 'idle',
        message: data.message || '',
        current: data.current || 0,
        total: data.total || 0,
      });

      if (data.running) {
        pollTimerRef.current = setTimeout(pollScrapeStatus, 1500);
      } else if (data.stage === 'done') {
        setNotice({ tone: 'ok', text: data.message || 'Sync completed.' });
        loadJobs({ ...filters, offset: 0 });
      } else if (data.stage === 'error') {
        setNotice({ tone: 'error', text: data.message || 'Sync failed.' });
      }
    } catch {
      // Ignore polling network glitches
    }
  }, [filters, loadJobs]);

  // Check initial scrape state on mount & clean up timers
  useEffect(() => {
    if (import.meta.env.DEV) {
      pollScrapeStatus();
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [pollScrapeStatus]);

  // Fast refresh from database (<100ms)
  async function handleRefresh() {
    setOffset(0);
    await loadJobs({ ...filters, offset: 0 });
    setNotice({ tone: 'ok', text: 'Listing refreshed from database.' });
  }

  // Trigger background TikTok scrape via Apify (dev only)
  async function handleLiveSync() {
    if (syncState.running) return;
    setNotice(null);
    try {
      const res = await triggerScrape({ resultsPerPage: 5, fast: true });
      if (res.data) {
        setSyncState({
          running: true,
          stage: res.data.stage || 'scraping',
          message: res.data.message || 'Starting TikTok crawler...',
          current: 0,
          total: 0,
        });
      }
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(pollScrapeStatus, 1500);
    } catch (err) {
      setNotice({ tone: 'error', text: `Sync failed — ${err.message}` });
    }
  }

  function handleFilterChange(newFilters) {
    // Reset offset when filters change
    setFilters({ ...newFilters, offset: 0 });
  }

  function handleLoadMore() {
    const nextOffset = offset + JOBS_PER_PAGE;
    setOffset(nextOffset);
    loadJobs({ ...filters, offset: nextOffset }, true /* append */);
  }

  // Age of the newest record — surfaced in the command bar
  const newestAge = useMemo(() => {
    if (jobs.length === 0) return null;
    return formatAge(jobs[0].published_at ?? jobs[0].created_at);
  }, [jobs]);

  // Lowest and highest archive numbers currently in view
  const [archiveLow, archiveHigh] = useMemo(() => {
    if (jobs.length === 0) return [0, 0];
    const ids = jobs.map((j) => j.id);
    return [Math.min(...ids), Math.max(...ids)];
  }, [jobs]);

  return (
    <div className="relative z-10 min-h-screen">

      {/* ── Command bar ── */}
      <header className="sticky top-0 z-40 h-14 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-xl sm:h-16">
        <div className="relative mx-auto flex h-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">

          {/* One-time signal sweep across the bar */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-ember-500/10 to-transparent" />
          </div>

          {/* Wordmark */}
          <a href="/" className="flex min-w-0 items-center gap-3">
            <DispatchMark className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
            <span className="min-w-0">
              <span className="block truncate font-display text-[15px] font-bold leading-tight tracking-tight text-fg sm:text-base">
                ការងារ IT
              </span>
              <span className="hidden font-mono text-[10px] uppercase leading-tight tracking-[0.2em] text-fg-mute sm:block">
                Khmer Tech Jobs
              </span>
            </span>
          </a>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Live cluster */}
            <span className="hidden items-center gap-2 md:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-live-pulse rounded-full bg-mint-400" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint-400" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-mute">
                Newest {newestAge ?? '—'}
              </span>
            </span>

            <span className="hidden h-4 w-px bg-ink-700 sm:block" />

            <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.16em] text-fg-mute">
              <span className="text-fg">{jobs.length}</span>
              <span className="hidden sm:inline">&nbsp;records</span>
            </span>

            {/* Fast refresh from DB (<100ms) */}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="btn !px-2.5 !py-1.5"
              title="Refresh job records from database"
            >
              <IconRefresh className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Live background TikTok scrape — dev server only */}
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={handleLiveSync}
                disabled={syncState.running}
                className={`btn !px-2.5 !py-1.5 ${
                  syncState.running ? 'border-mint-500/40 text-mint-400' : ''
                }`}
                title="Scrape fresh live posts from TikTok in the background via Apify"
              >
                <IconRefresh className={`h-3.5 w-3.5 ${syncState.running ? 'animate-spin text-mint-400' : ''}`} />
                <span className="hidden sm:inline">
                  {syncState.running
                    ? (syncState.stage === 'scraping' ? 'Scraping TikTok…' : `AI: ${syncState.current}/${syncState.total}…`)
                    : 'Sync TikTok'}
                </span>
              </button>
            )}

            <a
              href="https://www.tiktok.com/tag/hiringcambodia"
              target="_blank"
              rel="noopener noreferrer"
              className="btn hidden !px-2.5 !py-1.5 sm:inline-flex"
              title="Browse the source hashtag on TikTok"
            >
              TikTok
              <IconArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-5 sm:px-6">

        <FilterBar filters={filters} onFilterChange={handleFilterChange} />

        {/* Live background scrape status banner */}
        {syncState.running && (
          <div
            role="status"
            className="mt-4 flex items-center justify-between gap-2.5 rounded-lg border border-accent-500/30 bg-accent-500/10 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-300"
          >
            <div className="flex items-center gap-2.5">
              <IconRefresh className="h-3.5 w-3.5 animate-spin text-accent-400" />
              <span>{syncState.message || 'Background sync running...'}</span>
            </div>
            <span className="text-[10px] text-fg-mute tracking-normal normal-case">
              Background job — page remains fully interactive
            </span>
          </div>
        )}

        {/* Sync / refresh notice */}
        {notice && !syncState.running && (
          <div
            role="status"
            className={`mt-4 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] ${
              notice.tone === 'ok'
                ? 'border-mint-500/30 bg-mint-500/10 text-mint-400'
                : 'border-ember-500/30 bg-ember-500/10 text-ember-300'
            }`}
          >
            {notice.tone === 'ok' ? '✓' : '⚠'}
            {notice.text}
          </div>
        )}

        {/* ── Results bar ── */}
        {!error && (
          <div className="mt-6 flex items-center gap-3 sm:gap-4">
            <span className="mono-label shrink-0">Index</span>
            <span className="rule" />
            <span className="mono-label shrink-0">
              {loading && jobs.length === 0 ? 'Indexing' : `${jobs.length} records`}
            </span>
            <span className="rule hidden sm:block" />
            <span className="mono-label hidden shrink-0 sm:block">Newest first</span>
            <span className="rule hidden sm:block" />
            <span className="mono-label hidden shrink-0 lg:block">
              Archive № {formatIndex(archiveLow)} → {formatIndex(archiveHigh)}
            </span>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div className="mt-6 rounded-xl border border-ember-500/30 bg-ember-500/[0.06] px-6 py-14 text-center">
            <IconAlert className="mx-auto h-7 w-7 text-ember-500" />
            <p className="mt-3 font-display text-base font-semibold text-fg">Feed unavailable</p>
            <p className="mt-1 text-sm text-fg-mute">{error}</p>
            <button
              type="button"
              onClick={() => { setOffset(0); loadJobs({ ...filters, offset: 0 }); }}
              className="btn mt-5"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Records ── */}
        {!error && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
              {jobs.map((job, i) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJobId(job.id)}
                />
              ))}

              {/* Skeletons — only on a fresh load */}
              {loading && jobs.length === 0 &&
                Array.from({ length: 6 }).map((_, i) => <RecordSkeleton key={i} />)}
            </div>

            {/* Load more */}
            {!loading && hasMore && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <button type="button" onClick={handleLoadMore} disabled={appending} className="btn !px-7 !py-3">
                  {appending ? 'Loading' : 'Load more records'}
                  <IconChevronDown className={`h-4 w-4 ${appending ? 'animate-bounce' : ''}`} />
                </button>
                <span className="mono-label">
                  {jobs.length} of {jobs.length + 1}+ indexed
                </span>
              </div>
            )}

            {/* Empty state */}
            {!loading && jobs.length === 0 && (
              <div className="mt-6 rounded-xl border border-dashed border-ink-700 px-6 py-16 text-center">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-mute">
                  No matching records
                </p>
                <p className="mt-2 text-sm text-fg-dim">
                  Try a broader keyword, a different discipline, or clear the filters.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-ink-700/60 py-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-1.5 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-mute sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Every listing links back to the creator's original TikTok post</p>
          <p>Built for the Cambodian tech community</p>
        </div>
      </footer>

      {/* ── Detail panel ── */}
      {selectedJobId != null && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}

/** Placeholder card matching the record layout, shown while loading. */
function RecordSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink-700/60 bg-ink-900">
      <div className="aspect-video animate-pulse bg-ink-800" />
      <div className="space-y-3 p-4">
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-ink-800" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-ink-800" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-ink-800" />
        <div className="h-8 animate-pulse rounded bg-ink-800" />
      </div>
    </div>
  );
}
