import type { RestaurantCardDto } from '@onda/shared-types';

export function RestaurantCardList({ cards }: { cards: RestaurantCardDto[] }) {
  if (!cards.length) {
    return (
      <p className="text-[var(--onda-muted)]">
        Aún no tienes ondas en ningún restaurante.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <div
          key={c.storeId}
          className="onda-card flex items-center justify-between gap-3 px-4 py-3.5"
          style={{ borderLeft: `4px solid ${c.design?.backgroundColor || 'var(--onda-violet)'}` }}
        >
          <div className="min-w-0">
            <p className="font-semibold text-[var(--onda-ink)]">{c.storeName}</p>
            <p className="text-xs text-[var(--onda-muted)]">
              {c.rewards.length} recompensa{c.rewards.length === 1 ? '' : 's'} disponible
              {c.rewards.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-[var(--onda-ink)]">{c.points}</p>
            <p className="text-[10px] uppercase tracking-wide text-[var(--onda-muted)]">ondas</p>
          </div>
        </div>
      ))}
    </div>
  );
}
