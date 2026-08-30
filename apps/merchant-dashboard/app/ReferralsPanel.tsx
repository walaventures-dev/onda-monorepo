'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  GradientButton,
  OndaIcons,
  SkeletonDashboard,
  toast,
} from '@onda/shared-ui';
import { formatDateEs } from '@onda/shared-utils';

type FreeMonthCredit = {
  id: string;
  type: 'WELCOME' | 'REFERRAL';
  label: string;
  months: number;
  earnedAt: string;
  storeId?: string;
  slug?: string;
};

type ReferralSummary = {
  storeId: string;
  storeName: string;
  storeCreatedAt?: string;
  referralCode: string;
  freeMonthsBalance: number;
  freeMonthsBreakdown: {
    welcome: number;
    fromReferrals: number;
    total: number;
  };
  freeMonthCredits: FreeMonthCredit[];
  referredStores: Array<{
    id: string;
    name: string;
    createdAt: string;
    slug: string;
  }>;
};

type CalendarCell = {
  key: string;
  year: number;
  monthIndex: number;
  phase: 'past' | 'current' | 'future';
  credit?: {
    type: 'WELCOME' | 'REFERRAL';
    label: string;
    slug?: string;
  };
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthShort(monthIndex: number) {
  const label = new Date(2024, monthIndex, 1).toLocaleDateString('es-CO', {
    month: 'short',
  });
  return label.replace('.', '').slice(0, 3).toUpperCase();
}

/** Link público de referido: landing /unirse/CODIGO → merchant onboarding. */
function buildReferralInviteUrl(referralCode: string) {
  const code = encodeURIComponent(referralCode.trim().toUpperCase());
  const landing = (
    process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:4200'
  ).replace(/\/$/, '');
  return `${landing}/unirse/${code}`;
}

function buildFreeMonthCalendar(
  storeCreatedAt: string,
  credits: FreeMonthCredit[],
  now = new Date()
): CalendarCell[] {
  const start = startOfMonth(new Date(storeCreatedAt));
  const today = startOfMonth(now);
  const assigned = new Map<
    string,
    { type: 'WELCOME' | 'REFERRAL'; label: string; slug?: string }
  >();

  let cursor = start;
  for (const credit of credits) {
    for (let i = 0; i < credit.months; i++) {
      assigned.set(monthKey(cursor), {
        type: credit.type,
        label: credit.label,
        slug: credit.slug,
      });
      cursor = addMonths(cursor, 1);
    }
  }

  const lastAssigned =
    assigned.size > 0 ? addMonths(cursor, -1) : addMonths(start, -1);
  const spanEnd = lastAssigned > today ? lastAssigned : today;
  const end = addMonths(spanEnd, assigned.size > 0 ? 1 : 2);

  const cells: CalendarCell[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addMonths(d, 1)) {
    const key = monthKey(d);
    const credit = assigned.get(key);
    const phase: CalendarCell['phase'] =
      d.getTime() < today.getTime()
        ? 'past'
        : d.getTime() === today.getTime()
          ? 'current'
          : 'future';
    cells.push({
      key,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      phase,
      credit,
    });
  }
  return cells;
}

function isLocalhost() {
  if (typeof window === 'undefined') return false;
  return (
    process.env.NODE_ENV === 'development' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d;
}

function mockReferrals(): ReferralSummary {
  const created = monthsAgo(4);
  const stores = [
    {
      id: 'mock-r1',
      name: 'Café La Esquina',
      createdAt: monthsAgo(3).toISOString(),
      slug: 'cafe-la-esquina',
    },
    {
      id: 'mock-r2',
      name: 'Panadería El Sol',
      createdAt: monthsAgo(2).toISOString(),
      slug: 'panaderia-el-sol',
    },
    {
      id: 'mock-r3',
      name: 'Barra Norte',
      createdAt: monthsAgo(1).toISOString(),
      slug: 'barra-norte',
    },
    {
      id: 'mock-r4',
      name: 'Heladería Río',
      createdAt: monthsAgo(0).toISOString(),
      slug: 'heladeria-rio',
    },
    {
      id: 'mock-r5',
      name: 'Tacos del Parque',
      createdAt: new Date().toISOString(),
      slug: 'tacos-del-parque',
    },
  ];
  return {
    storeId: 'mock',
    storeName: 'Demo',
    storeCreatedAt: created.toISOString(),
    referralCode: 'ONDA-DEMO',
    freeMonthsBalance: 6,
    freeMonthsBreakdown: { welcome: 1, fromReferrals: 5, total: 6 },
    freeMonthCredits: [
      {
        id: 'welcome',
        type: 'WELCOME',
        label: 'Mes de bienvenida',
        months: 1,
        earnedAt: created.toISOString(),
      },
      ...stores.map((s) => ({
        id: s.id,
        type: 'REFERRAL' as const,
        label: s.name,
        months: 1,
        earnedAt: s.createdAt,
        storeId: s.id,
        slug: s.slug,
      })),
    ],
    referredStores: stores,
  };
}

function groupByYear(cells: CalendarCell[]) {
  const groups: Array<{ year: number; cells: CalendarCell[] }> = [];
  for (const cell of cells) {
    const last = groups[groups.length - 1];
    if (!last || last.year !== cell.year) {
      groups.push({ year: cell.year, cells: [cell] });
    } else {
      last.cells.push(cell);
    }
  }
  return groups;
}

function LocalMockButton({
  mockOn,
  onToggle,
}: {
  mockOn: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-full border border-dashed border-[var(--onda-bridge)] bg-[var(--onda-primary-50)] px-4 py-2 text-xs font-semibold text-[var(--onda-primary-700)] hover:bg-[var(--onda-primary-100)]"
    >
      {mockOn ? 'Quitar simulación' : 'Simular datos (local)'}
    </button>
  );
}

export function ReferralsPanel({ storeId }: { storeId: string }) {
  const [data, setData] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [error, setError] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mockOn, setMockOn] = useState(false);
  const [isLocalDev, setIsLocalDev] = useState(false);
  const loadSeq = useRef(0);

  const inviteLink = data?.referralCode
    ? buildReferralInviteUrl(data.referralCode)
    : '';

  useEffect(() => {
    setIsLocalDev(isLocalhost());
  }, []);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    if (mockOn) {
      setData(mockReferrals());
      setError('');
      setLoading(false);
      return;
    }
    if (!storeId) return;
    setLoading(true);
    setError('');
    try {
      const next = await api<ReferralSummary>(`/referrals/store/${storeId}`);
      if (seq !== loadSeq.current) return;
      setData(next);
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      setError(err?.message || 'No se pudo cargar referidos');
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [storeId, mockOn]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleMock() {
    setMockOn((on) => {
      const next = !on;
      toast(
        next
          ? 'Datos demo de referidos (solo local)'
          : 'Volviste a los datos reales'
      );
      return next;
    });
  }

  async function copy(text: string, kind: 'code' | 'link') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* ignore */
    }
  }

  async function share() {
    if (!data || !inviteLink) return;
    if (navigator.share) {
      try {
        // Solo `url` limpia: meter el link en `text` contamina el path en WhatsApp/iOS.
        await navigator.share({
          title: 'Únete a Onda',
          text: 'Regístrate en Onda y empieza con 1 mes gratis.',
          url: inviteLink,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await copy(inviteLink, 'link');
  }

  const mockBtn = isLocalDev ? (
    <LocalMockButton mockOn={mockOn} onToggle={toggleMock} />
  ) : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <header className="space-y-1">
            <h2 className="font-display text-2xl font-semibold">Referidos</h2>
          </header>
          {mockBtn}
        </div>
        <SkeletonDashboard kpis={3} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <header className="space-y-1">
            <h2 className="font-display text-2xl font-semibold">Referidos</h2>
          </header>
          {mockBtn}
        </div>
        <p className="text-sm text-[var(--onda-danger)]">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const breakdown = data.freeMonthsBreakdown || {
    welcome: Math.max(0, data.freeMonthsBalance - data.referredStores.length),
    fromReferrals: data.referredStores.length,
    total: data.freeMonthsBalance,
  };

  const credits: FreeMonthCredit[] =
    data.freeMonthCredits ||
    [
      ...(breakdown.welcome > 0
        ? [
            {
              id: 'welcome',
              type: 'WELCOME' as const,
              label: 'Mes de bienvenida',
              months: breakdown.welcome,
              earnedAt: new Date().toISOString(),
            },
          ]
        : []),
      ...data.referredStores.map((s) => ({
        id: s.id,
        type: 'REFERRAL' as const,
        label: s.name,
        months: 1,
        earnedAt: s.createdAt,
        storeId: s.id,
        slug: s.slug,
      })),
    ];

  const storeCreatedAt =
    data.storeCreatedAt ||
    credits.find((c) => c.type === 'WELCOME')?.earnedAt ||
    credits[0]?.earnedAt ||
    new Date().toISOString();

  const calendar = buildFreeMonthCalendar(storeCreatedAt, credits);
  const years = groupByYear(calendar);
  const selected =
    calendar.find((c) => c.key === selectedKey) ||
    calendar.find((c) => c.phase === 'current') ||
    calendar.find((c) => c.credit) ||
    null;

  const pastFree = calendar.filter((c) => c.credit && c.phase === 'past').length;
  const futureFree = calendar.filter(
    (c) => c.credit && (c.phase === 'future' || c.phase === 'current')
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <header className="space-y-1">
          <h2 className="font-display text-2xl font-semibold">Referidos</h2>
          <p className="text-sm text-[var(--onda-muted)]">
            Tu calendario de meses gratis: lo que ya disfrutaste y lo que viene por
            cada referido.
          </p>
        </header>
        {mockBtn}
      </div>

      <section className="onda-card overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
              Meses gratis
            </p>
            <p className="mt-1 font-display text-4xl font-semibold tabular-nums text-[var(--onda-ink)]">
              {breakdown.total}
              <span className="ml-2 text-base font-medium text-[var(--onda-muted)]">
                {breakdown.total === 1 ? 'mes' : 'meses'}
              </span>
            </p>
            <p className="mt-2 text-xs text-[var(--onda-muted)]">
              {pastFree > 0 ? `${pastFree} ya disfrutados` : 'Aún en curso'}
              {futureFree > 0 ? ` · ${futureFree} por delante` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-sky-soft)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)]">
              <span className="h-2 w-2 rounded-full bg-[var(--onda-sky)]" />
              {breakdown.welcome} bienvenida
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-violet-soft)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)]">
              <span className="h-2 w-2 rounded-full bg-[var(--onda-violet)]" />
              {breakdown.fromReferrals} por referidos
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--onda-border)] pt-4 text-xs text-[var(--onda-muted)]">
          <span className="inline-flex items-center gap-1.5">
            {OndaIcons.calendar}
            Calendario
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[var(--onda-sky)]" />
            Bienvenida
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[var(--onda-violet)]" />
            Referido
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-[var(--onda-border)] bg-[var(--onda-bg)]" />
            Sin mes gratis
          </span>
        </div>

        <div className="mt-5 space-y-6">
          {years.map(({ year, cells }) => (
            <div key={year}>
              <p className="mb-3 font-display text-sm font-semibold text-[var(--onda-ink)]">
                {year}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {cells.map((cell) => {
                  const isWelcome = cell.credit?.type === 'WELCOME';
                  const isReferral = cell.credit?.type === 'REFERRAL';
                  const isFree = Boolean(cell.credit);
                  const isSelected = selected?.key === cell.key;
                  const isPastFree = isFree && cell.phase === 'past';
                  const isCurrent = cell.phase === 'current';

                  let cellClass =
                    'border-[var(--onda-border)] bg-[var(--onda-bg)] text-[var(--onda-muted)]';
                  if (isWelcome) {
                    cellClass = isPastFree
                      ? 'border-[var(--onda-sky)]/40 bg-[var(--onda-sky)] text-white'
                      : 'border-[var(--onda-sky)]/35 bg-[var(--onda-sky-soft)] text-[var(--onda-ink)]';
                  } else if (isReferral) {
                    cellClass = isPastFree
                      ? 'border-[var(--onda-violet)]/40 bg-[var(--onda-violet)] text-white'
                      : 'border-[var(--onda-violet)]/30 bg-[var(--onda-violet-soft)] text-[var(--onda-ink)]';
                  }

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      onClick={() => setSelectedKey(cell.key)}
                      className={`relative flex min-h-[5.5rem] flex-col items-start justify-between rounded-2xl border p-3 text-left transition ${cellClass} ${
                        isSelected
                          ? 'ring-2 ring-[var(--onda-violet)] ring-offset-2 ring-offset-[var(--onda-card)]'
                          : ''
                      } ${isCurrent && !isSelected ? 'ring-2 ring-[var(--onda-ink)]/15' : ''} ${
                        !isFree ? 'border-dashed' : ''
                      }`}
                      aria-pressed={isSelected}
                      aria-label={`${monthShort(cell.monthIndex)} ${cell.year}${
                        cell.credit
                          ? `, gratis por ${cell.credit.label}`
                          : ', sin mes gratis'
                      }`}
                    >
                      <div className="flex w-full items-start justify-between gap-1">
                        <span className="font-display text-sm font-semibold tracking-wide">
                          {monthShort(cell.monthIndex)}
                        </span>
                        {isCurrent ? (
                          <span className="rounded-full bg-[var(--onda-ink)]/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--onda-ink)]">
                            Hoy
                          </span>
                        ) : isPastFree ? (
                          <span className="text-xs opacity-90" aria-hidden>
                            ✓
                          </span>
                        ) : null}
                      </div>

                      <div className="w-full">
                        {isFree ? (
                          <>
                            <p
                              className={`text-[10px] font-semibold uppercase tracking-[0.08em] ${
                                isPastFree ? 'text-white/80' : 'text-[var(--onda-muted)]'
                              }`}
                            >
                              {isWelcome ? 'Bienvenida' : 'Referido'}
                            </p>
                            <p
                              className={`mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug ${
                                isPastFree ? 'text-white' : 'text-[var(--onda-ink)]'
                              }`}
                            >
                              {isWelcome ? 'Alta en Onda' : cell.credit?.label}
                            </p>
                          </>
                        ) : (
                          <p className="text-[11px] leading-snug">
                            Sin mes gratis
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {selected ? (
          <div className="mt-5 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--onda-muted)]">
              {monthShort(selected.monthIndex)} {selected.year}
              {selected.phase === 'current'
                ? ' · mes actual'
                : selected.phase === 'past'
                  ? ' · ya pasó'
                  : ' · por venir'}
            </p>
            {selected.credit ? (
              <p className="mt-1 text-sm text-[var(--onda-ink)]">
                Mes gratis por{' '}
                <span className="font-semibold">
                  {selected.credit.type === 'WELCOME'
                    ? 'bienvenida'
                    : selected.credit.label}
                </span>
                {selected.credit.slug ? (
                  <span className="text-[var(--onda-muted)]">
                    {' '}
                    (/{selected.credit.slug})
                  </span>
                ) : null}
                .
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--onda-muted)]">
                Este mes no es gratis. Comparte tu link para sumar otro mes al
                calendario.
              </p>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={share}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3 text-sm font-medium text-[var(--onda-ink)] transition hover:border-[var(--onda-violet)]/40 hover:bg-[var(--onda-violet-soft)]"
        >
          {OndaIcons.plus}
          Suma otro mes al calendario
        </button>
      </section>

      <div className="onda-card space-y-4 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--onda-muted)]">
            Tu código
          </p>
          <p className="mt-1 font-display text-2xl font-semibold tracking-widest">
            {data.referralCode}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GradientButton
            type="button"
            onClick={() => copy(data.referralCode, 'code')}
          >
            {OndaIcons.copy}
            {copied === 'code' ? 'Copiado' : 'Copiar código'}
          </GradientButton>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-2 text-sm font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
            onClick={() => copy(inviteLink, 'link')}
          >
            {OndaIcons.copy}
            {copied === 'link' ? 'Link copiado' : 'Copiar link'}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-2 text-sm font-medium text-[var(--onda-ink)] hover:bg-[var(--onda-bg)]"
            onClick={share}
          >
            {OndaIcons.users}
            Compartir
          </button>
        </div>
        {inviteLink ? (
          <p className="break-all text-xs text-[var(--onda-muted)]">
            {inviteLink}
          </p>
        ) : null}
      </div>

      <div className="onda-card p-5">
        <h3 className="font-display text-lg font-semibold">
          Negocios que empezaron contigo
        </h3>
        {data.referredStores.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--onda-muted)]">
            Aún no hay referidos. Cuando alguien se registre con tu código,
            su mes aparecerá en el calendario.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {data.referredStores.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-3"
              >
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]">
                  <span className="font-display text-sm font-bold leading-none">
                    +1
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-wide">
                    mes
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[var(--onda-ink)]">
                    {s.name}
                  </p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    /{s.slug} · {formatDateEs(s.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-[var(--onda-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--onda-violet)] ring-1 ring-[var(--onda-violet)]/20">
                  Referido #{data.referredStores.length - i}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
