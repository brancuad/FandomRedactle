/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        dark: {
          950: '#0b0d13',
          900: '#11131c',
          850: '#141620',
          800: '#161924',
          700: '#1f2330',
          600: '#2b3144',
          500: '#343b50',
        }
      }
    },
  },
  plugins: [],
}
