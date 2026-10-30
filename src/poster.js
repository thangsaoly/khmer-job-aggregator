/**
 * poster.js — Generates high-res vector hiring card posters for jobs.
 * Used when a video has no thumbnail or when external CDN images expire.
 */

const CATEGORY_THEMES = {
  SOFTWARE_DEV: {
    label: 'SOFTWARE DEV',
    color: '#10b981',
    gradFrom: '#064e3b',
    gradTo: '#022c22',
    accent: '#34d399',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.3)',
  },
  DATA_AI: {
    label: 'DATA & AI',
    color: '#8b5cf6',
    gradFrom: '#4c1d95',
    gradTo: '#1e1b4b',
    accent: '#a78bfa',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.3)',
  },
  UX_UI: {
    label: 'UX / UI DESIGN',
    color: '#f43f5e',
    gradFrom: '#881337',
    gradTo: '#2a0815',
    accent: '#fb7185',
    badgeBg: 'rgba(244, 63, 94, 0.15)',
    border: 'rgba(244, 63, 94, 0.3)',
  },
  IT_SUPPORT_NETWORK: {
    label: 'IT SUPPORT',
    color: '#f59e0b',
    gradFrom: '#78350f',
    gradTo: '#27170a',
    accent: '#fbbf24',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  QA_TESTING: {
    label: 'QA & TESTING',
    color: '#3b82f6',
    gradFrom: '#1e3a8a',
    gradTo: '#0b192c',
    accent: '#60a5fa',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  DIGITAL_MARKETING: {
    label: 'DIGITAL MARKETING',
    color: '#d946ef',
    gradFrom: '#701a75',
    gradTo: '#2e0836',
    accent: '#e879f9',
    badgeBg: 'rgba(217, 70, 239, 0.15)',
    border: 'rgba(217, 70, 239, 0.3)',
  },
  OTHER: {
    label: 'TECH HIRING',
    color: '#64748b',
    gradFrom: '#334155',
    gradTo: '#0f172a',
    accent: '#94a3b8',
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    border: 'rgba(100, 116, 139, 0.3)',
  },
};

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateJobPosterSvg(job) {
  const theme = CATEGORY_THEMES[job.category] || CATEGORY_THEMES.OTHER;
  const rawTitle = (job.title || 'Tech Opportunity').trim();
  const title = escapeXml(rawTitle);
  const company = escapeXml(job.company_name || 'Hiring Company');
  const location = escapeXml(job.location || 'Phnom Penh, Cambodia');
  const initial = (job.company_name ? job.company_name.trim().charAt(0) : 'K').toUpperCase();

  // Split title if long
  const isLong = rawTitle.length > 32;
  const line1 = isLong ? escapeXml(rawTitle.substring(0, 32)) : title;
  const line2 = isLong ? escapeXml(rawTitle.substring(32, 64)) : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%">
  <defs>
    <radialGradient id="glow-${job.id}" cx="85%" cy="15%" r="75%">
      <stop offset="0%" stop-color="${theme.accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${theme.gradTo}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bgGrad-${job.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0c0e12"/>
      <stop offset="55%" stop-color="${theme.gradTo}"/>
      <stop offset="100%" stop-color="#07080a"/>
    </linearGradient>
    <pattern id="grid-${job.id}" width="32" height="32" patternUnits="userSpaceOnUse">
      <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>

  <!-- Background Layer -->
  <rect width="640" height="360" fill="url(#bgGrad-${job.id})"/>
  <rect width="640" height="360" fill="url(#grid-${job.id})"/>
  <rect width="640" height="360" fill="url(#glow-${job.id})"/>

  <!-- Outer Framing -->
  <rect x="10" y="10" width="620" height="340" rx="10" fill="none" stroke="${theme.border}" stroke-width="1.2"/>

  <!-- Category Pill Badge -->
  <g transform="translate(28, 30)">
    <rect width="135" height="24" rx="12" fill="${theme.badgeBg}" stroke="${theme.border}" stroke-width="1"/>
    <circle cx="14" cy="12" r="3.5" fill="${theme.accent}"/>
    <text x="24" y="16" fill="${theme.accent}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" letter-spacing="1">${theme.label}</text>
  </g>

  <!-- Top Right Brand -->
  <g transform="translate(470, 36)">
    <text x="142" y="10" text-anchor="end" fill="rgba(255,255,255,0.3)" font-family="ui-monospace, monospace" font-size="9" letter-spacing="2">KHMER TECH JOBS</text>
  </g>

  <!-- Company Avatar & Name -->
  <g transform="translate(28, 80)">
    <rect width="42" height="42" rx="10" fill="rgba(255,255,255,0.05)" stroke="${theme.border}" stroke-width="1"/>
    <text x="21" y="27" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="17" font-weight="800">${initial}</text>
    <text x="54" y="26" fill="rgba(255,255,255,0.85)" font-family="system-ui, sans-serif" font-size="15" font-weight="600">${company}</text>
  </g>

  <!-- Job Title -->
  <g transform="translate(28, 170)">
    <text x="0" y="0" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" letter-spacing="-0.3">${line1}</text>
    ${line2 ? `<text x="0" y="30" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="700">${line2}</text>` : ''}
  </g>

  <!-- Bottom Bar: Location & Tag -->
  <g transform="translate(28, 314)">
    <text x="0" y="0" fill="rgba(255,255,255,0.5)" font-family="system-ui, sans-serif" font-size="12">📍 ${location}</text>
    <text x="584" y="0" text-anchor="end" fill="${theme.accent}" font-family="ui-monospace, monospace" font-size="11" font-weight="700" letter-spacing="1">TIKTOK DISPATCH ↗</text>
  </g>
</svg>`;
}
