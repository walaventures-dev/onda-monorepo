import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Onda — Tu cliente. Vuelve por el premio.",
  description:
    "Cada visita suma hacia un premio que tú defines. Recompensas, campañas y reseñas en Wallet — sin app que descargar.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
