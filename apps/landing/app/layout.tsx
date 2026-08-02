import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Onda — Lealtad digital para tu negocio',
  description:
    'Pases Apple/Google Wallet, ondas y WhatsApp para restaurantes y eventos.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
