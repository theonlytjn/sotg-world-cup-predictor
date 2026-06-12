import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import 'aos/dist/aos.css';
import AosInit from '@/components/AosInit';
import PageLoader from '@/components/PageLoader';
import ScrollToTop from '@/components/ScrollToTop';

const display = localFont({
  src: '../public/fonts/Boldonse.woff2',
  variable: '--font-display',
  display: 'swap',
});
const body = localFont({
  src: '../public/fonts/Satoshi-Variable.woff2',
  variable: '--font-body',
  display: 'swap',
});

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
    url: 'https://sotg.app',
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

export const viewport: Viewport = {
  themeColor: '#070b08',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <head>
        {/* Prevent flash of wrong theme — reads localStorage before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('sotg-theme')==='light')document.documentElement.classList.add('light')}catch(e){}` }} />
      </head>
      <body>
        <PageLoader />
        <AosInit />
        {children}
        <ScrollToTop />
      </body>
    </html>
  );
}
