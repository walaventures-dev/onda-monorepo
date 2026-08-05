import type { OndaCardDto, RestaurantCardDto, PromotionDto } from '@onda/shared-types';
import { getPortalSession, type PortalSession } from './mockAuth';

export type CatalogReward = PromotionDto & { storeName: string };

const MOCK_RESTAURANT_CARDS: RestaurantCardDto[] = [
  {
    storeId: 'store-aa',
    storeName: 'Restaurante AA',
    points: 1,
    design: {
      id: 'design-aa',
      storeId: 'store-aa',
      eventId: null,
      backgroundColor: '#3DB9E8',
      foregroundColor: '#FFFFFF',
      labelColor: '#E5F6FC',
      logoUrl: null,
      stripImageUrl: null,
      title: 'Restaurante AA',
      subtitle: 'Onda Rewards',
      description: null,
    },
    rewards: [
      {
        id: 'promo-aa-1',
        storeId: 'store-aa',
        eventId: null,
        title: 'Café gratis',
        description: 'Canjea 5 ondas por un café',
        imageUrl: null,
        pointsRequired: 5,
        isActive: true,
      },
    ],
  },
  {
    storeId: 'store-bb',
    storeName: 'Restaurante BB',
    points: 1,
    design: {
      id: 'design-bb',
      storeId: 'store-bb',
      eventId: null,
      backgroundColor: '#6E5AE6',
      foregroundColor: '#FFFFFF',
      labelColor: '#EEEAFF',
      logoUrl: null,
      stripImageUrl: null,
      title: 'Restaurante BB',
      subtitle: 'Onda Rewards',
      description: null,
    },
    rewards: [
      {
        id: 'promo-bb-1',
        storeId: 'store-bb',
        eventId: null,
        title: 'Postre gratis',
        description: 'Canjea 8 ondas por un postre',
        imageUrl: null,
        pointsRequired: 8,
        isActive: true,
      },
    ],
  },
];

// Cuenta existente (Dante): ya tiene ondas en los restaurantes demo AA y BB.
const PERSONA_RESTAURANTS: Record<string, RestaurantCardDto[]> = {
  '+573202331295': MOCK_RESTAURANT_CARDS,
};

// Cuenta nueva: simula que se creó escaneando el QR de Restaurante AA,
// que le acredita el bono de bienvenida de 1 onda ahí.
function restaurantsForSession(session: PortalSession | null): RestaurantCardDto[] {
  if (!session) return [];
  if (session.isNew) return [MOCK_RESTAURANT_CARDS[0]];
  return PERSONA_RESTAURANTS[session.phone] ?? [];
}

export async function getOndaCard(): Promise<OndaCardDto> {
  const session = getPortalSession();
  const cards = restaurantsForSession(session);
  const totalPoints = cards.reduce((sum, c) => sum + c.points, 0);
  return {
    id: 'mock-onda-card-1',
    userId: 'mock-user-1',
    serialNumber: 'ONDA-DEMO0001',
    memberName: session?.name || 'Cliente Onda',
    totalPoints,
  };
}

export async function getRestaurantCards(): Promise<RestaurantCardDto[]> {
  return restaurantsForSession(getPortalSession());
}

export async function getRewardsCatalog(): Promise<CatalogReward[]> {
  return MOCK_RESTAURANT_CARDS.flatMap((c) =>
    c.rewards.map((r) => ({ ...r, storeName: c.storeName }))
  );
}
