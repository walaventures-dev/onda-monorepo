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

export enum StoreCategory {
  RESTAURANT = 'RESTAURANT',
  SERVICE = 'SERVICE',
  HOSPITALITY = 'HOSPITALITY',
}

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
  googlePlaceId?: string | null;
  address?: string | null;
  planType: PlanType | string;
  billingStatus: string;
  whatsappUsed: number;
  freeMonthsBalance?: number;
  referralCode?: string;
  ownerName?: string;
  ownerEmail?: string | null;
  pinCode?: string;
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
  pinCode: string;
  points?: number;
}

export interface RedeemRequest {
  passId: string;
  storeId: string;
  pinCode: string;
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

export const PLAN_WHATSAPP_LIMITS: Record<PlanType, number> = {
  [PlanType.BASIC]: 150,
  [PlanType.PRO]: 350,
};

export const WHATSAPP_OVERAGE_COP = 150;
