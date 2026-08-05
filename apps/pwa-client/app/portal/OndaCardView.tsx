import { PassPreview } from '@onda/shared-ui';
import type { OndaCardDto } from '@onda/shared-types';

export function OndaCardView({ card }: { card: OndaCardDto }) {
  return (
    <PassPreview
      backgroundColor="#6E5AE6"
      foregroundColor="#FFFFFF"
      labelColor="#E5F6FC"
      title="Tarjeta Onda"
      subtitle="Tu identidad en todos los restaurantes"
      description="Acumula ondas en cualquier restaurante Onda"
      points={card.totalPoints}
      memberName={card.memberName}
    />
  );
}
