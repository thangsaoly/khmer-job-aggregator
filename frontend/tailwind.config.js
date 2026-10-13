/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Kantumruy Pro supports Khmer script beautifully
        sans: ['Kantumruy Pro', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316', // Primary orange — evokes Cambodian temple sandstone
          600: '#ea6c0a',
          700: '#c2560a',
          800: '#9a3b12',
          900: '#7c2d12',
        },
      },
    },
  },
  plugins: [],
};
