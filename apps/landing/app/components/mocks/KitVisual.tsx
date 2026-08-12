import { ONDA_BRAND } from '@onda/shared-ui';

export function KitVisual({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ONDA_BRAND.kitBienvenida}
        alt="Kit de bienvenida Onda: hablador NFC, QR, stickers y materiales de marca"
        className="mx-auto h-auto w-full max-w-3xl select-none object-contain"
        draggable={false}
      />
    </div>
  );
}
