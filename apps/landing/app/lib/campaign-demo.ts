export const OBJECTIVES = [
  'Traer clientes que dejaron de venir',
  'Vender más en horarios flojos',
  'Lanzar una recompensa nueva',
  'Pedir reseñas en Google',
] as const;

export type Objective = (typeof OBJECTIVES)[number];

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
  defaultMessage: string;
};

const PEOPLE_POOL: AudiencePerson[] = [
  { name: 'Camila Rojas', initials: 'CR', meta: 'hace 34 días' },
  { name: 'Andrés Mejía', initials: 'AM', meta: 'hace 41 días' },
  { name: 'Valentina Díaz', initials: 'VD', meta: 'hace 28 días' },
  { name: 'Santiago Pérez', initials: 'SP', meta: 'hace 52 días' },
  { name: 'Laura Gómez', initials: 'LG', meta: 'hace 37 días' },
  { name: 'Juan Esteban', initials: 'JE', meta: 'hace 45 días' },
];

export const AUDIENCE_BY_OBJECTIVE: Record<Objective, AudienceDemo> = {
  'Traer clientes que dejaron de venir': {
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
    defaultMessage: 'Café gratis si vuelves esta semana',
  },
  'Vender más en horarios flojos': {
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
    defaultMessage: '20% de dto. martes y miércoles de 2 a 5',
  },
  'Lanzar una recompensa nueva': {
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
    defaultMessage: 'Nueva recompensa: postre gratis en tu 5ª visita',
  },
  'Pedir reseñas en Google': {
    headline: 'Encontramos 104 clientes felices que aún no dejaron reseña.',
    chips: ['Canjearon premio', 'Sin reseña', 'Visita reciente'],
    kpis: [
      { label: 'Alcanzables', value: '104' },
      { label: 'Días desde canje', value: '6' },
      { label: 'Con WhatsApp', value: '93%' },
    ],
    people: [
      { name: 'Andrea Pineda', initials: 'AP', meta: 'canjeó hace 4 días' },
      { name: 'Ricardo Mora', initials: 'RM', meta: 'sin reseña' },
      { name: 'Catalina Vélez', initials: 'CV', meta: 'canjeó hace 1 sem' },
      { name: 'Óscar Jiménez', initials: 'OJ', meta: 'cliente feliz' },
      { name: 'Lucía Ramírez', initials: 'LR', meta: 'cliente frecuente' },
      { name: 'Tomás Aguilar', initials: 'TA', meta: 'Wallet + WA' },
    ],
    visitFrequency: [
      { bucket: '1–2', count: 22 },
      { bucket: '3–5', count: 39 },
      { bucket: '6+', count: 43 },
    ],
    defaultMessage: '¿Nos dejas una reseña en Google? Te damos 1 onda extra',
  },
};

export const CHANNELS = ['Wallet', 'WhatsApp', 'SMS'] as const;
export type Channel = (typeof CHANNELS)[number];
