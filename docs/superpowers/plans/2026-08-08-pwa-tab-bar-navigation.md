# Tab bar "Mis tarjetas" / "Perfil" en pwa-client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Post-implementation note:** the final whole-branch review found cross-task issues this plan's per-task text below does not reflect — see `.superpowers/sdd/2026-08-08-pwa-tab-bar-navigation/progress.md` (ledger) for the full list. In particular: the tab bar now gates on `session.user.name` being set, not just a session existing; `AppShell` always renders `<Tabs>` and toggles only `Tabs.List`'s `hidden` attribute (never swaps between a `Fragment` and `<Tabs>`, which was remounting the page underneath it); the `.onda-pwa-appshell--tabbed` class described in Task 3 below was removed in a later fix and no longer exists in the code — the padding rule that superseded it lives on `.onda-pwa-tabbed-content` instead, applied directly to `Tabs.Panel`. The task text below is kept as-authored for historical record; it does not describe the final shipped code.

**Goal:** Add a persistent bottom tab bar to `apps/pwa-client` with two destinations — "Mis tarjetas" (`/`) and "Perfil" (`/perfil`, new) — visible only while a customer session exists, plus make "Mis tarjetas" jump straight to the single-card detail view when the user has exactly one pass.

**Architecture:** `lib/session.ts` gains an event-based `useSession()` hook so session changes (which happen mid-page, without navigation, during the OTP→name login flow in `/r/[storeId]`) are observable without touching the existing login flow. A new client component `AppShell.tsx`, mounted in `layout.tsx`, reads `useSession()` and — only when a session exists — wraps `{children}` in Hero UI's `Tabs` component used purely as routed navigation chrome (`selectedKey` derived from the pathname, `onSelectionChange` calls `router.push`, a single `Tabs.Panel` renders `{children}`). `MisTarjetasClient.tsx` gains a one-pass redirect to the existing `/r/[storeId]` detail view (no new detail UI). A new `/perfil` route reuses the existing `.onda-pwa-*` CSS classes (no new UI kit) for name edit / phone display / logout, backed entirely by already-existing API endpoints.

**Tech Stack:** Next.js 16 App Router (`apps/pwa-client`), React 19 client components, Hero UI v3 (`@heroui/react`, re-exported through `@onda/shared-ui`), Phosphor icons (`@phosphor-icons/react`, via the shared `OndaIcons` map in `libs/shared/ui/src/icons.tsx`), existing `api()` helper.

## Global Constraints

- No backend changes. `GET /customer-auth/session`, `PATCH /customer-auth/profile`, `POST /customer-auth/logout` already exist in `apps/api/src/customer-auth.controller.ts` (spec section 3).
- `StoreEntryClient.tsx` is NOT modified — the single-pass redirect reuses its existing `step: 'home'` view as-is (spec section 2.3).
- Hero UI is used only for the tab bar (`Tabs`). The new `/perfil` screen uses the existing `.onda-pwa-*` CSS classes, matching every other screen in `pwa-client` — no other Hero UI components are introduced (explicit user decision).
- Icons come only from the shared `OndaIcons` map in `libs/shared/ui/src/icons.tsx` — no per-component icon imports in `apps/pwa-client` (matches existing project convention; CLAUDE.md).
- Tab bar is visible only when `useSession()` returns non-null. It must appear without a page navigation the moment `saveSession()` is called mid-flow inside `/r/[storeId]`, and disappear the moment `clearSession()` is called (spec sections 2.1, 2.2, 4).
- **No Playwright, no E2E tests, no dev server.** Verification per task is `tsc --noEmit` + `nx build pwa-client`, plus showing the diff for manual review — per explicit user constraint.

---

### Task 1: Session reactivity — `useSession()` hook

**Files:**
- Modify: `apps/pwa-client/lib/session.ts` (full file)

**Interfaces:**
- Consumes: nothing new (existing `localStorage`-backed `loadSession`/`saveSession`/`clearSession`).
- Produces: `useSession(): CustomerSession | null` — a React hook, exported from `apps/pwa-client/lib/session.ts`, that returns the current session and re-renders its caller whenever `saveSession()` or `clearSession()` is called anywhere in the app. `saveSession`/`clearSession`/`loadSession`/`CustomerSession` keep their existing signatures — no existing caller (`MisTarjetasClient.tsx`, `StoreEntryClient.tsx`) needs to change.

- [ ] **Step 1: Rewrite `apps/pwa-client/lib/session.ts`**

Replace the entire file contents with:

```ts
import { useEffect, useState } from 'react';

export type CustomerSession = {
  token: string;
  user: { id: string; name: string; phone: string };
};

const KEY = 'onda_customer_session';
const SESSION_CHANGED_EVENT = 'onda-session-changed';

export function loadSession(): CustomerSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CustomerSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: CustomerSession) {
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

export function useSession(): CustomerSession | null {
  const [session, setSession] = useState<CustomerSession | null>(() => loadSession());

  useEffect(() => {
    function sync() {
      setSession(loadSession());
    }
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    return () => window.removeEventListener(SESSION_CHANGED_EVENT, sync);
  }, []);

  return session;
}
```

Notes: `saveSession`/`clearSession` keep their exact existing call signatures (`saveSession(session)`, `clearSession()`), so `MisTarjetasClient.tsx` and `StoreEntryClient.tsx` require zero changes for this task. The event fires even for the tab/component that itself called `saveSession`/`clearSession` (not just other tabs), which is required — `useSession()` needs to observe changes made by `StoreEntryClient.tsx` in the same page.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds.

- [ ] **Step 4: Show the diff for manual review**

Run: `git diff -- apps/pwa-client/lib/session.ts`
Paste the output back for review. No Playwright/E2E per user constraint.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa-client/lib/session.ts
git commit -m "$(cat <<'EOF'
Add useSession() hook for reactive customer session state

saveSession()/clearSession() now dispatch a window event, and a new
useSession() hook subscribes to it. Needed because login (OTP -> name)
happens inside /r/[storeId] without a navigation, so anything that
needs to react to "session just appeared" (the upcoming tab bar)
can't rely on route changes alone. Existing callers of
loadSession/saveSession/clearSession are unaffected.
EOF
)"
```

---

### Task 2: Add `wallet`/`profile` icons to the shared icon map

**Files:**
- Modify: `libs/shared/ui/src/icons.tsx:1-96` (imports block + `OndaIcons` object)

**Interfaces:**
- Consumes: nothing new.
- Produces: `OndaIcons.wallet` and `OndaIcons.profile` — two new `ReactNode` entries on the existing `OndaIcons` object exported from `libs/shared/ui/src/icons.tsx` (re-exported from `@onda/shared-ui`). Used by Task 3's `AppShell.tsx`.

- [ ] **Step 1: Add the two icon imports**

In `libs/shared/ui/src/icons.tsx`, after the existing `import { SnowflakeIcon as Snowflake } from '@phosphor-icons/react/dist/csr/Snowflake';` line (line 46), add:

```tsx
import { CreditCardIcon as CreditCard } from '@phosphor-icons/react/dist/csr/CreditCard';
import { UserCircleIcon as UserCircle } from '@phosphor-icons/react/dist/csr/UserCircle';
```

- [ ] **Step 2: Add the two `OndaIcons` entries**

In the same file, after the existing `snowflake: <Snowflake size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,` line (inside the `OndaIcons` object, just before its closing `};`), add:

```tsx
  wallet: <CreditCard size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  profile: <UserCircle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
```

- [ ] **Step 3: Type-check and build the consuming app**

`shared-ui` has no standalone build target — it's consumed as source via the `@onda/shared-ui` path alias, so type-checking `pwa-client` (which will consume `OndaIcons.wallet`/`.profile` starting in Task 3, but already imports other `OndaIcons` members transitively today) is sufficient to catch any mistake in this file.

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors.

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds.

- [ ] **Step 4: Show the diff for manual review**

Run: `git diff -- libs/shared/ui/src/icons.tsx`
Paste the output back for review.

- [ ] **Step 5: Commit**

```bash
git add libs/shared/ui/src/icons.tsx
git commit -m "$(cat <<'EOF'
Add wallet and profile icons to the shared OndaIcons map

CreditCard and UserCircle, for the new pwa-client tab bar (Mis
tarjetas / Perfil). Added to the shared icon map rather than imported
directly in apps/pwa-client, matching the project's existing
convention of centralizing Phosphor icon imports in one file.
EOF
)"
```

---

### Task 3: `AppShell` bottom tab bar, wired into `layout.tsx`

**Files:**
- Modify: `libs/shared/ui/src/index.tsx:7` (re-export `Tabs` from `@heroui/react`)
- Create: `apps/pwa-client/app/AppShell.tsx`
- Modify: `apps/pwa-client/app/layout.tsx` (wrap `{children}` with `AppShell`)
- Modify: `apps/pwa-client/app/globals.css` (append tab bar styles)

**Interfaces:**
- Consumes: `useSession()` from `../lib/session` (Task 1); `OndaIcons.wallet`/`OndaIcons.profile` from `@onda/shared-ui` (Task 2); `Tabs` from `@onda/shared-ui` (this task adds the re-export).
- Produces: `AppShell` — a client component exported from `apps/pwa-client/app/AppShell.tsx` as `export function AppShell({ children }: { children: ReactNode })`, consumed by `layout.tsx`. No other task depends on it.

Every other app in this repo imports Hero UI components only through `@onda/shared-ui`, never directly from `@heroui/react` (confirmed: `libs/shared/ui/src/index.tsx` re-exports `Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker`; no app imports `@heroui/react` directly). `Tabs` isn't re-exported yet, so Step 1 adds it to that same list.

- [ ] **Step 1: Re-export `Tabs` from shared-ui**

In `libs/shared/ui/src/index.tsx`, change line 7 from:

```tsx
export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker } from '@heroui/react';
```

to:

```tsx
export { Button, Card, Chip, Avatar, Badge, Spinner, Form, TextField, Input, TextArea, InputOTP, Table, ColorPicker, Tabs } from '@heroui/react';
```

- [ ] **Step 2: Create `apps/pwa-client/app/AppShell.tsx`**

```tsx
'use client';

import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Tabs, OndaIcons } from '@onda/shared-ui';
import { useSession } from '../lib/session';

type TabKey = 'wallet' | 'perfil';

function tabKeyForPath(pathname: string): TabKey {
  return pathname === '/perfil' ? 'perfil' : 'wallet';
}

export function AppShell({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!session) {
    return <>{children}</>;
  }

  const selectedKey = tabKeyForPath(pathname);

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={(key) => router.push(key === 'perfil' ? '/perfil' : '/')}
      className="onda-pwa-appshell--tabbed"
    >
      <Tabs.List className="onda-pwa-tabbar" aria-label="Navegación principal">
        <Tabs.Tab id="wallet" className="onda-pwa-tab">
          {OndaIcons.wallet}
          <span>Mis tarjetas</span>
        </Tabs.Tab>
        <Tabs.Tab id="perfil" className="onda-pwa-tab">
          {OndaIcons.profile}
          <span>Perfil</span>
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel id={selectedKey}>{children}</Tabs.Panel>
    </Tabs>
  );
}
```

Notes:
- `selectedKey`/`onSelectionChange` drive navigation via `router.push` — there's no local panel-switching, `{children}` is always whatever page Next.js's router currently renders. Rendering a single `Tabs.Panel` whose `id` always matches `selectedKey` (rather than one `TabPanel` per tab) is a supported react-aria-components pattern for panel content that's expensive or externally driven — here, driven by the router.
- "Mis tarjetas" is selected for every path except `/perfil` (covers `/` and `/r/[storeId]`, per spec section 2.3 — both are the same functional section).
- When there's no session, the component is a pure passthrough — no tab bar markup renders at all, so there's no residual fixed-position element to hide.

- [ ] **Step 3: Wire `AppShell` into `layout.tsx`**

In `apps/pwa-client/app/layout.tsx`, add the import and wrap `{children}`:

```tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppShell } from './AppShell';

export const metadata: Metadata = {
  title: 'Onda',
  description: 'Tu pase de lealtad en un toque',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Onda',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#F3F6FB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="onda-pwa min-h-dvh antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Append tab bar styles to `apps/pwa-client/app/globals.css`**

At the end of the file (after the existing `.onda-pwa-hola-card` block), add:

```css
.onda-pwa-appshell--tabbed .onda-pwa-shell {
  padding-bottom: calc(4.75rem + env(safe-area-inset-bottom, 0));
}

.onda-pwa-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem calc(0.6rem + env(safe-area-inset-bottom, 0));
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  border-top: 1px solid var(--onda-border);
}

.onda-pwa-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-width: 6.5rem;
  padding: 0.5rem 1rem;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--onda-muted);
  outline: none;
  cursor: pointer;
}

.onda-pwa-tab[data-selected='true'] {
  background: var(--onda-violet);
  color: #fff;
}

.onda-pwa-tab[data-focus-visible='true'] {
  box-shadow: 0 0 0 3px var(--onda-violet-soft);
}
```

`.onda-pwa-shell` (used by every existing page) already sits inside `AppShell`'s `Tabs.Panel`; the `.onda-pwa-appshell--tabbed .onda-pwa-shell` rule only adds bottom padding when a session exists (i.e., when `AppShell` actually renders the `Tabs` wrapper carrying that class), so pages never lose content behind the fixed bar. `[data-selected]`/`[data-focus-visible]` are react-aria-components' standard state attributes on `Tab`.

This is new visual surface that can't be pixel-verified without a browser, per the no-dev-server constraint — the CSS above is a reasonable first pass (matches existing tokens: `--onda-violet`, `--onda-violet-soft`, `--onda-border`, `999px` pill radius already used by `.onda-pwa-cta`/`.onda-pwa-secondary`), but flag it for a manual look once the user does their own visual pass.

- [ ] **Step 5: Type-check**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors. In particular, confirm `Tabs.List`/`Tabs.Tab`/`Tabs.Panel` resolve their types correctly through the new `@onda/shared-ui` re-export.

- [ ] **Step 6: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds.

- [ ] **Step 7: Show the diff for manual review**

Run: `git diff -- libs/shared/ui/src/index.tsx apps/pwa-client/app/AppShell.tsx apps/pwa-client/app/layout.tsx apps/pwa-client/app/globals.css`
Paste the output back for review. No Playwright/E2E per user constraint.

- [ ] **Step 8: Commit**

```bash
git add libs/shared/ui/src/index.tsx apps/pwa-client/app/AppShell.tsx apps/pwa-client/app/layout.tsx apps/pwa-client/app/globals.css
git commit -m "$(cat <<'EOF'
Add session-aware bottom tab bar (Mis tarjetas / Perfil)

New AppShell client component, mounted in layout.tsx, wraps all pages
in a Hero UI Tabs-based bottom nav — but only once useSession() is
non-null, so the bar is absent during onboarding/OTP and appears the
moment login completes, and disappears on logout, all without a page
navigation. Tabs is used purely as routed nav chrome: selectedKey
comes from the pathname, onSelectionChange calls router.push, and a
single Tabs.Panel renders whatever page Next.js's router is currently
showing.
EOF
)"
```

---

### Task 4: Single-pass redirect in "Mis tarjetas"

**Files:**
- Modify: `apps/pwa-client/app/MisTarjetasClient.tsx:34-68` (`boot()` function only)

**Interfaces:**
- Consumes: nothing new — same `api()`, `loadSession()`, `useRouter()` already imported in this file.
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Add the one-pass redirect branch in `boot()`**

In `apps/pwa-client/app/MisTarjetasClient.tsx`, inside `boot()`, change:

```ts
      if (userPasses.length === 0 && SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;

      if (!cancelled) {
        setPasses(userPasses);
        setStep('cards');
      }
```

to:

```ts
      if (userPasses.length === 0 && SIMULATE_QR_SCAN && (await simulateQrScan(router))) return;

      if (userPasses.length === 1) {
        if (!cancelled) router.replace(`/r/${userPasses[0].storeId}`);
        return;
      }

      if (!cancelled) {
        setPasses(userPasses);
        setStep('cards');
      }
```

This reuses the same `router.replace('/r/{storeId}')` navigation the existing card list already uses for each `<Link href={/r/${p.storeId}}>` (`MisTarjetasClient.tsx:109`), just triggered automatically when there's exactly one card instead of requiring a tap. `StoreEntryClient.tsx` at that route already handles "existing session, existing pass for this store" correctly (`loadOrClaim` → `step: 'home'`) — no changes needed there. Not gated behind `SIMULATE_QR_SCAN`/`NODE_ENV`: this is permanent product behavior, unlike the QR-scan simulation.

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds.

- [ ] **Step 4: Show the diff for manual review**

Run: `git diff -- apps/pwa-client/app/MisTarjetasClient.tsx`
Paste the output back for review. No Playwright/E2E per user constraint.

- [ ] **Step 5: Commit**

```bash
git add apps/pwa-client/app/MisTarjetasClient.tsx
git commit -m "$(cat <<'EOF'
Redirect Mis tarjetas straight to the card when there's only one

Skips the list-of-one-card screen: with exactly one pass, jump
directly to its existing /r/{storeId} detail view (accumulate ondas,
claim rewards, add to wallet) instead of making the user tap through
a list containing a single item. Unlike the QR-scan simulation, this
runs in production too.
EOF
)"
```

---

### Task 5: `/perfil` route

**Files:**
- Create: `apps/pwa-client/app/perfil/page.tsx`
- Create: `apps/pwa-client/app/perfil/ProfileClient.tsx`

**Interfaces:**
- Consumes: `useSession()`, `saveSession()`, `clearSession()`, `type CustomerSession` from `../../lib/session` (Task 1); `api()`, `OndaIcons` from `@onda/shared-ui`.
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 1: Create `apps/pwa-client/app/perfil/page.tsx`**

```tsx
import { ProfileClient } from './ProfileClient';

export default function ProfilePage() {
  return <ProfileClient />;
}
```

- [ ] **Step 2: Create `apps/pwa-client/app/perfil/ProfileClient.tsx`**

```tsx
'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api, OndaIcons } from '@onda/shared-ui';
import { useSession, saveSession, clearSession, type CustomerSession } from '../../lib/session';

export function ProfileClient() {
  const session = useSession();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (session === null) {
      router.replace('/');
    }
  }, [session, router]);

  if (!session) {
    return (
      <div className="onda-pwa-shell items-center justify-center gap-3">
        <div className="onda-pwa-avatar onda-pwa-avatar--pulse" aria-hidden />
      </div>
    );
  }

  function startEditing() {
    setName(session.user.name);
    setError('');
    setEditing(true);
  }

  async function submitName(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const updated = await api<CustomerSession['user']>('/customer-auth/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ name: name.trim() }),
      });
      saveSession({ token: session.token, user: updated });
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'No se pudo guardar tu nombre');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api('/customer-auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` },
      });
    } finally {
      clearSession();
    }
  }

  return (
    <div className="onda-pwa-shell">
      <header className="onda-pwa-hero">
        <div className="onda-pwa-hero-copy">
          <p className="onda-pwa-eyebrow">Onda</p>
          <h1 className="onda-pwa-title">Perfil</h1>
        </div>
      </header>

      <div className="onda-pwa-body onda-pwa-fade">
        <div className="onda-pwa-fields">
          <div>
            <p className="onda-pwa-label">Nombre</p>
            {editing ? (
              <form className="mt-1 flex items-center gap-2" onSubmit={submitName}>
                <input
                  required
                  autoFocus
                  minLength={2}
                  className="onda-pwa-field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button
                  type="submit"
                  className="onda-pwa-link"
                  disabled={busy || name.trim().length < 2}
                >
                  {busy ? 'Guardando…' : 'Guardar'}
                </button>
              </form>
            ) : (
              <div className="onda-pwa-field mt-1 flex items-center justify-between gap-2">
                <span>{session.user.name}</span>
                <button type="button" aria-label="Editar nombre" onClick={startEditing}>
                  {OndaIcons.edit}
                </button>
              </div>
            )}
            {error ? <p className="mt-1 text-sm text-[var(--onda-danger)]">{error}</p> : null}
          </div>

          <div>
            <p className="onda-pwa-label">Teléfono</p>
            <div className="onda-pwa-field mt-1">{session.user.phone}</div>
          </div>
        </div>

        <button type="button" className="onda-pwa-secondary mt-6" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
```

Notes:
- The `useEffect` redirect handles both edge cases from spec section 4 with one code path: direct unauthenticated access to `/perfil`, and the moment `clearSession()` runs from the "Cerrar sesión" button on this same screen (both make `session` become `null`, both redirect to `/`).
- Name edit calls the existing `PATCH /customer-auth/profile` and, on success, `saveSession()` with the updated user — this fires the Task 1 event, so anything else reading `useSession()` (i.e. `AppShell`) picks up the new name immediately; other screens that call `loadSession()` directly (`StoreEntryClient.tsx`) pick it up next time they mount, same as today.
- Logout has no confirmation dialog — parity with the existing behavior in `MisTarjetasClient.tsx`.
- Only `.onda-pwa-*` classes and existing `OndaIcons.edit` are used — no Hero UI components on this screen, per the explicit user decision.

- [ ] **Step 3: Type-check**

Run: `pnpm exec tsc -p apps/pwa-client/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `pnpm exec nx build pwa-client`
Expected: build succeeds, and the build output lists `/perfil` as a generated route.

- [ ] **Step 5: Show the diff for manual review**

Run: `git status --short apps/pwa-client/app/perfil/ && git diff -- apps/pwa-client/app/perfil/`
Paste the output back for review (new files show as untracked in `git status`, so `git diff` alone won't show their content). No Playwright/E2E per user constraint.

- [ ] **Step 6: Commit**

```bash
git add apps/pwa-client/app/perfil/
git commit -m "$(cat <<'EOF'
Add /perfil route: edit name, view phone, cerrar sesión

New screen reachable from the tab bar's Perfil tab. Name is editable
inline (PATCH /customer-auth/profile, already existed), phone is
read-only, and logout reuses the existing POST /customer-auth/logout
call that used to live inline in MisTarjetasClient. Redirects to / if
there's no session, whether from direct unauthenticated access or
right after logging out from this screen. Uses only the existing
.onda-pwa-* classes, no Hero UI components, matching the rest of the
app.
EOF
)"
```
