import type { Metadata, Viewport } from 'next';
import { Anton, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Anton({ subsets: ['latin'], weight: '400', variable: '--font-display' });
const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--font-body' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono' });

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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
