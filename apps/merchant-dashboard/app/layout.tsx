import type { Metadata } from "next";
import "./globals.css";
import { DashboardShell } from "./DashboardShell";

export const metadata: Metadata = {
  title: "Onda Merchant",
  description: "Panel del negocio",
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
