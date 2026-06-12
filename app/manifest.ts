import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SOTG World Cup 2026 Predictor',
    short_name: "SOTG '26",
    description:
      'Pick the scoreline for every World Cup group game, earn points, and top the table.',
    start_url: '/predict',
    display: 'standalone',
    background_color: '#070b08',
    theme_color: '#070b08',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/wc-logo-white.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
