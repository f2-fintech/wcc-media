import type { Metadata } from 'next';
import './globals.css';
import TopProgressBar from '@/components/TopProgressBar';

export const metadata: Metadata = {
  title: {
    default: '1F2 | Curated Events & Gallery Portal',
    template: '%s | 1F2',
  },
  description: 'Official digital showcase of corporate milestones, celebrations, and events across 1F2.',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/logo_blue_croped.png', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <TopProgressBar />
        {children}
      </body>
    </html>
  );
}
