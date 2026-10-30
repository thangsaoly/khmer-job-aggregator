import { useEffect, useRef, useState } from 'react';
import { CATEGORY_LIST } from '../lib/categories.js';
import { IconSearch, IconPin, IconClose } from './Icons.jsx';

/**
 * FilterBar — the control strip.
 *
 * Search, location and the internship switch are debounced before they reach
 * the parent, because every change re-queries the API. Category chips apply
 * immediately — they're a single discrete choice.
 *
 * @param {object}   filters        — current filter state from parent
 * @param {function} onFilterChange — (newFilters) => void
 */
export default function FilterBar({ filters, onFilterChange }) {
  const [searchInput, setSearchInput] = useState(filters.q ?? '');
  const [locationInput, setLocationInput] = useState(filters.location ?? '');

  const searchRef = useRef(null);
  const timers    = useRef({});
  const filtersRef = useRef(filters);

  // Keep the latest filters reachable from debounced callbacks
  filtersRef.current = filters;

  // Sync local inputs when the parent resets filters (e.g. RESET pressed)
  useEffect(() => { setSearchInput(filters.q ?? ''); },       [filters.q]);
  useEffect(() => { setLocationInput(filters.location ?? ''); }, [filters.location]);

  // Clear pending debounces on unmount
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
  }, []);

  /** Apply a filter change immediately. */
  function apply(key, value) {
    onFilterChange({ ...filtersRef.current, [key]: value, offset: 0 });
  }

  /** Apply a filter change after a short pause — for free-text inputs. */
  function applyDebounced(key, value) {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => apply(key, value), 350);
  }

  function handleSearchChange(e) {
    const value = e.target.value;
    setSearchInput(value);
    applyDebounced('q', value);
  }

  function handleLocationChange(e) {
    const value = e.target.value;
    setLocationInput(value);
    applyDebounced('location', value);
  }

  function clearAll() {
    Object.values(timers.current).forEach(clearTimeout);
    setSearchInput('');
    setLocationInput('');
    onFilterChange({ category: '', isInternship: undefined, location: '', q: '', offset: 0 });
  }

  // "/" focuses search from anywhere on the page
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;

      const el = e.target;
      if (el instanceof HTMLElement &&
          (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;

      e.preventDefault();
      searchRef.current?.focus();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const internshipOnly = filters.isInternship === true;
  const hasActiveFilters =
    Boolean(filters.category) || internshipOnly ||
    Boolean(filters.location) || Boolean(filters.q);

  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/95 shadow-record backdrop-blur-xl lg:sticky lg:top-16 lg:z-30">
      <div className="p-3 sm:p-4">

        {/* ── Row 1 — search, location, internship switch ── */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          {/* Keyword search */}
          <div className="relative flex-1 min-w-0">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-mute">
              <IconSearch />
            </span>
            <input
              ref={searchRef}
              type="text"
              value={searchInput}
              onChange={handleSearchChange}
              placeholder="Search roles, skills, companies"
              aria-label="Search roles, skills or companies"
              className="field pl-9 pr-10"
            />
            {/* Keyboard hint — only useful while the field is idle */}
            {!searchInput && (
              <kbd
                className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2
                           rounded border border-ink-700 bg-ink-850 px-1.5 py-0.5
                           font-mono text-[10px] text-fg-mute sm:block"
              >
                /
              </kbd>
            )}
          </div>

          <div className="flex gap-2.5">
            {/* Location */}
            <div className="relative flex-1 sm:w-48 sm:flex-none">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-mute">
                <IconPin />
              </span>
              <input
                type="text"
                value={locationInput}
                onChange={handleLocationChange}
                placeholder="Location"
                aria-label="Filter by location"
                className="field pl-8"
              />
            </div>

            {/* Internship toggle */}
            <button
              type="button"
              role="switch"
              aria-checked={internshipOnly}
              onClick={() => apply('isInternship', internshipOnly ? undefined : true)}
              className="group inline-flex shrink-0 items-center gap-2.5 rounded-lg border
                         border-ink-700 bg-ink-800/80 px-3 py-2.5 transition-colors duration-200
                         hover:bg-ink-800"
              title="Show internships only"
            >
              <span
                className={`relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-200 ${
                  internshipOnly
                    ? 'border-ember-500/70 bg-ember-500/30'
                    : 'border-ink-700 bg-ink-850'
                }`}
              >
                <span
                  className={`absolute top-[2px] h-[12px] w-[12px] rounded-full transition-all duration-200 ease-out ${
                    internshipOnly ? 'left-[16px] bg-ember-400' : 'left-[2px] bg-fg-mute'
                  }`}
                />
              </span>
              <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-fg-dim transition-colors group-hover:text-fg">
                Internships<span className="hidden sm:inline">&nbsp;only</span>
              </span>
            </button>
          </div>
        </div>

        {/* ── Row 2 — category chips ── */}
        <div className="mt-3 flex items-center gap-3 border-t border-ink-700/50 pt-3">
          <span className="mono-label hidden shrink-0 sm:block">Discipline</span>

          {/* min-w-0 lets the strip shrink and scroll instead of pushing
              the reset button off the row */}
          <div className="scroll-x flex min-w-0 flex-1 gap-2 overflow-x-auto pb-0.5">
            {CATEGORY_LIST.map((cat) => {
              const active = (filters.category ?? '') === cat.value;
              const hue = cat.rgb;

              return (
                <button
                  key={cat.value || 'ALL'}
                  type="button"
                  onClick={() => apply('category', cat.value)}
                  aria-pressed={active}
                  className="chip"
                  style={{ '--chip-hue': hue }}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full transition-opacity"
                    style={{
                      background: `rgb(${hue})`,
                      opacity: active ? 1 : 0.55,
                      boxShadow: active ? `0 0 8px rgb(${hue})` : 'none',
                    }}
                  />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Reset — only when something is active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="btn btn-quiet shrink-0 !px-2.5 !py-1.5"
              aria-label="Reset all filters"
            >
              <IconClose className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
