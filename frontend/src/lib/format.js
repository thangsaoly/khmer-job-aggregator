/**
 * format.js — date + text formatting for the dispatch UI
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Compact relative age for record metadata — "NOW", "4H AGO", "3D AGO".
 *
 * @param {string|number|null} value — ISO string or epoch millis
 * @returns {string|null}
 */
export function formatAge(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'NOW';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}M AGO`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}H AGO`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}D AGO`;
  if (diff < 30 * DAY) return `${Math.floor(diff / (7 * DAY))}W AGO`;

  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  }).toUpperCase();
}

/**
 * Full date for the detail panel — "14 Sep 2026, 13:00".
 *
 * @param {string|number|null} value
 * @returns {string|null}
 */
export function formatDateTime(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Zero-padded record index — 7 becomes "007".
 *
 * @param {number} id
 */
export function formatIndex(id) {
  return String(id ?? 0).padStart(3, '0');
}
