/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0E14', // page background — near-black slate, not pure black
        surface: '#121620', // card/panel background
        surfaceRaised: '#181D2A', // hover/active surface
        border: '#232A3B',
        borderMuted: '#1A2030',
        text: '#E7EAF2',
        textMuted: '#8B93A8',
        textFaint: '#5A6178',
        accent: '#5B8DFF', // single interactive accent — electric blue
        accentMuted: '#33406B',
        ok: '#35D399',
        warn: '#FFB454',
        error: '#FF5C7A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.4rem' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
