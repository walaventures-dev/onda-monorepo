'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, OndaSelect } from '@onda/shared-ui';
import { UsersThreeIcon as UsersThree } from '@phosphor-icons/react/dist/csr/UsersThree';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
import { UserPlusIcon as UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { WalletIcon as Wallet } from '@phosphor-icons/react/dist/csr/Wallet';
import { CookingPotIcon as CookingPot } from '@phosphor-icons/react/dist/csr/CookingPot';
import { CrownIcon as Crown } from '@phosphor-icons/react/dist/csr/Crown';
import { KeyIcon as Key } from '@phosphor-icons/react/dist/csr/Key';
import { EyeIcon as Eye } from '@phosphor-icons/react/dist/csr/Eye';
import { EyeSlashIcon as EyeSlash } from '@phosphor-icons/react/dist/csr/EyeSlash';
import { ClockCounterClockwiseIcon as Clock } from '@phosphor-icons/react/dist/csr/ClockCounterClockwise';
import { PencilSimpleIcon as Pencil } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { PowerIcon as Power } from '@phosphor-icons/react/dist/csr/Power';
import { CheckCircleIcon as CheckCircle } from '@phosphor-icons/react/dist/csr/CheckCircle';
import { WarningCircleIcon as WarningCircle } from '@phosphor-icons/react/dist/csr/WarningCircle';
import { StorefrontIcon as Storefront } from '@phosphor-icons/react/dist/csr/Storefront';
import { QrCodeIcon as QrCode } from '@phosphor-icons/react/dist/csr/QrCode';
import { useBusinessType, hasDining } from '../lib/businessType';

type PosUserRole = 'ADMIN' | 'ATENCION' | 'CAJA' | 'PREPARACION';

type PosUserDto = {
  id: string;
  username: string;
  name: string;
  role: PosUserRole;
  isActive: boolean;
  lastLoginAt: string | null;
};

/** Color e icono por rol: la identidad visual del equipo en toda la UI. */
const ROLE_META: Record<
  PosUserRole,
  { label: string; description: string; icon: ReactNode; badge: string; avatar: string }
> = {
  ADMIN: {
    label: 'Admin',
    description: 'Acceso total y visibilidad global',
    icon: <Crown className="h-4 w-4" weight="duotone" aria-hidden />,
    badge: 'bg-violet-100 text-violet-700',
    avatar: 'bg-violet-100 text-violet-700',
  },
  ATENCION: {
    label: 'Atención',
    description: 'Vende y acumula ondas',
    icon: <UserCircle className="h-4 w-4" weight="duotone" aria-hidden />,
    badge: 'bg-sky-100 text-sky-700',
    avatar: 'bg-sky-100 text-sky-700',
  },
  CAJA: {
    label: 'Caja',
    description: 'Vende y acumula ondas',
    icon: <Wallet className="h-4 w-4" weight="duotone" aria-hidden />,
    badge: 'bg-emerald-100 text-emerald-700',
    avatar: 'bg-emerald-100 text-emerald-700',
  },
  PREPARACION: {
    label: 'Preparación',
    description: 'Solo el módulo de cocina',
    icon: <CookingPot className="h-4 w-4" weight="duotone" aria-hidden />,
    badge: 'bg-amber-100 text-amber-700',
    avatar: 'bg-amber-100 text-amber-700',
  },
};

const inputCls =
  'onda-input w-full rounded-xl px-3 py-2 text-[var(--onda-ink)]';

function lastLoginLabel(iso: string | null): string {
  if (!iso) return 'Sin accesos aún';
  const d = new Date(iso);
  const date = d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function PosUsersPanel({ storeId }: { storeId: string }) {
  const { businessType } = useBusinessType();
  const dining = hasDining(businessType);
  // Fuera de restauración solo existe el rol Atención (vender y acumular).
  const roleOptions: PosUserRole[] = dining
    ? ['ATENCION', 'CAJA', 'PREPARACION', 'ADMIN']
    : ['ATENCION'];

  const [users, setUsers] = useState<PosUserDto[]>([]);
  const [sharedTabs, setSharedTabs] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{
    kind: 'ok' | 'error';
    text: string;
  } | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<PosUserRole>('ATENCION');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<PosUserRole>('ATENCION');
  const [editPin, setEditPin] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  function notify(kind: 'ok' | 'error', text: string) {
    setFeedback({ kind, text });
  }

  async function reload() {
    if (!storeId) return;
    setLoading(true);
    try {
      const [list, store] = await Promise.all([
        api<PosUserDto[]>(`/stores/${storeId}/pos-users`),
        api<{ posSharedTabs?: boolean }>(`/stores/${storeId}`),
      ]);
      setUsers(list);
      setSharedTabs(Boolean(store.posSharedTabs));
    } catch {
      notify('error', 'No se pudo cargar el equipo. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await api(`/stores/${storeId}/pos-users`, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          pin,
          role,
        }),
      });
      setCreating(false);
      setName('');
      setUsername('');
      setPin('');
      setRole('ATENCION');
      notify('ok', `Usuario @${username.trim()} creado. Ya puede entrar a la caja.`);
      await reload();
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'No se pudo crear el usuario',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(user: PosUserDto) {
    if (editBusy) return;
    setEditBusy(true);
    try {
      await api(`/stores/${storeId}/pos-users/${user.id}`, {
        method: 'POST',
        body: JSON.stringify({
          role: editRole,
          ...(editPin.trim() ? { pin: editPin.trim() } : {}),
        }),
      });
      setEditingId(null);
      setEditPin('');
      notify(
        'ok',
        editPin.trim()
          ? `Rol y PIN de ${user.name} actualizados.`
          : `Rol de ${user.name} actualizado.`,
      );
      await reload();
    } catch (err) {
      notify(
        'error',
        err instanceof Error ? err.message : 'No se pudo actualizar',
      );
    } finally {
      setEditBusy(false);
    }
  }

  async function toggleActive(user: PosUserDto) {
    try {
      await api(`/stores/${storeId}/pos-users/${user.id}`, {
        method: 'POST',
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      notify(
        'ok',
        user.isActive
          ? `${user.name} desactivado: ya no podrá entrar a la caja.`
          : `${user.name} reactivado.`,
      );
      await reload();
    } catch {
      notify('error', 'No se pudo cambiar el estado');
    }
  }

  async function toggleSharedTabs() {
    const next = !sharedTabs;
    setSharedTabs(next);
    try {
      await api(`/stores/${storeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ posSharedTabs: next }),
      });
    } catch {
      setSharedTabs(!next);
      notify('error', 'No se pudo guardar la configuración');
    }
  }

  const activeCount = users.filter((u) => u.isActive).length;

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--onda-primary-50)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-primary-700)]">
          <UsersThree className="h-3.5 w-3.5" weight="bold" aria-hidden />
          Equipo de caja
        </div>
        <h2 className="font-display text-xl font-semibold text-[var(--onda-ink)]">
          Usuarios y perfiles
        </h2>
        <p className="max-w-2xl text-sm text-[var(--onda-muted)]">
          Tu equipo entra a la app de caja con un usuario y un PIN de 4
          dígitos. Solo tú creas usuarios y asignas roles.
          {users.length > 0 ? (
            <>
              {' '}
              <span className="font-medium text-[var(--onda-ink)]">
                {activeCount} activo{activeCount === 1 ? '' : 's'}
              </span>{' '}
              de {users.length}.
            </>
          ) : null}
        </p>
      </div>

      {/* Cómo funciona */}
      <div className="grid gap-2 sm:grid-cols-3">
        {[
          {
            icon: <UserPlus className="h-4 w-4" weight="duotone" aria-hidden />,
            title: '1 · Crea el usuario',
            text: 'Nombre, usuario y PIN de 4 dígitos.',
          },
          {
            icon: <Key className="h-4 w-4" weight="duotone" aria-hidden />,
            title: '2 · Asigna un rol',
            text: 'Cada rol ve solo sus módulos.',
          },
          {
            icon: <Storefront className="h-4 w-4" weight="duotone" aria-hidden />,
            title: '3 · Entran a la caja',
            text: 'Inician sesión y listo: la sesión queda abierta en el dispositivo.',
          },
        ].map((s) => (
          <div
            key={s.title}
            className="onda-card flex items-start gap-2.5 p-3 text-[var(--onda-primary-700)]"
          >
            <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--onda-primary-50)] p-1.5">
              {s.icon}
            </span>
            <span>
              <span className="block text-xs font-semibold text-[var(--onda-ink)]">
                {s.title}
              </span>
              <span className="block text-xs text-[var(--onda-muted)]">
                {s.text}
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Visibilidad de comandas */}
      <div className="onda-card flex items-center justify-between gap-3 p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 shrink-0 rounded-lg bg-[var(--onda-primary-50)] p-1.5 text-[var(--onda-primary-700)]">
            {sharedTabs ? (
              <Eye className="h-4 w-4" weight="duotone" aria-hidden />
            ) : (
              <EyeSlash className="h-4 w-4" weight="duotone" aria-hidden />
            )}
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--onda-ink)]">
              Todos ven las comandas de todos
            </span>
            <span className="block text-xs text-[var(--onda-muted)]">
              {sharedTabs
                ? 'Activado: cualquier usuario puede ver y cobrar las comandas del equipo.'
                : 'Apagado: cada usuario ve solo las comandas que abre o atiende.'}
            </span>
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sharedTabs}
          onClick={() => void toggleSharedTabs()}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            sharedTabs ? 'bg-[var(--onda-primary-500)]' : 'bg-[var(--onda-border)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              sharedTabs ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Feedback */}
      {feedback ? (
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
            feedback.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-600'
          }`}
          role="status"
        >
          {feedback.kind === 'ok' ? (
            <CheckCircle className="h-4 w-4 shrink-0" weight="fill" aria-hidden />
          ) : (
            <WarningCircle className="h-4 w-4 shrink-0" weight="fill" aria-hidden />
          )}
          {feedback.text}
        </div>
      ) : null}

      {/* Lista de usuarios */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--onda-ink)]">
            Equipo ({users.length})
          </h3>
          {!creating ? (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setFeedback(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--onda-primary-500)] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" weight="bold" aria-hidden />
              Agregar usuario
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="onda-card space-y-3 p-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="h-10 w-10 animate-pulse rounded-full bg-[var(--onda-bg)]" />
                <span className="flex-1 space-y-1.5">
                  <span className="block h-3 w-32 animate-pulse rounded bg-[var(--onda-bg)]" />
                  <span className="block h-2.5 w-48 animate-pulse rounded bg-[var(--onda-bg)]" />
                </span>
              </div>
            ))}
          </div>
        ) : users.length === 0 && !creating ? (
          <div className="onda-card flex flex-col items-center gap-3 p-8 text-center">
            <span className="rounded-2xl bg-[var(--onda-primary-50)] p-3 text-[var(--onda-primary-700)]">
              <UsersThree className="h-7 w-7" weight="duotone" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--onda-ink)]">
                Aún no tienes usuarios de caja
              </p>
              <p className="mx-auto max-w-sm text-xs text-[var(--onda-muted)]">
                Crea el primer usuario para que tu equipo pueda entrar a la app
                de caja con su PIN. Tú sigues viendo todo desde aquí.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--onda-primary-500)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" weight="bold" aria-hidden />
              Crear el primer usuario
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const meta = ROLE_META[u.role];
              const editing = editingId === u.id;
              return (
                <div
                  key={u.id}
                  className={`onda-card transition ${
                    u.isActive ? '' : 'opacity-70'
                  } ${editing ? 'ring-2 ring-[var(--onda-primary-200)]' : ''}`}
                >
                  <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${meta.avatar} ${
                        u.isActive ? '' : 'grayscale'
                      }`}
                    >
                      {u.name.trim().slice(0, 1).toUpperCase() || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-[var(--onda-ink)]">
                          {u.name}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                        >
                          {meta.icon}
                          {meta.label}
                        </span>
                        {!u.isActive ? (
                          <span className="rounded-full bg-[var(--onda-bg)] px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--onda-muted)]">
                            Inactivo
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--onda-muted)]">
                        <span>@{u.username}</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden />
                          {lastLoginLabel(u.lastLoginAt)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editing ? null : u.id);
                          setEditRole(u.role);
                          setEditPin('');
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--onda-border)] px-3 py-1.5 text-xs font-medium text-[var(--onda-ink)] transition hover:bg-[var(--onda-bg)]"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(u)}
                        title={u.isActive ? 'Desactivar acceso' : 'Reactivar acceso'}
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          u.isActive
                            ? 'border-[var(--onda-border)] text-[var(--onda-muted)] hover:bg-red-50 hover:text-red-600'
                            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" weight="bold" aria-hidden />
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>

                  {editing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveEdit(u);
                      }}
                      className="space-y-3 rounded-b-[inherit] border-t border-[var(--onda-border)] bg-[var(--onda-bg)]/60 p-3 sm:p-4"
                    >
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="space-y-1 text-xs">
                          <span className="font-medium text-[var(--onda-muted)]">
                            Rol
                          </span>
                          <OndaSelect
                            value={editRole}
                            onChange={(v) => setEditRole(v as PosUserRole)}
                            options={roleOptions.map((r) => ({
                              id: r,
                              label: ROLE_META[r].label,
                            }))}
                            aria-label="Rol"
                          />
                          <span className="block text-[11px] text-[var(--onda-muted)]">
                            {ROLE_META[editRole].description}
                          </span>
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="font-medium text-[var(--onda-muted)]">
                            PIN nuevo
                          </span>
                          <input
                            className={inputCls}
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            value={editPin}
                            onChange={(e) =>
                              setEditPin(
                                e.target.value.replace(/\D/g, '').slice(0, 4),
                              )
                            }
                            placeholder="•••• (vacío = sin cambio)"
                          />
                        </label>
                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={editBusy}
                            className="rounded-xl bg-[var(--onda-primary-500)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {editBusy ? 'Guardando…' : 'Guardar cambios'}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario de creación */}
      {creating ? (
        <form
          onSubmit={createUser}
          className="onda-card space-y-4 p-4 ring-2 ring-[var(--onda-primary-200)] sm:p-5"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-[var(--onda-primary-50)] p-1.5 text-[var(--onda-primary-700)]">
              <UserPlus className="h-4 w-4" weight="duotone" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-[var(--onda-ink)]">
                Nuevo usuario de caja
              </p>
              <p className="text-xs text-[var(--onda-muted)]">
                Comparte el usuario y el PIN con tu colaborador.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-[var(--onda-muted)]">Nombre</span>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Laura"
                required
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-[var(--onda-muted)]">Usuario</span>
              <input
                className={inputCls}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. laura"
                autoComplete="off"
                required
              />
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-[var(--onda-muted)]">
                PIN de 4 dígitos
              </span>
              <input
                className={inputCls}
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                }
                placeholder="••••"
                required
              />
            </label>
          </div>

          {/* Selector de rol como tarjetas */}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-[var(--onda-muted)]">
              Rol y módulos que puede usar
            </legend>
            <div
              className={`grid gap-2 ${
                roleOptions.length > 2 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'
              }`}
            >
              {roleOptions.map((r) => {
                const meta = ROLE_META[r];
                const selected = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    aria-pressed={selected}
                    className={`flex items-start gap-2 rounded-xl border p-3 text-left transition ${
                      selected
                        ? 'border-[var(--onda-primary-500)] bg-[var(--onda-primary-50)] ring-1 ring-[var(--onda-primary-500)]'
                        : 'border-[var(--onda-border)] hover:bg-[var(--onda-bg)]'
                    }`}
                  >
                    <span className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${meta.badge}`}>
                      {meta.icon}
                    </span>
                    <span>
                      <span className="block text-xs font-semibold text-[var(--onda-ink)]">
                        {meta.label}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--onda-muted)]">
                        {r === 'PREPARACION' ? (
                          <CookingPot className="h-3 w-3" aria-hidden />
                        ) : (
                          <QrCode className="h-3 w-3" aria-hidden />
                        )}
                        {meta.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || pin.length !== 4}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--onda-primary-500)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              <Key className="h-4 w-4" weight="bold" aria-hidden />
              {busy ? 'Creando…' : 'Crear usuario'}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-xl px-4 py-2 text-sm font-medium text-[var(--onda-muted)] transition hover:bg-[var(--onda-bg)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {/* Leyenda de roles */}
      <div className="rounded-xl border border-dashed border-[var(--onda-border)] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--onda-muted)]">
          ¿Qué puede hacer cada rol?
        </p>
        <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
          {roleOptions.map((r) => (
            <p key={r} className="flex items-center gap-2 text-xs text-[var(--onda-muted)]">
              <span className={`rounded-md p-1 ${ROLE_META[r].badge}`}>
                {ROLE_META[r].icon}
              </span>
              <span>
                <span className="font-semibold text-[var(--onda-ink)]">
                  {ROLE_META[r].label}:
                </span>{' '}
                {ROLE_META[r].description}
              </span>
            </p>
          ))}
        </div>
        {!dining ? (
          <p className="mt-2 text-[11px] text-[var(--onda-muted)]">
            En negocios que no son de restauración solo aplica el rol Atención.
          </p>
        ) : null}
      </div>
    </div>
  );
}
