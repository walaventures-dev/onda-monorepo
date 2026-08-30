import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agenda un demo — Onda',
  description:
    'Cuéntanos de tu negocio y te contactamos para mostrarte Onda en una llamada corta.',
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
