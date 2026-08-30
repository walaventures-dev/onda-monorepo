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
  ObjectiveDetailsEditor,
  api,
  toast,
  type LockScreenNotification,
} from '@onda/shared-ui';
import {
  OBJECTIVE_KINDS,
  OBJECTIVE_TITLES,
  buildObjectiveMessages,
  campaignReachQuote,
  objectiveAudienceQueryParams,
  objectiveHint,
  objectiveLabel,
  recommendedObjectiveDetails,
  renderCampaignTemplate,
  voiceFor,
  formatCop,
  type ObjectiveDetails,
  type ObjectiveKind,
} from '@onda/shared-utils';
import { CAMPAIGN_FREE_REACH_MONTHLY, SMS_OVERAGE_COP, StoreSegment, StoreSubcategory } from '@onda/shared-types';

const STEPS = [
  { id: 0, label: '1. Objetivo' },
  { id: 1, label: '2. Audiencia' },
  { id: 2, label: '3. Revisión' },
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
    inactiveDays?: number;
    minVisits?: number;
    maxPointsGap?: number;
    activeWithinDays?: number;
    redeemWithinDays?: number;
    requireWallet?: boolean;
    cartillaId?: string | null;
  };
};

type ReachQuota = {
  reachUsed: number;
  reachLimit: number;
  freeRemaining: number;
  unitCop: number;
  hasPaymentMethod: boolean;
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
    segment?: string | null;
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
  const segment = (store.segment || null) as StoreSegment | null;
  const voice = voiceFor(subcategory, segment);
  const storeName = store.name || 'Tu negocio';

  const [step, setStep] = useState(0);
  const [objectiveKind, setObjectiveKind] = useState<ObjectiveKind>(initialObjective);
  const [details, setDetails] = useState<ObjectiveDetails>(() =>
    recommendedObjectiveDetails(voice)
  );
  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [quota, setQuota] = useState<ReachQuota | null>(null);
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
  const [isLocalDev, setIsLocalDev] = useState(false);

  useEffect(() => {
    setIsLocalDev(
      process.env.NODE_ENV === 'development' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
    );
  }, []);

  const messages = useMemo(
    () =>
      buildObjectiveMessages({
        kind: objectiveKind,
        voice,
        storeName,
        details,
        slowWindow: details.slowWindow || audience?.slowWindow,
      }),
    [objectiveKind, voice, storeName, details, audience?.slowWindow]
  );

  const reachQuote = useMemo(() => {
    const count = audience?.count ?? 0;
    const used = quota?.reachUsed ?? 0;
    return campaignReachQuote({
      audienceCount: count,
      reachUsedThisMonth: used,
      unitCop: quota?.unitCop ?? SMS_OVERAGE_COP,
      freeMonthly: quota?.reachLimit ?? CAMPAIGN_FREE_REACH_MONTHLY,
    });
  }, [audience?.count, quota]);

  const previewName = audience?.people[0]?.name.split(' ')[0] || 'Camila';
  const previewMessages = messages.map((m) => ({
    ...m,
    text: renderCampaignTemplate(m.text, { nombre: previewName }),
  }));
  const objective = objectiveLabel(objectiveKind, voice, {
    ...details,
    slowWindow: details.slowWindow || audience?.slowWindow,
  });

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({
      storeId,
      objective: objectiveKind,
    });
    for (const [key, value] of Object.entries(
      objectiveAudienceQueryParams(objectiveKind, details)
    )) {
      qs.set(key, value);
    }
    void api<AudienceResponse>(`/campaigns/audience?${qs.toString()}`)
      .then((data) => {
        if (!cancelled) setAudience(data);
      })
      .catch(() => {
        if (!cancelled) setAudience(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, objectiveKind, details]);

  useEffect(() => {
    void api<ReachQuota>(`/campaigns/quota?storeId=${storeId}`)
      .then(setQuota)
      .catch(() => setQuota(null));
  }, [storeId]);

  // Si la API sugiere una ventana floja distinta a la del vertical, úsala como default
  // mientras el usuario no la haya personalizado.
  useEffect(() => {
    if (objectiveKind !== 'slow_hours' || !audience?.slowWindow) return;
    setDetails((d) =>
      d.slowWindow === voice.slowWindow
        ? { ...d, slowWindow: audience.slowWindow! }
        : d
    );
  }, [audience?.slowWindow, objectiveKind, voice.slowWindow]);

  useEffect(() => {
    if (!recId) return;
    void api<{ recommendations: any[] }>(
      `/campaigns/recommendations?storeId=${storeId}`
    ).then((data) => {
      const rec = (data.recommendations || []).find((r) => r.id === recId);
      if (!rec) return;
      const nextDetails = recommendedObjectiveDetails(voice, {
        slowWindow: rec.slowWindow || voice.slowWindow,
        rewardName: rec.rewardName || voice.signatureReward,
      });
      setObjectiveKind(rec.objective);
      setDetails(nextDetails);
    });
  }, [recId, storeId, subcategory, segment]);

  const selectObjective = (kind: ObjectiveKind) => {
    const nextDetails = recommendedObjectiveDetails(voice, {
      slowWindow: audience?.slowWindow || voice.slowWindow,
    });
    setObjectiveKind(kind);
    setDetails(nextDetails);
  };

  const patchDetails = (patch: Partial<ObjectiveDetails>) => {
    setDetails({ ...details, ...patch });
  };

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
          title: objective,
          objective: objectiveKind,
          origin: recId ? 'RECOMMENDED' : 'MANUAL',
          scheduledAt,
          smsBody: sms?.text,
          walletBody: wallet?.text,
          sendSms: true,
          sendWallet: true,
          audienceCount: audience.count,
          estimatedCostCop: reachQuote.costCop,
          audienceFilter: {
            ...(audience.filter || { objective: objectiveKind }),
            objective: objectiveKind,
            inactiveDays: details.inactiveDays,
            minVisits: details.minVisits,
            slowWindow: details.slowWindow || audience.filter?.slowWindow,
            maxPointsGap: details.maxPointsGap,
            activeWithinDays: details.activeWithinDays,
            redeemWithinDays: details.redeemWithinDays,
            requireWallet: details.requireWallet,
            rewardName: details.rewardName,
            reviewIncentive: details.reviewIncentive,
          },
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
        String(msg).includes('tarjeta') ||
        String(msg).includes('Wompi') ||
        String(msg).includes('PAYMENT')
      ) {
        router.push('/facturacion');
      }
    } finally {
      setSaving(false);
    }
  }

  const ctaLabel =
    step < 2 ? 'Siguiente' : launched ? null : saving ? 'Lanzando…' : 'Lanzar campaña';

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
                    Elige el propósito (trae recomendación) y ajústalo a detalle
                    {segment ? ` · ${voice.place}` : ''}.
                  </p>
                  <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                    {OBJECTIVE_KINDS.map((kind) => {
                      const selected = objectiveKind === kind;
                      const label = objectiveLabel(
                        kind,
                        voice,
                        selected
                          ? {
                              ...details,
                              slowWindow:
                                details.slowWindow || audience?.slowWindow,
                            }
                          : recommendedObjectiveDetails(voice, {
                              slowWindow:
                                audience?.slowWindow || voice.slowWindow,
                            })
                      );
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => selectObjective(kind)}
                          className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                            selected
                              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-ink)] shadow-[0_8px_20px_rgba(5,45,222,0.08)]'
                              : 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)] hover:bg-white'
                          }`}
                        >
                          <span
                            className={`block text-sm font-semibold ${
                              selected
                                ? 'text-[var(--onda-primary-700)]'
                                : 'text-[var(--onda-ink)]'
                            }`}
                          >
                            {OBJECTIVE_TITLES[kind]}
                          </span>
                          <span className="mt-1 block text-xs leading-snug text-[var(--onda-muted)]">
                            {objectiveHint(kind)}
                          </span>
                          <span
                            className={`mt-2 block text-xs leading-snug ${
                              selected
                                ? 'font-medium text-[var(--onda-ink)]'
                                : 'text-[var(--onda-muted)]'
                            }`}
                          >
                            {label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <ObjectiveDetailsEditor
                    kind={objectiveKind}
                    details={details}
                    onChange={patchDetails}
                  />

                  <div className="mt-4 rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
                      Objetivo
                    </p>
                    <p className="mt-1 text-sm font-medium text-[var(--onda-ink)]">
                      {objective}
                    </p>
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <AudienceStep
                  audience={audience}
                  isLocalDev={isLocalDev}
                  onLoadMock={() => {
                    setAudience(
                      buildMockAudience(objectiveKind, details, voice, audience?.slowWindow)
                    );
                    toast('Audiencia demo cargada (solo local)');
                  }}
                />
              ) : null}

              {step === 2 ? (
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
                        Costo estimado (alcance)
                      </p>
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-[var(--onda-muted)]">Personas a alcanzar</dt>
                          <dd className="font-medium tabular-nums">{audience?.count ?? 0}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-[var(--onda-muted)]">
                            Gratis este mes ({reachQuote.freeMonthly})
                          </dt>
                          <dd className="text-[var(--onda-ink)]">
                            {reachQuote.reachUsedThisMonth} usadas →{' '}
                            {reachQuote.freeApplied} aplicadas gratis
                          </dd>
                        </div>
                        {reachQuote.paidCount > 0 ? (
                          <div className="flex justify-between gap-4">
                            <dt className="text-[var(--onda-muted)]">Personas de pago</dt>
                            <dd className="font-medium tabular-nums">
                              {reachQuote.paidCount} × {formatCop(reachQuote.unitCop)}
                            </dd>
                          </div>
                        ) : null}
                        <div className="flex justify-between gap-4 border-t border-[var(--onda-border)] pt-2">
                          <dt className="font-semibold text-[var(--onda-ink)]">En la próxima factura</dt>
                          <dd className="font-display text-lg font-bold text-[var(--onda-ink)]">
                            {formatCop(reachQuote.costCop)}
                          </dd>
                        </div>
                      </dl>
                      {reachQuote.paidCount > 0 && quota && !quota.hasPaymentMethod ? (
                        <p className="mt-3 rounded-xl bg-[var(--onda-warning)]/10 px-3 py-2 text-xs text-[var(--onda-ink)]">
                          Necesitas tarjeta para superar las{' '}
                          {reachQuote.freeMonthly} personas incluidas. El extra
                          se cobra en la factura de consumos.
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                        Mensajes
                      </p>
                      <ul className="mt-3 space-y-2">
                        {previewMessages.map((msg) => (
                          <li
                            key={msg.channel}
                            className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-3 py-2.5"
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
                if (step < 2) goToStep(step + 1);
                else void launch();
              }}
              className="mt-5 w-full max-w-[280px]"
            >
              {ctaLabel}
              {step < 2 ? ' →' : ''}
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

function AudienceStep({
  audience,
  isLocalDev,
  onLoadMock,
}: {
  audience: AudienceResponse | null;
  isLocalDev?: boolean;
  onLoadMock?: () => void;
}) {
  if (!audience) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--onda-muted)]">Calculando audiencia…</p>
        {isLocalDev && onLoadMock ? (
          <button
            type="button"
            onClick={onLoadMock}
            className="rounded-full border border-dashed border-[var(--onda-bridge)] bg-[var(--onda-primary-50)] px-4 py-2 text-xs font-semibold text-[var(--onda-primary-700)] hover:bg-[var(--onda-primary-100)]"
          >
            Cargar audiencia demo (local)
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">Audiencia encontrada</h3>
        {isLocalDev && onLoadMock ? (
          <button
            type="button"
            onClick={onLoadMock}
            className="rounded-full border border-dashed border-[var(--onda-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--onda-muted)] hover:border-[var(--onda-bridge)] hover:text-[var(--onda-ink)]"
          >
            {audience.count === 0 ? 'Cargar audiencia demo' : 'Recargar demo'}
          </button>
        ) : null}
      </div>
      {audience.count === 0 ? (
        <p className="mt-3 rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3 text-sm text-[var(--onda-muted)]">
          No hay clientes en este filtro con tus datos actuales.
          {isLocalDev && onLoadMock
            ? ' Usa el botón de arriba para probar el flujo con audiencia demo.'
            : null}
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

const MOCK_PEOPLE = [
  { name: 'Camila Rojas', initials: 'CR', meta: 'hace 34 días' },
  { name: 'Andrés Mejía', initials: 'AM', meta: 'hace 41 días' },
  { name: 'Valentina Díaz', initials: 'VD', meta: 'hace 28 días' },
  { name: 'Santiago Pérez', initials: 'SP', meta: 'hace 52 días' },
  { name: 'Laura Gómez', initials: 'LG', meta: 'hace 37 días' },
  { name: 'Juan Esteban', initials: 'JE', meta: 'hace 45 días' },
  { name: 'María Fernanda', initials: 'MF', meta: '2 ondas · cerca del premio' },
  { name: 'Diego Castillo', initials: 'DC', meta: 'canjeó hace 5 días' },
] as const;

function buildMockAudience(
  objectiveKind: ObjectiveKind,
  details: ObjectiveDetails,
  voice: ReturnType<typeof voiceFor>,
  slowWindow?: string
): AudienceResponse {
  const count = 104;
  const windowLabel = slowWindow || details.slowWindow || voice.slowWindow;
  const filter: AudienceResponse['filter'] = {
    objective: objectiveKind,
    slowWindow: windowLabel,
    inactiveDays: details.inactiveDays,
    minVisits: details.minVisits,
    maxPointsGap: details.maxPointsGap,
    activeWithinDays: details.activeWithinDays,
    redeemWithinDays: details.redeemWithinDays,
    requireWallet: details.requireWallet,
    cartillaId: null,
  };

  const headlines: Record<ObjectiveKind, string> = {
    reactivate: `Encontramos ${count} ${voice.customerPlural} que no regresan hace más de ${details.inactiveDays} días.`,
    slow_hours: `Encontramos ${count} ${voice.customerPlural} a quienes invitar ${windowLabel}.`,
    new_reward: `Encontramos ${count} ${voice.customerPlural} a ${details.maxPointsGap} ondas del premio o activos en ${details.activeWithinDays} días.`,
    reviews: `Encontramos ${count} ${voice.customerPlural} que canjearon en los últimos ${details.redeemWithinDays} días y aún no dejaron reseña.`,
  };

  const chips: Record<ObjectiveKind, string[]> = {
    reactivate: [
      `Inactivos ${details.inactiveDays}d`,
      details.minVisits > 1 ? `${details.minVisits}+ visitas` : 'Visitaron antes',
      details.requireWallet ? 'Solo Wallet' : 'Wallet o SMS',
    ],
    slow_hours: [
      'Ya conocen el local',
      windowLabel,
      details.requireWallet ? 'Solo Wallet' : 'Invitación a horario flojo',
    ],
    new_reward: [
      'Activos',
      `≤ ${details.maxPointsGap} ondas al premio`,
      `${details.activeWithinDays}d de actividad`,
    ],
    reviews: [
      `Canje ≤ ${details.redeemWithinDays}d`,
      'Sin reseña',
      details.requireWallet ? 'Solo Wallet' : 'Google Reviews',
    ],
  };

  const kpis =
    objectiveKind === 'new_reward'
      ? [
          { label: 'Alcanzables', value: String(count) },
          { label: 'Cerca del premio', value: '38%' },
          { label: 'Con Wallet', value: '72%' },
        ]
      : [
          { label: 'Alcanzables', value: String(count) },
          { label: 'Días sin visita', value: '36' },
          { label: 'Con Wallet', value: '68%' },
        ];

  return {
    headline: headlines[objectiveKind],
    chips: chips[objectiveKind],
    kpis,
    people: MOCK_PEOPLE.map((p) => ({ ...p })),
    visitFrequency: [
      { bucket: '1–2', count: 48 },
      { bucket: '3–5', count: 37 },
      { bucket: '6+', count: 19 },
    ],
    count,
    slowWindow: windowLabel,
    filter,
  };
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
