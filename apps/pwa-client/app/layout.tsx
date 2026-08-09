import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onda',
  description: 'Tu pase de lealtad en un toque',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Onda',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F2F2F2',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="onda-pwa min-h-dvh antialiased">{children}</body>
    </html>
  );
}
