/**
 * categories.js — job category metadata
 *
 * Each category owns a hue. The hue tints the record's status-light spine, its
 * chip dot, and its glow on hover, so a wall of listings can be triaged by
 * colour alone without reading a single title.
 *
 * `rgb` is a space-separated RGB triplet so it can be composed as
 * `rgb(var(--cat) / 0.14)` in CSS.
 */

export const CATEGORY_META = {
  SOFTWARE_DEV: {
    code: 'DEV',
    label: 'Software Dev',
    full: 'Software Development',
    rgb: '91 140 255',
  },
  DATA_AI: {
    code: 'DAT',
    label: 'Data & AI',
    full: 'Data & AI',
    rgb: '0 217 192',
  },
  UX_UI: {
    code: 'UX',
    label: 'UX / UI',
    full: 'UX / UI Design',
    rgb: '255 92 138',
  },
  IT_SUPPORT_NETWORK: {
    code: 'ITS',
    label: 'IT Support',
    full: 'IT Support & Network',
    rgb: '255 197 61',
  },
  QA_TESTING: {
    code: 'QA',
    label: 'QA & Testing',
    full: 'QA & Testing',
    rgb: '163 230 53',
  },
  DIGITAL_MARKETING: {
    code: 'MKT',
    label: 'Marketing',
    full: 'Digital Marketing',
    rgb: '125 211 252',
  },
  OTHER: {
    code: 'OTH',
    label: 'Other',
    full: 'Other',
    rgb: '138 144 153',
  },
};

/**
 * Ordered list for the filter chips. The leading "All" entry uses the ember
 * brand hue — it is the default state of the board.
 */
export const CATEGORY_LIST = [
  { value: '', code: 'ALL', label: 'All', full: 'All disciplines', rgb: '255 106 31' },
  ...Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, ...meta })),
];

/**
 * Look up category metadata, falling back to OTHER for unknown values.
 *
 * @param {string} value
 */
export function getCategory(value) {
  return CATEGORY_META[value] ?? CATEGORY_META.OTHER;
}
