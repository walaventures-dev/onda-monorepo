'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  OndaSelect,
  ObjectiveDetailsEditor,
} from '@onda/shared-ui';
import {
  AUDIENCE_BY_OBJECTIVE,
  CHANNELS,
  DEMO_STORE,
  OBJECTIVE_KINDS,
  OBJECTIVE_TITLES,
  STORE_CATEGORY_LABELS,
  STORE_SUBCATEGORY_LABELS,
  STORE_SEGMENT_LABELS,
  StoreCategory,
  StoreSubcategory,
  StoreSegment,
  buildObjectiveMessages,
  campaignReachQuote,
  demoStoreName,
  formatCop,
  objectiveHint,
  objectiveLabel,
  recommendedObjectiveDetails,
  subcategoryOptions,
  segmentOptions,
  defaultSegmentFor,
  voiceFor,
  type CampaignMessage,
  type ObjectiveDetails,
  type ObjectiveKind,
} from '../lib/campaign-demo';
import { fadeUpDelay, inViewStagger, staggerItem } from '../lib/motion';
import { onboardingUrl } from '../lib/pricing';
import { CAMPAIGN_FREE_REACH_MONTHLY } from '@onda/shared-types';
import {
  IPhonePreview,
  LockScreen,
  type LockScreenNotification,
} from './mocks/IPhonePreview';

const STEPS = [
  { id: 0, label: '1. Objetivo' },
  { id: 1, label: '2. Audiencia' },
  { id: 2, label: '3. Revisión' },
] as const;

const NOTIF_DELAYS_MS = [900, 2600] as const;

const CATEGORY_OPTIONS = (
  Object.keys(STORE_CATEGORY_LABELS) as StoreCategory[]
).map((id) => ({ id, label: STORE_CATEGORY_LABELS[id] }));

export function CampaignSection() {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<StoreCategory>(DEMO_STORE.category);
  const [subcategory, setSubcategory] = useState<StoreSubcategory>(
    DEMO_STORE.subcategory
  );
  const [segment, setSegment] = useState<StoreSegment>(DEMO_STORE.segment);
  const [objectiveKind, setObjectiveKind] = useState<ObjectiveKind>('reactivate');
  const [details, setDetails] = useState<ObjectiveDetails>(() =>
    recommendedObjectiveDetails(
      voiceFor(DEMO_STORE.subcategory, DEMO_STORE.segment)
    )
  );
  const [launched, setLaunched] = useState(false);
  const [visibleNotifs, setVisibleNotifs] = useState<LockScreenNotification[]>([]);
  const launchTimersRef = useRef<number[]>([]);

  const voice = voiceFor(subcategory, segment);
  const storeName = demoStoreName(subcategory);
  const audience = AUDIENCE_BY_OBJECTIVE[objectiveKind];
  const objective = objectiveLabel(objectiveKind, voice, details);
  const messages = useMemo(
    () =>
      buildObjectiveMessages({
        kind: objectiveKind,
        voice,
        storeName,
        details,
        firstName: audience.people[0]?.name.split(' ')[0],
        slowWindow: details.slowWindow,
      }),
    [objectiveKind, voice, storeName, audience.people, details]
  );

  const demoQuote = useMemo(
    () =>
      campaignReachQuote({
        audienceCount: Number(audience.kpis[0]?.value) || 104,
        reachUsedThisMonth: 12,
      }),
    [audience.kpis]
  );

  const clearLaunchTimers = () => {
    launchTimersRef.current.forEach((id) => window.clearTimeout(id));
    launchTimersRef.current = [];
  };

  const resetLaunch = () => {
    clearLaunchTimers();
    setLaunched(false);
    setVisibleNotifs([]);
  };

  const goToStep = (next: number) => {
    if (launched) resetLaunch();
    setStep(next);
  };

  useEffect(() => () => clearLaunchTimers(), []);

  const applyVertical = (
    nextCategory: StoreCategory,
    nextSub: StoreSubcategory,
    nextSegment?: StoreSegment,
    keepObjective: ObjectiveKind = objectiveKind
  ) => {
    const nextSeg = nextSegment ?? defaultSegmentFor(nextSub);
    const nextVoice = voiceFor(nextSub, nextSeg);
    const nextDetails = recommendedObjectiveDetails(nextVoice);
    setCategory(nextCategory);
    setSubcategory(nextSub);
    setSegment(nextSeg);
    setDetails(nextDetails);
    resetLaunch();
  };

  const selectObjective = (kind: ObjectiveKind) => {
    const nextDetails = recommendedObjectiveDetails(voice);
    setObjectiveKind(kind);
    setDetails(nextDetails);
    resetLaunch();
  };

  const patchDetails = (patch: Partial<ObjectiveDetails>) => {
    setDetails({ ...details, ...patch });
    resetLaunch();
  };

  const handleCta = () => {
    if (launched) return;
    if (step < 2) {
      goToStep(step + 1);
      return;
    }

    setLaunched(true);
    setVisibleNotifs([]);
    clearLaunchTimers();
    messages.forEach((msg, index) => {
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
  };

  const ctaLabel =
    step < 2 ? 'Siguiente' : launched ? null : 'Lanzar campaña';

  return (
    <section id="campanas" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
      <motion.div {...inViewStagger} className="max-w-2xl">
        <motion.h2
          variants={staggerItem}
          className="font-display text-[clamp(1.75rem,4vw,2.75rem)] font-bold tracking-tight text-[var(--onda-ink)]"
        >
          Llena el local cuando esté flojo.
        </motion.h2>
        <motion.p variants={staggerItem} className="mt-3 text-lg text-[var(--onda-muted)]">
          Desde Lealtad: objetivo, audiencia y revisión en tres pasos. Llegas a
          tus clientes por Wallet y SMS — {CAMPAIGN_FREE_REACH_MONTHLY} personas
          alcanzadas gratis al mes.
        </motion.p>
      </motion.div>

      <motion.div
        {...fadeUpDelay(0.1)}
        className="mt-12 overflow-hidden rounded-[1.5rem] border border-[var(--onda-border)] bg-[var(--onda-card)] shadow-[0_20px_50px_rgba(26,27,46,0.08)]"
      >
        <div className="grid lg:grid-cols-[180px_1fr_minmax(260px,300px)]">
          <aside className="border-b border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 lg:border-b-0 lg:border-r">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Nueva campaña
            </p>
            <nav className="mt-3 flex gap-2 overflow-x-auto lg:flex-col">
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
                  <ObjectiveStep
                    category={category}
                    subcategory={subcategory}
                    segment={segment}
                    objectiveKind={objectiveKind}
                    details={details}
                    onCategoryChange={(next) => {
                      const subs = subcategoryOptions(next);
                      applyVertical(
                        next,
                        subs[0]?.id ?? StoreSubcategory.BEAUTY
                      );
                    }}
                    onSubcategoryChange={(next) => applyVertical(category, next)}
                    onSegmentChange={(next) => {
                      applyVertical(category, subcategory, next);
                    }}
                    onObjectiveChange={selectObjective}
                    onDetailsChange={patchDetails}
                  />
                ) : null}

                {step === 1 ? (
                  <AudienceStep audience={audience} />
                ) : null}

                {step === 2 ? (
                  <ReviewStep
                    objective={objective}
                    audience={audience}
                    messages={messages}
                    quote={demoQuote}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <aside className="flex flex-col items-center border-t border-[var(--onda-border)] bg-[var(--onda-bg)] px-4 py-6 lg:border-l lg:border-t-0">
            <p className="mb-4 self-start text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
              Preview
            </p>
            <IPhonePreview>
              <LockScreen notifications={visibleNotifs} storeName={storeName} />
            </IPhonePreview>

            {launched ? (
              <a
                href={onboardingUrl('PRO')}
                className="mt-5 flex w-full max-w-[280px] items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
              >
                Poner mi negocio en la Onda →
              </a>
            ) : (
              <button
                type="button"
                onClick={handleCta}
                className="mt-5 flex w-full max-w-[280px] items-center justify-center rounded-full bg-[var(--onda-primary-500)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--onda-primary-600)] active:scale-[0.98]"
              >
                {ctaLabel}
                {step < 2 ? ' →' : ''}
              </button>
            )}
          </aside>
        </div>
      </motion.div>
    </section>
  );
}

function ObjectiveStep({
  category,
  subcategory,
  segment,
  objectiveKind,
  details,
  onCategoryChange,
  onSubcategoryChange,
  onSegmentChange,
  onObjectiveChange,
  onDetailsChange,
}: {
  category: StoreCategory;
  subcategory: StoreSubcategory;
  segment: StoreSegment;
  objectiveKind: ObjectiveKind;
  details: ObjectiveDetails;
  onCategoryChange: (category: StoreCategory) => void;
  onSubcategoryChange: (subcategory: StoreSubcategory) => void;
  onSegmentChange: (segment: StoreSegment) => void;
  onObjectiveChange: (kind: ObjectiveKind) => void;
  onDetailsChange: (patch: Partial<ObjectiveDetails>) => void;
}) {
  const voice = voiceFor(subcategory, segment);
  const liveLabel = objectiveLabel(objectiveKind, voice, details);
  const categoryLabel = STORE_CATEGORY_LABELS[category];
  const subcategoryLabel = STORE_SUBCATEGORY_LABELS[subcategory];
  const segmentLabel = STORE_SEGMENT_LABELS[segment];

  return (
    <div>
      <h3 className="font-display text-xl font-semibold">¿Qué quieres lograr?</h3>
      <p className="mt-1 text-sm text-[var(--onda-muted)]">
        Elige el propósito (trae recomendación) y ajústalo a detalle.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-[var(--onda-muted)]">
          Tipo de negocio
          <div className="mt-1.5">
            <OndaSelect
              compact
              aria-label="Tipo de negocio"
              value={category}
              options={CATEGORY_OPTIONS}
              onChange={(id) => onCategoryChange(id as StoreCategory)}
            />
          </div>
        </label>
        <label className="block text-xs font-medium text-[var(--onda-muted)]">
          Categoría
          <div className="mt-1.5">
            <OndaSelect
              compact
              aria-label="Categoría del negocio"
              value={subcategory}
              options={subcategoryOptions(category)}
              onChange={(id) => onSubcategoryChange(id as StoreSubcategory)}
            />
          </div>
        </label>
        <label className="block text-xs font-medium text-[var(--onda-muted)]">
          Subcategoría
          <div className="mt-1.5">
            <OndaSelect
              compact
              aria-label="Subcategoría del negocio"
              value={segment}
              options={segmentOptions(subcategory)}
              onChange={(id) => onSegmentChange(id as StoreSegment)}
            />
          </div>
        </label>
      </div>

      <p className="mt-2 text-[11px] text-[var(--onda-muted)]">
        Combinación:{' '}
        <span className="font-medium text-[var(--onda-ink)]">
          {categoryLabel} → {subcategoryLabel} → {segmentLabel}
        </span>
      </p>

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
        {OBJECTIVE_KINDS.map((kind) => {
          const selected = objectiveKind === kind;
          const label = objectiveLabel(
            kind,
            voice,
            selected ? details : recommendedObjectiveDetails(voice)
          );
          return (
            <button
              key={kind}
              type="button"
              onClick={() => onObjectiveChange(kind)}
              className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                selected
                  ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] text-[var(--onda-ink)] shadow-[0_8px_20px_rgba(5,45,222,0.08)]'
                  : 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:border-[var(--onda-bridge)] hover:bg-white'
              }`}
            >
              <span
                className={`block text-sm font-semibold ${
                  selected ? 'text-[var(--onda-primary-700)]' : 'text-[var(--onda-ink)]'
                }`}
              >
                {OBJECTIVE_TITLES[kind]}
              </span>
              <span className="mt-1 block text-xs leading-snug text-[var(--onda-muted)]">
                {objectiveHint(kind)}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${kind}-${subcategory}-${segment}-${label}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className={`mt-2 block text-xs leading-snug ${
                    selected
                      ? 'font-medium text-[var(--onda-ink)]'
                      : 'text-[var(--onda-muted)]'
                  }`}
                >
                  {label}
                </motion.span>
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <ObjectiveDetailsEditor
        kind={objectiveKind}
        details={details}
        onChange={onDetailsChange}
      />

      <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--onda-sky-soft)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--onda-muted)]">
          Objetivo vivo
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={liveLabel}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22 }}
            className="mt-1 text-sm font-medium text-[var(--onda-ink)]"
          >
            {liveLabel}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AudienceStep({
  audience,
}: {
  audience: (typeof AUDIENCE_BY_OBJECTIVE)[ObjectiveKind];
}) {
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
            {audience.people.map((person) => (
              <li key={person.name} className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--onda-primary-100)] text-[10px] font-bold text-[var(--onda-primary-700)]">
                  {person.initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--onda-ink)]">
                    {person.name}
                  </p>
                  <p className="text-[11px] text-[var(--onda-muted)]">{person.meta}</p>
                </div>
              </li>
            ))}
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

function ReviewStep({
  objective,
  audience,
  messages,
  quote,
}: {
  objective: string;
  audience: (typeof AUDIENCE_BY_OBJECTIVE)[ObjectiveKind];
  messages: CampaignMessage[];
  quote: ReturnType<typeof campaignReachQuote>;
}) {
  const audienceCount = Number(audience.kpis[0]?.value) || 104;
  return (
    <div>
      <h3 className="font-display text-xl font-semibold">Listo para lanzar</h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Objetivo
          </p>
          <p className="mt-1.5 font-display text-lg font-semibold text-[var(--onda-ink)]">
            {objective}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Audiencia
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-[var(--onda-ink)]">
            {audienceCount}
          </p>
          <p className="text-sm text-[var(--onda-muted)]">clientes</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {audience.chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="rounded-full bg-[var(--onda-primary-100)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-primary-700)]"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Canales
          </p>
          <ul className="mt-3 space-y-2">
            {CHANNELS.map((c) => (
              <li
                key={c}
                className="flex items-center gap-2 text-sm text-[var(--onda-ink)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--onda-success)]" />
                {c === 'Wallet' ? 'Push · Wallet' : 'SMS'}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Costo estimado (alcance)
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--onda-muted)]">Personas a alcanzar</dt>
              <dd>{audienceCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--onda-muted)]">
                Gratis este mes ({quote.freeMonthly})
              </dt>
              <dd>
                {quote.reachUsedThisMonth} usadas → {quote.freeApplied} gratis
              </dd>
            </div>
            {quote.paidCount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--onda-muted)]">Personas de pago</dt>
                <dd>
                  {quote.paidCount} × {formatCop(quote.unitCop)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-[var(--onda-border)] pt-2 font-semibold">
              <dt>Costo estimado</dt>
              <dd>{formatCop(quote.costCop)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-[var(--onda-muted)]">
            ROI tras el envío: — (demo)
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--onda-border)] bg-white p-4 sm:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--onda-muted)]">
            Mensajes · push y SMS
          </p>
          <ul className="mt-3 space-y-2">
            {messages.map((msg) => (
              <li key={msg.channel} className="text-sm leading-snug text-[var(--onda-ink)]">
                <span className="font-semibold text-[var(--onda-primary-700)]">
                  {msg.channelLabel}:
                </span>{' '}
                {msg.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

