'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GradientButton,
  api,
  toast,
  OndaIcons,
  SkeletonList,
} from '@onda/shared-ui';
import { formatCop, type CampaignPromo, type ObjectiveKind } from '@onda/shared-utils';

type Recommendation = {
  id: string;
  objective: ObjectiveKind;
  reason: string;
  title: string;
  audienceCount: number;
  promo: CampaignPromo;
  slowWindow?: string;
  cartillaId?: string;
};

type CampaignRow = {
  id: string;
  title: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED';
  origin: 'MANUAL' | 'RECOMMENDED';
  objective: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  sendSms: boolean;
  sendWallet: boolean;
  createdAt: string;
};

type CampaignPricing = {
  freeMonthly: number;
  unitCop: number;
  packSize: number;
  packDiscount: number;
  packCop: number;
};

type CampaignsList = {
  campaigns: CampaignRow[];
  smsCampaignsUsed: number;
  smsCampaignsLimit: number;
  freeRemaining: number;
  campaignCredits: number;
  packSubscribed: boolean;
  hasPaymentMethod: boolean;
  pricing: CampaignPricing;
};

const STATUS_LABEL: Record<CampaignRow['status'], string> = {
  DRAFT: 'Borrador',
  SCHEDULED: 'Programada',
  SENT: 'Enviada',
  CANCELLED: 'Cancelada',
  FAILED: 'Falló',
};

export function CampaignsHome({
  storeId,
  confirm,
}: {
  storeId: string;
  confirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    tone?: 'default' | 'danger' | 'accent';
  }) => Promise<boolean>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [sku, setSku] = useState<'single' | 'pack' | 'subscribe'>('pack');
  const [pendingPath, setPendingPath] = useState('/campanas/nueva');
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [quota, setQuota] = useState<Omit<CampaignsList, 'campaigns'> | null>(null);

  const applyList = (list: CampaignsList) => {
    setCampaigns(list.campaigns || []);
    setQuota({
      smsCampaignsUsed: list.smsCampaignsUsed ?? 0,
      smsCampaignsLimit: list.smsCampaignsLimit ?? 1,
      freeRemaining: list.freeRemaining ?? 0,
      campaignCredits: list.campaignCredits ?? 0,
      packSubscribed: Boolean(list.packSubscribed),
      hasPaymentMethod: Boolean(list.hasPaymentMethod),
      pricing: list.pricing,
    });
  };

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [list, rec] = await Promise.all([
        api<CampaignsList>(`/campaigns?storeId=${storeId}`),
        api<{ recommendations: Recommendation[] }>(
          `/campaigns/recommendations?storeId=${storeId}`
        ),
      ]);
      applyList(list);
      setRecs(rec.recommendations || []);
    } catch (e: any) {
      toast(e?.message || 'No se pudieron cargar las campañas');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelCampaign(id: string) {
    const ok = await confirm({
      title: '¿Cancelar esta campaña?',
      message: 'No se enviará SMS ni push si aún no salió. Si era de un crédito, te lo devolvemos.',
      confirmLabel: 'Cancelar envío',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await api(`/campaigns/${id}/cancel`, { method: 'POST' });
      toast('Campaña cancelada');
      await load();
    } catch (e: any) {
      toast(e?.message || 'No se pudo cancelar');
    }
  }

  const canLaunch =
    (quota?.freeRemaining ?? 0) > 0 || (quota?.campaignCredits ?? 0) > 0;

  function goCreate(path = '/campanas/nueva') {
    if (!quota) return;
    if (canLaunch) {
      router.push(path);
      return;
    }
    setPendingPath(path);
    setPaywallOpen(true);
  }

  async function buySelected() {
    if (!quota) return;
    if (!quota.hasPaymentMethod) {
      toast('Completa facturación y tarjeta en Configuración (Wompi) para comprar extras.');
      setPaywallOpen(false);
      router.push('/config');
      return;
    }
    setBuying(true);
    try {
      const list = await api<CampaignsList>('/campaigns/purchase', {
        method: 'POST',
        body: JSON.stringify({ storeId, sku }),
      });
      applyList(list);
      setPaywallOpen(false);
      toast('Compra lista. Arma tu campaña.');
      router.push(pendingPath);
    } catch (e: any) {
      toast(e?.message || 'No se pudo cobrar');
    } finally {
      setBuying(false);
    }
  }

  async function cancelSub() {
    const ok = await confirm({
      title: '¿Cancelar la suscripción de campañas?',
      message: 'No se renovará el paquete el próximo mes. Los créditos que ya compraste siguen vigentes.',
      confirmLabel: 'Dejar de renovar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const list = await api<CampaignsList>('/campaigns/subscription/cancel', {
        method: 'POST',
        body: JSON.stringify({ storeId }),
      });
      applyList(list);
      toast('Suscripción cancelada');
    } catch (e: any) {
      toast(e?.message || 'No se pudo cancelar');
    }
  }

  const p = quota?.pricing;

  useEffect(() => {
    if (searchParams.get('comprar') === '1' && quota && !canLaunch) {
      setPaywallOpen(true);
    }
  }, [searchParams, quota, canLaunch]);

  const payLabel = p
    ? sku === 'single'
      ? `Pagar ${formatCop(p.unitCop)}`
      : sku === 'pack'
        ? `Pagar ${formatCop(p.packCop)}`
        : `Suscribirme · ${formatCop(p.packCop)}/mes`
    : 'Pagar';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">Campañas</h2>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">
            Recomendadas según tus cartillas y clientes, o ármala tú.
            {quota
              ? ` Gratis este mes: ${quota.smsCampaignsUsed}/${quota.smsCampaignsLimit} · Créditos: ${quota.campaignCredits}.`
              : null}
            {quota?.packSubscribed ? ' Suscripción activa.' : ''}
            {quota?.packSubscribed ? (
              <>
                {' '}
                <button
                  type="button"
                  className="font-medium text-[var(--onda-ink)] underline decoration-[var(--onda-border)] underline-offset-2 hover:decoration-[var(--onda-ink)]"
                  onClick={() => void cancelSub()}
                >
                  Dejar de renovar
                </button>
              </>
            ) : null}
          </p>
        </div>
        <GradientButton type="button" onClick={() => goCreate()}>
          {OndaIcons.plus} Nueva campaña
        </GradientButton>
      </header>

      {loading ? (
        <SkeletonList rows={4} />
      ) : (
        <>
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Recomendadas para confirmar
            </h3>
            {recs.length === 0 ? (
              <p className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-5 text-sm text-[var(--onda-muted)]">
                Todavía no hay una sugerencia clara. Crea una campaña con el
                objetivo que quieras lograr.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {recs.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      goCreate(
                        `/campanas/nueva?objective=${encodeURIComponent(r.objective)}&rec=${encodeURIComponent(r.id)}`
                      )
                    }
                    className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-4 text-left transition hover:border-[var(--onda-bridge)]"
                  >
                    <p className="font-display text-lg font-semibold text-[var(--onda-ink)]">
                      {r.title}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--onda-muted)]">
                      {r.reason}
                    </p>
                    <p className="mt-3 text-xs font-medium text-[var(--onda-primary-700)]">
                      {r.audienceCount} clientes · Revisar y confirmar →
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Historial
            </h3>
            {campaigns.length === 0 ? (
              <p className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] px-4 py-5 text-sm text-[var(--onda-muted)]">
                Aún no has lanzado campañas.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--onda-border)] overflow-hidden rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)]">
                {campaigns.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--onda-ink)]">
                        {c.title}
                      </p>
                      <p className="text-xs text-[var(--onda-muted)]">
                        {STATUS_LABEL[c.status]}
                        {c.scheduledAt
                          ? ` · ${new Date(c.scheduledAt).toLocaleString('es-CO', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}`
                          : ''}
                        {c.sendSms ? ' · SMS' : ''}
                        {c.sendWallet ? ' · Wallet' : ''}
                      </p>
                    </div>
                    {c.status === 'SCHEDULED' ? (
                      <button
                        type="button"
                        onClick={() => void cancelCampaign(c.id)}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--onda-danger)] hover:bg-[var(--onda-danger)]/8"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {paywallOpen && p ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Cerrar"
            className="absolute inset-0 bg-[rgba(26,27,46,0.45)] backdrop-blur-[4px]"
            onClick={() => setPaywallOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-paywall-title"
            className="relative z-10 w-full max-w-[40rem] overflow-hidden rounded-[1.25rem] border border-[var(--onda-border)] bg-[var(--onda-card)] p-5 shadow-[0_24px_60px_rgba(26,27,46,0.2)] sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--onda-primary-50)] text-[var(--onda-primary-700)] [&>svg]:h-5 [&>svg]:w-5">
                {OndaIcons.megaphone}
              </span>
              <div className="min-w-0">
                <h3
                  id="campaign-paywall-title"
                  className="font-display text-xl font-semibold text-[var(--onda-ink)]"
                >
                  Sigue llegando a tus clientes
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--onda-muted)]">
                  Ya usaste la campaña SMS gratis de este mes. Elige un extra y
                  cobramos con la tarjeta de Wompi que ya tienes en Configuración.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
              {(
                [
                  {
                    id: 'single' as const,
                    kicker: 'Una',
                    title: formatCop(p.unitCop),
                    hint: '1 campaña extra',
                  },
                  {
                    id: 'pack' as const,
                    kicker: 'Paquete',
                    title: formatCop(p.packCop),
                    hint: `${p.packSize} campañas · ${Math.round(p.packDiscount * 100)}% off`,
                    badge: 'Recomendado',
                  },
                  {
                    id: 'subscribe' as const,
                    kicker: 'Mensual',
                    title: `${formatCop(p.packCop)}/mes`,
                    hint: `${p.packSize} al mes · ritmo semanal`,
                    disabled: quota?.packSubscribed,
                  },
                ] as const
              ).map((opt) => {
                const selected = sku === opt.id;
                const disabled = 'disabled' in opt && opt.disabled;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSku(opt.id)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      disabled
                        ? 'cursor-not-allowed border-[var(--onda-border)] bg-[var(--onda-bg)] opacity-55'
                        : selected
                          ? 'border-[var(--onda-bridge)] bg-[var(--onda-primary-50)] shadow-[0_8px_24px_rgba(26,27,46,0.06)]'
                          : 'border-[var(--onda-border)] bg-[var(--onda-bg)] hover:border-[var(--onda-bridge)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
                        {opt.kicker}
                      </p>
                      {'badge' in opt && opt.badge ? (
                        <span className="rounded-full bg-[var(--onda-violet)] px-2 py-0.5 text-[10px] font-semibold text-white">
                          {opt.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 font-display text-lg font-semibold text-[var(--onda-ink)]">
                      {opt.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-[var(--onda-muted)]">
                      {disabled ? 'Ya está activa' : opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-4 py-2.5 text-sm font-semibold text-[var(--onda-muted)] hover:bg-[var(--onda-bg)] hover:text-[var(--onda-ink)]"
                onClick={() => setPaywallOpen(false)}
              >
                Ahora no
              </button>
              <GradientButton
                type="button"
                disabled={buying || (sku === 'subscribe' && quota?.packSubscribed)}
                onClick={() => void buySelected()}
              >
                {buying ? 'Cobrando…' : payLabel}
              </GradientButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
