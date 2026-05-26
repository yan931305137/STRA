import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'STRA Demo - Semantic Tree Runtime + AI',
  description: 'AI-Native Frontend Runtime: The tree is the source of truth, not the DOM.',
  icons: {
    icon: '/stra-icon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-background text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
