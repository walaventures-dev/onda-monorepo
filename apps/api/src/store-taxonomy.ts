/** Taxonomy helpers for store category/subcategory (kept local so API build needs no path rewrite). */

export const STORE_SUBCATEGORIES_BY_CATEGORY: Record<string, string[]> = {
  RESTAURANT: [
    'CAFE',
    'RESTAURANT_FULL',
    'BAR',
    'BAKERY',
    'FAST_FOOD',
    'FOOD_TRUCK',
  ],
  SERVICE: [
    'RETAIL',
    'BEAUTY',
    'HEALTH',
    'AUTO',
    'EDUCATION',
    'OTHER_SERVICE',
  ],
  HOSPITALITY: ['HOTEL', 'HOSTEL', 'VACATION_RENTAL', 'EVENT_VENUE'],
};

export const STORE_SEGMENTS_BY_SUBCATEGORY: Record<string, string[]> = {
  CAFE: ['CAFE_COFFEE', 'CAFE_SPECIALTY', 'CAFE_ROASTERY'],
  RESTAURANT_FULL: ['REST_CASUAL', 'REST_FINE', 'REST_TRADITIONAL', 'REST_SEAFOOD'],
  BAR: ['BAR_PUB', 'BAR_BREWERY', 'BAR_COCKTAIL'],
  BAKERY: ['BAKERY_BREAD', 'BAKERY_PASTRY', 'BAKERY_DESSERT'],
  FAST_FOOD: ['FAST_BURGER', 'FAST_PIZZA', 'FAST_CHICKEN', 'FAST_OTHER'],
  FOOD_TRUCK: ['TRUCK_FOOD', 'TRUCK_CART'],
  RETAIL: ['RETAIL_FASHION', 'RETAIL_BOUTIQUE', 'RETAIL_MARKET', 'RETAIL_OTHER'],
  BEAUTY: [
    'BEAUTY_HAIR',
    'BEAUTY_BARBER',
    'BEAUTY_SALON',
    'BEAUTY_SPA',
    'BEAUTY_NAILS',
    'BEAUTY_BROWS',
  ],
  HEALTH: [
    'HEALTH_CLINIC',
    'HEALTH_AESTHETIC',
    'HEALTH_PHARMA',
    'HEALTH_GYM',
    'HEALTH_DENTAL',
  ],
  AUTO: ['AUTO_SHOP', 'AUTO_WASH', 'AUTO_TIRES'],
  EDUCATION: ['EDU_ACADEMY', 'EDU_LANGUAGE', 'EDU_TUTOR'],
  OTHER_SERVICE: ['OTHER_PETS', 'OTHER_CLEANING', 'OTHER_GENERIC'],
  HOTEL: ['HOTEL_STANDARD', 'HOTEL_BOUTIQUE'],
  HOSTEL: ['HOSTEL_STANDARD'],
  VACATION_RENTAL: ['STAY_CABIN', 'STAY_GLAMPING', 'STAY_APARTMENT'],
  EVENT_VENUE: ['VENUE_HALL', 'VENUE_TERRACE'],
};

export function normalizeStoreSlug(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function isSubcategoryOfCategory(
  category: string,
  subcategory: string
): boolean {
  const list = STORE_SUBCATEGORIES_BY_CATEGORY[category] || [];
  return list.includes(subcategory);
}

export function isSegmentOfSubcategory(
  subcategory: string,
  segment: string
): boolean {
  const list = STORE_SEGMENTS_BY_SUBCATEGORY[subcategory] || [];
  return list.includes(segment);
}

export function defaultSegmentFor(subcategory: string): string | undefined {
  return STORE_SEGMENTS_BY_SUBCATEGORY[subcategory]?.[0];
}

export function generateReferralCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
