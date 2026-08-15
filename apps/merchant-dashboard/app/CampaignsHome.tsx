'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GradientButton,
  api,
  toast,
  OndaIcons,
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
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
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

  async function buy(sku: 'single' | 'pack' | 'subscribe') {
    if (!quota) return;
    if (!quota.hasPaymentMethod) {
      toast('Completa facturación y tarjeta en Configuración (Wompi) para comprar extras.');
      router.push('/config');
      return;
    }
    const p = quota.pricing;
    const label =
      sku === 'single'
        ? `1 campaña extra por ${formatCop(p.unitCop)}`
        : sku === 'pack'
          ? `paquete de ${p.packSize} (${Math.round(p.packDiscount * 100)}% off) por ${formatCop(p.packCop)}`
          : `suscripción mensual del paquete (${p.packSize} campañas, ${formatCop(p.packCop)}/mes)`;
    const ok = await confirm({
      title: 'Confirmar compra',
      message: `Se cobrará ${label} con la tarjeta registrada en Wompi.`,
      confirmLabel: 'Pagar',
      tone: 'accent',
    });
    if (!ok) return;
    setBuying(sku);
    try {
      const list = await api<CampaignsList>('/campaigns/purchase', {
        method: 'POST',
        body: JSON.stringify({ storeId, sku }),
      });
      applyList(list);
      toast('Compra aplicada. Ya puedes lanzar.');
    } catch (e: any) {
      toast(e?.message || 'No se pudo cobrar');
    } finally {
      setBuying(null);
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
  const canLaunch =
    (quota?.freeRemaining ?? 0) > 0 || (quota?.campaignCredits ?? 0) > 0;

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
          </p>
        </div>
        <GradientButton
          type="button"
          onClick={() => router.push('/campanas/nueva')}
        >
          {OndaIcons.plus} Nueva campaña
        </GradientButton>
      </header>

      {loading ? (
        <p className="text-sm text-[var(--onda-muted)]">Cargando campañas…</p>
      ) : (
        <>
          {p ? (
            <section className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-card)] p-5">
              <h3 className="font-display text-lg font-semibold">
                Campañas extra
              </h3>
              <p className="mt-1 text-sm text-[var(--onda-muted)]">
                {quota?.hasPaymentMethod
                  ? 'Se cobra con la tarjeta y facturación de Wompi que ya configuraste.'
                  : 'Para pagar extras completa facturación y tarjeta en Configuración (mismo flujo del onboarding / Wompi).'}
              </p>
              {quota?.packSubscribed ? (
                <p className="mt-2 text-sm text-[var(--onda-success)]">
                  Suscripción activa: {p.packSize} campañas al mes (una por
                  semana aprox.).{' '}
                  <button
                    type="button"
                    className="font-medium underline"
                    onClick={() => void cancelSub()}
                  >
                    Cancelar renovación
                  </button>
                </p>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
                    A demanda
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold">
                    {formatCop(p.unitCop)}
                  </p>
                  <p className="text-sm text-[var(--onda-muted)]">1 campaña</p>
                  <GradientButton
                    type="button"
                    className="mt-3 w-full"
                    disabled={Boolean(buying)}
                    onClick={() => void buy('single')}
                  >
                    {buying === 'single' ? 'Cobrando…' : 'Comprar 1'}
                  </GradientButton>
                </article>
                <article className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
                    Paquete
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold">
                    {formatCop(p.packCop)}
                  </p>
                  <p className="text-sm text-[var(--onda-muted)]">
                    {p.packSize} campañas · {Math.round(p.packDiscount * 100)}% off
                  </p>
                  <GradientButton
                    type="button"
                    className="mt-3 w-full"
                    disabled={Boolean(buying)}
                    onClick={() => void buy('pack')}
                  >
                    {buying === 'pack' ? 'Cobrando…' : 'Comprar paquete'}
                  </GradientButton>
                </article>
                <article className="rounded-2xl border border-[var(--onda-primary-200)] bg-[var(--onda-primary-50)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--onda-primary-700)]">
                    Suscripción
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold">
                    {formatCop(p.packCop)}
                    <span className="text-sm font-medium text-[var(--onda-muted)]">
                      /mes
                    </span>
                  </p>
                  <p className="text-sm text-[var(--onda-muted)]">
                    {p.packSize} al mes · ritmo semanal
                  </p>
                  <GradientButton
                    type="button"
                    className="mt-3 w-full"
                    disabled={Boolean(buying) || quota?.packSubscribed}
                    onClick={() => void buy('subscribe')}
                  >
                    {quota?.packSubscribed
                      ? 'Activa'
                      : buying === 'subscribe'
                        ? 'Cobrando…'
                        : 'Suscribirme'}
                  </GradientButton>
                </article>
              </div>
              {!canLaunch ? (
                <p className="mt-3 text-sm text-[var(--onda-danger)]">
                  Ya usaste la campaña gratis de este mes. Compra créditos para
                  lanzar otra.
                </p>
              ) : null}
            </section>
          ) : null}

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
                      router.push(
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
    </div>
  );
}
