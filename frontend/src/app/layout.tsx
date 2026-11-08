import { Commissioner } from 'next/font/google';
import type { Metadata } from 'next';
import messages from '@/locales/en.json';
import './globals.css';

const commissioner = Commissioner({
  variable: '--font-commissioner',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: messages.app.title,
  description: messages.app.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={commissioner.variable}>
      <body>{children}</body>
    </html>
  );
}
