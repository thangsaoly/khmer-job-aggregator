/**
 * filter.js — Gate 2: Zero-cost local heuristic filter
 *
 * Before spending Gemini API tokens, we do a cheap local check to decide
 * whether a post is worth sending to the AI. This filter runs entirely
 * in memory with regex — no network calls, no DB writes.
 *
 * Logic:
 *   - AUTO-PASS if any high-signal hiring hashtag is present
 *   - Otherwise, require BOTH a hiring keyword AND a tech keyword to match
 */

// ─── High-Signal Hashtags (Auto-Pass) ────────────────────────────────────────
// These Khmer and English hashtags are used almost exclusively for real
// hiring announcements. A match here means we skip the regex gates entirely.

const HIGH_SIGNAL_HASHTAGS = new Set([
  // Khmer
  'ជួលបុគ្គលិក',       // hiring staff
  'រើសបុគ្គលិក',       // recruiting staff
  'ដំណឹងជ្រើសរើសបុគ្គលិក', // hiring announcement
  'ប្រកាសជ្រើសរើស',    // recruitment notice
  // English (often used by Cambodian companies)
  'hiringcambodia',
  'jobcambodia',
  'internshipcambodia',
  'careeropportunity',
  'cambodiajobs',
]);

// ─── Hiring Keywords (must have at least one match) ───────────────────────────
// Using RegExp constructor so we can split the long pattern across readable lines.

const HIRING_PATTERNS = [
  'intern(?:ship)?', 'hiring', 'recruit', 'vacancy', 'vacancies', 'position',
  'apply', 'job\\s*opening', 'we\\s*are\\s*(?:hiring|looking)',
  'join\\s*(?:our|us)', 'opportunity', 'career',
  // Khmer hiring terms
  'ប្រកាស', 'ជ្រើសរើស', 'ជួល', 'រើស', 'ហាត់ការ', 'បុគ្គលិក', 'ដំណឹង',
];
const HIRING_REGEX = new RegExp(`(${HIRING_PATTERNS.join('|')})`, 'i');

// ─── Tech Keywords (must have at least one match) ─────────────────────────────

const TECH_PATTERNS = [
  'developer', 'dev', 'engineer', 'programmer', 'coder', 'software',
  'frontend', 'back[\\s-]?end', 'fullstack', 'full[\\s-]?stack',
  'react', 'vue', 'angular', 'node(?:\\.?js)?', 'next(?:\\.?js)?',
  'flutter', 'kotlin', 'swift', 'android', 'ios', 'mobile',
  'web', 'html', 'css', 'javascript', 'typescript',
  'python', 'java', 'php', 'golang', 'ruby', 'rust', 'c\\+\\+',
  'sql', 'mysql', 'postgresql', 'mongodb', 'firebase',
  'aws', 'cloud', 'devops', 'docker', 'kubernetes', 'linux',
  'network', 'infrastructure', 'sysadmin', 'system\\s*admin', 'it\\s*support', 'helpdesk',
  'data\\s*(?:analyst|engineer|scientist)',
  'machine\\s*learning', '\\bml\\b', 'deep\\s*learning', 'nlp', 'computer\\s*vision',
  '\\bux\\b', '\\bui\\b', 'product\\s*design(?:er)?', 'graphic', 'figma',
  '\\bqa\\b', 'quality\\s*assurance', 'tester',
  'digital\\s*marketing', '\\bseo\\b', '\\bsem\\b', 'social\\s*media', 'content\\s*(?:creator|writer)',
  'cybersecurity', 'security\\s*(?:analyst|engineer)',
  // Khmer tech terms
  'កូដ', 'ព័ត៌មានវិទ្យា', 'បច្ចេកវិទ្យា', 'អ្នកអភិវឌ្ឍ', 'វិស្វករ',
];
const TECH_REGEX = new RegExp(`(${TECH_PATTERNS.join('|')})`, 'i');

// ─── Excluded Non-Tech Roles (Fast Reject) ────────────────────────────────────
// If a post clearly targets a common non-tech occupation and has no tech signal,
// reject early to avoid spending 4.5s delays + Gemini API calls on it.
const EXCLUDED_ROLES_PATTERNS = [
  'cleaner', 'cleaning', 'maid', 'housekeeping',
  'driver', 'delivery\\s*rider', 'security\\s*guard',
  'waiter', 'waitress', 'bartender', 'barista', 'cook', 'chef', 'dishwasher',
  'salon', 'spa', 'massage', 'hairdresser', 'barber',
  'cashier', 'receptionist', 'translator',
  // Khmer non-tech roles
  'អ្នកបោសសំអាត', 'អ្នកបើកបរ', 'សន្តិសុខ', 'អ្នកគិតលុយ', 'អ្នករត់តុ', 'អ្នកបកប្រែ', 'មេការសំណង់',
];
const EXCLUDED_REGEX = new RegExp(`(${EXCLUDED_ROLES_PATTERNS.join('|')})`, 'i');

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Determine whether a scraped post should be sent to the AI for classification.
 *
 * @param {string}   caption   — raw post caption text
 * @param {string[]} hashtags  — array of hashtag strings (without the # symbol)
 * @returns {{ pass: boolean, reason: string }}
 */
export function shouldSendToAi(caption = '', hashtags = []) {
  const normalizedHashtags = hashtags.map((h) => h.toLowerCase().replace(/^#/, ''));
  const searchText = `${caption} ${hashtags.join(' ')}`;
  const hasTechSignal = TECH_REGEX.test(searchText);

  // Early exit: explicitly mentions a non-tech job and lacks tech keywords
  if (EXCLUDED_REGEX.test(caption) && !hasTechSignal) {
    return { pass: false, reason: 'excluded_non_tech_role' };
  }

  // Gate 2A — High-signal hashtag auto-pass
  const hasHighSignalHashtag = normalizedHashtags.some((tag) =>
    HIGH_SIGNAL_HASHTAGS.has(tag)
  );

  if (hasHighSignalHashtag) {
    return { pass: true, reason: 'high_signal_hashtag' };
  }

  // Gate 2B — Must match BOTH hiring and tech patterns
  const hasHiringSignal = HIRING_REGEX.test(searchText);

  if (hasHiringSignal && hasTechSignal) {
    return { pass: true, reason: 'keyword_match' };
  }

  // Build informative rejection reason for debugging
  const missingSignals = [];
  if (!hasHiringSignal) missingSignals.push('hiring');
  if (!hasTechSignal)   missingSignals.push('tech');

  return {
    pass: false,
    reason: `missing_keywords:${missingSignals.join('+')}`,
  };
}
