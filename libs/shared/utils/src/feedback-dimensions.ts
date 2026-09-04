import {
  StoreCategory,
  StoreSegment,
  StoreSubcategory,
} from '@onda/shared-types';

export type FeedbackDimensionId =
  | 'service'
  | 'product'
  | 'time'
  | 'ambience'
  | 'price'
  | 'result'
  | 'punctuality'
  | 'reception'
  | 'room'
  | 'cleanliness'
  | 'location'
  | 'value';

export type FeedbackDimensionDef = {
  id: FeedbackDimensionId;
  label: string;
  icon: string;
  positiveLabel: string;
  negativeLabel: string;
};

const FOOD_DIMENSIONS: FeedbackDimensionDef[] = [
  {
    id: 'service',
    label: 'Atención',
    icon: 'HandWaving',
    positiveLabel: 'Buena atención',
    negativeLabel: 'Atención mejorable',
  },
  {
    id: 'product',
    label: 'Comida',
    icon: 'ForkKnife',
    positiveLabel: 'Rica comida',
    negativeLabel: 'Comida mejorable',
  },
  {
    id: 'time',
    label: 'Tiempo',
    icon: 'Clock',
    positiveLabel: 'Rápido',
    negativeLabel: 'Demorado',
  },
  {
    id: 'ambience',
    label: 'Ambiente',
    icon: 'Armchair',
    positiveLabel: 'Buen ambiente',
    negativeLabel: 'Ambiente mejorable',
  },
  {
    id: 'price',
    label: 'Precio',
    icon: 'CurrencyCircleDollar',
    positiveLabel: 'Buen precio',
    negativeLabel: 'Caro',
  },
];

const BEAUTY_DIMENSIONS: FeedbackDimensionDef[] = [
  {
    id: 'service',
    label: 'Atención',
    icon: 'HandWaving',
    positiveLabel: 'Buena atención',
    negativeLabel: 'Atención mejorable',
  },
  {
    id: 'result',
    label: 'Resultado',
    icon: 'Sparkle',
    positiveLabel: 'Gran resultado',
    negativeLabel: 'Resultado mejorable',
  },
  {
    id: 'punctuality',
    label: 'Puntualidad',
    icon: 'Clock',
    positiveLabel: 'A tiempo',
    negativeLabel: 'Con demora',
  },
  {
    id: 'ambience',
    label: 'Ambiente',
    icon: 'Armchair',
    positiveLabel: 'Buen ambiente',
    negativeLabel: 'Ambiente mejorable',
  },
  {
    id: 'price',
    label: 'Precio',
    icon: 'CurrencyCircleDollar',
    positiveLabel: 'Buen precio',
    negativeLabel: 'Caro',
  },
];

const RETAIL_DIMENSIONS: FeedbackDimensionDef[] = [
  {
    id: 'service',
    label: 'Atención',
    icon: 'HandWaving',
    positiveLabel: 'Buena atención',
    negativeLabel: 'Atención mejorable',
  },
  {
    id: 'product',
    label: 'Producto',
    icon: 'ShoppingBag',
    positiveLabel: 'Buen producto',
    negativeLabel: 'Producto mejorable',
  },
  {
    id: 'time',
    label: 'Tiempo',
    icon: 'Clock',
    positiveLabel: 'Rápido',
    negativeLabel: 'Demorado',
  },
  {
    id: 'ambience',
    label: 'Tienda',
    icon: 'Storefront',
    positiveLabel: 'Buena tienda',
    negativeLabel: 'Tienda mejorable',
  },
  {
    id: 'price',
    label: 'Precio',
    icon: 'CurrencyCircleDollar',
    positiveLabel: 'Buen precio',
    negativeLabel: 'Caro',
  },
];

const HOSPITALITY_DIMENSIONS: FeedbackDimensionDef[] = [
  {
    id: 'reception',
    label: 'Recepción',
    icon: 'Bell',
    positiveLabel: 'Buena recepción',
    negativeLabel: 'Recepción mejorable',
  },
  {
    id: 'room',
    label: 'Habitación',
    icon: 'Bed',
    positiveLabel: 'Buena habitación',
    negativeLabel: 'Habitación mejorable',
  },
  {
    id: 'cleanliness',
    label: 'Limpieza',
    icon: 'Broom',
    positiveLabel: 'Muy limpio',
    negativeLabel: 'Limpieza mejorable',
  },
  {
    id: 'location',
    label: 'Ubicación',
    icon: 'MapPin',
    positiveLabel: 'Buena ubicación',
    negativeLabel: 'Ubicación mejorable',
  },
  {
    id: 'value',
    label: 'Relación calidad-precio',
    icon: 'CurrencyCircleDollar',
    positiveLabel: 'Buena relación',
    negativeLabel: 'Caro para lo ofrecido',
  },
];

const SERVICE_DIMENSIONS: FeedbackDimensionDef[] = [
  {
    id: 'service',
    label: 'Atención',
    icon: 'HandWaving',
    positiveLabel: 'Buena atención',
    negativeLabel: 'Atención mejorable',
  },
  {
    id: 'result',
    label: 'Servicio',
    icon: 'Wrench',
    positiveLabel: 'Buen servicio',
    negativeLabel: 'Servicio mejorable',
  },
  {
    id: 'punctuality',
    label: 'Puntualidad',
    icon: 'Clock',
    positiveLabel: 'A tiempo',
    negativeLabel: 'Con demora',
  },
  {
    id: 'ambience',
    label: 'Instalaciones',
    icon: 'Buildings',
    positiveLabel: 'Buenas instalaciones',
    negativeLabel: 'Instalaciones mejorables',
  },
  {
    id: 'price',
    label: 'Precio',
    icon: 'CurrencyCircleDollar',
    positiveLabel: 'Buen precio',
    negativeLabel: 'Caro',
  },
];

const SUBCATEGORY_DIMENSIONS: Partial<
  Record<StoreSubcategory, FeedbackDimensionDef[]>
> = {
  [StoreSubcategory.CAFE]: FOOD_DIMENSIONS,
  [StoreSubcategory.RESTAURANT_FULL]: FOOD_DIMENSIONS,
  [StoreSubcategory.BAR]: FOOD_DIMENSIONS,
  [StoreSubcategory.BAKERY]: FOOD_DIMENSIONS,
  [StoreSubcategory.FAST_FOOD]: FOOD_DIMENSIONS,
  [StoreSubcategory.FOOD_TRUCK]: FOOD_DIMENSIONS,
  [StoreSubcategory.RETAIL]: RETAIL_DIMENSIONS,
  [StoreSubcategory.BEAUTY]: BEAUTY_DIMENSIONS,
  [StoreSubcategory.HEALTH]: SERVICE_DIMENSIONS,
  [StoreSubcategory.AUTO]: SERVICE_DIMENSIONS,
  [StoreSubcategory.EDUCATION]: SERVICE_DIMENSIONS,
  [StoreSubcategory.OTHER_SERVICE]: SERVICE_DIMENSIONS,
  [StoreSubcategory.HOTEL]: HOSPITALITY_DIMENSIONS,
  [StoreSubcategory.HOSTEL]: HOSPITALITY_DIMENSIONS,
  [StoreSubcategory.VACATION_RENTAL]: HOSPITALITY_DIMENSIONS,
  [StoreSubcategory.EVENT_VENUE]: HOSPITALITY_DIMENSIONS,
  [StoreSubcategory.BEVERAGE]: RETAIL_DIMENSIONS,
  [StoreSubcategory.ALCOHOL]: RETAIL_DIMENSIONS,
  [StoreSubcategory.SNACKS]: RETAIL_DIMENSIONS,
  [StoreSubcategory.PACKAGED_FOOD]: RETAIL_DIMENSIONS,
  [StoreSubcategory.COFFEE_TEA]: RETAIL_DIMENSIONS,
  [StoreSubcategory.DAIRY]: RETAIL_DIMENSIONS,
  [StoreSubcategory.PERSONAL_CARE]: RETAIL_DIMENSIONS,
  [StoreSubcategory.COSMETICS]: BEAUTY_DIMENSIONS,
  [StoreSubcategory.FASHION]: RETAIL_DIMENSIONS,
  [StoreSubcategory.SPORTS]: RETAIL_DIMENSIONS,
  [StoreSubcategory.TECH]: RETAIL_DIMENSIONS,
  [StoreSubcategory.HOME_CARE]: RETAIL_DIMENSIONS,
  [StoreSubcategory.PETS]: RETAIL_DIMENSIONS,
  [StoreSubcategory.OTHER_BRAND]: RETAIL_DIMENSIONS,
};

const CATEGORY_FALLBACK: Record<StoreCategory, FeedbackDimensionDef[]> = {
  [StoreCategory.RESTAURANT]: FOOD_DIMENSIONS,
  [StoreCategory.SERVICE]: SERVICE_DIMENSIONS,
  [StoreCategory.HOSPITALITY]: HOSPITALITY_DIMENSIONS,
  [StoreCategory.BRAND]: RETAIL_DIMENSIONS,
};

export function feedbackDimensionsFor(
  subcategory: StoreSubcategory | string,
  _segment?: StoreSegment | string | null
): FeedbackDimensionDef[] {
  const preset =
    SUBCATEGORY_DIMENSIONS[subcategory as StoreSubcategory] ||
    CATEGORY_FALLBACK[StoreCategory.RESTAURANT];
  return preset;
}

export function feedbackDimensionLabel(
  dimensions: FeedbackDimensionDef[],
  id: string
): string {
  return dimensions.find((d) => d.id === id)?.label || id;
}
