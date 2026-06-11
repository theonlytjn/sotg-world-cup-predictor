import type { Metadata, Viewport } from 'next';
import { Rubik, Manrope } from 'next/font/google';
import './globals.css';
import 'aos/dist/aos.css';
import AosInit from '@/components/AosInit';

const display = Rubik({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-display' });
const body = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-body' });

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
