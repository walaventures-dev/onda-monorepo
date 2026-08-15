import { StoreSubcategory } from '@onda/shared-types';

export type ObjectiveKind =
  | 'reactivate'
  | 'slow_hours'
  | 'new_reward'
  | 'reviews';

export const OBJECTIVE_KINDS: ObjectiveKind[] = [
  'reactivate',
  'slow_hours',
  'new_reward',
  'reviews',
];

export type VerticalVoice = {
  customerPlural: string;
  place: string;
  placeTo: string;
  slowWindow: string;
  signatureReward: string;
  signatureProduct: string;
  visitNoun: string;
};

const VOICES: Record<StoreSubcategory, VerticalVoice> = {
  [StoreSubcategory.CAFE]: {
    customerPlural: 'clientes',
    place: 'el café',
    placeTo: 'al café',
    slowWindow: 'martes y miércoles de 2 a 5 pm',
    signatureReward: 'café + postre',
    signatureProduct: 'latte',
    visitNoun: 'visita',
  },
  [StoreSubcategory.RESTAURANT_FULL]: {
    customerPlural: 'comensales',
    place: 'el restaurante',
    placeTo: 'al restaurante',
    slowWindow: 'martes y miércoles al mediodía',
    signatureReward: 'postre de la casa',
    signatureProduct: 'plato del día',
    visitNoun: 'visita',
  },
  [StoreSubcategory.BAR]: {
    customerPlural: 'clientes',
    place: 'el bar',
    placeTo: 'al bar',
    slowWindow: 'martes y miércoles de 4 a 7 pm',
    signatureReward: 'cóctel de la casa',
    signatureProduct: 'happy hour',
    visitNoun: 'visita',
  },
  [StoreSubcategory.BAKERY]: {
    customerPlural: 'clientes',
    place: 'la panadería',
    placeTo: 'a la panadería',
    slowWindow: 'martes y miércoles de 3 a 6 pm',
    signatureReward: 'combo desayuno',
    signatureProduct: 'pan del día',
    visitNoun: 'visita',
  },
  [StoreSubcategory.FAST_FOOD]: {
    customerPlural: 'clientes',
    place: 'el local',
    placeTo: 'al local',
    slowWindow: 'martes y miércoles de 3 a 5 pm',
    signatureReward: 'combo + bebida',
    signatureProduct: 'combo',
    visitNoun: 'visita',
  },
  [StoreSubcategory.FOOD_TRUCK]: {
    customerPlural: 'clientes',
    place: 'el food truck',
    placeTo: 'al food truck',
    slowWindow: 'martes y miércoles al mediodía',
    signatureReward: 'extra de la casa',
    signatureProduct: 'plato estrella',
    visitNoun: 'visita',
  },
  [StoreSubcategory.RETAIL]: {
    customerPlural: 'clientes',
    place: 'la tienda',
    placeTo: 'a la tienda',
    slowWindow: 'martes y miércoles de 2 a 5 pm',
    signatureReward: 'accesorio de regalo',
    signatureProduct: 'producto destacado',
    visitNoun: 'visita',
  },
  [StoreSubcategory.BEAUTY]: {
    customerPlural: 'clientas',
    place: 'el spa',
    placeTo: 'al spa',
    slowWindow: 'martes y miércoles de 2 a 5 pm',
    signatureReward: 'masaje de 30 min',
    signatureProduct: 'facial',
    visitNoun: 'sesión',
  },
  [StoreSubcategory.HEALTH]: {
    customerPlural: 'pacientes',
    place: 'el consultorio',
    placeTo: 'al consultorio',
    slowWindow: 'martes y miércoles en la tarde',
    signatureReward: 'valoración de control',
    signatureProduct: 'sesión de control',
    visitNoun: 'cita',
  },
  [StoreSubcategory.AUTO]: {
    customerPlural: 'clientes',
    place: 'el taller',
    placeTo: 'al taller',
    slowWindow: 'martes y miércoles en la mañana',
    signatureReward: 'lavado de cortesía',
    signatureProduct: 'cambio de aceite',
    visitNoun: 'visita',
  },
  [StoreSubcategory.EDUCATION]: {
    customerPlural: 'estudiantes',
    place: 'el centro',
    placeTo: 'al centro',
    slowWindow: 'martes y miércoles en la tarde',
    signatureReward: 'clase de prueba',
    signatureProduct: 'módulo introductorio',
    visitNoun: 'clase',
  },
  [StoreSubcategory.OTHER_SERVICE]: {
    customerPlural: 'clientes',
    place: 'el negocio',
    placeTo: 'al negocio',
    slowWindow: 'martes y miércoles de 2 a 5 pm',
    signatureReward: 'servicio de cortesía',
    signatureProduct: 'servicio destacado',
    visitNoun: 'visita',
  },
  [StoreSubcategory.HOTEL]: {
    customerPlural: 'huéspedes',
    place: 'el hotel',
    placeTo: 'al hotel',
    slowWindow: 'domingo a miércoles',
    signatureReward: 'late check-out',
    signatureProduct: 'noche de hotel',
    visitNoun: 'estadía',
  },
  [StoreSubcategory.HOSTEL]: {
    customerPlural: 'huéspedes',
    place: 'el hostel',
    placeTo: 'al hostel',
    slowWindow: 'domingo a miércoles',
    signatureReward: 'desayuno incluido',
    signatureProduct: 'cama extra',
    visitNoun: 'estadía',
  },
  [StoreSubcategory.VACATION_RENTAL]: {
    customerPlural: 'huéspedes',
    place: 'el alojamiento',
    placeTo: 'al alojamiento',
    slowWindow: 'entre semana',
    signatureReward: 'noche extra',
    signatureProduct: 'estadía de 2 noches',
    visitNoun: 'reserva',
  },
  [StoreSubcategory.EVENT_VENUE]: {
    customerPlural: 'clientes',
    place: 'el venue',
    placeTo: 'al venue',
    slowWindow: 'martes y miércoles',
    signatureReward: 'hora extra de salón',
    signatureProduct: 'paquete de evento',
    visitNoun: 'evento',
  },
};

export function voiceFor(subcategory: StoreSubcategory): VerticalVoice {
  return VOICES[subcategory] ?? VOICES[StoreSubcategory.OTHER_SERVICE];
}

export function objectiveLabel(
  kind: ObjectiveKind,
  voice: VerticalVoice,
  slowWindow = voice.slowWindow
): string {
  switch (kind) {
    case 'reactivate':
      return `Traer ${voice.customerPlural} que no vuelven ${voice.placeTo} hace más de 21 días`;
    case 'slow_hours':
      return `Llenar ${slowWindow}`;
    case 'new_reward':
      return `Lanzar ${voice.signatureReward} como recompensa`;
    case 'reviews':
      return `Pedir reseñas en Google a ${voice.customerPlural} felices`;
  }
}

export type CampaignPromoType =
  | 'PERCENT_OFF'
  | 'AMOUNT_OFF'
  | 'BUY_GET'
  | 'PRODUCT'
  | 'OTHER';

export type CampaignPromo = {
  type: CampaignPromoType;
  title: string;
  value: string;
  buyQuantity: string;
  getQuantity: string;
  productName: string;
  cartillaId?: string;
  promotionId?: string;
};

export function defaultPromo(
  kind: ObjectiveKind,
  voice: VerticalVoice
): CampaignPromo {
  switch (kind) {
    case 'reactivate':
      return {
        type: 'PERCENT_OFF',
        title: `Vuelve ${voice.placeTo}`,
        value: '20',
        buyQuantity: '2',
        getQuantity: '1',
        productName: voice.signatureProduct,
      };
    case 'slow_hours':
      return {
        type: 'PERCENT_OFF',
        title: `Promo ${voice.slowWindow}`,
        value: '25',
        buyQuantity: '2',
        getQuantity: '1',
        productName: voice.signatureProduct,
      };
    case 'new_reward':
      return {
        type: 'PRODUCT',
        title: voice.signatureReward,
        value: '',
        buyQuantity: '2',
        getQuantity: '1',
        productName: voice.signatureReward,
      };
    case 'reviews':
      return {
        type: 'OTHER',
        title: '1 onda extra por reseña',
        value: '',
        buyQuantity: '2',
        getQuantity: '1',
        productName: '',
      };
  }
}

export function promoForType(
  type: CampaignPromoType,
  kind: ObjectiveKind,
  voice: VerticalVoice
): CampaignPromo {
  const base = defaultPromo(kind, voice);
  if (type === base.type) return { ...base, type };

  switch (type) {
    case 'PERCENT_OFF':
      return {
        ...base,
        type,
        title: `${kind === 'slow_hours' ? '25' : '20'}% en ${voice.signatureProduct}`,
        value: kind === 'slow_hours' ? '25' : '20',
        productName: voice.signatureProduct,
      };
    case 'AMOUNT_OFF':
      return {
        ...base,
        type,
        title: `$20.000 off en ${voice.signatureProduct}`,
        value: '20000',
        productName: voice.signatureProduct,
      };
    case 'BUY_GET':
      return {
        ...base,
        type,
        title: `2x1 en ${voice.signatureProduct}`,
        buyQuantity: '2',
        getQuantity: '1',
        productName: voice.signatureProduct,
        value: '',
      };
    case 'PRODUCT':
      return {
        ...base,
        type,
        title: voice.signatureReward,
        productName: voice.signatureReward,
        value: '',
      };
    case 'OTHER':
      return {
        ...base,
        type,
        title:
          kind === 'reviews'
            ? '1 onda extra por reseña'
            : `Promo en ${voice.place}`,
        productName: '',
        value: '',
      };
  }
}

export function promoHeadline(promo: CampaignPromo): string {
  const product = promo.productName.trim();
  const amount = Number(promo.value) || 0;
  switch (promo.type) {
    case 'PERCENT_OFF':
      return `${promo.value || 0}% de descuento${product ? ` en ${product}` : ''}`;
    case 'AMOUNT_OFF':
      return `$${amount.toLocaleString('es-CO')} de descuento${product ? ` en ${product}` : ''}`;
    case 'BUY_GET':
      return `Lleva ${promo.getQuantity || 1} pagando ${promo.buyQuantity || 1}${
        product ? ` en ${product}` : ''
      }`;
    case 'PRODUCT':
      return amount > 0
        ? `${product || promo.title} a $${amount.toLocaleString('es-CO')}`
        : product || promo.title;
    default:
      return promo.title.trim() || 'Promo';
  }
}

/** WhatsApp queda fuera de campañas por ahora. */
export const CAMPAIGN_CHANNELS = ['Wallet', 'SMS'] as const;
export type CampaignChannelLabel = (typeof CAMPAIGN_CHANNELS)[number];

export type CampaignMessage = {
  channel: CampaignChannelLabel;
  channelLabel: string;
  text: string;
};

export function buildCampaignMessages(opts: {
  promo: CampaignPromo;
  kind: ObjectiveKind;
  voice: VerticalVoice;
  storeName: string;
  firstName?: string;
  slowWindow?: string;
}): CampaignMessage[] {
  const offer = promoHeadline(opts.promo);
  const name = opts.firstName || '{{nombre}}';
  const { storeName, voice, kind } = opts;
  const slowWindow = opts.slowWindow || voice.slowWindow;

  if (kind === 'reviews') {
    return [
      {
        channel: 'Wallet',
        channelLabel: 'Push · Wallet',
        text: `${offer}. Ábrelo en tu pase de ${storeName}.`,
      },
      {
        channel: 'SMS',
        channelLabel: 'SMS',
        text: `Hola ${name}, ¿cómo te fue en ${storeName}? Una reseña nos ayuda — y te damos ${offer.toLowerCase()}.`,
      },
    ];
  }

  if (kind === 'slow_hours') {
    return [
      {
        channel: 'Wallet',
        channelLabel: 'Push · Wallet',
        text: `${offer}. Válido ${slowWindow}.`,
      },
      {
        channel: 'SMS',
        channelLabel: 'SMS',
        text: `Hola ${name}, ${slowWindow} está más rico en ${storeName}. ${offer} si vienes.`,
      },
    ];
  }

  if (kind === 'new_reward') {
    return [
      {
        channel: 'Wallet',
        channelLabel: 'Push · Wallet',
        text: `Nueva recompensa: ${offer}. Ya está en tu pase.`,
      },
      {
        channel: 'SMS',
        channelLabel: 'SMS',
        text: `Hola ${name}, estrenamos recompensa en ${storeName}: ${offer}. Te esperamos en tu próxima ${voice.visitNoun}.`,
      },
    ];
  }

  return [
    {
      channel: 'Wallet',
      channelLabel: 'Push · Wallet',
      text: `${offer}. Ábrelo en tu pase de ${storeName}.`,
    },
    {
      channel: 'SMS',
      channelLabel: 'SMS',
      text: `Hola ${name}, te extrañamos en ${storeName}. ${offer} si vuelves esta semana.`,
    },
  ];
}

export function renderCampaignTemplate(
  text: string,
  vars: { nombre?: string }
): string {
  return text.replaceAll('{{nombre}}', vars.nombre?.trim() || 'tú');
}
