/**
 * tailwind.config.js — DISPATCH design tokens
 *
 * Colour values are declared as `rgb(var(--token) / <alpha-value>)` so a single
 * set of CSS custom properties drives the whole UI (and could drive a second
 * theme later without touching component markup).
 *
 * Category hues are NOT here — they live in src/lib/categories.js and are
 * injected per-record as a `--cat` custom property.
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Body copy + Khmer script
        sans: ['Kantumruy Pro', 'system-ui', '-apple-system', 'sans-serif'],
        // Latin display face — headings, wordmark
        display: ['"Space Grotesk"', 'Kantumruy Pro', 'system-ui', 'sans-serif'],
        // Metadata, indices, labels
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },

      colors: {
        // Surfaces — cool graphite, from page canvas up to raised controls
        ink: {
          950: 'rgb(var(--c-ink-950) / <alpha-value>)', // page canvas
          900: 'rgb(var(--c-ink-900) / <alpha-value>)', // panels, cards
          850: 'rgb(var(--c-ink-850) / <alpha-value>)', // raised / hover surface
          800: 'rgb(var(--c-ink-800) / <alpha-value>)', // inputs, wells
          700: 'rgb(var(--c-ink-700) / <alpha-value>)', // strongest hairline
        },
        // Foreground
        fg: {
          DEFAULT: 'rgb(var(--c-fg) / <alpha-value>)',
          dim: 'rgb(var(--c-fg-dim) / <alpha-value>)',
          mute: 'rgb(var(--c-fg-mute) / <alpha-value>)',
        },
        // Primary accent — Cambodian temple sandstone
        ember: {
          300: 'rgb(var(--c-ember-300) / <alpha-value>)',
          400: 'rgb(var(--c-ember-400) / <alpha-value>)',
          500: 'rgb(var(--c-ember-500) / <alpha-value>)',
          600: 'rgb(var(--c-ember-600) / <alpha-value>)',
        },
        // Secondary — salary, success, "live" state
        mint: {
          400: 'rgb(var(--c-mint-400) / <alpha-value>)',
          500: 'rgb(var(--c-mint-500) / <alpha-value>)',
        },
        // Tertiary — links, informational
        ice: {
          400: 'rgb(var(--c-ice-400) / <alpha-value>)',
        },
      },

      boxShadow: {
        record: 'inset 0 1px 0 0 rgb(255 255 255 / 0.035), 0 24px 48px -32px rgb(0 0 0 / 0.95)',
        modal: 'inset 0 1px 0 0 rgb(255 255 255 / 0.05), 0 40px 90px -40px rgb(0 0 0 / 1)',
      },

      keyframes: {
        'live-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: '0.85' },
          '70%':  { transform: 'scale(2.4)', opacity: '0' },
          '100%': { transform: 'scale(2.4)', opacity: '0' },
        },
        'sweep': {
          '0%':   { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(320%)' },
        },
        'rise': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },

      animation: {
        'live-pulse': 'live-pulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        sweep:       'sweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) 1 forwards',
        rise:        'rise 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
