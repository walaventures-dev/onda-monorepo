import {
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORIES_BY_CATEGORY,
  STORE_SUBCATEGORY_LABELS,
  STORE_SEGMENT_LABELS,
  STORE_SEGMENTS_BY_SUBCATEGORY,
  defaultSegmentFor,
} from '@onda/shared-types';
import {
  CAMPAIGN_CHANNELS,
  type CampaignPromo,
  type ObjectiveKind,
} from '@onda/shared-utils';

export {
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
  STORE_SEGMENT_LABELS,
  defaultSegmentFor,
};

export {
  OBJECTIVE_KINDS,
  OBJECTIVE_TITLES,
  OBJECTIVE_DETAIL_FIELDS,
  voiceFor,
  objectiveLabel,
  objectiveHint,
  objectiveDetailFields,
  recommendedObjectiveDetails,
  objectiveAudienceQueryParams,
  buildObjectiveMessages,
  campaignReachQuote,
  formatCop,
  defaultPromo,
  promoForType,
  promoHeadline,
  buildCampaignMessages,
  CAMPAIGN_CHANNELS,
  type ObjectiveKind,
  type ObjectiveDetails,
  type ObjectiveDetailFieldDef,
  type VerticalVoice,
  type CampaignPromo,
  type CampaignPromoType,
  type CampaignMessage,
} from '@onda/shared-utils';

export const DEMO_STORE = {
  name: 'Onda Spa',
  category: StoreCategory.SERVICE,
  subcategory: StoreSubcategory.BEAUTY,
  segment: StoreSegment.BEAUTY_SPA,
} as const;

export function subcategoryOptions(category: StoreCategory) {
  return STORE_SUBCATEGORIES_BY_CATEGORY[category].map((id) => ({
    id,
    label: STORE_SUBCATEGORY_LABELS[id],
  }));
}

export function segmentOptions(subcategory: StoreSubcategory) {
  return STORE_SEGMENTS_BY_SUBCATEGORY[subcategory].map((id) => ({
    id,
    label: STORE_SEGMENT_LABELS[id],
  }));
}

export function demoStoreName(
  subcategory: StoreSubcategory,
  fallback = DEMO_STORE.name
) {
  if (subcategory === StoreSubcategory.BEAUTY) return fallback;
  return `Onda ${STORE_SUBCATEGORY_LABELS[subcategory]}`;
}

export type AudiencePerson = {
  name: string;
  initials: string;
  meta: string;
};

export type AudienceDemo = {
  headline: string;
  chips: string[];
  kpis: { label: string; value: string }[];
  people: AudiencePerson[];
  visitFrequency: { bucket: string; count: number }[];
};

const PEOPLE_POOL: AudiencePerson[] = [
  { name: 'Camila Rojas', initials: 'CR', meta: 'hace 34 días' },
  { name: 'Andrés Mejía', initials: 'AM', meta: 'hace 41 días' },
  { name: 'Valentina Díaz', initials: 'VD', meta: 'hace 28 días' },
  { name: 'Santiago Pérez', initials: 'SP', meta: 'hace 52 días' },
  { name: 'Laura Gómez', initials: 'LG', meta: 'hace 37 días' },
  { name: 'Juan Esteban', initials: 'JE', meta: 'hace 45 días' },
];

export const AUDIENCE_BY_OBJECTIVE: Record<ObjectiveKind, AudienceDemo> = {
  reactivate: {
    headline: 'Encontramos 104 clientes que no regresan hace más de 30 días.',
    chips: ['Inactivos 30d', 'Wallet activo', 'Visitaron 2+ veces'],
    kpis: [
      { label: 'Alcanzables', value: '104' },
      { label: 'Días sin visita', value: '38' },
      { label: 'Con Wallet', value: '81%' },
    ],
    people: PEOPLE_POOL,
    visitFrequency: [
      { bucket: '1–2', count: 48 },
      { bucket: '3–5', count: 37 },
      { bucket: '6+', count: 19 },
    ],
  },
  slow_hours: {
    headline: 'Encontramos 104 clientes que suelen venir fuera de martes y miércoles 2–5 pm.',
    chips: ['Visitan tarde', 'Ticket medio alto', 'Cerca del local'],
    kpis: [
      { label: 'Alcanzables', value: '104' },
      { label: 'Visitas en flojos', value: '12%' },
      { label: 'Con Wallet', value: '74%' },
    ],
    people: [
      { name: 'Natalia Cruz', initials: 'NC', meta: 'suele venir sábados' },
      { name: 'Diego Vargas', initials: 'DV', meta: 'ticket alto' },
      { name: 'María Fernanda', initials: 'MF', meta: '3 visitas/mes' },
      { name: 'Carlos Ruiz', initials: 'CR', meta: 'cerca del local' },
      { name: 'Isabella Toró', initials: 'IT', meta: 'Wallet activo' },
      { name: 'Felipe Soto', initials: 'FS', meta: 'última: viernes' },
    ],
    visitFrequency: [
      { bucket: '1–2', count: 31 },
      { bucket: '3–5', count: 44 },
      { bucket: '6+', count: 29 },
    ],
  },
  new_reward: {
    headline: 'Encontramos 104 clientes listos para probar tu nueva recompensa.',
    chips: ['Activos 14d', 'Cerca del canje', 'Muy activos'],
    kpis: [
      { label: 'Alcanzables', value: '104' },
      { label: 'Cerca del premio', value: '62%' },
      { label: 'Con Wallet', value: '88%' },
    ],
    people: [
      { name: 'Sofía Herrera', initials: 'SH', meta: '4 de 5 ondas' },
      { name: 'Mateo López', initials: 'ML', meta: 'activo esta semana' },
      { name: 'Daniela Ruiz', initials: 'DR', meta: '3 canjes previos' },
      { name: 'Julián Castro', initials: 'JC', meta: 'Wallet activo' },
      { name: 'Paula Mendoza', initials: 'PM', meta: 'visita frecuente' },
      { name: 'Sebastián Nieto', initials: 'SN', meta: 'hace 2 días' },
    ],
    visitFrequency: [
      { bucket: '1–2', count: 18 },
      { bucket: '3–5', count: 41 },
      { bucket: '6+', count: 45 },
    ],
  },
  reviews: {
    headline: 'Encontramos 104 clientes felices que aún no dejaron reseña.',
    chips: ['Canjearon premio', 'Sin reseña', 'Visita reciente'],
    kpis: [
      { label: 'Alcanzables', value: '104' },
      { label: 'Días desde canje', value: '6' },
      { label: 'Con Wallet', value: '88%' },
    ],
    people: [
      { name: 'Andrea Pineda', initials: 'AP', meta: 'canjeó hace 4 días' },
      { name: 'Ricardo Mora', initials: 'RM', meta: 'sin reseña' },
      { name: 'Catalina Vélez', initials: 'CV', meta: 'canjeó hace 1 sem' },
      { name: 'Óscar Jiménez', initials: 'OJ', meta: 'cliente feliz' },
      { name: 'Lucía Ramírez', initials: 'LR', meta: 'cliente frecuente' },
      { name: 'Tomás Aguilar', initials: 'TA', meta: 'Wallet activo' },
    ],
    visitFrequency: [
      { bucket: '1–2', count: 22 },
      { bucket: '3–5', count: 39 },
      { bucket: '6+', count: 43 },
    ],
  },
};

export type DemoPromoType = CampaignPromo['type'];
export type DemoPromo = CampaignPromo;

/** WhatsApp queda fuera del demo de campaña por ahora. */
export const CHANNELS = CAMPAIGN_CHANNELS;
export type Channel = 'Wallet' | 'WhatsApp' | 'SMS';
