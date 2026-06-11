import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import 'aos/dist/aos.css';
import AosInit from '@/components/AosInit';

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
  description: 'Predict every group game. Score the points. Top the table.',
};

export const viewport: Viewport = {
  themeColor: '#070b08',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AosInit />
        {children}
      </body>
    </html>
  );
}
