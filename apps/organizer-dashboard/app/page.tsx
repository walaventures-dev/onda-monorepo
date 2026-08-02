'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell, KpiCard, GradientButton, PassPreview, HeatmapPoints, OndaSelect, OndaColorPicker, useOndaDialogs, api } from '@onda/shared-ui';
import { displayPhone, derivePassPalette } from '@onda/shared-utils';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

type Tab = 'evento' | 'aliados' | 'analytics' | 'sorteos' | 'pase';

export default function OrganizerPage() {
  const [tab, setTab] = useState<Tab>('analytics');
  const [events, setEvents] = useState<any[]>([]);
  const [eventId, setEventId] = useState('');
  const [macro, setMacro] = useState<any>(null);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [design, setDesign] = useState<any>(null);
  const [drawResult, setDrawResult] = useState<any>(null);
  const { confirm, alert, dialogs } = useOndaDialogs();

  const event = events.find((e) => e.id === eventId);

  const nav = useMemo(
    () =>
      (
        [
          ['analytics', 'Analítica'],
          ['aliados', 'Aliados'],
          ['evento', 'Evento'],
          ['pase', 'Pase del evento'],
          ['sorteos', 'Sorteos'],
        ] as const
      ).map(([href, label]) => ({
        href: `#${href}`,
        label,
        active: tab === href,
      })),
    [tab]
  );

  useEffect(() => {
    api<any[]>('/events').then((list) => {
      setEvents(list);
      if (list[0]) setEventId(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!eventId) return;
    api(`/analytics/event/${eventId}/macro`).then(setMacro);
    api(`/memberships?eventId=${eventId}`).then(setMemberships);
    api(`/pass-designs/event/${eventId}`).then(setDesign).catch(() => null);
  }, [eventId]);

  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || '#analytics').slice(1) as Tab;
      if (h) setTab(h);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  async function invite(storeId: string) {
    const ok = await confirm({
      title: 'Enviar invitación',
      message: 'Se enviará la invitación al aliado por WhatsApp (número Onda).',
      confirmLabel: 'Enviar',
      tone: 'accent',
    });
    if (!ok) return;
    await api('/memberships/invite', {
      method: 'POST',
      body: JSON.stringify({ storeId, eventId }),
    });
    setMemberships(await api(`/memberships?eventId=${eventId}`));
    await alert({
      title: 'Invitación enviada',
      message: 'El aliado recibirá el mensaje de WhatsApp.',
      tone: 'success',
    });
  }

  async function setStatus(id: string, status: string) {
    const labels: Record<string, string> = {
      ACCEPTED: 'aceptar',
      PENDING: 'dejar pendiente',
      REJECTED: 'rechazar',
    };
    const ok = await confirm({
      title: 'Cambiar estado',
      message: `¿Seguro que quieres ${labels[status] || 'actualizar'} este aliado?`,
      confirmLabel: 'Confirmar',
      tone: status === 'REJECTED' ? 'danger' : 'accent',
    });
    if (!ok) return;
    await api(`/memberships/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, nfcKitId: status === 'ACCEPTED' ? `NFC-${Date.now()}` : undefined }),
    });
    setMemberships(await api(`/memberships?eventId=${eventId}`));
  }

  async function runDraw() {
    const ok = await confirm({
      title: 'Ejecutar sorteo',
      message: 'Se elegirá un ganador al azar entre los participantes del evento.',
      confirmLabel: 'Sortear',
      tone: 'warning',
    });
    if (!ok) return;
    const res = await api('/draws', {
      method: 'POST',
      body: JSON.stringify({ eventId, note: 'Sorteo en vivo' }),
    });
    setDrawResult(res);
    await alert({
      title: 'Sorteo listo',
      message: 'Ya puedes ver el ganador y exportar el resultado.',
      tone: 'success',
    });
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;
    await api(`/events/${event.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: event.name,
        globalTarget: event.globalTarget,
        status: event.status,
      }),
    });
    await alert({
      title: 'Evento actualizado',
      message: 'Los cambios del evento quedaron guardados.',
      tone: 'success',
    });
  }

  async function saveDesign(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...design,
      ...derivePassPalette(design.backgroundColor || '#6E5AE6'),
    };
    const saved = await api(`/pass-designs/event/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setDesign(saved);
    await alert({
      title: 'Diseño guardado',
      message: 'La vista previa del pase del evento quedó actualizada.',
      tone: 'success',
    });
  }

  return (
    <>
    <AppShell
      title={event?.name || 'Organizer'}
      nav={nav}
      userName="Org"
      toolbar={
        <OndaSelect
          aria-label="Evento"
          value={eventId}
          onChange={setEventId}
          placeholder="Seleccionar evento"
          options={events.map((ev) => ({ id: ev.id, label: ev.name }))}
        />
      }
    >
      {tab === 'analytics' && (
        <div className="flex flex-col gap-6">
          <div className="onda-kpi-grid">
            <KpiCard label="Ondas globales" value={macro?.totalOndas ?? 0} positive delta="+8%" />
            <KpiCard label="Aliados aceptados" value={macro?.acceptedStores ?? 0} />
            <KpiCard label="Top visitor" value={macro?.topVisitor?.user?.name || '—'} />
          </div>
          <div className="onda-two-col">
            <div className="onda-card p-5">
              <h3 className="font-display font-semibold">Ranking comercios</h3>
              <div className="mt-4 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={macro?.ranking || []} margin={{ left: 8, right: 8 }}>
                    <XAxis dataKey="storeName" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis allowDecimals={false} width={32} />
                    <Tooltip />
                    <Bar dataKey="ondas" fill="#6E5AE6" radius={[8, 8, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="onda-card p-5">
              <h3 className="font-display font-semibold">Mapa de calor</h3>
              <div className="mt-4">
                <HeatmapPoints points={macro?.heatmap || []} />
                {!macro?.heatmap?.length ? (
                  <p className="text-[var(--onda-muted)]">Sin coordenadas aún.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'aliados' && (
        <div className="flex flex-col gap-3">
          {memberships.map((m) => (
            <div
              key={m.id}
              className="onda-card flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="font-medium">{m.store?.name}</p>
                <p className="text-sm text-[var(--onda-muted)]">
                  {m.status} {m.nfcKitId ? `· Kit ${m.nfcKitId}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full bg-[var(--onda-sky-soft)] px-3 py-1 text-xs text-[var(--onda-sky)]"
                  onClick={() => setStatus(m.id, 'ACCEPTED')}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="rounded-full bg-[var(--onda-violet-soft)] px-3 py-1 text-xs text-[var(--onda-violet)]"
                  onClick={() => setStatus(m.id, 'DECLINED')}
                >
                  Rechazar
                </button>
                <button
                  type="button"
                  className="rounded-full border px-3 py-1 text-xs"
                  onClick={() => invite(m.storeId)}
                >
                  Reenviar WA
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'evento' && event && (
        <form onSubmit={saveEvent} className="onda-card max-w-lg space-y-3 p-5">
          <h3 className="font-display font-semibold">Gestión de evento</h3>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={event.name}
            onChange={(e) =>
              setEvents(events.map((ev) => (ev.id === eventId ? { ...ev, name: e.target.value } : ev)))
            }
          />
          <input
            type="number"
            className="w-full rounded-xl border px-3 py-2"
            value={event.globalTarget}
            onChange={(e) =>
              setEvents(
                events.map((ev) =>
                  ev.id === eventId ? { ...ev, globalTarget: Number(e.target.value) } : ev
                )
              )
            }
          />
          <OndaSelect
            aria-label="Estado del evento"
            value={event.status}
            onChange={(status) =>
              setEvents(
                events.map((ev) => (ev.id === eventId ? { ...ev, status } : ev))
              )
            }
            options={[
              { id: 'DRAFT', label: 'DRAFT' },
              { id: 'ACTIVE', label: 'ACTIVE' },
              { id: 'FINISHED', label: 'FINISHED' },
            ]}
            className="w-full"
          />
          <GradientButton type="submit">Guardar</GradientButton>
        </form>
      )}

      {tab === 'pase' && design && (
        <div className="onda-pass-designer-layout">
          <form onSubmit={saveDesign} className="onda-card onda-pass-designer p-6">
            <h3 className="font-display text-lg font-semibold">Diseño del pase</h3>

            <div className="onda-pass-designer-brand">
              <div className="onda-pass-designer-brand-color onda-pass-designer-brand-color--solo">
                <OndaColorPicker
                  label="Color de marca"
                  value={design.backgroundColor || '#6E5AE6'}
                  fallback="#6E5AE6"
                  onChange={(backgroundColor) =>
                    setDesign({
                      ...design,
                      ...derivePassPalette(backgroundColor),
                    })
                  }
                />
                <p className="mt-2 text-xs leading-snug text-[var(--onda-muted)]">
                  El texto se ajusta solo para contraste y jerarquía.
                </p>
              </div>
            </div>

            <div className="onda-pass-designer-fields">
              <div className="onda-pass-designer-row">
                <label>
                  <span>Título</span>
                  <input
                    value={design.title || ''}
                    onChange={(e) => setDesign({ ...design, title: e.target.value })}
                  />
                </label>
                <label>
                  <span>Subtítulo</span>
                  <input
                    value={design.subtitle || ''}
                    onChange={(e) => setDesign({ ...design, subtitle: e.target.value })}
                  />
                </label>
              </div>

              <label>
                <span>Descripción</span>
                <textarea
                  rows={3}
                  value={design.description || ''}
                  onChange={(e) => setDesign({ ...design, description: e.target.value })}
                />
              </label>

              <div className="flex justify-end pt-1">
                <GradientButton type="submit">Guardar</GradientButton>
              </div>
            </div>
          </form>
          <div className="onda-pass-designer-preview">
            <p className="onda-pass-designer-label mb-3">Vista previa</p>
            <PassPreview {...design} points={event?.globalTarget || 10} memberName="Cliente demo" />
          </div>
        </div>
      )}

      {tab === 'sorteos' && (
        <div className="onda-card max-w-xl space-y-4 p-5">
          <h3 className="font-display font-semibold">Gestor de sorteos</h3>
          <GradientButton type="button" onClick={runDraw}>
            Ejecutar sorteo aleatorio
          </GradientButton>
          {drawResult?.winner ? (
            <div className="rounded-xl bg-[var(--onda-violet-soft)] p-4">
              <p className="font-semibold">Ganador: {drawResult.winner.name}</p>
              <p className="text-sm">{displayPhone(drawResult.winner.phone)}</p>
              <p className="mt-2 text-sm text-[var(--onda-muted)]">
                Más visitas: {drawResult.topVisitor?.user?.name} (
                {drawResult.topVisitor?.visits})
              </p>
              <pre className="mt-3 max-h-40 overflow-auto rounded bg-white p-2 text-xs">
                {drawResult.exportCsv}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </AppShell>
    {dialogs}
    </>
  );
}
