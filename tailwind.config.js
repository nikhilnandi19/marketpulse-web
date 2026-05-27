/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      colors: {
        base: '#0A0C10',
        card: '#0E1424',
        glass: 'rgba(14,20,36,0.75)',
        border: 'rgba(148,163,184,0.12)',
        accent: {
          cyan: '#38BDF8',
          blue: '#60A5FA',
          violet: '#A78BFA',
          teal: '#2DD4BF',
          amber: '#F59E0B',
          red: '#F87171',
          green: '#34D399',
          ai: '#8E75FF',
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(30,42,58,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(30,42,58,0.35) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
}
