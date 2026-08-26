export type LoyaltyRewardHint = {
  title: string;
  pointsRequired: number;
  ready: boolean;
};

const SMS_MAX = 160;

function clipTitle(title: string, max: number) {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(1, max - 1))}…`;
}

export function pickLoyaltyReward(input: {
  points: number;
  rewards: Array<{
    title: string;
    pointsRequired: number;
    promotionId?: string;
    id?: string;
    isActive?: boolean;
  }>;
  claimedPromotionIds?: Iterable<string>;
}): LoyaltyRewardHint | null {
  const claimed = new Set(input.claimedPromotionIds || []);
  const rewards = input.rewards
    .filter((r) => r.isActive !== false)
    .sort((a, b) => a.pointsRequired - b.pointsRequired);
  const ready = rewards.find((r) => {
    const id = r.promotionId || r.id;
    return input.points >= r.pointsRequired && (!id || !claimed.has(id));
  });
  if (ready) {
    return {
      title: ready.title,
      pointsRequired: ready.pointsRequired,
      ready: true,
    };
  }
  const next = rewards.find((r) => input.points < r.pointsRequired);
  if (next) {
    return {
      title: next.title,
      pointsRequired: next.pointsRequired,
      ready: false,
    };
  }
  return null;
}

/** Copy del header del pase (UI y Wallet). */
export function loyaltyProgressCopy(
  points: number,
  maxStamps: number,
  reward?: LoyaltyRewardHint | null,
  opts?: { clipTitle?: number }
): { fieldLabel: 'PREMIO' | 'SIGUIENTE'; value: string } {
  const cap = opts?.clipTitle ?? 42;
  if (reward?.ready) {
    return {
      fieldLabel: 'PREMIO',
      value: clipTitle(reward.title, cap),
    };
  }
  if (reward) {
    const remaining = Math.max(0, reward.pointsRequired - points);
    const title = clipTitle(reward.title, Math.min(28, cap));
    return {
      fieldLabel: 'SIGUIENTE',
      value:
        remaining === 1
          ? `Te falta 1 onda para ${title}`
          : `Te faltan ${remaining} ondas para ${title}`,
    };
  }
  const remaining = Math.max(0, maxStamps - points);
  if (remaining === 0) {
    return { fieldLabel: 'PREMIO', value: '¡Listo para canjear!' };
  }
  return {
    fieldLabel: 'SIGUIENTE',
    value:
      remaining === 1 ? 'Te falta 1 onda' : `Te faltan ${remaining} ondas`,
  };
}

/** SMS al registrarse en un negocio: promos por onda + fecha límite (máx. 160 chars). */
export function buildEnrollmentSmsMessage(input: {
  storeName: string;
  rewards: Array<{ title: string; pointsRequired: number }>;
  endsAt?: Date | string | null;
  welcomePoints?: number;
}): string {
  const store = clipTitle(input.storeName, 32);
  const deadline = input.endsAt
    ? ` Hasta el ${formatSmsDeadline(input.endsAt)}.`
    : '';
  const welcome =
    input.welcomePoints && input.welcomePoints > 0
      ? ` Tienes ${input.welcomePoints} onda${input.welcomePoints === 1 ? '' : 's'}.`
      : '';

  const sorted = [...input.rewards]
    .filter((r) => r.title?.trim())
    .sort((a, b) => a.pointsRequired - b.pointsRequired);

  const head = `${store}:${welcome}`;
  let budget = SMS_MAX - head.length - deadline.length - (sorted.length ? 1 : 0);

  const parts: string[] = [];
  for (const reward of sorted) {
    const title = clipTitle(reward.title, 22);
    const part = `O${reward.pointsRequired} ${title}`;
    const sep = parts.length ? ', ' : ' ';
    if (sep.length + part.length > budget) break;
    parts.push(part);
    budget -= sep.length + part.length;
  }

  const promos =
    parts.length > 0
      ? ` ${parts.join(', ')}.`
      : sorted.length === 0
        ? ' Tu cartilla Onda está lista.'
        : ' Consulta tus premios en Wallet.';

  return `${head}${promos}${deadline}`.slice(0, SMS_MAX);
}

function formatSmsDeadline(input: Date | string): string {
  const key =
    typeof input === 'string' ? input.slice(0, 10) : input.toISOString().slice(0, 10);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d)
    .toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
    .replace('.', '');
}
