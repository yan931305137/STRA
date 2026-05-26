import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '@stra/devtools',
  description: 'STRA - DevTools UI: tree / signal / action inspector',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
