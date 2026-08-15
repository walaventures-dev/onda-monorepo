import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DashboardShell } from "./DashboardShell";

export const metadata: Metadata = {
  title: "Onda",
  description: "Panel del negocio",
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
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
