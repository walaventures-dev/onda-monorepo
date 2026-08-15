'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  GradientButton,
  IPhonePreview,
  LockScreen,
  OndaDatePicker,
  PROMO_TYPE_OPTIONS,
  api,
  toast,
  type LockScreenNotification,
  type PromoTypeKey,
} from '@onda/shared-ui';
import {
  OBJECTIVE_KINDS,
  buildCampaignMessages,
  defaultPromo,
  objectiveLabel,
  promoForType,
  promoHeadline,
  renderCampaignTemplate,
  voiceFor,
  type CampaignPromo,
  type ObjectiveKind,
} from '@onda/shared-utils';
import { StoreSubcategory } from '@onda/shared-types';

const STEPS = [
  { id: 0, label: '1. Objetivo' },
  { id: 1, label: '2. Audiencia' },
  { id: 2, label: '3. Promo' },
  { id: 3, label: '4. Revisión' },
] as const;

const NOTIF_DELAYS_MS = [900, 2600] as const;

type AudienceResponse = {
  headline: string;
  chips: string[];
  kpis: { label: string; value: string }[];
  people: { name: string; initials: string; meta: string }[];
  visitFrequency: { bucket: string; count: number }[];
  count: number;
  slowWindow?: string;
  filter: {
    objective: ObjectiveKind;
    slowWindow?: string;
    cartillaId?: string | null;
  };
};

type CartillaReward = {
  cartillaId: string;
  cartillaName: string;
  promotionId: string;
  title: string;
  type: PromoTypeKey;
  value?: number | null;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  productName?: string | null;
};

export function CampaignWizard({
  storeId,
  store,
  onClose,
  onLaunched,
}: {
  storeId: string;
  store: {
    name?: string;
    subcategory?: string;
    passDesign?: { logoUrl?: string | null } | null;
  };
  onClose: () => void;
  onLaunched: () => void;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const initialObjective = parseObjective(search.get('objective'));
  const recId = search.get('rec');

  const subcategory = (store.subcategory || StoreSubcategory.OTHER_SERVICE) as StoreSubcategory;
  const voice = voiceFor(subcategory);
  const storeName = store.name || 'Tu negocio';

  const [step, setStep] = useState(0);
  const [objectiveKind, setObjectiveKind] = useState<ObjectiveKind>(initialObjective);
  const [promo, setPromo] = useState<CampaignPromo>(() =>
    defaultPromo(initialObjective, voice)
  );
  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [rewards, setRewards] = useState<CartillaReward[]>([]);
  const [launchMode, setLaunchMode] = useState<'now' | 'schedule'>('now');
  const [scheduleDate, setScheduleDate] = useState(() => isoDateBogota(new Date()));
  const [scheduleTime, setScheduleTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [saving, setSaving] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [visibleNotifs, setVisibleNotifs] = useState<LockScreenNotification[]>([]);
  const launchTimersRef = useRef<number[]>([]);

  const messages = useMemo(
    () =>
      buildCampaignMessages({
        promo,
        kind: objectiveKind,
        voice,
        storeName,
        slowWindow: audience?.slowWindow,
      }),
    [promo, objectiveKind, voice, storeName, audience?.slowWindow]
  );

  const previewName = audience?.people[0]?.name.split(' ')[0] || 'Camila';
  const previewMessages = messages.map((m) => ({
    ...m,
    text: renderCampaignTemplate(m.text, { nombre: previewName }),
  }));
  const benefitPreview = promoHeadline(promo);
  const objective = objectiveLabel(objectiveKind, voice, audience?.slowWindow);

  useEffect(() => {
    let cancelled = false;
    void api<AudienceResponse>(
      `/campaigns/audience?storeId=${storeId}&objective=${objectiveKind}`
    )
      .then((data) => {
        if (!cancelled) setAudience(data);
      })
      .catch(() => {
        if (!cancelled) setAudience(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, objectiveKind]);

  useEffect(() => {
    void api<{ cartillas: any[] }>(`/cartillas?storeId=${storeId}`)
      .then((data) => {
        const list: CartillaReward[] = [];
        for (const c of data.cartillas || []) {
          if (c.status !== 'ACTIVE') continue;
          for (const item of c.items || []) {
            const p = item.promotion;
            if (!p?.isActive) continue;
            list.push({
              cartillaId: c.id,
              cartillaName: c.name,
              promotionId: p.id,
              title: p.title,
              type: p.type,
              value: p.value,
              buyQuantity: p.buyQuantity,
              getQuantity: p.getQuantity,
              productName: p.productName,
            });
          }
        }
        setRewards(list);
      })
      .catch(() => setRewards([]));
  }, [storeId]);

  useEffect(() => {
    if (!recId) return;
    void api<{ recommendations: any[] }>(
      `/campaigns/recommendations?storeId=${storeId}`
    ).then((data) => {
      const rec = (data.recommendations || []).find((r) => r.id === recId);
      if (!rec) return;
      setObjectiveKind(rec.objective);
      if (rec.promo) setPromo(rec.promo);
    });
  }, [recId, storeId]);

  const clearLaunchTimers = () => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  };

  useEffect(() => () => clearLaunchTimers(), []);

  const goToStep = (next: number) => {
    setLaunched(false);
    setVisibleNotifs([]);
    clearLaunchTimers();
    setStep(next);
  };

  async function launch() {
    if (saving || launched) return;
    if (!audience || audience.count === 0) {
      toast('No hay clientes en esta audiencia');
      return;
    }
    setSaving(true);
    try {
      const sms = messages.find((m) => m.channel === 'SMS');
      const wallet = messages.find((m) => m.channel === 'Wallet');
      const scheduledAt =
        launchMode === 'now'
          ? undefined
          : bogotaToIso(scheduleDate, scheduleTime);
      await api('/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          storeId,
          title: promo.title || objective,
          objective: objectiveKind,
          origin: recId ? 'RECOMMENDED' : 'MANUAL',
          scheduledAt,
          smsBody: sms?.text,
          walletBody: wallet?.text,
          sendSms: true,
          sendWallet: true,
          promoSnapshot: promo,
          audienceFilter: audience.filter,
        }),
      });
      setLaunched(true);
      setVisibleNotifs([]);
      clearLaunchTimers();
      previewMessages.forEach((msg, index) => {
        const id = window.setTimeout(() => {
          setVisibleNotifs((prev) => {
            if (prev.some((n) => n.id === msg.channel)) return prev;
            return [
              ...prev,
              { id: msg.channel, channel: msg.channel, message: msg.text },
            ];
          });
        }, NOTIF_DELAYS_MS[index] ?? 900);
        launchTimersRef.current.push(id);
      });
      toast(
        launchMode === 'now' ? 'Campaña en cola para salir ahora' : 'Campaña programada'
      );
      onLaunched();
    } catch (e: any) {
      const msg = e?.message || 'No se pudo lanzar la campaña';
      toast(msg);
      if (
        String(msg).includes('gratis') ||
        String(msg).includes('crédito') ||
        String(msg).includes('Wompi')
      ) {
        router.push('/campanas?comprar=1');
      }
    } finally {
      setSaving(false);
    }
  }

  const ctaLabel =
    step < 3 ? 'Siguiente' : launched ? null : saving ? 'Lanzando…' : 'Lanzar campaña';

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)]">
      <div className="flex items-center justify-between border-b border-[var(--onda-border)] px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
        >
          ← Campañas
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
          Nueva campaña
        </p>
      </div>

      <div className="grid lg:grid-cols-[180px_1fr_minmax(260px,300px)]">
        <aside className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 lg:border-b-0 lg:border-r">
          <nav className="flex gap-2 overflow-x-auto lg:flex-col">
            {STEPS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id)}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-left text-sm font-medium transition ${
                  step === s.id
                    ? 'bg-[var(--onda-primary-500)] text-white'
                    : 'text-[var(--onda-muted)] hover:bg-[var(--onda-primary-50)] hover:text-[var(--onda-ink)]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-h-[520px] p-6 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {step === 0 ? (
                <div>
                  <h3 className="font-display text-xl font-semibold">
                    ¿Qué quieres lograr?
                  </h3>
                  <p className="mt-1 text-sm text-[var(--onda-muted)]">
                    El copy se ajusta a {storeName}.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {OBJECTIVE_KINDS.map((kind) => {
                      const label = objectiveLabel(kind, voice, audience?.slowWindow);
                      const selected = objectiveKind === kind;
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => {
                            setObjectiveKind(kind);
                            setPromo(defaultPromo(kind, voice));
                          }}
                          className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                            selected
                              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-ink)]'
                              : 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)]'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <AudienceStep audience={audience} />
              ) : null}

              {step === 2 ? (
                <div>
                  <h3 className="font-display text-xl font-semibold">La promo</h3>
                  <p className="mt-1 text-sm text-[var(--onda-muted)]">
                    Es el texto de la oferta. No crea una promoción nueva en la
                    cartilla.
                  </p>
                  {rewards.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-[var(--onda-ink)]">
                        De tus cartillas
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {rewards.map((r) => (
                          <button
                            key={`${r.cartillaId}-${r.promotionId}`}
                            type="button"
                            onClick={() =>
                              setPromo({
                                type: r.type,
                                title: r.title,
                                value: r.value != null ? String(r.value) : '',
                                buyQuantity: String(r.buyQuantity ?? 2),
                                getQuantity: String(r.getQuantity ?? 1),
                                productName: r.productName || r.title,
                                cartillaId: r.cartillaId,
                                promotionId: r.promotionId,
                              })
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                              promo.promotionId === r.promotionId
                                ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-500)] text-white'
                                : 'border-[var(--onda-border)] bg-white text-[var(--onda-muted)]'
                            }`}
                          >
                            {r.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {PROMO_TYPE_OPTIONS.map((t) => {
                      const selected = promo.type === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            setPromo(promoForType(t.id, objectiveKind, voice))
                          }
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            selected
                              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-500)] text-white'
                              : 'border-[var(--onda-border)] bg-white text-[var(--onda-muted)]'
                          }`}
                        >
                          {t.icon}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={promo.title}
                    onChange={(e) => setPromo({ ...promo, title: e.target.value })}
                    placeholder="Título"
                    className="mt-3 w-full rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-3 text-sm font-medium text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
                  />
                  {promo.type === 'PERCENT_OFF' ? (
                    <label className="mt-3 block text-sm text-[var(--onda-muted)]">
                      Porcentaje (1–100)
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={promo.value}
                        onChange={(e) => setPromo({ ...promo, value: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-2.5 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
                      />
                    </label>
                  ) : null}
                  {promo.type === 'AMOUNT_OFF' ? (
                    <label className="mt-3 block text-sm text-[var(--onda-muted)]">
                      Valor de descuento (COP)
                      <input
                        type="number"
                        min={1}
                        value={promo.value}
                        onChange={(e) => setPromo({ ...promo, value: e.target.value })}
                        className="mt-1 w-full rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-2.5 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
                      />
                    </label>
                  ) : null}
                  {promo.type === 'BUY_GET' ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      <label className="text-sm text-[var(--onda-muted)]">
                        Compra N
                        <input
                          type="number"
                          min={1}
                          value={promo.buyQuantity}
                          onChange={(e) =>
                            setPromo({ ...promo, buyQuantity: e.target.value })
                          }
                          className="ml-2 w-20 rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--onda-bridge)]"
                        />
                      </label>
                      <label className="text-sm text-[var(--onda-muted)]">
                        Lleva M
                        <input
                          type="number"
                          min={1}
                          value={promo.getQuantity}
                          onChange={(e) =>
                            setPromo({ ...promo, getQuantity: e.target.value })
                          }
                          className="ml-2 w-20 rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--onda-bridge)]"
                        />
                      </label>
                    </div>
                  ) : null}
                  {promo.type === 'PRODUCT' ? (
                    <label className="mt-3 block text-sm text-[var(--onda-muted)]">
                      Nombre del producto
                      <input
                        value={promo.productName}
                        onChange={(e) =>
                          setPromo({ ...promo, productName: e.target.value })
                        }
                        className="mt-1 w-full rounded-2xl border border-[var(--onda-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--onda-bridge)]"
                      />
                    </label>
                  ) : null}
                  <p className="mt-3 rounded-2xl bg-[var(--onda-bg)] px-4 py-2.5 text-xs text-[var(--onda-muted)]">
                    Preview: {benefitPreview}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {previewMessages.map((msg) => (
                      <li
                        key={msg.channel}
                        className="rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2.5"
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-primary-700)]">
                          {msg.channelLabel}
                        </p>
                        <p className="mt-1 text-sm leading-snug text-[var(--onda-ink)]">
                          {msg.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {step === 3 ? (
                <div>
                  <h3 className="font-display text-xl font-semibold">
                    Listo para lanzar
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                        Objetivo
                      </p>
                      <p className="mt-1.5 font-display text-lg font-semibold">
                        {objective}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                        Audiencia
                      </p>
                      <p className="mt-1 font-display text-3xl font-bold">
                        {audience?.count ?? 0}
                      </p>
                      <p className="text-sm text-[var(--onda-muted)]">clientes</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                        Canales
                      </p>
                      <p className="mt-3 text-sm">Push · Wallet</p>
                      <p className="text-sm">SMS</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                        Cuándo sale
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setLaunchMode('now')}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            launchMode === 'now'
                              ? 'bg-[var(--onda-primary-500)] text-white'
                              : 'bg-[var(--onda-bg)] text-[var(--onda-muted)]'
                          }`}
                        >
                          Ahora
                        </button>
                        <button
                          type="button"
                          onClick={() => setLaunchMode('schedule')}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            launchMode === 'schedule'
                              ? 'bg-[var(--onda-primary-500)] text-white'
                              : 'bg-[var(--onda-bg)] text-[var(--onda-muted)]'
                          }`}
                        >
                          Programar
                        </button>
                      </div>
                      {launchMode === 'schedule' ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <OndaDatePicker
                            label="Fecha"
                            value={scheduleDate}
                            onChange={setScheduleDate}
                          />
                          <label className="text-xs font-medium text-[var(--onda-muted)]">
                            Hora (Bogotá)
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="mt-1.5 w-full rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[var(--onda-muted)]">
                          Sale hoy, a esta hora.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="flex flex-col items-center border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-6 lg:border-l lg:border-t-0">
          <p className="mb-4 self-start text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Preview
          </p>
          <IPhonePreview>
            <LockScreen
              notifications={visibleNotifs}
              storeName={storeName}
              logoUrl={store.passDesign?.logoUrl}
            />
          </IPhonePreview>
          {ctaLabel ? (
            <GradientButton
              type="button"
              disabled={saving}
              onClick={() => {
                if (step < 3) goToStep(step + 1);
                else void launch();
              }}
              className="mt-5 w-full max-w-[280px]"
            >
              {ctaLabel}
              {step < 3 ? ' →' : ''}
            </GradientButton>
          ) : (
            <GradientButton
              type="button"
              className="mt-5 w-full max-w-[280px]"
              onClick={() => router.push('/campanas')}
            >
              Ver campañas
            </GradientButton>
          )}
        </aside>
      </div>
    </div>
  );
}

function AudienceStep({ audience }: { audience: AudienceResponse | null }) {
  if (!audience) {
    return <p className="text-sm text-[var(--onda-muted)]">Calculando audiencia…</p>;
  }
  return (
    <div>
      <h3 className="font-display text-xl font-semibold">Audiencia encontrada</h3>
      <p className="mt-3 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3 text-sm text-[var(--onda-ink)]">
        {audience.headline}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {audience.kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-3 text-center"
          >
            <p className="font-display text-xl font-bold text-[var(--onda-ink)]">
              {kpi.value}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-[var(--onda-muted)]">
              {kpi.label}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4">
          <p className="text-xs font-semibold text-[var(--onda-ink)]">
            Frecuencia de visitas
          </p>
          <div className="mt-2 h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={audience.visitFrequency}
                margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
              >
                <XAxis dataKey="bucket" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} allowDecimals={false} width={28} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(5,45,222,0.06)' }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid var(--onda-border)',
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Clientes"
                  fill="var(--onda-sky)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4">
          <p className="text-xs font-semibold text-[var(--onda-ink)]">
            Personas en el segmento
          </p>
          <ul className="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
            {audience.people.length === 0 ? (
              <li className="text-sm text-[var(--onda-muted)]">Nadie en este filtro.</li>
            ) : (
              audience.people.map((person) => (
                <li key={person.name + person.meta} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[10px] font-bold text-[var(--onda-primary-700)]">
                    {person.initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{person.name}</p>
                    <p className="text-[11px] text-[var(--onda-muted)]">{person.meta}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {audience.chips.map((t) => (
          <span
            key={t}
            className="rounded-full bg-[var(--onda-primary-100)] px-3 py-1 text-xs font-medium text-[var(--onda-primary-700)]"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function parseObjective(raw: string | null): ObjectiveKind {
  if (
    raw === 'reactivate' ||
    raw === 'slow_hours' ||
    raw === 'new_reward' ||
    raw === 'reviews'
  ) {
    return raw;
  }
  return 'reactivate';
}

function isoDateBogota(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function bogotaToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`).toISOString();
}
