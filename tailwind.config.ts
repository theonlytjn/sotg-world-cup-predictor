import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        pitch: {
          950: '#070b08',
          900: '#0b110d',
          800: '#121a14',
          750: '#161f17',
          700: '#1b261e',
          600: '#27362b',
        },
        chalk: '#f4f6f2',
        lime: {
          DEFAULT: '#c6ff3d',
          dim: '#9fcc2f',
        },
        flame: '#ff5c38',
        gold: '#ffd24a',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04), 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
