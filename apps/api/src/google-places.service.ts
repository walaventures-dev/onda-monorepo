import { Inject, Injectable, Logger } from '@nestjs/common';
import { GooglePlaceSnapshotSource, Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type PlacePreview = {
  googlePlaceId: string;
  rating: number | null;
  reviewCount: number | null;
  mapsUrl: string;
};

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  private apiKey() {
    return (
      process.env.GOOGLE_PLACES_API_KEY?.trim() ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
      ''
    );
  }

  async fetchPlacePreview(googlePlaceId: string): Promise<PlacePreview> {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(
      googlePlaceId
    )}`;
    const key = this.apiKey();
    if (!key) {
      this.logger.warn('[Google Places stub] sin API key');
      return { googlePlaceId, rating: null, reviewCount: null, mapsUrl };
    }

    try {
      const url = new URL(
        'https://maps.googleapis.com/maps/api/place/details/json'
      );
      url.searchParams.set('place_id', googlePlaceId);
      url.searchParams.set('fields', 'rating,user_ratings_total');
      url.searchParams.set('language', 'es');
      url.searchParams.set('key', key);

      const res = await fetch(url.toString());
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        status?: string;
        result?: { rating?: number; user_ratings_total?: number };
      };
      if (data.status !== 'OK' || !data.result) {
        this.logger.warn(
          `Place Details ${googlePlaceId}: ${data.status || 'UNKNOWN'}`
        );
        return { googlePlaceId, rating: null, reviewCount: null, mapsUrl };
      }
      return {
        googlePlaceId,
        rating:
          typeof data.result.rating === 'number' ? data.result.rating : null,
        reviewCount:
          typeof data.result.user_ratings_total === 'number'
            ? data.result.user_ratings_total
            : null,
        mapsUrl,
      };
    } catch (err) {
      this.logger.warn(
        `Place Details falló para ${googlePlaceId}: ${
          err instanceof Error ? err.message : err
        }`
      );
      return { googlePlaceId, rating: null, reviewCount: null, mapsUrl };
    }
  }

  async saveSnapshot(
    storeId: string,
    googlePlaceId: string,
    source: GooglePlaceSnapshotSource,
    preview?: PlacePreview,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || this.prisma;
    const data =
      preview || (await this.fetchPlacePreview(googlePlaceId));
    const snapshot = await client.googlePlaceSnapshot.create({
      data: {
        storeId,
        googlePlaceId,
        rating: data.rating,
        reviewCount: data.reviewCount,
        source,
      },
    });
    await client.store.update({
      where: { id: storeId },
      data: {
        googleRating: data.rating,
        googleReviewCount: data.reviewCount,
        googleRatingUpdatedAt: new Date(),
      },
    });
    return snapshot;
  }

  async refreshStoreSnapshot(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store?.googlePlaceId) return null;
    return this.saveSnapshot(
      storeId,
      store.googlePlaceId,
      GooglePlaceSnapshotSource.CRON
    );
  }

  async refreshAllProStores() {
    const stores = await this.prisma.store.findMany({
      where: {
        planType: 'PRO',
        googlePlaceId: { not: null },
      },
      select: { id: true, googlePlaceId: true },
    });
    let updated = 0;
    for (const store of stores) {
      if (!store.googlePlaceId) continue;
      try {
        await this.saveSnapshot(
          store.id,
          store.googlePlaceId,
          GooglePlaceSnapshotSource.CRON
        );
        updated++;
      } catch (err) {
        this.logger.warn(
          `Cron snapshot ${store.id}: ${
            err instanceof Error ? err.message : err
          }`
        );
      }
    }
    return { updated, total: stores.length };
  }

  async googleComparison(storeId: string) {
    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return null;

    const snapshots = await this.prisma.googlePlaceSnapshot.findMany({
      where: { storeId },
      orderBy: { fetchedAt: 'asc' },
    });
    const baseline =
      snapshots.find((s) => s.source === GooglePlaceSnapshotSource.ONBOARDING) ||
      snapshots[0] ||
      null;
    const latest = snapshots[snapshots.length - 1] || null;

    return {
      ratingBefore: baseline?.rating ?? null,
      ratingNow: store.googleRating ?? latest?.rating ?? null,
      reviewsBefore: baseline?.reviewCount ?? null,
      reviewsNow: store.googleReviewCount ?? latest?.reviewCount ?? null,
      baselineAt: baseline?.fetchedAt?.toISOString() ?? null,
      updatedAt: store.googleRatingUpdatedAt?.toISOString() ?? null,
    };
  }
}
