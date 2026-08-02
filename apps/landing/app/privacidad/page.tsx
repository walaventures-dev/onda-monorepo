import {
  LegalLayout,
  PrivacyPolicyContent,
} from '@onda/shared-ui';

export const metadata = {
  title: 'Política de Privacidad — Onda',
  description: 'Cómo Onda trata tus datos personales en el programa de lealtad.',
};

export default function PrivacidadPage() {
  return (
    <LegalLayout title="Política de Privacidad" updated="2 de agosto de 2026" backHref="/">
      <PrivacyPolicyContent />
    </LegalLayout>
  );
}
