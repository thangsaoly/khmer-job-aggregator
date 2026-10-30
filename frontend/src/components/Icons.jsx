/**
 * Icons.jsx — inline SVG icon set
 *
 * The project has no icon library, and pulling one in for a few glyphs would
 * be a dependency that doesn't pay for itself. These are hand-drawn 24×24
 * stroke icons that inherit `currentColor`.
 */

const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

export function IconSearch({ className = 'h-4 w-4' }) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </svg>
  );
}

export function IconPin({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

export function IconCash({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

export function IconArrowUpRight({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </svg>
  );
}

export function IconClose({ className = 'h-4 w-4' }) {
  return (
    <svg {...base} className={className}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconRefresh({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M20 11a8 8 0 0 0-13.7-5.3L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" />
      <path d="M20 20v-4h-4" />
    </svg>
  );
}

export function IconFilm({ className = 'h-3.5 w-3.5' }) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M10.2 9.4 15 12l-4.8 2.6z" />
    </svg>
  );
}

export function IconChevronDown({ className = 'h-4 w-4' }) {
  return (
    <svg {...base} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconAlert({ className = 'h-4 w-4' }) {
  return (
    <svg {...base} className={className}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  );
}

/**
 * DispatchMark — the brand mark: three index bars of decreasing length.
 * Also used as the favicon.
 */
export function DispatchMark({ className = 'h-8 w-8' }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" fill="rgb(var(--c-ink-900))" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8.5"
        fill="none"
        stroke="rgb(var(--c-ember-500) / 0.35)"
      />
      <rect x="7" y="9" width="18" height="3" rx="1.5" fill="rgb(var(--c-ember-500))" />
      <rect x="7" y="15" width="12" height="3" rx="1.5" fill="rgb(var(--c-ember-500) / 0.68)" />
      <rect x="7" y="21" width="7" height="3" rx="1.5" fill="rgb(var(--c-ember-500) / 0.4)" />
    </svg>
  );
}
