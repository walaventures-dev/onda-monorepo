import { ONDA_BRAND } from '@onda/shared-ui';

export function KitVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`relative ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ONDA_BRAND.kitBienvenida}
        alt="Kit de bienvenida Onda: hablador NFC, QR, stickers y materiales de marca"
        className="block h-auto w-full select-none object-contain"
        draggable={false}
      />
    </div>
  );
}
