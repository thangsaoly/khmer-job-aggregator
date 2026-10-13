import { useState } from 'react';

// Maps DB enum values to human-readable labels
const CATEGORIES = [
  { value: '',                   label: 'All Categories' },
  { value: 'SOFTWARE_DEV',       label: '💻 Software Development' },
  { value: 'DATA_AI',            label: '🧠 Data & AI' },
  { value: 'UX_UI',              label: '🎨 UX / UI Design' },
  { value: 'IT_SUPPORT_NETWORK', label: '🔧 IT Support & Network' },
  { value: 'QA_TESTING',         label: '🧪 QA & Testing' },
  { value: 'DIGITAL_MARKETING',  label: '📣 Digital Marketing' },
  { value: 'OTHER',              label: '📁 Other' },
];

/**
 * FilterBar — controls for category, internship toggle, location, and keyword
 * search. Calls onFilterChange with the updated filter object on every change.
 *
 * @param {object}   filters          — current filter state from parent
 * @param {function} onFilterChange   — (newFilters) => void
 */
export default function FilterBar({ filters, onFilterChange }) {
  // Local state for the search input so we can debounce before propagating
  const [searchInput, setSearchInput] = useState(filters.q ?? '');

  function handleChange(key, value) {
    onFilterChange({ ...filters, [key]: value, offset: 0 });
  }

  // Debounce search: wait 400ms after the user stops typing
  function handleSearchChange(e) {
    const value = e.target.value;
    setSearchInput(value);

    clearTimeout(window._searchDebounce);
    window._searchDebounce = setTimeout(() => {
      handleChange('q', value);
    }, 400);
  }

  function clearFilters() {
    setSearchInput('');
    onFilterChange({ category: '', isInternship: undefined, location: '', q: '', offset: 0 });
  }

  const hasActiveFilters = filters.category || filters.isInternship !== undefined || filters.location || filters.q;

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">

        {/* Keyword search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Search
          </label>
          <input
            type="text"
            placeholder="React, Flutter, UX Design..."
            value={searchInput}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>

        {/* Category */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Category
          </label>
          <select
            value={filters.category ?? ''}
            onChange={(e) => handleChange('category', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                       bg-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div className="min-w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Location
          </label>
          <input
            type="text"
            placeholder="Phnom Penh"
            value={filters.location ?? ''}
            onChange={(e) => handleChange('location', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>

        {/* Internship toggle */}
        <div className="flex flex-col gap-1">
          <label className="block text-xs font-medium text-gray-500">
            Type
          </label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white h-[38px]">
            <input
              type="checkbox"
              id="internship-toggle"
              checked={filters.isInternship === true}
              onChange={(e) =>
                handleChange('isInternship', e.target.checked ? true : undefined)
              }
              className="w-4 h-4 accent-brand-500 cursor-pointer"
            />
            <label
              htmlFor="internship-toggle"
              className="text-sm text-gray-700 cursor-pointer whitespace-nowrap select-none"
            >
              Internships only
            </label>
          </div>
        </div>

        {/* Clear filters — only show when something is active */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="btn-ghost text-gray-500 self-end"
            aria-label="Clear all filters"
          >
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  );
}
