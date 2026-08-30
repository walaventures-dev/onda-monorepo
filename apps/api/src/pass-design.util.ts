export type PassDesignLike = {
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  backgroundColor?: string | null;
  foregroundColor?: string | null;
  labelColor?: string | null;
  logoUrl?: string | null;
  stripImageUrl?: string | null;
};

const DEFAULTS: PassDesignLike = {
  title: 'Onda',
  subtitle: 'Programa de lealtad',
  description: '',
  backgroundColor: '#6E5AE6',
  foregroundColor: '#FFFFFF',
  labelColor: '#3DB9E8',
  logoUrl: null,
  stripImageUrl: null,
};

/** Paleta de marca del negocio (Config → Marca). */
export function paletteFromStoreBrand(
  brand?: PassDesignLike | null
): {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
} {
  return {
    backgroundColor: brand?.backgroundColor || DEFAULTS.backgroundColor!,
    foregroundColor: brand?.foregroundColor || DEFAULTS.foregroundColor!,
    labelColor: brand?.labelColor || DEFAULTS.labelColor!,
  };
}

function pickLogo(
  primary: PassDesignLike | null | undefined,
  fallback: PassDesignLike | null | undefined
) {
  const own = primary?.logoUrl?.trim();
  if (own) return own;
  const inherited = fallback?.logoUrl?.trim();
  return inherited || null;
}

/** Cartilla/event design with store logo as fallback when the cartilla has no override. */
export function resolvePassDesign(
  primary: PassDesignLike | null | undefined,
  storeFallback?: PassDesignLike | null | undefined
): PassDesignLike {
  return {
    ...DEFAULTS,
    ...storeFallback,
    ...primary,
    logoUrl: pickLogo(primary, storeFallback),
  };
}

export function passDesignFromStoreName(name: string): PassDesignLike {
  return {
    ...DEFAULTS,
    title: name,
    subtitle: 'Programa de lealtad Onda',
    description: 'Acumula ondas y gana recompensas',
  };
}

export function toPassDesignInput(design: PassDesignLike) {
  return {
    title: design.title ?? DEFAULTS.title!,
    subtitle: design.subtitle ?? DEFAULTS.subtitle ?? undefined,
    description: design.description ?? DEFAULTS.description ?? undefined,
    backgroundColor: design.backgroundColor ?? DEFAULTS.backgroundColor!,
    foregroundColor:
      design.foregroundColor ?? DEFAULTS.foregroundColor ?? undefined,
    labelColor: design.labelColor ?? DEFAULTS.labelColor ?? undefined,
    logoUrl: design.logoUrl ?? null,
    stripImageUrl: design.stripImageUrl ?? null,
  };
}
