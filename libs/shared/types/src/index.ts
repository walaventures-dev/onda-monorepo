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
  category: StoreCategory | string;
  googlePlaceId?: string | null;
  planType: PlanType | string;
  billingStatus: string;
  whatsappUsed: number;
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
