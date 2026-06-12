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
          950: 'rgb(var(--c-pitch-950) / <alpha-value>)',
          900: 'rgb(var(--c-pitch-900) / <alpha-value>)',
          800: 'rgb(var(--c-pitch-800) / <alpha-value>)',
          750: 'rgb(var(--c-pitch-750) / <alpha-value>)',
          700: 'rgb(var(--c-pitch-700) / <alpha-value>)',
          600: 'rgb(var(--c-pitch-600) / <alpha-value>)',
        },
        chalk: 'rgb(var(--c-chalk) / <alpha-value>)',
        lime: {
          DEFAULT: 'rgb(var(--c-lime) / <alpha-value>)',
          dim: 'rgb(var(--c-lime-dim) / <alpha-value>)',
        },
        flame: 'rgb(var(--c-flame) / <alpha-value>)',
        gold: 'rgb(var(--c-gold) / <alpha-value>)',
      },
      boxShadow: {
        card: '0 1px 0 rgba(255,255,255,0.04), 0 12px 40px -12px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
};
export default config;
