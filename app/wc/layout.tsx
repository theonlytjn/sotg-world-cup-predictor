import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SOTG World Cup 2026 Predictor',
  description:
    'The Students of the Game World Cup 2026 predictor. Pick the scoreline for every group game, earn points for accuracy, and battle your crew to top the table.',
  icons: {
    icon: '/wc-logo-white.png',
    apple: '/wc-logo-white.png',
  },
  openGraph: {
    title: 'SOTG World Cup 2026 Predictor',
    description:
      'Pick the scoreline for every group game, earn points, and battle your crew to top the table.',
    url: 'https://sotg.app/wc',
    siteName: 'SOTG Predictor',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SOTG World Cup 2026 Predictor',
    description:
      'Pick the scoreline for every group game, earn points, and battle your crew to top the table.',
    images: ['/og-image.png'],
  },
};

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
