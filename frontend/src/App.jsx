import { useState, useEffect, useCallback } from 'react';
import { fetchJobs } from './lib/api.js';
import FilterBar        from './components/FilterBar.jsx';
import JobCard          from './components/JobCard.jsx';
import JobDetailModal   from './components/JobDetailModal.jsx';

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
  const [totalLoaded,    setTotalLoaded]   = useState(0);
  const [hasMore,        setHasMore]       = useState(false);
  const [loading,        setLoading]       = useState(true);
  const [error,          setError]         = useState(null);
  const [selectedJobId,  setSelectedJobId] = useState(null);

  // Fetch jobs whenever filters change (including pagination offset)
  const loadJobs = useCallback(async (currentFilters, append = false) => {
    setLoading(true);
    setError(null);

    try {
      const { data, count } = await fetchJobs(currentFilters);

      setJobs((prev) => append ? [...prev, ...data] : data);
      setTotalLoaded((prev) => append ? prev + count : count);
      setHasMore(count === JOBS_PER_PAGE); // If we got a full page, there might be more
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload from scratch when filters change (not pagination)
  useEffect(() => {
    setJobs([]);
    setTotalLoaded(0);
    loadJobs(filters, false);
  }, [filters, loadJobs]);

  const [syncing,        setSyncing]       = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/scrape/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultsPerPage: 20 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Sync failed');
      await loadJobs(filters);
    } catch (err) {
      alert('Failed to trigger TikTok scrape: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleFilterChange(newFilters) {
    // Reset offset when filters change
    setFilters({ ...newFilters, offset: 0 });
  }

  function handleLoadMore() {
    const nextFilters = { ...filters, offset: filters.offset + JOBS_PER_PAGE };
    setFilters(nextFilters);
    loadJobs(nextFilters, true /* append */);
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              🇰🇭 Khmer Tech Jobs
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              IT & internship listings sourced from TikTok Cambodia (auto-syncs every 6h)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="btn-primary text-xs"
              title="Scrape fresh live posts from TikTok right now via Apify"
            >
              {syncing ? '⏳ Syncing...' : '🔄 Sync from TikTok'}
            </button>
            <a
              href="https://www.tiktok.com/tag/hiringcambodia"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-xs hidden sm:inline-flex"
            >
              Browse TikTok ↗
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-6xl mx-auto px-4 py-6">

        {/* Filter controls */}
        <FilterBar filters={filters} onFilterChange={handleFilterChange} />

        {/* Results count */}
        {!loading && !error && (
          <p className="text-sm text-gray-500 mb-4">
            {jobs.length === 0
              ? 'No jobs found matching your filters.'
              : `Showing ${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div className="card p-8 text-center text-red-500">
            <p className="text-2xl mb-2">⚠️</p>
            <p className="font-medium">Failed to load jobs</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => loadJobs(filters)}
              className="btn-ghost mt-4 mx-auto"
            >
              Try again
            </button>
          </div>
        )}

        {/* Job grid */}
        {!error && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onClick={() => setSelectedJobId(job.id)}
                />
              ))}

              {/* Loading skeleton cards */}
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="card overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                    </div>
                  </div>
                ))}
            </div>

            {/* Load more */}
            {!loading && hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={handleLoadMore} className="btn-ghost">
                  Load more jobs
                </button>
              </div>
            )}

            {/* Empty state (after filtering) */}
            {!loading && jobs.length === 0 && (
              <div className="card p-12 text-center">
                <p className="text-4xl mb-3">🔍</p>
                <p className="font-semibold text-gray-700">No jobs found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try different keywords or remove some filters.
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 mt-12 py-6 text-center text-xs text-gray-400">
        <p>
          All job listings link back to the original creator's TikTok post.{' '}
          Content belongs to the respective creators.
        </p>
        <p className="mt-1">
          Built for the Cambodian tech community 🇰🇭
        </p>
      </footer>

      {/* ── Job Detail Modal ── */}
      {selectedJobId != null && (
        <JobDetailModal
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
        />
      )}
    </div>
  );
}
