import { LegalLayout, TermsContent } from '@onda/shared-ui';

export const metadata = {
  title: 'Términos y Condiciones — Onda',
  description: 'Condiciones de uso del programa de lealtad Onda.',
};

export default function TerminosPage() {
  return (
    <LegalLayout title="Términos y Condiciones" updated="2 de agosto de 2026" backHref="/">
      <TermsContent />
    </LegalLayout>
  );
}
