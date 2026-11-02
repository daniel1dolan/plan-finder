import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { COPY } from '@/copy';
import './globals.css';

const sans = localFont({
  src: './fonts/AtkinsonHyperlegibleNext-latin.woff2',
  weight: '400 700',
  variable: '--font-atkinson',
  display: 'swap',
  adjustFontFallback: 'Arial',
});
const serif = localFont({
  src: './fonts/Newsreader-latin.woff2',
  weight: '400 600',
  variable: '--font-newsreader',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
});

export const metadata: Metadata = { title: COPY.title, description: COPY.intro };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body className="font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
