"use client";

import { useEffect, useState } from "react";
import {
  KpiCard,
  GradientButton,
  FilterChip,
  ImageUploadField,
  promoTypeLabel,
  formatPromoBenefit,
  promoDisplayTitle,
  PROMO_TYPE_OPTIONS,
  api,
  type PromoTypeKey,
  OndaIcons,
  SegmentedControl,
} from "@onda/shared-ui";
import {
  displayPhone,
  formatMoneyInput,
  parseMoneyInput,
} from "@onda/shared-utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

function deltaLabel(n?: number | null) {
  if (n == null) return undefined;
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}%`;
}

function isoDateInput(d?: string | Date | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function PromoDetail({
  detail,
  loading,
  onBack,
  onToggle,
  onDelete,
  onDuplicate,
  onSaved,
  onMovePool,
}: {
  detail: any | null;
  loading: boolean;
  onBack: () => void;
  onToggle: (id: string, isActive: boolean) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onDuplicate: (promo: any) => void;
  onSaved: () => void | Promise<void>;
  onMovePool?: (
    promo: any,
    pool: "BIENVENIDA" | "RETENCION",
  ) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scope, setScope] = useState<string>("global");
  const [scoped, setScoped] = useState<any | null>(null);
  const promo = detail?.promotion;
  const view = scoped && scope !== "global" ? scoped : detail;
  const k = view?.kpis;
  const locked = Boolean(detail?.locked);
  const [form, setForm] = useState({
    description: "",
    imageUrl: "",
    type: "PRODUCT" as PromoTypeKey,
    value: "",
    buyQuantity: "2",
    getQuantity: "1",
    productName: "",
    maxRedemptions: "",
  });

  useEffect(() => {
    if (!promo) return;
    setForm({
      description: promo.description || "",
      imageUrl: promo.imageUrl || "",
      type: (promo.type as PromoTypeKey) || "PRODUCT",
      value: promo.value != null ? String(promo.value) : "",
      buyQuantity: promo.buyQuantity != null ? String(promo.buyQuantity) : "2",
      getQuantity: promo.getQuantity != null ? String(promo.getQuantity) : "1",
      productName: promo.productName || "",
      maxRedemptions:
        promo.maxRedemptions != null ? String(promo.maxRedemptions) : "",
    });
    setEditing(false);
    setError("");
    setScope("global");
    setScoped(null);
  }, [promo?.id, detail?.redemptionCount, detail?.locked]);

  useEffect(() => {
    if (!promo?.id || scope === "global") {
      setScoped(null);
      return;
    }
    const from = detail?.range?.from?.slice(0, 10);
    const to = detail?.range?.to?.slice(0, 10);
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    q.set("cartillaId", scope);
    let cancelled = false;
    void api(`/promotions/${promo.id}/analytics?${q}`).then((data) => {
      if (!cancelled) setScoped(data);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, promo?.id, detail?.range?.from, detail?.range?.to]);

  if (loading && !promo) {
    return (
      <div className="onda-card p-8 text-center text-sm text-[var(--onda-muted)]">
        Cargando detalle…
      </div>
    );
  }

  if (!promo) {
    return (
      <div className="onda-card space-y-3 p-6 text-center">
        <p className="text-sm text-[var(--onda-muted)]">
          No se pudo cargar la promoción.
        </p>
        <button
          type="button"
          className="cursor-pointer text-sm font-medium text-[var(--onda-violet)]"
          onClick={onBack}
        >
          ← Volver al listado
        </button>
      </div>
    );
  }

  const benefit = formatPromoBenefit(promo);
  const hasHourly = (view?.hourly || []).some((h: any) => h.canjes > 0);

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      let body: Record<string, unknown>;
      if (locked) {
        body = { imageUrl: form.imageUrl || null };
      } else {
        body = {
          description: form.description.trim() || null,
          imageUrl: form.imageUrl || null,
          type: form.type,
          maxRedemptions: form.maxRedemptions
            ? Number(form.maxRedemptions)
            : null,
          productName: form.productName || null,
          value: form.value ? Number(form.value) : null,
          buyQuantity: form.buyQuantity ? Number(form.buyQuantity) : null,
          getQuantity: form.getQuantity ? Number(form.getQuantity) : null,
        };
      }
      await api(`/promotions/${promo.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setEditing(false);
      await onSaved();
    } catch (err: any) {
      setError(err.message || "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 cursor-pointer text-xs font-medium text-[var(--onda-muted)] hover:text-[var(--onda-ink)]"
          >
            ← Todas las promociones
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold">
              {promoDisplayTitle(promo)}
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--onda-violet-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--onda-violet)]">
              {PROMO_TYPE_OPTIONS.find((t) => t.id === promo.type)?.icon ||
                OndaIcons.other}
              {promoTypeLabel(promo.type)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                promo.isActive
                  ? "bg-[var(--onda-success)]/15 text-[var(--onda-success)]"
                  : "bg-[var(--onda-bg)] text-[var(--onda-muted)]"
              }`}
            >
              {promo.isActive ? OndaIcons.check : OndaIcons.close}
              {promo.isActive ? "Activa" : "Inactiva"}
            </span>
            {locked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">
                {OndaIcons.lock}
                Ya redimida · solo foto editable
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--onda-muted)]">{benefit}</p>
          <p className="mt-1 text-xs text-[var(--onda-muted)]">
            {promo.pool === "BIENVENIDA"
              ? "Bolsa Adquisición"
              : "Bolsa Retención"}
            {" · "}
            Cupo: {detail?.redemptionCount ?? 0}/{promo.maxRedemptions ?? "∞"}{" "}
            redenciones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onMovePool ? (
            <SegmentedControl
              aria-label="Bolsa de la promoción"
              value={promo.pool === "BIENVENIDA" ? "BIENVENIDA" : "RETENCION"}
              onChange={(pool) => {
                if (pool !== promo.pool) void onMovePool(promo, pool);
              }}
              options={[
                {
                  id: "BIENVENIDA",
                  label: "Adquisición",
                  icon: OndaIcons.sparkle,
                },
                { id: "RETENCION", label: "Retención", icon: OndaIcons.users },
              ]}
            />
          ) : null}
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? OndaIcons.close : OndaIcons.edit}
            {editing ? "Cerrar edición" : "Editar"}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium"
            onClick={() => onDuplicate(promo)}
          >
            {OndaIcons.copy}
            Duplicar
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[var(--onda-border)] bg-[var(--onda-card)] px-3 py-1.5 text-xs font-medium"
            onClick={() => onToggle(promo.id, promo.isActive)}
          >
            {OndaIcons.power}
            {promo.isActive ? "Desactivar" : "Activar"}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--onda-danger)]"
            onClick={() => onDelete(promo.id)}
          >
            {OndaIcons.trash}
            Eliminar
          </button>
        </div>
      </div>

      {editing ? (
        <form
          onSubmit={saveEdit}
          className="onda-card grid gap-5 p-5 lg:grid-cols-[220px_1fr]"
        >
          <ImageUploadField
            label="Imagen"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm((f) => ({ ...f, imageUrl }))}
          />
          <div className="space-y-3">
            {locked ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Ya hubo al menos un canje: solo puedes actualizar la foto. El
                resto queda bloqueado para no alterar lo ya reclamado. Usa
                “Duplicar” para una nueva.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {PROMO_TYPE_OPTIONS.map((t) => (
                    <FilterChip
                      key={t.id}
                      selected={form.type === t.id}
                      icon={t.icon}
                      onClick={() => setForm((f) => ({ ...f, type: t.id }))}
                    >
                      {t.label}
                    </FilterChip>
                  ))}
                </div>
                <p className="rounded-xl bg-[var(--onda-bg)] px-3 py-2 text-sm font-medium">
                  {promoDisplayTitle({
                    ...form,
                    value: form.value ? Number(form.value) : null,
                    buyQuantity: Number(form.buyQuantity) || null,
                    getQuantity: Number(form.getQuantity) || null,
                  })}
                </p>
                <textarea
                  rows={2}
                  className="w-full rounded-xl border border-[var(--onda-border)] px-3 py-2.5 text-sm"
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
                {form.type === "PERCENT_OFF" ? (
                  <label className="block text-sm text-[var(--onda-muted)]">
                    Porcentaje (1–100)
                    <input
                      type="number"
                      min={1}
                      max={100}
                      required
                      className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                      value={form.value}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, value: e.target.value }))
                      }
                    />
                  </label>
                ) : null}
                {form.type === "AMOUNT_OFF" ? (
                  <label className="block text-sm text-[var(--onda-muted)]">
                    Valor de descuento (COP)
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      required
                      className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                      value={formatMoneyInput(form.value)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          value: parseMoneyInput(e.target.value),
                        }))
                      }
                    />
                  </label>
                ) : null}
                {form.type === "BUY_GET" ? (
                  <div className="flex flex-wrap gap-3">
                    <label className="text-sm text-[var(--onda-muted)]">
                      Compra N
                      <input
                        type="number"
                        min={1}
                        required
                        className="ml-2 w-20 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={form.buyQuantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            buyQuantity: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm text-[var(--onda-muted)]">
                      Lleva M
                      <input
                        type="number"
                        min={1}
                        required
                        className="ml-2 w-20 rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={form.getQuantity}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            getQuantity: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : null}
                {form.type === "PRODUCT" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm text-[var(--onda-muted)]">
                      Nombre del producto
                      <input
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={form.productName}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            productName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="text-sm text-[var(--onda-muted)]">
                      Precio del producto (COP)
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        required
                        className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                        value={formatMoneyInput(form.value)}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            value: parseMoneyInput(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                ) : null}
                <label className="block text-sm text-[var(--onda-muted)]">
                  Cupo de redenciones (opcional)
                  <input
                    type="number"
                    min={1}
                    className="mt-1 w-full rounded-xl border border-[var(--onda-border)] px-3 py-2 text-sm text-[var(--onda-ink)]"
                    value={form.maxRedemptions}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, maxRedemptions: e.target.value }))
                    }
                  />
                </label>
              </>
            )}
            {error ? (
              <p className="text-sm text-[var(--onda-danger)]">{error}</p>
            ) : null}
            <GradientButton type="submit" disabled={busy}>
              {OndaIcons.save}
              {busy ? "Guardando…" : "Guardar cambios"}
            </GradientButton>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <FilterChip
          selected={scope === "global"}
          onClick={() => setScope("global")}
        >
          Global
        </FilterChip>
        {(detail?.byCartilla || []).map((c: any) => (
          <FilterChip
            key={c.cartillaId}
            selected={scope === c.cartillaId}
            onClick={() => setScope(c.cartillaId)}
          >
            {c.name}
          </FilterChip>
        ))}
      </div>

      {scope === "global" && (detail?.byCartilla || []).length > 0 ? (
        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-4 py-3">
            <h3 className="font-display font-semibold">
              Rendimiento por cartilla
            </h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-[var(--onda-muted)]">
              <tr>
                <th className="p-3 font-medium">Cartilla</th>
                <th className="p-3 font-medium">Estado</th>
                <th className="p-3 font-medium">Canjes</th>
                <th className="p-3 font-medium">Asignados</th>
              </tr>
            </thead>
            <tbody>
              {detail.byCartilla.map((c: any) => (
                <tr
                  key={c.cartillaId}
                  className="border-t border-[var(--onda-border)]"
                >
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 text-[var(--onda-muted)]">{c.status}</td>
                  <td className="p-3">{c.canjes}</td>
                  <td className="p-3">
                    {c.assignmentCount}
                    {c.assignmentCap != null ? ` / ${c.assignmentCap}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {scope !== "global" ? (
        <p className="text-xs text-[var(--onda-muted)]">
          KPIs y gráficos del rango, filtrados a esta cartilla. Recarga el
          detalle desde el listado si acabas de cambiar el filtro en la URL.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
        <div className="overflow-hidden rounded-2xl border border-[var(--onda-border)] bg-[var(--onda-bg)]">
          {promo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={promo.imageUrl}
              alt=""
              className="aspect-[4/3] h-full w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center onda-gradient text-2xl font-bold text-white/90">
              Onda
            </div>
          )}
        </div>
        <div className="onda-kpi-grid">
          <KpiCard
            label="Canjes en rango"
            value={k?.canjes ?? 0}
            delta={deltaLabel(k?.canjesDelta)}
            positive={(k?.canjesDelta ?? 0) >= 0}
          />
          <KpiCard label="Clientes únicos" value={k?.clientesUnicos ?? 0} />
          <KpiCard label="Restantes" value={k?.remaining ?? "∞"} />
          <KpiCard
            label="Conv. elegibles"
            value={`${k?.conversionElegibles ?? 0}%`}
          />
          <KpiCard label="Ondas gastadas" value={k?.ondasGastadas ?? 0} />
          <KpiCard label="Canjes totales" value={k?.canjesAllTime ?? 0} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <div className="onda-card flex flex-col p-5">
          <h3 className="font-display font-semibold">Canjes por día</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={view?.series || []}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => String(v).slice(5)}
                  fontSize={11}
                />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="canjes"
                  name="Canjes"
                  fill="#6E5AE6"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="onda-card flex flex-col p-5">
          <h3 className="font-display font-semibold">
            {hasHourly ? "Horario de canjes" : "Coste en ondas"}
          </h3>
          <div className="mt-4 h-56">
            {hasHourly ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={view?.hourly || []}>
                  <XAxis dataKey="hour" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="canjes"
                    stroke="#3DB9E8"
                    strokeWidth={2}
                    name="Canjes"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <p className="font-display text-4xl font-semibold">
                  {k?.costeMedioOndas ?? "—"}
                </p>
                <p className="mt-2 text-sm text-[var(--onda-muted)]">
                  Ondas promedio por canje · {k?.clientesRepetidores ?? 0}{" "}
                  clientes repitieron en el rango.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-4 py-3">
            <h3 className="font-display font-semibold">
              Clientes que redimieron
              <span className="ml-2 text-sm font-normal text-[var(--onda-muted)]">
                {view?.redeemers?.length ?? 0}
              </span>
            </h3>
          </div>
          <div className="max-h-80 overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="sticky top-0 bg-[var(--onda-bg)] text-[var(--onda-muted)]">
                <tr>
                  <th className="p-3 font-medium">Cliente</th>
                  <th className="p-3 font-medium">WhatsApp</th>
                  <th className="p-3 font-medium">Canjes</th>
                  <th className="p-3 font-medium">Último</th>
                </tr>
              </thead>
              <tbody>
                {(view?.redeemers || []).map((r: any) => (
                  <tr
                    key={r.userId}
                    className="border-t border-[var(--onda-border)]"
                  >
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-[var(--onda-muted)]">
                      {displayPhone(r.phone)}
                    </td>
                    <td className="p-3">{r.redemptions}</td>
                    <td className="p-3 text-xs text-[var(--onda-muted)]">
                      {new Date(r.lastRedeemAt).toLocaleDateString("es-CO")}
                    </td>
                  </tr>
                ))}
                {!view?.redeemers?.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-[var(--onda-muted)]"
                    >
                      Nadie ha redimido esta promo en el rango.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="onda-card overflow-hidden">
          <div className="border-b border-[var(--onda-border)] px-4 py-3">
            <h3 className="font-display font-semibold">
              Historial de redenciones
              <span className="ml-2 text-sm font-normal text-[var(--onda-muted)]">
                {detail?.history?.length ?? 0}
              </span>
            </h3>
          </div>
          <ul className="max-h-80 space-y-0 overflow-auto">
            {(detail?.history || []).map((h: any) => (
              <li
                key={h.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--onda-border)] px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{h.user.name}</p>
                  <p className="text-xs text-[var(--onda-muted)]">
                    {displayPhone(h.user.phone)} · −{h.points} ondas
                  </p>
                </div>
                <time className="shrink-0 text-xs text-[var(--onda-muted)]">
                  {new Date(h.createdAt).toLocaleString("es-CO")}
                </time>
              </li>
            ))}
            {!detail?.history?.length ? (
              <li className="p-6 text-center text-sm text-[var(--onda-muted)]">
                Sin redenciones en este periodo.
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
