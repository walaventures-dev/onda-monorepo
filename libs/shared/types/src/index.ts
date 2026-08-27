// Enums & shared DTOs for Onda
export enum PlanType {
  BASIC = 'BASIC',
  PRO = 'PRO',
}

export enum EventStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  FINISHED = 'FINISHED',
}

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

export enum TransactionType {
  ACCUMULATE = 'ACCUMULATE',
  REDEEM = 'REDEEM',
}

/** Tipo de negocio: comida, servicios u hospitalidad. */
export enum StoreCategory {
  RESTAURANT = 'RESTAURANT',
  SERVICE = 'SERVICE',
  HOSPITALITY = 'HOSPITALITY',
}

/** Categoría dentro del tipo (belleza, café, hotel…). */
export enum StoreSubcategory {
  CAFE = 'CAFE',
  RESTAURANT_FULL = 'RESTAURANT_FULL',
  BAR = 'BAR',
  BAKERY = 'BAKERY',
  FAST_FOOD = 'FAST_FOOD',
  FOOD_TRUCK = 'FOOD_TRUCK',
  RETAIL = 'RETAIL',
  BEAUTY = 'BEAUTY',
  HEALTH = 'HEALTH',
  AUTO = 'AUTO',
  EDUCATION = 'EDUCATION',
  OTHER_SERVICE = 'OTHER_SERVICE',
  HOTEL = 'HOTEL',
  HOSTEL = 'HOSTEL',
  VACATION_RENTAL = 'VACATION_RENTAL',
  EVENT_VENUE = 'EVENT_VENUE',
}

/** Tercer nivel: subcategoría dentro de cada categoría. */
export enum StoreSegment {
  CAFE_COFFEE = 'CAFE_COFFEE',
  CAFE_SPECIALTY = 'CAFE_SPECIALTY',
  CAFE_ROASTERY = 'CAFE_ROASTERY',
  REST_CASUAL = 'REST_CASUAL',
  REST_FINE = 'REST_FINE',
  REST_TRADITIONAL = 'REST_TRADITIONAL',
  REST_SEAFOOD = 'REST_SEAFOOD',
  BAR_PUB = 'BAR_PUB',
  BAR_BREWERY = 'BAR_BREWERY',
  BAR_COCKTAIL = 'BAR_COCKTAIL',
  BAKERY_BREAD = 'BAKERY_BREAD',
  BAKERY_PASTRY = 'BAKERY_PASTRY',
  BAKERY_DESSERT = 'BAKERY_DESSERT',
  FAST_BURGER = 'FAST_BURGER',
  FAST_PIZZA = 'FAST_PIZZA',
  FAST_CHICKEN = 'FAST_CHICKEN',
  FAST_OTHER = 'FAST_OTHER',
  TRUCK_FOOD = 'TRUCK_FOOD',
  TRUCK_CART = 'TRUCK_CART',
  RETAIL_FASHION = 'RETAIL_FASHION',
  RETAIL_BOUTIQUE = 'RETAIL_BOUTIQUE',
  RETAIL_MARKET = 'RETAIL_MARKET',
  RETAIL_OTHER = 'RETAIL_OTHER',
  BEAUTY_HAIR = 'BEAUTY_HAIR',
  BEAUTY_BARBER = 'BEAUTY_BARBER',
  BEAUTY_SALON = 'BEAUTY_SALON',
  BEAUTY_SPA = 'BEAUTY_SPA',
  BEAUTY_NAILS = 'BEAUTY_NAILS',
  BEAUTY_BROWS = 'BEAUTY_BROWS',
  HEALTH_CLINIC = 'HEALTH_CLINIC',
  HEALTH_AESTHETIC = 'HEALTH_AESTHETIC',
  HEALTH_PHARMA = 'HEALTH_PHARMA',
  HEALTH_GYM = 'HEALTH_GYM',
  HEALTH_DENTAL = 'HEALTH_DENTAL',
  AUTO_SHOP = 'AUTO_SHOP',
  AUTO_WASH = 'AUTO_WASH',
  AUTO_TIRES = 'AUTO_TIRES',
  EDU_ACADEMY = 'EDU_ACADEMY',
  EDU_LANGUAGE = 'EDU_LANGUAGE',
  EDU_TUTOR = 'EDU_TUTOR',
  OTHER_PETS = 'OTHER_PETS',
  OTHER_CLEANING = 'OTHER_CLEANING',
  OTHER_GENERIC = 'OTHER_GENERIC',
  HOTEL_STANDARD = 'HOTEL_STANDARD',
  HOTEL_BOUTIQUE = 'HOTEL_BOUTIQUE',
  HOSTEL_STANDARD = 'HOSTEL_STANDARD',
  STAY_CABIN = 'STAY_CABIN',
  STAY_GLAMPING = 'STAY_GLAMPING',
  STAY_APARTMENT = 'STAY_APARTMENT',
  VENUE_HALL = 'VENUE_HALL',
  VENUE_TERRACE = 'VENUE_TERRACE',
}

export const STORE_SUBCATEGORIES_BY_CATEGORY: Record<
  StoreCategory,
  StoreSubcategory[]
> = {
  [StoreCategory.RESTAURANT]: [
    StoreSubcategory.CAFE,
    StoreSubcategory.RESTAURANT_FULL,
    StoreSubcategory.BAR,
    StoreSubcategory.BAKERY,
    StoreSubcategory.FAST_FOOD,
    StoreSubcategory.FOOD_TRUCK,
  ],
  [StoreCategory.SERVICE]: [
    StoreSubcategory.RETAIL,
    StoreSubcategory.BEAUTY,
    StoreSubcategory.HEALTH,
    StoreSubcategory.AUTO,
    StoreSubcategory.EDUCATION,
    StoreSubcategory.OTHER_SERVICE,
  ],
  [StoreCategory.HOSPITALITY]: [
    StoreSubcategory.HOTEL,
    StoreSubcategory.HOSTEL,
    StoreSubcategory.VACATION_RENTAL,
    StoreSubcategory.EVENT_VENUE,
  ],
};

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
  [StoreCategory.RESTAURANT]: 'Restaurante',
  [StoreCategory.SERVICE]: 'Servicios',
  [StoreCategory.HOSPITALITY]: 'Hospitalidad',
};

export const STORE_SUBCATEGORY_LABELS: Record<StoreSubcategory, string> = {
  [StoreSubcategory.CAFE]: 'Café',
  [StoreSubcategory.RESTAURANT_FULL]: 'Restaurante',
  [StoreSubcategory.BAR]: 'Bar',
  [StoreSubcategory.BAKERY]: 'Panadería',
  [StoreSubcategory.FAST_FOOD]: 'Comida rápida',
  [StoreSubcategory.FOOD_TRUCK]: 'Food truck',
  [StoreSubcategory.RETAIL]: 'Retail',
  [StoreSubcategory.BEAUTY]: 'Belleza',
  [StoreSubcategory.HEALTH]: 'Salud',
  [StoreSubcategory.AUTO]: 'Automotriz',
  [StoreSubcategory.EDUCATION]: 'Educación',
  [StoreSubcategory.OTHER_SERVICE]: 'Otro servicio',
  [StoreSubcategory.HOTEL]: 'Hotel',
  [StoreSubcategory.HOSTEL]: 'Hostel',
  [StoreSubcategory.VACATION_RENTAL]: 'Alojamiento',
  [StoreSubcategory.EVENT_VENUE]: 'Venue de eventos',
};

export const STORE_SEGMENT_LABELS: Record<StoreSegment, string> = {
  [StoreSegment.CAFE_COFFEE]: 'Cafetería',
  [StoreSegment.CAFE_SPECIALTY]: 'Coffee shop',
  [StoreSegment.CAFE_ROASTERY]: 'Tostaduría',
  [StoreSegment.REST_CASUAL]: 'Casual',
  [StoreSegment.REST_FINE]: 'Alta cocina',
  [StoreSegment.REST_TRADITIONAL]: 'Comida típica',
  [StoreSegment.REST_SEAFOOD]: 'Marisquería',
  [StoreSegment.BAR_PUB]: 'Bar',
  [StoreSegment.BAR_BREWERY]: 'Cervecería',
  [StoreSegment.BAR_COCKTAIL]: 'Coctelería',
  [StoreSegment.BAKERY_BREAD]: 'Panadería',
  [StoreSegment.BAKERY_PASTRY]: 'Pastelería',
  [StoreSegment.BAKERY_DESSERT]: 'Repostería',
  [StoreSegment.FAST_BURGER]: 'Hamburguesas',
  [StoreSegment.FAST_PIZZA]: 'Pizza',
  [StoreSegment.FAST_CHICKEN]: 'Pollo',
  [StoreSegment.FAST_OTHER]: 'Otra comida rápida',
  [StoreSegment.TRUCK_FOOD]: 'Food truck',
  [StoreSegment.TRUCK_CART]: 'Carrito',
  [StoreSegment.RETAIL_FASHION]: 'Ropa',
  [StoreSegment.RETAIL_BOUTIQUE]: 'Boutique',
  [StoreSegment.RETAIL_MARKET]: 'Minimercado',
  [StoreSegment.RETAIL_OTHER]: 'Otra tienda',
  [StoreSegment.BEAUTY_HAIR]: 'Peluquería',
  [StoreSegment.BEAUTY_BARBER]: 'Barbería',
  [StoreSegment.BEAUTY_SALON]: 'Salón de belleza',
  [StoreSegment.BEAUTY_SPA]: 'Spa',
  [StoreSegment.BEAUTY_NAILS]: 'Uñas',
  [StoreSegment.BEAUTY_BROWS]: 'Cejas y pestañas',
  [StoreSegment.HEALTH_CLINIC]: 'Consultorio',
  [StoreSegment.HEALTH_AESTHETIC]: 'Clínica estética',
  [StoreSegment.HEALTH_PHARMA]: 'Farmacia',
  [StoreSegment.HEALTH_GYM]: 'Gimnasio',
  [StoreSegment.HEALTH_DENTAL]: 'Odontología',
  [StoreSegment.AUTO_SHOP]: 'Taller',
  [StoreSegment.AUTO_WASH]: 'Lavadero',
  [StoreSegment.AUTO_TIRES]: 'Llantas',
  [StoreSegment.EDU_ACADEMY]: 'Academia',
  [StoreSegment.EDU_LANGUAGE]: 'Idiomas',
  [StoreSegment.EDU_TUTOR]: 'Tutorías',
  [StoreSegment.OTHER_PETS]: 'Mascotas',
  [StoreSegment.OTHER_CLEANING]: 'Limpieza',
  [StoreSegment.OTHER_GENERIC]: 'Otro',
  [StoreSegment.HOTEL_STANDARD]: 'Hotel',
  [StoreSegment.HOTEL_BOUTIQUE]: 'Hotel boutique',
  [StoreSegment.HOSTEL_STANDARD]: 'Hostel',
  [StoreSegment.STAY_CABIN]: 'Cabaña',
  [StoreSegment.STAY_GLAMPING]: 'Glamping',
  [StoreSegment.STAY_APARTMENT]: 'Apartamento',
  [StoreSegment.VENUE_HALL]: 'Salón de eventos',
  [StoreSegment.VENUE_TERRACE]: 'Terraza',
};

export const STORE_SEGMENTS_BY_SUBCATEGORY: Record<
  StoreSubcategory,
  StoreSegment[]
> = {
  [StoreSubcategory.CAFE]: [
    StoreSegment.CAFE_COFFEE,
    StoreSegment.CAFE_SPECIALTY,
    StoreSegment.CAFE_ROASTERY,
  ],
  [StoreSubcategory.RESTAURANT_FULL]: [
    StoreSegment.REST_CASUAL,
    StoreSegment.REST_FINE,
    StoreSegment.REST_TRADITIONAL,
    StoreSegment.REST_SEAFOOD,
  ],
  [StoreSubcategory.BAR]: [
    StoreSegment.BAR_PUB,
    StoreSegment.BAR_BREWERY,
    StoreSegment.BAR_COCKTAIL,
  ],
  [StoreSubcategory.BAKERY]: [
    StoreSegment.BAKERY_BREAD,
    StoreSegment.BAKERY_PASTRY,
    StoreSegment.BAKERY_DESSERT,
  ],
  [StoreSubcategory.FAST_FOOD]: [
    StoreSegment.FAST_BURGER,
    StoreSegment.FAST_PIZZA,
    StoreSegment.FAST_CHICKEN,
    StoreSegment.FAST_OTHER,
  ],
  [StoreSubcategory.FOOD_TRUCK]: [
    StoreSegment.TRUCK_FOOD,
    StoreSegment.TRUCK_CART,
  ],
  [StoreSubcategory.RETAIL]: [
    StoreSegment.RETAIL_FASHION,
    StoreSegment.RETAIL_BOUTIQUE,
    StoreSegment.RETAIL_MARKET,
    StoreSegment.RETAIL_OTHER,
  ],
  [StoreSubcategory.BEAUTY]: [
    StoreSegment.BEAUTY_HAIR,
    StoreSegment.BEAUTY_BARBER,
    StoreSegment.BEAUTY_SALON,
    StoreSegment.BEAUTY_SPA,
    StoreSegment.BEAUTY_NAILS,
    StoreSegment.BEAUTY_BROWS,
  ],
  [StoreSubcategory.HEALTH]: [
    StoreSegment.HEALTH_CLINIC,
    StoreSegment.HEALTH_AESTHETIC,
    StoreSegment.HEALTH_PHARMA,
    StoreSegment.HEALTH_GYM,
    StoreSegment.HEALTH_DENTAL,
  ],
  [StoreSubcategory.AUTO]: [
    StoreSegment.AUTO_SHOP,
    StoreSegment.AUTO_WASH,
    StoreSegment.AUTO_TIRES,
  ],
  [StoreSubcategory.EDUCATION]: [
    StoreSegment.EDU_ACADEMY,
    StoreSegment.EDU_LANGUAGE,
    StoreSegment.EDU_TUTOR,
  ],
  [StoreSubcategory.OTHER_SERVICE]: [
    StoreSegment.OTHER_PETS,
    StoreSegment.OTHER_CLEANING,
    StoreSegment.OTHER_GENERIC,
  ],
  [StoreSubcategory.HOTEL]: [
    StoreSegment.HOTEL_STANDARD,
    StoreSegment.HOTEL_BOUTIQUE,
  ],
  [StoreSubcategory.HOSTEL]: [StoreSegment.HOSTEL_STANDARD],
  [StoreSubcategory.VACATION_RENTAL]: [
    StoreSegment.STAY_CABIN,
    StoreSegment.STAY_GLAMPING,
    StoreSegment.STAY_APARTMENT,
  ],
  [StoreSubcategory.EVENT_VENUE]: [
    StoreSegment.VENUE_HALL,
    StoreSegment.VENUE_TERRACE,
  ],
};

export function defaultSegmentFor(
  subcategory: StoreSubcategory
): StoreSegment {
  return STORE_SEGMENTS_BY_SUBCATEGORY[subcategory][0];
}

export enum BillingStatus {
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
}

export interface PassDesignDto {
  id: string;
  storeId?: string | null;
  eventId?: string | null;
  backgroundColor: string;
  foregroundColor: string;
  labelColor?: string | null;
  logoUrl?: string | null;
  /** Banner horizontal opcional encima de los sellos (UI y Wallet). */
  stripImageUrl?: string | null;
  title: string;
  subtitle?: string | null;
  description?: string | null;
}

export interface StoreDto {
  id: string;
  name: string;
  slug: string;
  category: StoreCategory | string;
  subcategory: StoreSubcategory | string;
  segment?: StoreSegment | string | null;
  googlePlaceId?: string | null;
  address?: string | null;
  planType: PlanType | string;
  billingStatus: string;
  billingPeriod?: string | null;
  nextBillingAt?: string | null;
  whatsappUsed: number;
  freeMonthsBalance?: number;
  referralBonusApplied?: boolean;
  referralCode?: string;
  ownerName?: string;
  ownerEmail?: string | null;
  lat?: number | null;
  lng?: number | null;
  createdAt?: string;
}

export interface EventDto {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  status: EventStatus | string;
  globalTarget: number;
}

export interface UserDto {
  id: string;
  name: string;
  phone: string;
  createdAt?: string;
}

export interface PassDto {
  id: string;
  userId: string;
  storeId?: string | null;
  eventId?: string | null;
  serialNumber: string;
  points: number;
  user?: UserDto;
  design?: PassDesignDto | null;
}

export interface OndaCardDto {
  id: string;
  userId: string;
  serialNumber: string;
  memberName: string;
  totalPoints: number;
}

export interface RestaurantCardDto {
  storeId: string;
  storeName: string;
  points: number;
  design: PassDesignDto | null;
  rewards: PromotionDto[];
}

export interface TransactionDto {
  id: string;
  passId: string;
  storeId: string;
  type: TransactionType | string;
  points: number;
  createdAt: string;
}

export interface PromotionDto {
  id: string;
  storeId?: string | null;
  eventId?: string | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pointsRequired: number;
  isActive: boolean;
}

export interface FeedbackDto {
  id: string;
  userId: string;
  storeId: string;
  rating: number;
  comment?: string | null;
  redirectedToGoogle: boolean;
  createdAt: string;
}

export interface EnrollRequest {
  name: string;
  phone: string;
  storeId: string;
  eventId?: string;
  tableId?: string;
}

export interface EnrollResponse {
  user: UserDto;
  pass: PassDto;
  token: string;
}

export interface AccumulateRequest {
  passId: string;
  storeId: string;
  points?: number;
}

export interface RedeemRequest {
  passId: string;
  storeId: string;
  promotionId: string;
}

export interface LeadRequest {
  name: string;
  email: string;
  phone?: string;
  businessName?: string;
  message?: string;
}

export interface KpiSummary {
  ondasHoy: number;
  clientesNuevos: number;
  redenciones: number;
  whatsappUsed: number;
  whatsappLimit: number;
}

/** Ondas incluidas por mes en cualquier suscripción (BASIC o PRO). */
export const PLAN_ONDA_MONTHLY_LIMIT = 300;

/** Campañas SMS/Wallet incluidas gratis por mes (override API: CAMPAIGN_FREE_MONTHLY). */
export const PLAN_SMS_CAMPAIGNS_MONTHLY = 1;

/** Personas alcanzadas gratis al mes (todas las campañas). */
export const CAMPAIGN_FREE_REACH_MONTHLY = 30;

/** Precio por persona alcanzada fuera del cupo gratis (COP). */
export const CAMPAIGN_REACH_PRICE_COP = 200;

/** @deprecated Cobro legacy por campaña extra; usar CAMPAIGN_REACH_PRICE_COP */
export const CAMPAIGN_PRICE_COP = 29_900;

/** Tamaño del paquete (aprox. una por semana). */
export const CAMPAIGN_PACK_SIZE = 3;

/** Descuento del paquete de 3 (15%). */
export const CAMPAIGN_PACK_DISCOUNT = 0.15;

export type StoreMemberRole = 'ADMIN' | 'CAJA';
export type StoreMemberStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';
export type PosItemKind = 'PRODUCT' | 'SERVICE';
export type PosTabStatus = 'OPEN' | 'CHECKOUT' | 'PAID' | 'VOID';
export type PosSaleStatus =
  | 'COMPLETED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'VOID';
export type AccountingProvider = 'NONE' | 'ALEGRA' | 'SIIGO';

export interface StoreMemberDto {
  id: string;
  storeId: string;
  email: string;
  name: string;
  role: StoreMemberRole;
  status: StoreMemberStatus;
  invitedAt: string;
  acceptedAt?: string | null;
}

export interface TeamQuotaDto {
  planType: PlanType;
  cajaUsed: number;
  cajaMax: number;
  adminUsed: number;
  adminMax: number;
}

export interface PosAddonDto {
  id: string;
  storeId: string;
  name: string;
  price: number;
  isActive: boolean;
  sortOrder: number;
}

export interface PosItemVariantDto {
  id: string;
  itemId: string;
  name: string;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface PosItemDto {
  id: string;
  storeId: string;
  kind: PosItemKind;
  name: string;
  price: number;
  trackStock: boolean;
  stockQty: number | null;
  isActive: boolean;
  sortOrder: number;
  imageUrl?: string | null;
  variants?: PosItemVariantDto[];
  addons?: PosAddonDto[];
}

export interface PosTabLineAddonDto {
  id: string;
  addonId?: string | null;
  name: string;
  price: number;
}

export interface PosTabLineDto {
  id: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  variantId?: string | null;
  variantName?: string | null;
  addons?: PosTabLineAddonDto[];
  item?: PosItemDto;
}

export interface PosTabDto {
  id: string;
  storeId: string;
  label: string;
  status: PosTabStatus;
  guestName?: string | null;
  userId?: string | null;
  passId?: string | null;
  openedAt: string;
  checkoutAt?: string | null;
  lines: PosTabLineDto[];
  subtotal: number;
  total: number;
  customerName?: string | null;
  openedByMemberId?: string | null;
  attendedByMemberId?: string | null;
  attendedByName?: string | null;
}

export interface PosAttendantDto {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'CAJA';
}

export interface PosPaymentDto {
  id: string;
  methodKey: string;
  amount: number;
  cashReceived?: number | null;
  changeGiven?: number | null;
}

export interface PosSaleLineDto {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  variantName?: string | null;
  addons?: Array<{ id: string; name: string; price: number }>;
}

export interface PosSaleDto {
  id: string;
  storeId: string;
  tabId: string;
  passId?: string | null;
  subtotal: number;
  total: number;
  status: PosSaleStatus;
  completedAt: string;
  ondasGranted: number;
  payments: PosPaymentDto[];
  lines: PosSaleLineDto[];
}

export interface PosPaymentMethodDto {
  id: string;
  key: string;
  label: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PosSummaryDto {
  totalSales: number;
  transactionCount: number;
  averageTicket: number;
  byPaymentMethod: Array<{ methodKey: string; total: number }>;
  topItems: Array<{ itemId: string; name: string; quantity: number }>;
  topCustomers: Array<{
    passId: string | null;
    name: string;
    total: number;
    visits: number;
  }>;
  series: Array<{
    date: string;
    ventas: number;
    transacciones: number;
    ondas: number;
  }>;
  refundsTotal: number;
  ondasGranted: number;
  insights: string[];
}

export interface MerchantStoreAccess {
  id: string;
  name: string;
  role: StoreMemberRole;
  memberName: string;
}
