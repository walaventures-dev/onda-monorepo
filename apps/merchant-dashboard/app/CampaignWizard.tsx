'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UserListIcon as UserList } from '@phosphor-icons/react/dist/csr/UserList';
import { MegaphoneIcon as Megaphone } from '@phosphor-icons/react/dist/csr/Megaphone';
import { BellIcon as Bell } from '@phosphor-icons/react/dist/csr/Bell';
import { ChatTextIcon as ChatText } from '@phosphor-icons/react/dist/csr/ChatText';
import { CurrencyCircleDollarIcon as CurrencyCircleDollar } from '@phosphor-icons/react/dist/csr/CurrencyCircleDollar';
import { CalendarBlankIcon as CalendarBlank } from '@phosphor-icons/react/dist/csr/CalendarBlank';
import { ClockIcon as Clock } from '@phosphor-icons/react/dist/csr/Clock';
import { ChatCenteredDotsIcon as ChatCenteredDots } from '@phosphor-icons/react/dist/csr/ChatCenteredDots';
import { RocketIcon as Rocket } from '@phosphor-icons/react/dist/csr/Rocket';
import { MagnifyingGlassIcon as MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { SpinnerGapIcon as SpinnerGap } from '@phosphor-icons/react/dist/csr/SpinnerGap';
import { CaretDownIcon as CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { TargetIcon as Target } from '@phosphor-icons/react/dist/csr/Target';
import { CheckIcon as Check } from '@phosphor-icons/react/dist/csr/Check';
import { HeartIcon as Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { SmileyIcon as Smiley } from '@phosphor-icons/react/dist/csr/Smiley';
import { LightningIcon as Lightning } from '@phosphor-icons/react/dist/csr/Lightning';
import { CrownIcon as Crown } from '@phosphor-icons/react/dist/csr/Crown';
import type { CampaignEmotion } from '@onda/shared-utils';

const EMOTION_ICONS: Record<CampaignEmotion, typeof Heart> = {
  warm: Heart,
  playful: Smiley,
  urgent: Lightning,
  elegant: Crown,
};
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
  CAMPAIGN_EMOTIONS,
  buildObjectiveMessages,
  campaignReachQuote,
  nextRewardSuffix,
  objectiveAudienceQueryParams,
  objectiveHint,
  objectiveLabel,
  recommendedObjectiveDetails,
  renderCampaignTemplate,
  voiceFor,
  formatSlowWindowParts,
  parseSlowWindowLabel,
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

type AudienceMember = {
  passId: string;
  name: string;
  initials: string;
  meta: string;
  phone?: string | null;
  walletRef?: string | null;
  daysSince?: number;
  nearGap?: number | null;
  nextRewardTitle?: string | null;
  visits?: number;
};

type AudienceResponse = {
  headline: string;
  chips: string[];
  kpis: { label: string; value: string }[];
  people: AudienceMember[];
  members?: AudienceMember[];
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

type BrowseResponse = {
  count: number;
  members: AudienceMember[];
};

type BrowseFilters = {
  search: string;
  inactiveFrom: string;
  inactiveTo: string;
  ondasGap: string;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [browse, setBrowse] = useState<BrowseResponse | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>({
    search: '',
    inactiveFrom: '',
    inactiveTo: '',
    ondasGap: '',
  });

  const [proposeLoading, setProposeLoading] = useState(false);

  const proposeParams = async () => {
    if (proposeLoading) return;
    setProposeLoading(true);
    try {
      const p = await api<{
        patch: Partial<ObjectiveDetails>;
        label: string | null;
      }>(
        `/campaigns/propose?storeId=${storeId}&objective=${objectiveKind}`
      );
      if (!p?.patch || Object.keys(p.patch).length === 0) {
        toast(p?.label || 'Aún no hay datos suficientes para proponer');
        return;
      }
      patchDetails(p.patch);
      toast(p.label ? `Propuesta: ${p.label}` : 'Parámetros propuestos aplicados');
    } catch (err: any) {
      toast(err.message || 'No se pudo calcular la propuesta');
    } finally {
      setProposeLoading(false);
    }
  };

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

  const pool: AudienceMember[] = useMemo(
    () =>
      audience && audience.count > 0
        ? audience.members ?? audience.people
        : browse?.members ?? [],
    [audience, browse]
  );

  const effectiveSelected = useMemo(
    () => pool.filter((m) => selected.has(m.passId)),
    [pool, selected]
  );
  const effectiveCount = effectiveSelected.length;

  const toggleMember = (passId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(passId)) next.delete(passId);
      else next.add(passId);
      return next;
    });
  };

  const setAllMembers = (passIds: string[], value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of passIds) {
        if (value) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  // Los miembros del pool entran seleccionados por defecto; los que el
  // usuario quitó siguen fuera mientras sigan en el pool.
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const m of pool) {
        if (!next.has(m.passId)) {
          next.add(m.passId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [pool]);

  const browseFiltersRef = useRef(browseFilters);
  browseFiltersRef.current = browseFilters;

  const loadBrowse = useCallback(() => {
    const f = browseFiltersRef.current;
    const qs = new URLSearchParams({ storeId });
    if (f.search.trim()) qs.set('search', f.search.trim());
    if (f.inactiveFrom) qs.set('inactiveFrom', f.inactiveFrom);
    if (f.inactiveTo) qs.set('inactiveTo', f.inactiveTo);
    if (f.ondasGap) qs.set('ondasGap', f.ondasGap);
    setBrowseLoading(true);
    void api<BrowseResponse>(`/campaigns/audience/browse?${qs.toString()}`)
      .then(setBrowse)
      .catch(() => setBrowse(null))
      .finally(() => setBrowseLoading(false));
  }, [storeId]);

  useEffect(() => {
    if (!audience || audience.count > 0) return;
    loadBrowse();
  }, [audience, loadBrowse]);

  const reachQuote = useMemo(() => {
    const count = effectiveCount;
    const used = quota?.reachUsed ?? 0;
    return campaignReachQuote({
      audienceCount: count,
      reachUsedThisMonth: used,
      unitCop: quota?.unitCop ?? SMS_OVERAGE_COP,
      freeMonthly: quota?.reachLimit ?? CAMPAIGN_FREE_REACH_MONTHLY,
    });
  }, [effectiveCount, quota]);

  const previewName = audience?.people[0]?.name.split(' ')[0] || 'Camila';
  const previewMember = audience?.members?.[0] ?? null;
  const previewSuffix = nextRewardSuffix(
    previewMember?.nearGap,
    previewMember?.nextRewardTitle
  );
  const previewMessages = messages.map((m) => ({
    ...m,
    text: renderCampaignTemplate(m.text, { nombre: previewName }) + previewSuffix,
  }));
  // En el paso de revisión el iPhone muestra cómo llegarían ambas notificaciones;
  // tras el lanzamiento, las notificaciones animadas reemplazan al preview.
  const lockNotifications: LockScreenNotification[] =
    visibleNotifs.length > 0
      ? visibleNotifs
      : step === 2
        ? previewMessages.map((msg) => ({
            id: msg.channel,
            channel: msg.channel,
            message: msg.text,
          }))
        : [];
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

  // La ventana analizada se aplica solo con el botón "Proponer" (ver proposeSlowWindow).

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
      if (rec.objective === 'slow_hours') {
        const parsed = parseSlowWindowLabel(rec.slowWindow || voice.slowWindow);
        if (parsed) {
          nextDetails.slowDows = parsed.dows;
          nextDetails.slowStartHour = parsed.startHour;
          nextDetails.slowEndHour = parsed.endHour;
        }
        nextDetails.slowWindow = formatSlowWindowParts({
          dows: nextDetails.slowDows,
          startHour: nextDetails.slowStartHour,
          endHour: nextDetails.slowEndHour,
        });
      }
      setObjectiveKind(rec.objective);
      setDetails(nextDetails);
    });
  }, [recId, storeId, subcategory, segment]);

  const selectObjective = (kind: ObjectiveKind) => {
    // La ventana analizada ya no se aplica sola: el usuario la aplica con "Proponer".
    const baseLabel = voice.slowWindow;
    const nextDetails = recommendedObjectiveDetails(voice, {
      slowWindow: baseLabel,
    });
    if (kind === 'slow_hours') {
      const parsed = parseSlowWindowLabel(baseLabel);
      if (parsed) {
        nextDetails.slowDows = parsed.dows;
        nextDetails.slowStartHour = parsed.startHour;
        nextDetails.slowEndHour = parsed.endHour;
      }
      nextDetails.slowWindow = formatSlowWindowParts({
        dows: nextDetails.slowDows,
        startHour: nextDetails.slowStartHour,
        endHour: nextDetails.slowEndHour,
      });
    }
    setObjectiveKind(kind);
    setDetails(nextDetails);
  };

  const patchDetails = (patch: Partial<ObjectiveDetails>) => {
    setDetails((d) => {
      const next = { ...d, ...patch };
      if (
        'slowDows' in patch ||
        'slowStartHour' in patch ||
        'slowEndHour' in patch
      ) {
        next.slowWindow = formatSlowWindowParts({
          dows: next.slowDows,
          startHour: next.slowStartHour,
          endHour: next.slowEndHour,
        });
      }
      return next;
    });
  };

  const clearLaunchTimers = () => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  };

  useEffect(() => () => clearLaunchTimers(), []);

  const goToStep = (next: number) => {
    setVisibleNotifs([]);
    clearLaunchTimers();
    setStep(next);
  };

  async function launch() {
    if (saving || launched) return;
    if (!audience) return;
    if (effectiveCount === 0) {
      toast('Selecciona al menos un cliente para la campaña');
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
          audienceCount: effectiveCount,
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
            negativeWithinDays: details.negativeWithinDays,
            slowDows: details.slowDows,
            slowStartHour: details.slowStartHour,
            slowEndHour: details.slowEndHour,
            requireWallet: details.requireWallet,
            rewardName: details.rewardName,
            reviewIncentive: details.reviewIncentive,
            selectedPassIds: effectiveSelected.map((m) => m.passId),
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
    <div className="flex h-[calc(100dvh-170px)] min-h-[560px] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--onda-border)] px-4 py-3">
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

      <div
        className={`grid min-h-0 flex-1 ${
          step === 2
            ? 'lg:grid-cols-[180px_1fr_minmax(260px,300px)]'
            : 'lg:grid-cols-[180px_1fr]'
        }`}
      >
        <aside className="min-h-0 overflow-y-auto border-b border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 lg:border-b-0 lg:border-r">
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

        <div className="flex min-h-0 flex-col p-6 md:p-8">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
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
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {OBJECTIVE_KINDS.map((kind) => {
                      const selected = objectiveKind === kind;
                      return (
                        <button
                          key={kind}
                          type="button"
                          onClick={() => selectObjective(kind)}
                          className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                            selected
                              ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)]'
                              : 'border-[var(--onda-border)] hover:border-[var(--onda-bridge)] hover:bg-white'
                          }`}
                        >
                          <span className="min-w-0">
                            <span
                              className={`block text-sm font-semibold ${
                                selected
                                  ? 'text-[var(--onda-primary-700)]'
                                  : 'text-[var(--onda-ink)]'
                              }`}
                            >
                              {OBJECTIVE_TITLES[kind]}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-[var(--onda-muted)]">
                              {objectiveHint(kind)}
                            </span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition ${
                              selected
                                ? 'bg-[var(--onda-primary-500)] text-white'
                                : 'border border-[var(--onda-border)] bg-white text-transparent'
                            }`}
                          >
                            <Check size={12} weight="bold" />
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <ObjectiveDetailsEditor
                    kind={objectiveKind}
                    details={details}
                    onChange={patchDetails}
                    onPropose={() => void proposeParams()}
                    proposeLoading={proposeLoading}
                  />

                  <div className="mt-4 rounded-2xl border border-[var(--onda-border)] bg-white p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--onda-ink)]">
                        Emoción del mensaje
                      </p>
                      <p className="text-[10px] text-[var(--onda-muted)]">
                        Cambia cómo suena el texto
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {CAMPAIGN_EMOTIONS.map((emotion) => {
                        const active = details.emotion === emotion.id;
                        const Icon = EMOTION_ICONS[emotion.id];
                        return (
                          <button
                            key={emotion.id}
                            type="button"
                            onClick={() => patchDetails({ emotion: emotion.id })}
                            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                              active
                                ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)]'
                                : 'border-[var(--onda-border)] hover:border-[var(--onda-bridge)]'
                            }`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                active
                                  ? 'bg-[var(--onda-primary-500)] text-white'
                                  : 'bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]'
                              }`}
                            >
                              <Icon size={15} weight="duotone" />
                            </span>
                            <span className="min-w-0">
                              <span
                                className={`block text-sm font-semibold ${
                                  active
                                    ? 'text-[var(--onda-primary-700)]'
                                    : 'text-[var(--onda-ink)]'
                                }`}
                              >
                                {emotion.label}
                              </span>
                              <span className="mt-0.5 block truncate text-[10px] text-[var(--onda-muted)]">
                                {emotion.hint}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                  browse={browse}
                  browseLoading={browseLoading}
                  browseFilters={browseFilters}
                  onBrowseFiltersChange={(patch) =>
                    setBrowseFilters((f) => ({ ...f, ...patch }))
                  }
                  onApplyBrowse={loadBrowse}
                  selected={selected}
                  onToggleMember={toggleMember}
                  onSetAll={setAllMembers}
                />
              ) : null}

              {step === 2 ? (
                <div>
                  <h3 className="font-display text-xl font-semibold">
                    Listo para lanzar
                  </h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <SectionCard
                      title="Objetivo"
                      icon={<Target size={15} weight="duotone" />}
                    >
                      <p className="font-display text-lg font-semibold">
                        {objective}
                      </p>
                    </SectionCard>
                    <SectionCard
                      title="Audiencia"
                      icon={<UserList size={15} weight="duotone" />}
                    >
                      <p className="font-display text-2xl font-bold leading-none">
                        {effectiveCount}
                        <span className="ml-1 text-sm font-medium text-[var(--onda-muted)]">
                          de {pool.length}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--onda-muted)]">
                        clientes seleccionados
                      </p>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--onda-primary-100)]">
                        <div
                          className="h-full rounded-full bg-[var(--onda-primary-500)] transition-all"
                          style={{
                            width: `${pool.length > 0 ? Math.round((effectiveCount / pool.length) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </SectionCard>
                    <SectionCard
                      title="Canales"
                      icon={<Megaphone size={15} weight="duotone" />}
                    >
                      <div className="flex flex-wrap gap-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--onda-ink)]">
                          <Bell size={12} weight="duotone" className="text-[var(--onda-primary-700)]" />
                          Push · Wallet
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--onda-border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--onda-ink)]">
                          <ChatText size={12} weight="duotone" className="text-[var(--onda-primary-700)]" />
                          SMS
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] text-[var(--onda-muted)]">
                        El SMS llega a cualquier celular; el push se muestra en el
                        pase de Wallet del cliente.
                      </p>
                    </SectionCard>
                    <SectionCard
                      title="Costo estimado"
                      icon={<CurrencyCircleDollar size={15} weight="duotone" />}
                    >
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-[var(--onda-muted)]">Personas a alcanzar</dt>
                          <dd className="font-medium tabular-nums">{effectiveCount}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt className="text-[var(--onda-muted)]">
                            Incluidas este mes ({reachQuote.freeMonthly})
                          </dt>
                          <dd className="tabular-nums text-[var(--onda-ink)]">
                            {reachQuote.reachUsedThisMonth} usadas ·{' '}
                            {reachQuote.freeApplied} gratis
                          </dd>
                        </div>
                        {reachQuote.paidCount > 0 ? (
                          <div className="flex items-center justify-between gap-4">
                            <dt className="text-[var(--onda-muted)]">Personas de pago</dt>
                            <dd className="font-medium tabular-nums">
                              {reachQuote.paidCount} × {formatCop(reachQuote.unitCop)}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                      <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--onda-sky-soft)] px-3 py-2.5">
                        <p className="text-xs font-semibold text-[var(--onda-ink)]">
                          En la próxima factura
                        </p>
                        <p className="font-display text-xl font-bold text-[var(--onda-ink)]">
                          {reachQuote.costCop === 0 ? 'Gratis' : formatCop(reachQuote.costCop)}
                        </p>
                      </div>
                      {reachQuote.paidCount > 0 && quota && !quota.hasPaymentMethod ? (
                        <p className="mt-3 rounded-xl bg-[var(--onda-warning)]/10 px-3 py-2 text-xs text-[var(--onda-ink)]">
                          Necesitas tarjeta para superar las{' '}
                          {reachQuote.freeMonthly} personas incluidas. El extra
                          se cobra en la factura de consumos.
                        </p>
                      ) : null}
                    </SectionCard>
                    <SectionCard
                      title="Mensajes"
                      icon={<ChatCenteredDots size={15} weight="duotone" />}
                    >
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {previewMessages.map((msg) => (
                          <li
                            key={msg.channel}
                            className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-3"
                          >
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-primary-700)] ring-1 ring-[var(--onda-border)]">
                              {msg.channel === 'SMS' ? (
                                <ChatText size={11} weight="duotone" />
                              ) : (
                                <Bell size={11} weight="duotone" />
                              )}
                              {msg.channelLabel}
                            </span>
                            <p className="mt-2 text-sm leading-snug text-[var(--onda-ink)]">
                              {msg.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                    <SectionCard
                      title="Cuándo sale"
                      icon={<CalendarBlank size={15} weight="duotone" />}
                    >
                      <div className="inline-flex rounded-full bg-[var(--onda-bg)] p-1">
                        <button
                          type="button"
                          onClick={() => setLaunchMode('now')}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                            launchMode === 'now'
                              ? 'bg-white text-[var(--onda-ink)] shadow-sm'
                              : 'text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
                          }`}
                        >
                          Ahora
                        </button>
                        <button
                          type="button"
                          onClick={() => setLaunchMode('schedule')}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                            launchMode === 'schedule'
                              ? 'bg-white text-[var(--onda-ink)] shadow-sm'
                              : 'text-[var(--onda-muted)] hover:text-[var(--onda-ink)]'
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
                          <label className="block text-xs font-medium text-[var(--onda-muted)]">
                            Hora (Bogotá)
                            <input
                              type="time"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                              className="mt-1.5 block w-full rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
                            />
                          </label>
                        </div>
                      ) : (
                        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--onda-muted)]">
                          <Clock size={14} weight="duotone" className="text-[var(--onda-primary-700)]" />
                          Sale hoy, a esta hora.
                        </p>
                      )}
                    </SectionCard>
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--onda-border)] pt-4">
            {!launched && step > 0 ? (
              <button
                type="button"
                onClick={() => goToStep(step - 1)}
                className="rounded-full border border-[var(--onda-border)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--onda-ink)] transition hover:border-[var(--onda-bridge)]"
              >
                ← Atrás
              </button>
            ) : (
              <span aria-hidden />
            )}
            {ctaLabel ? (
              <GradientButton
                type="button"
                disabled={saving}
                onClick={() => {
                  if (step < 2) goToStep(step + 1);
                  else void launch();
                }}
              >
                {step === 2 ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Rocket size={15} weight="duotone" />
                    {ctaLabel}
                  </span>
                ) : (
                  <>
                    {ctaLabel}
                    {' →'}
                  </>
                )}
              </GradientButton>
            ) : (
              <GradientButton type="button" onClick={() => router.push('/campanas')}>
                Ver campañas
              </GradientButton>
            )}
          </div>
        </div>

        <AnimatePresence>
          {step === 2 ? (
            <motion.aside
              key="preview"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="flex min-h-0 flex-col items-center overflow-y-auto border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-6 lg:col-start-3 lg:row-start-1 lg:border-l lg:border-t-0"
            >
              <p className="mb-4 self-start text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
                Preview
              </p>
              <IPhonePreview>
                <LockScreen
                  notifications={lockNotifications}
                  storeName={storeName}
                  logoUrl={store.passDesign?.logoUrl}
                />
              </IPhonePreview>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[var(--onda-primary-700)]">
            {icon}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            {title}
          </span>
        </span>
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--onda-muted)]"
        >
          <CaretDown size={14} weight="bold" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function AudienceStep({
  audience,
  browse,
  browseLoading,
  browseFilters,
  onBrowseFiltersChange,
  onApplyBrowse,
  selected,
  onToggleMember,
  onSetAll,
}: {
  audience: AudienceResponse | null;
  browse: BrowseResponse | null;
  browseLoading: boolean;
  browseFilters: BrowseFilters;
  onBrowseFiltersChange: (patch: Partial<BrowseFilters>) => void;
  onApplyBrowse: () => void;
  selected: Set<string>;
  onToggleMember: (passId: string) => void;
  onSetAll: (passIds: string[], value: boolean) => void;
}) {
  if (!audience) {
    return (
      <p className="text-sm text-[var(--onda-muted)]">Calculando audiencia…</p>
    );
  }

  if (audience.count === 0) {
    return (
      <div>
        <h3 className="font-display text-xl font-semibold">Arma tu audiencia</h3>
        <p className="mt-1 text-sm text-[var(--onda-muted)]">
          Ningún cliente cumple los filtros del objetivo con tus datos actuales.
          Busca entre todos tus clientes y elige quién recibe la campaña.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onApplyBrowse();
          }}
          className="mt-5 grid items-end gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto]"
        >
          <label className="block text-xs font-medium text-[var(--onda-muted)]">
            Nombre o teléfono
            <input
              type="search"
              value={browseFilters.search}
              onChange={(e) => onBrowseFiltersChange({ search: e.target.value })}
              placeholder="Buscar…"
              className="mt-1.5 block w-full rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
            />
          </label>
          <fieldset>
            <legend className="text-xs font-medium text-[var(--onda-muted)]">
              Días sin visita
            </legend>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="number"
                min={0}
                aria-label="Días sin visita, mínimo"
                value={browseFilters.inactiveFrom}
                onChange={(e) => onBrowseFiltersChange({ inactiveFrom: e.target.value })}
                placeholder="Mín."
                className="w-full min-w-0 rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
              />
              <span className="shrink-0 text-xs text-[var(--onda-muted)]">–</span>
              <input
                type="number"
                min={0}
                aria-label="Días sin visita, máximo"
                value={browseFilters.inactiveTo}
                onChange={(e) => onBrowseFiltersChange({ inactiveTo: e.target.value })}
                placeholder="Máx."
                className="w-full min-w-0 rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
              />
            </div>
          </fieldset>
          <label className="block text-xs font-medium text-[var(--onda-muted)]">
            Ondas faltantes
            <input
              type="number"
              min={1}
              value={browseFilters.ondasGap}
              onChange={(e) => onBrowseFiltersChange({ ondasGap: e.target.value })}
              placeholder="Máx."
              className="mt-1.5 block w-full rounded-2xl border border-[var(--onda-border)] bg-white px-3 py-2 text-sm text-[var(--onda-ink)] outline-none focus:border-[var(--onda-bridge)]"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={browseLoading}
              aria-label={browseLoading ? 'Buscando…' : 'Buscar'}
              title={browseLoading ? 'Buscando…' : 'Buscar'}
              className="flex h-[38px] w-[46px] shrink-0 items-center justify-center rounded-2xl bg-[var(--onda-primary-500)] text-white transition hover:bg-[var(--onda-primary-600)] disabled:opacity-70 sm:col-span-2 lg:col-span-1"
            >
              {browseLoading ? (
                <SpinnerGap size={16} weight="bold" className="animate-spin" />
              ) : (
                <MagnifyingGlass size={16} weight="bold" />
              )}
            </button>
          </div>
        </form>

        <div className="mt-5">
          {browseLoading && !browse ? (
            <p className="text-sm text-[var(--onda-muted)]">Cargando clientes…</p>
          ) : !browse ? null : browse.count === 0 ? (
            <p className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-3 text-sm text-[var(--onda-muted)]">
              Sin resultados con estos filtros. Prueba ampliar el rango de días
              sin visita o quitar la búsqueda.
            </p>
          ) : (
            <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4">
              <p className="text-xs font-semibold text-[var(--onda-ink)]">
                Todos los clientes ({browse.count}
                {browse.count > browse.members.length
                  ? ` · mostrando ${browse.members.length}`
                  : ''}
                )
              </p>
              <div className="mt-3">
                <MemberList
                  members={browse.members}
                  selected={selected}
                  onToggle={onToggleMember}
                  onSetAll={onSetAll}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const members = audience.members ?? audience.people;
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">Audiencia encontrada</h3>
        <p className="text-xs font-medium text-[var(--onda-muted)]">
          {members.filter((m) => selected.has(m.passId)).length} de {members.length}{' '}
          seleccionados
        </p>
      </div>
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
          <MemberList
            members={members}
            selected={selected}
            onToggle={onToggleMember}
            onSetAll={onSetAll}
          />
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

function MemberList({
  members,
  selected,
  onToggle,
  onSetAll,
}: {
  members: AudienceMember[];
  selected: Set<string>;
  onToggle: (passId: string) => void;
  onSetAll: (passIds: string[], value: boolean) => void;
}) {
  const selectedCount = members.filter((m) => selected.has(m.passId)).length;
  const allSelected = members.length > 0 && selectedCount === members.length;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--onda-ink)]">
          Personas en el segmento
        </p>
        <button
          type="button"
          onClick={() => onSetAll(members.map((m) => m.passId), !allSelected)}
          className="text-[11px] font-medium text-[var(--onda-primary-700)] hover:underline"
        >
          {allSelected ? 'Quitar todos' : 'Seleccionar todos'}
        </button>
      </div>
      <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto pr-1">
        {members.length === 0 ? (
          <li className="text-sm text-[var(--onda-muted)]">Nadie en este filtro.</li>
        ) : (
          members.map((person) => (
            <li key={person.passId}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[var(--onda-bg)]">
                <input
                  type="checkbox"
                  checked={selected.has(person.passId)}
                  onChange={() => onToggle(person.passId)}
                  className="h-4 w-4 shrink-0 accent-[var(--onda-primary-500)]"
                />
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[10px] font-bold text-[var(--onda-primary-700)]">
                  {person.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{person.name}</p>
                  <p className="text-[11px] text-[var(--onda-muted)]">
                    {person.meta}
                    {person.phone ? ` · ${person.phone}` : ''}
                  </p>
                </div>
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function parseObjective(raw: string | null): ObjectiveKind {
  if (raw === 'reactivate' || raw === 'slow_hours' || raw === 'recover') {
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
