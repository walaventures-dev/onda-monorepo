import {
  StoreSegment,
  StoreSubcategory,
  STORE_SEGMENT_LABELS,
} from '@onda/shared-types';

export type ObjectiveKind =
  | 'reactivate'
  | 'slow_hours'
  | 'new_reward'
  | 'reviews';

export const OBJECTIVE_KINDS: ObjectiveKind[] = [
  'reactivate',
  'slow_hours',
];

/** Título corto del chip / tarjeta (no cambia con el vertical). */
export const OBJECTIVE_TITLES: Record<ObjectiveKind, string> = {
  reactivate: 'Traer de vuelta',
  slow_hours: 'Horas flojas',
  new_reward: 'Nueva recompensa',
  reviews: 'Pedir reseñas',
};

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
  [StoreSubcategory.BEVERAGE]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'muestra gratis',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.ALCOHOL]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'jueves y viernes',
    signatureReward: 'copas de cortesía',
    signatureProduct: 'bebida estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.SNACKS]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'snack de regalo',
    signatureProduct: 'snack estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.PACKAGED_FOOD]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'producto de regalo',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.COFFEE_TEA]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'mañanas entre semana',
    signatureReward: 'muestra de café',
    signatureProduct: 'blend estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.DAIRY]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'producto de regalo',
    signatureProduct: 'lácteo estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.PERSONAL_CARE]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'kit de muestra',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.COSMETICS]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'mini de regalo',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.FASHION]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'accesorio de regalo',
    signatureProduct: 'prenda estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.SPORTS]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'accesorio de regalo',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.TECH]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'accesorio de regalo',
    signatureProduct: 'gadget estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.HOME_CARE]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'producto de regalo',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.PETS]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'snack para mascota',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
  [StoreSubcategory.OTHER_BRAND]: {
    customerPlural: 'clientes',
    place: 'la marca',
    placeTo: 'a la marca',
    slowWindow: 'fines de semana',
    signatureReward: 'producto de regalo',
    signatureProduct: 'producto estrella',
    visitNoun: 'compra',
  },
};

/** Ajustes por subcategoría (segmento) sobre la voz de la categoría. */
const SEGMENT_VOICE: Partial<
  Record<StoreSegment, Partial<VerticalVoice>>
> = {
  [StoreSegment.CAFE_COFFEE]: {
    place: 'la cafetería',
    placeTo: 'a la cafetería',
    signatureReward: 'café + croissant',
    signatureProduct: 'americano',
  },
  [StoreSegment.CAFE_SPECIALTY]: {
    place: 'el coffee shop',
    placeTo: 'al coffee shop',
    signatureReward: 'cold brew + postre',
    signatureProduct: 'flat white',
  },
  [StoreSegment.CAFE_ROASTERY]: {
    place: 'la tostaduría',
    placeTo: 'a la tostaduría',
    signatureReward: 'bolsa de origen',
    signatureProduct: 'café de origen',
  },
  [StoreSegment.REST_CASUAL]: {
    place: 'el restaurante',
    placeTo: 'al restaurante',
    signatureReward: 'postre de la casa',
    signatureProduct: 'plato del día',
  },
  [StoreSegment.REST_FINE]: {
    place: 'el restaurante',
    placeTo: 'al restaurante',
    signatureReward: 'copa de cortesía',
    signatureProduct: 'menú degustación',
    slowWindow: 'martes y miércoles al mediodía',
  },
  [StoreSegment.REST_TRADITIONAL]: {
    place: 'el restaurante',
    placeTo: 'al restaurante',
    signatureReward: 'jugo de cortesía',
    signatureProduct: 'bandeja típica',
  },
  [StoreSegment.REST_SEAFOOD]: {
    place: 'la marisquería',
    placeTo: 'a la marisquería',
    signatureReward: 'ceviches de la casa',
    signatureProduct: 'cazuela de mariscos',
  },
  [StoreSegment.BAR_PUB]: {
    place: 'el bar',
    placeTo: 'al bar',
    signatureReward: 'cerveza de cortesía',
    signatureProduct: 'happy hour',
  },
  [StoreSegment.BAR_BREWERY]: {
    place: 'la cervecería',
    placeTo: 'a la cervecería',
    signatureReward: 'pinta de cortesía',
    signatureProduct: 'cerveza de la casa',
  },
  [StoreSegment.BAR_COCKTAIL]: {
    place: 'la coctelería',
    placeTo: 'a la coctelería',
    signatureReward: 'cóctel de la casa',
    signatureProduct: 'negroni',
  },
  [StoreSegment.BAKERY_BREAD]: {
    place: 'la panadería',
    placeTo: 'a la panadería',
    signatureReward: 'pan del día',
    signatureProduct: 'baguette',
  },
  [StoreSegment.BAKERY_PASTRY]: {
    place: 'la pastelería',
    placeTo: 'a la pastelería',
    signatureReward: 'porción de torta',
    signatureProduct: 'croissant',
  },
  [StoreSegment.BAKERY_DESSERT]: {
    place: 'la repostería',
    placeTo: 'a la repostería',
    signatureReward: 'postre de la casa',
    signatureProduct: 'brownie',
  },
  [StoreSegment.FAST_BURGER]: {
    place: 'el local',
    placeTo: 'al local',
    signatureReward: 'combo + papas',
    signatureProduct: 'hamburguesa',
  },
  [StoreSegment.FAST_PIZZA]: {
    place: 'el local',
    placeTo: 'al local',
    signatureReward: 'pizza personal',
    signatureProduct: 'pizza',
  },
  [StoreSegment.FAST_CHICKEN]: {
    place: 'el local',
    placeTo: 'al local',
    signatureReward: 'combo + gaseosa',
    signatureProduct: 'pollo frito',
  },
  [StoreSegment.FAST_OTHER]: {
    place: 'el local',
    placeTo: 'al local',
    signatureReward: 'combo + bebida',
    signatureProduct: 'combo',
  },
  [StoreSegment.TRUCK_FOOD]: {
    place: 'el food truck',
    placeTo: 'al food truck',
    signatureReward: 'extra de la casa',
    signatureProduct: 'plato estrella',
  },
  [StoreSegment.TRUCK_CART]: {
    place: 'el carrito',
    placeTo: 'al carrito',
    signatureReward: 'extra gratis',
    signatureProduct: 'especial del día',
  },
  [StoreSegment.RETAIL_FASHION]: {
    place: 'la tienda',
    placeTo: 'a la tienda',
    signatureReward: 'accesorio de regalo',
    signatureProduct: 'prenda destacada',
  },
  [StoreSegment.RETAIL_BOUTIQUE]: {
    place: 'la boutique',
    placeTo: 'a la boutique',
    signatureReward: 'detalle de regalo',
    signatureProduct: 'pieza destacada',
  },
  [StoreSegment.RETAIL_MARKET]: {
    place: 'el minimercado',
    placeTo: 'al minimercado',
    signatureReward: 'producto gratis',
    signatureProduct: 'canasta del día',
  },
  [StoreSegment.RETAIL_OTHER]: {
    place: 'la tienda',
    placeTo: 'a la tienda',
    signatureReward: 'obsequio',
    signatureProduct: 'producto destacado',
  },
  [StoreSegment.BEAUTY_HAIR]: {
    customerPlural: 'clientas',
    place: 'la peluquería',
    placeTo: 'a la peluquería',
    signatureReward: 'tratamiento de brillo',
    signatureProduct: 'corte + brush',
    visitNoun: 'cita',
  },
  [StoreSegment.BEAUTY_BARBER]: {
    customerPlural: 'clientes',
    place: 'la barbería',
    placeTo: 'a la barbería',
    signatureReward: 'arreglo de barba',
    signatureProduct: 'corte clásico',
    visitNoun: 'cita',
  },
  [StoreSegment.BEAUTY_SALON]: {
    customerPlural: 'clientas',
    place: 'el salón',
    placeTo: 'al salón',
    signatureReward: 'mascarilla de cortesía',
    signatureProduct: 'coloración',
    visitNoun: 'cita',
  },
  [StoreSegment.BEAUTY_SPA]: {
    customerPlural: 'clientas',
    place: 'el spa',
    placeTo: 'al spa',
    signatureReward: 'masaje de 30 min',
    signatureProduct: 'facial',
    visitNoun: 'sesión',
  },
  [StoreSegment.BEAUTY_NAILS]: {
    customerPlural: 'clientas',
    place: 'el salón de uñas',
    placeTo: 'al salón de uñas',
    signatureReward: 'mano de cortesía',
    signatureProduct: 'manicure',
    visitNoun: 'cita',
  },
  [StoreSegment.BEAUTY_BROWS]: {
    customerPlural: 'clientas',
    place: 'el estudio',
    placeTo: 'al estudio',
    signatureReward: 'diseño de cejas',
    signatureProduct: 'laminado',
    visitNoun: 'cita',
  },
  [StoreSegment.HEALTH_CLINIC]: {
    customerPlural: 'pacientes',
    place: 'el consultorio',
    placeTo: 'al consultorio',
    signatureReward: 'valoración de control',
    signatureProduct: 'consulta',
    visitNoun: 'cita',
  },
  [StoreSegment.HEALTH_AESTHETIC]: {
    customerPlural: 'pacientes',
    place: 'la clínica',
    placeTo: 'a la clínica',
    signatureReward: 'sesión de evaluación',
    signatureProduct: 'tratamiento facial',
    visitNoun: 'sesión',
  },
  [StoreSegment.HEALTH_PHARMA]: {
    customerPlural: 'clientes',
    place: 'la farmacia',
    placeTo: 'a la farmacia',
    signatureReward: 'descuento en OTC',
    signatureProduct: 'kit de bienestar',
    visitNoun: 'visita',
  },
  [StoreSegment.HEALTH_GYM]: {
    customerPlural: 'miembros',
    place: 'el gimnasio',
    placeTo: 'al gimnasio',
    signatureReward: 'clase de prueba',
    signatureProduct: 'entrenamiento personal',
    visitNoun: 'sesión',
  },
  [StoreSegment.HEALTH_DENTAL]: {
    customerPlural: 'pacientes',
    place: 'el consultorio dental',
    placeTo: 'al consultorio dental',
    signatureReward: 'limpieza de control',
    signatureProduct: 'profilaxis',
    visitNoun: 'cita',
  },
  [StoreSegment.AUTO_SHOP]: {
    place: 'el taller',
    placeTo: 'al taller',
    signatureReward: 'lavado de cortesía',
    signatureProduct: 'cambio de aceite',
  },
  [StoreSegment.AUTO_WASH]: {
    place: 'el lavadero',
    placeTo: 'al lavadero',
    signatureReward: 'aspirado gratis',
    signatureProduct: 'lavado completo',
  },
  [StoreSegment.AUTO_TIRES]: {
    place: 'el local de llantas',
    placeTo: 'al local de llantas',
    signatureReward: 'balanceo de cortesía',
    signatureProduct: 'rotación de llantas',
  },
  [StoreSegment.EDU_ACADEMY]: {
    customerPlural: 'estudiantes',
    place: 'la academia',
    placeTo: 'a la academia',
    signatureReward: 'clase de prueba',
    signatureProduct: 'módulo introductorio',
    visitNoun: 'clase',
  },
  [StoreSegment.EDU_LANGUAGE]: {
    customerPlural: 'estudiantes',
    place: 'el centro de idiomas',
    placeTo: 'al centro de idiomas',
    signatureReward: 'clase demo',
    signatureProduct: 'nivel A1',
    visitNoun: 'clase',
  },
  [StoreSegment.EDU_TUTOR]: {
    customerPlural: 'estudiantes',
    place: 'las tutorías',
    placeTo: 'a las tutorías',
    signatureReward: 'sesión de refuerzo',
    signatureProduct: 'clase particular',
    visitNoun: 'clase',
  },
  [StoreSegment.OTHER_PETS]: {
    place: 'la veterinaria',
    placeTo: 'a la veterinaria',
    signatureReward: 'baño de cortesía',
    signatureProduct: 'consulta mascota',
  },
  [StoreSegment.OTHER_CLEANING]: {
    place: 'el servicio',
    placeTo: 'al servicio',
    signatureReward: 'hora extra',
    signatureProduct: 'limpieza profunda',
  },
  [StoreSegment.OTHER_GENERIC]: {
    place: 'el negocio',
    placeTo: 'al negocio',
    signatureReward: 'servicio de cortesía',
    signatureProduct: 'servicio destacado',
  },
  [StoreSegment.HOTEL_STANDARD]: {
    customerPlural: 'huéspedes',
    place: 'el hotel',
    placeTo: 'al hotel',
    signatureReward: 'late check-out',
    signatureProduct: 'noche de hotel',
    visitNoun: 'estadía',
  },
  [StoreSegment.HOTEL_BOUTIQUE]: {
    customerPlural: 'huéspedes',
    place: 'el hotel boutique',
    placeTo: 'al hotel boutique',
    signatureReward: 'upgrade de habitación',
    signatureProduct: 'noche boutique',
    visitNoun: 'estadía',
  },
  [StoreSegment.HOSTEL_STANDARD]: {
    customerPlural: 'huéspedes',
    place: 'el hostel',
    placeTo: 'al hostel',
    signatureReward: 'desayuno incluido',
    signatureProduct: 'cama extra',
    visitNoun: 'estadía',
  },
  [StoreSegment.STAY_CABIN]: {
    customerPlural: 'huéspedes',
    place: 'la cabaña',
    placeTo: 'a la cabaña',
    signatureReward: 'noche extra',
    signatureProduct: 'fin de semana',
    visitNoun: 'reserva',
  },
  [StoreSegment.STAY_GLAMPING]: {
    customerPlural: 'huéspedes',
    place: 'el glamping',
    placeTo: 'al glamping',
    signatureReward: 'experiencia extra',
    signatureProduct: 'noche glamping',
    visitNoun: 'reserva',
  },
  [StoreSegment.STAY_APARTMENT]: {
    customerPlural: 'huéspedes',
    place: 'el apartamento',
    placeTo: 'al apartamento',
    signatureReward: 'noche extra',
    signatureProduct: 'estadía de 2 noches',
    visitNoun: 'reserva',
  },
  [StoreSegment.VENUE_HALL]: {
    place: 'el salón',
    placeTo: 'al salón',
    signatureReward: 'hora extra de salón',
    signatureProduct: 'paquete de evento',
    visitNoun: 'evento',
  },
  [StoreSegment.VENUE_TERRACE]: {
    place: 'la terraza',
    placeTo: 'a la terraza',
    signatureReward: 'hora extra de terraza',
    signatureProduct: 'paquete terraza',
    visitNoun: 'evento',
  },
};

export function voiceFor(
  subcategory: StoreSubcategory,
  segment?: StoreSegment | string | null
): VerticalVoice {
  const base = VOICES[subcategory] ?? VOICES[StoreSubcategory.OTHER_SERVICE];
  if (!segment) return base;
  const key = segment as StoreSegment;
  const overlay = SEGMENT_VOICE[key];
  if (!overlay) {
    // Fallback suave: usa el label del segmento si existe.
    const label = STORE_SEGMENT_LABELS[key];
    if (!label) return base;
    return {
      ...base,
      place: `el negocio (${label.toLowerCase()})`,
      placeTo: `al negocio (${label.toLowerCase()})`,
    };
  }
  return { ...base, ...overlay };
}

export function objectiveHint(kind: ObjectiveKind): string {
  switch (kind) {
    case 'reactivate':
      return 'Clientes dormidos o en riesgo';
    case 'slow_hours':
      return 'Llena el local cuando esté flojo';
    case 'new_reward':
      return 'Avisa un premio nuevo o cercano';
    case 'reviews':
      return 'Pide reseña a quien ya canjeó';
  }
}

/** Detalle editable del objetivo; la recomendación se aplica al elegir el propósito. */
export type CampaignEmotion = 'warm' | 'playful' | 'urgent' | 'elegant';

export const CAMPAIGN_EMOTIONS: Array<{
  id: CampaignEmotion;
  label: string;
  hint: string;
}> = [
  { id: 'warm', label: 'Cercano', hint: 'Cálido y directo' },
  { id: 'playful', label: 'Divertido', hint: 'Con energía' },
  { id: 'urgent', label: 'Urgente', hint: 'Acción ya' },
  { id: 'elegant', label: 'Elegante', hint: 'Trato formal' },
];

export type ObjectiveDetails = {
  inactiveDays: number;
  minVisits: number;
  slowWindow: string;
  rewardName: string;
  maxPointsGap: number;
  activeWithinDays: number;
  reviewIncentive: string;
  redeemWithinDays: number;
  requireWallet: boolean;
  emotion: CampaignEmotion;
};

export const DEFAULT_INACTIVE_DAYS = 21;
export const DEFAULT_MIN_VISITS = 1;
export const DEFAULT_MAX_POINTS_GAP = 2;
export const DEFAULT_ACTIVE_WITHIN_DAYS = 14;
export const DEFAULT_REDEEM_WITHIN_DAYS = 14;

export type ObjectiveDetailFieldKey = keyof ObjectiveDetails;

export type ObjectiveDetailFieldDef = {
  key: ObjectiveDetailFieldKey;
  label: string;
  hint?: string;
  type: 'number' | 'text' | 'boolean';
  min?: number;
  max?: number;
  placeholder?: string;
};

export const OBJECTIVE_DETAIL_FIELDS: Record<
  ObjectiveKind,
  ObjectiveDetailFieldDef[]
> = {
  reactivate: [
    {
      key: 'inactiveDays',
      label: 'Días sin visita',
      hint: 'Clientes que llevan más tiempo sin volver',
      type: 'number',
      min: 7,
      max: 180,
    },
    {
      key: 'minVisits',
      label: 'Visitas mínimas previas',
      hint: 'Solo quien ya conoce el local',
      type: 'number',
      min: 1,
      max: 20,
    },
    {
      key: 'requireWallet',
      label: 'Solo con pase en Wallet',
      type: 'boolean',
    },
  ],
  slow_hours: [
    {
      key: 'slowWindow',
      label: 'Ventana floja',
      hint: 'Cuándo quieres llenar el local',
      type: 'text',
      placeholder: 'ej. martes y miércoles de 2 a 5 pm',
    },
    {
      key: 'minVisits',
      label: 'Visitas mínimas previas',
      type: 'number',
      min: 1,
      max: 20,
    },
    {
      key: 'requireWallet',
      label: 'Solo con pase en Wallet',
      type: 'boolean',
    },
  ],
  new_reward: [
    {
      key: 'rewardName',
      label: 'Nombre de la recompensa',
      type: 'text',
      placeholder: 'ej. café + postre',
    },
    {
      key: 'maxPointsGap',
      label: 'Ondas máx. al premio',
      hint: 'Incluye a quien está a pocas ondas de canjear',
      type: 'number',
      min: 1,
      max: 10,
    },
    {
      key: 'activeWithinDays',
      label: 'Activos en los últimos (días)',
      type: 'number',
      min: 1,
      max: 90,
    },
    {
      key: 'requireWallet',
      label: 'Solo con pase en Wallet',
      type: 'boolean',
    },
  ],
  reviews: [
    {
      key: 'reviewIncentive',
      label: 'Incentivo por reseña',
      type: 'text',
      placeholder: 'ej. 1 onda extra por reseña',
    },
    {
      key: 'redeemWithinDays',
      label: 'Canjearon hace menos de (días)',
      type: 'number',
      min: 1,
      max: 60,
    },
    {
      key: 'requireWallet',
      label: 'Solo con pase en Wallet',
      type: 'boolean',
    },
  ],
};

export function objectiveDetailFields(kind: ObjectiveKind): ObjectiveDetailFieldDef[] {
  return OBJECTIVE_DETAIL_FIELDS[kind];
}

export function clampObjectiveDetail(
  key: ObjectiveDetailFieldKey,
  raw: string | number | boolean
): ObjectiveDetails[ObjectiveDetailFieldKey] {
  const field = Object.values(OBJECTIVE_DETAIL_FIELDS)
    .flat()
    .find((f) => f.key === key);
  if (field?.type === 'boolean') return Boolean(raw);
  if (field?.type === 'text') return String(raw);
  const n = Number(raw);
  const fallback =
    key === 'inactiveDays'
      ? DEFAULT_INACTIVE_DAYS
      : key === 'minVisits'
        ? DEFAULT_MIN_VISITS
        : key === 'maxPointsGap'
          ? DEFAULT_MAX_POINTS_GAP
          : key === 'activeWithinDays'
            ? DEFAULT_ACTIVE_WITHIN_DAYS
            : key === 'redeemWithinDays'
              ? DEFAULT_REDEEM_WITHIN_DAYS
              : 0;
  if (!Number.isFinite(n)) return fallback;
  const min = field?.min ?? 0;
  const max = field?.max ?? 999;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function recommendedObjectiveDetails(
  voice: VerticalVoice,
  overrides?: Partial<ObjectiveDetails>
): ObjectiveDetails {
  return {
    inactiveDays: DEFAULT_INACTIVE_DAYS,
    minVisits: DEFAULT_MIN_VISITS,
    slowWindow: voice.slowWindow,
    rewardName: voice.signatureReward,
    maxPointsGap: DEFAULT_MAX_POINTS_GAP,
    activeWithinDays: DEFAULT_ACTIVE_WITHIN_DAYS,
    reviewIncentive: '1 onda extra por reseña',
    redeemWithinDays: DEFAULT_REDEEM_WITHIN_DAYS,
    requireWallet: false,
    emotion: 'warm',
    ...overrides,
  };
}

/** Query params de audiencia según el objetivo y su detalle. */
export function objectiveAudienceQueryParams(
  kind: ObjectiveKind,
  details: ObjectiveDetails
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const field of OBJECTIVE_DETAIL_FIELDS[kind]) {
    const value = details[field.key];
    if (field.type === 'boolean') {
      if (value) params[field.key] = '1';
      continue;
    }
    if (field.type === 'text') {
      const text = String(value || '').trim();
      if (text) params[field.key] = text;
      continue;
    }
    params[field.key] = String(value);
  }
  return params;
}

export function objectiveLabel(
  kind: ObjectiveKind,
  voice: VerticalVoice,
  detailsOrSlow?: Partial<ObjectiveDetails> | string
): string {
  const details =
    typeof detailsOrSlow === 'string'
      ? { slowWindow: detailsOrSlow }
      : detailsOrSlow || {};
  const inactiveDays = details.inactiveDays ?? DEFAULT_INACTIVE_DAYS;
  const minVisits = details.minVisits ?? DEFAULT_MIN_VISITS;
  const slowWindow = details.slowWindow || voice.slowWindow;
  const rewardName = details.rewardName || voice.signatureReward;
  const maxPointsGap = details.maxPointsGap ?? DEFAULT_MAX_POINTS_GAP;
  const activeWithinDays = details.activeWithinDays ?? DEFAULT_ACTIVE_WITHIN_DAYS;
  const reviewIncentive = details.reviewIncentive || '1 onda extra por reseña';
  const redeemWithinDays = details.redeemWithinDays ?? DEFAULT_REDEEM_WITHIN_DAYS;
  const walletOnly = details.requireWallet ? ' (solo Wallet)' : '';

  switch (kind) {
    case 'reactivate':
      return minVisits > 1
        ? `Traer ${voice.customerPlural} con ${minVisits}+ visitas que no vuelven ${voice.placeTo} hace más de ${inactiveDays} días${walletOnly}`
        : `Traer ${voice.customerPlural} que no vuelven ${voice.placeTo} hace más de ${inactiveDays} días${walletOnly}`;
    case 'slow_hours':
      return minVisits > 1
        ? `Llenar ${voice.place} ${slowWindow} — ${minVisits}+ visitas previas${walletOnly}`
        : `Llenar ${voice.place} ${slowWindow}${walletOnly}`;
    case 'new_reward':
      return `Lanzar ${rewardName} — a ${maxPointsGap} ondas o activos en ${activeWithinDays} días${walletOnly}`;
    case 'reviews':
      return `Pedir reseñas a ${voice.customerPlural} que canjearon en ${redeemWithinDays} días (${reviewIncentive})${walletOnly}`;
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
  voice: VerticalVoice,
  details?: Partial<ObjectiveDetails>
): CampaignPromo {
  const slowWindow = details?.slowWindow || voice.slowWindow;
  const rewardName = details?.rewardName || voice.signatureReward;
  const reviewIncentive = details?.reviewIncentive || '1 onda extra por reseña';

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
        title: `Promo ${slowWindow}`,
        value: '25',
        buyQuantity: '2',
        getQuantity: '1',
        productName: voice.signatureProduct,
      };
    case 'new_reward':
      return {
        type: 'PRODUCT',
        title: rewardName,
        value: '',
        buyQuantity: '2',
        getQuantity: '1',
        productName: rewardName,
      };
    case 'reviews':
      return {
        type: 'OTHER',
        title: reviewIncentive,
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

type MessageCtx = {
  name: string;
  storeName: string;
  voice: VerticalVoice;
  slowWindow: string;
  rewardName: string;
  reviewIncentive: string;
};

type EmotionTemplate = Record<CampaignEmotion, (ctx: MessageCtx) => string>;

const OBJECTIVE_MESSAGE_TEMPLATES: Record<
  ObjectiveKind,
  Record<'Wallet' | 'SMS', EmotionTemplate>
> = {
  reactivate: {
    Wallet: {
      warm: (c) => `Te extrañamos en ${c.storeName}. Ábrelo en tu pase.`,
      playful: (c) => `¡${c.storeName} no es lo mismo sin ti! Tu pase te espera.`,
      urgent: (c) =>
        `Esta semana es para volver: tu lugar en ${c.storeName} te espera. Ábrelo en tu pase.`,
      elegant: (c) => `Le esperamos de nuevo en ${c.storeName}. Consulte su pase.`,
    },
    SMS: {
      warm: (c) =>
        `Hola ${c.name}, te extrañamos en ${c.storeName}. Vuelve pronto ${c.voice.placeTo}.`,
      playful: (c) =>
        `¡${c.name}! ${c.storeName} te extraña un montón. Ven y compruébalo ${c.voice.placeTo}.`,
      urgent: (c) =>
        `${c.name}, no dejes pasar esta semana: tu lugar en ${c.storeName} te espera ${c.voice.placeTo}.`,
      elegant: (c) =>
        `${c.name}, sería un gusto recibirle de nuevo en ${c.storeName}. Le esperamos ${c.voice.placeTo}.`,
    },
  },
  slow_hours: {
    Wallet: {
      warm: (c) => `Te esperamos ${c.slowWindow} en ${c.storeName}.`,
      playful: (c) => `¡${c.slowWindow} se disfruta más en ${c.storeName}!`,
      urgent: (c) =>
        `${c.slowWindow}: el momento perfecto para venir a ${c.storeName} sin filas.`,
      elegant: (c) =>
        `Lo invitamos ${c.slowWindow} a disfrutar ${c.storeName} con calma.`,
    },
    SMS: {
      warm: (c) =>
        `Hola ${c.name}, ${c.slowWindow} está más rico en ${c.storeName}. Te esperamos.`,
      playful: (c) =>
        `¡${c.name}! ${c.slowWindow} en ${c.storeName} sabe mejor. ¡Ven y compruébalo!`,
      urgent: (c) =>
        `${c.name}, aprovecha ${c.slowWindow}: ${c.storeName} está más tranquilo que nunca.`,
      elegant: (c) =>
        `${c.name}, ${c.slowWindow} le ofrecemos ${c.storeName} en su mejor ambiente.`,
    },
  },
  new_reward: {
    Wallet: {
      warm: (c) => `Nueva recompensa: ${c.rewardName}. Ya está en tu pase.`,
      playful: (c) => `¡Premio nuevo en tu pase: ${c.rewardName}! ¿Ya lo viste?`,
      urgent: (c) => `Acaba de llegar: ${c.rewardName}. Ya está en tu pase.`,
      elegant: (c) =>
        `Nueva recompensa disponible: ${c.rewardName}. Consulte su pase.`,
    },
    SMS: {
      warm: (c) =>
        `Hola ${c.name}, estrenamos recompensa en ${c.storeName}: ${c.rewardName}. Te esperamos en tu próxima ${c.voice.visitNoun}.`,
      playful: (c) =>
        `¡${c.name}, hay premio nuevo en ${c.storeName}: ${c.rewardName}! Ven por tu próxima ${c.voice.visitNoun}.`,
      urgent: (c) =>
        `${c.name}, estrenamos ${c.rewardName} en ${c.storeName}. Ven pronto y estrena tú también.`,
      elegant: (c) =>
        `${c.name}, ${c.storeName} le presenta su nueva recompensa: ${c.rewardName}. Le esperamos en su próxima ${c.voice.visitNoun}.`,
    },
  },
  reviews: {
    Wallet: {
      warm: (c) => `${c.reviewIncentive}. Cuéntanos: {{feedbackUrl}}`,
      playful: (c) =>
        `¿Nos cuentas cómo te fue? ${c.reviewIncentive}: {{feedbackUrl}}`,
      urgent: (c) => `Tu opinión vale: ${c.reviewIncentive}. {{feedbackUrl}}`,
      elegant: (c) =>
        `Su opinión es importante: ${c.reviewIncentive}. {{feedbackUrl}}`,
    },
    SMS: {
      warm: (c) =>
        `Hola ${c.name}, ¿cómo te fue en ${c.storeName}? Cuéntanos: {{feedbackUrl}}`,
      playful: (c) =>
        `¿Cómo te fue, ${c.name}? Una reseña nos alegra el día: {{feedbackUrl}}`,
      urgent: (c) =>
        `${c.name}, 1 minuto: tu reseña de ${c.storeName} nos ayuda un montón: {{feedbackUrl}}`,
      elegant: (c) =>
        `${c.name}, agradeceríamos su reseña de ${c.storeName}: {{feedbackUrl}}`,
    },
  },
};

export function buildObjectiveMessages(opts: {
  kind: ObjectiveKind;
  voice: VerticalVoice;
  storeName: string;
  details?: Partial<ObjectiveDetails>;
  firstName?: string;
  slowWindow?: string;
}): CampaignMessage[] {
  const name = opts.firstName || '{{nombre}}';
  const { storeName, voice, kind } = opts;
  const slowWindow = opts.slowWindow || opts.details?.slowWindow || voice.slowWindow;
  const rewardName = opts.details?.rewardName || voice.signatureReward;
  const reviewIncentive =
    opts.details?.reviewIncentive || '1 onda extra por reseña';
  const emotion = opts.details?.emotion ?? 'warm';

  const ctx: MessageCtx = {
    name,
    storeName,
    voice,
    slowWindow,
    rewardName,
    reviewIncentive,
  };
  const templates = OBJECTIVE_MESSAGE_TEMPLATES[kind];
  return [
    {
      channel: 'Wallet',
      channelLabel: 'Push · Wallet',
      text: templates.Wallet[emotion](ctx),
    },
    {
      channel: 'SMS',
      channelLabel: 'SMS',
      text: templates.SMS[emotion](ctx),
    },
  ];
}

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
  vars: { nombre?: string; feedbackUrl?: string; store?: string }
): string {
  return text
    .replaceAll('{{nombre}}', vars.nombre?.trim() || 'tú')
    .replaceAll('{{feedbackUrl}}', vars.feedbackUrl?.trim() || '')
    .replaceAll('{{store}}', vars.store?.trim() || '');
}

/** Cierre que se agrega a cada mensaje con el premio más cercano del cliente. */
export function nextRewardSuffix(
  nearGap: number | null | undefined,
  rewardTitle?: string | null
): string {
  if (nearGap == null || !rewardTitle?.trim()) return '';
  const ondas =
    nearGap === 1 ? 'te falta 1 onda' : `te faltan ${nearGap} ondas`;
  return ` · Tu próximo premio: ${rewardTitle.trim()} (${ondas})`;
}
