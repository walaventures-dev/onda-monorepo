# Migración a Phosphor Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los dos sets de íconos SVG hechos a mano (`OndaIcons` en `libs/shared/ui` e `IcoTag` duplicado en `MerchantWorkspace.tsx`) por componentes de `@phosphor-icons/react`, dejando una sola fuente de verdad sin duplicados ni inconsistencias visuales.

**Architecture:** `libs/shared/ui/src/icons.tsx` se reescribe como un wrapper delgado: el objeto `OndaIcons` conserva (casi) las mismas claves, pero cada valor pasa a ser un componente Phosphor real con `weight="regular"` y tamaño horneado en la definición. `IcoTag` se elimina de `MerchantWorkspace.tsx` y sus call sites pasan a usar `OndaIcons`. Ningún call site fuera de `icons.tsx` cambia su forma de consumir los íconos (`{OndaIcons.check}` sigue igual).

**Tech Stack:** Next.js 16 / React 19, `@phosphor-icons/react@^2.1.10`, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-06-phosphor-icons-migration-design.md`

## Global Constraints

- Paquete fijado a `@phosphor-icons/react@^2.1.10` exactamente — no instalar "latest" (la v3 en desarrollo tiene un breaking change de nomenclatura, sufijo `Icon` en cada componente).
- `weight="regular"` en absolutamente todos los usos — no mezclar grosores.
- Importar cada ícono por subpath individual (`@phosphor-icons/react/dist/csr/<Nombre>`), no desde el barrel (`@phosphor-icons/react`) — evita que el bundler parsee los ~3024 módulos del paquete para descartar los que no usamos.
- El tamaño se hornea una sola vez en cada entrada de `icons.tsx` (`size` + `className`); ningún call site fuera de ese archivo pasa props de tamaño.
- **Sin Playwright ni pruebas E2E en esta implementación.** Verificación limitada a: type-check/build (`pnpm exec next build apps/merchant-dashboard`), grep de cierre, y mostrar el diff de cada archivo tocado.
- Gestor de paquetes del repo: `pnpm` (hay `pnpm-lock.yaml` en la raíz).

---

## Task 1: Agregar la dependencia `@phosphor-icons/react`

**Files:**
- Modify: `package.json:60-61`

**Interfaces:**
- Produces: el paquete `@phosphor-icons/react@^2.1.10` disponible para import en cualquier lib/app del monorepo (workspace único, sin `package.json` por app).

- [ ] **Step 1: Agregar la dependencia al `package.json` raíz**

En `package.json`, el bloque `"dependencies"` tiene esta sección (líneas 59-61):

```json
    "@onda/whatsapp": "workspace:*",
    "@prisma/client": "^5.22.0",
```

Insertar `@phosphor-icons/react` entre ambas (orden alfabético: `@onda` < `@phosphor-icons` < `@prisma`):

```json
    "@onda/whatsapp": "workspace:*",
    "@phosphor-icons/react": "^2.1.10",
    "@prisma/client": "^5.22.0",
```

- [ ] **Step 2: Instalar**

Run: `pnpm install`

Expected: instala sin errores, `pnpm-lock.yaml` se actualiza con la entrada de `@phosphor-icons/react`, y aparece `node_modules/@phosphor-icons/react`.

- [ ] **Step 3: Verificar la instalación**

Run: `test -d node_modules/@phosphor-icons/react && node -e "console.log(require('./node_modules/@phosphor-icons/react/package.json').version)"`

Expected: imprime `2.1.10` (o el patch más reciente dentro de `^2.1.10`).

- [ ] **Step 4: Mostrar el diff y commitear**

Run: `git diff package.json pnpm-lock.yaml`

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
Add @phosphor-icons/react dependency

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Reescribir `libs/shared/ui/src/icons.tsx` para usar Phosphor

**Files:**
- Modify: `libs/shared/ui/src/icons.tsx` (reescritura completa)

**Interfaces:**
- Consumes: `@phosphor-icons/react/dist/csr/<Nombre>` (Task 1).
- Produces: `OndaIcons` — objeto con 43 claves (`ReactNode`), **misma forma pública que hoy salvo**: se elimina la clave `custom` (los consumidores usan `edit`), se agrega la clave nueva `snowflake`. También produce `badgeIcon(badge?: string | null): ReactNode`, `badgeDescription(badge?: string | null): string`, y el componente `BadgePill({ badge, className? })` — firmas sin cambios. **Ya no exporta `OndaIcon`** (el wrapper interno se elimina; no tenía consumidores fuera de este archivo).

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

Reemplazar todo `libs/shared/ui/src/icons.tsx` por:

```tsx
'use client';

import type { ReactNode } from 'react';
import Circle from '@phosphor-icons/react/dist/csr/Circle';
import Sparkle from '@phosphor-icons/react/dist/csr/Sparkle';
import UsersThree from '@phosphor-icons/react/dist/csr/UsersThree';
import Fire from '@phosphor-icons/react/dist/csr/Fire';
import Target from '@phosphor-icons/react/dist/csr/Target';
import Warning from '@phosphor-icons/react/dist/csr/Warning';
import Info from '@phosphor-icons/react/dist/csr/Info';
import Crown from '@phosphor-icons/react/dist/csr/Crown';
import Moon from '@phosphor-icons/react/dist/csr/Moon';
import WhatsappLogo from '@phosphor-icons/react/dist/csr/WhatsappLogo';
import Calendar from '@phosphor-icons/react/dist/csr/Calendar';
import Sun from '@phosphor-icons/react/dist/csr/Sun';
import CalendarBlank from '@phosphor-icons/react/dist/csr/CalendarBlank';
import PencilSimple from '@phosphor-icons/react/dist/csr/PencilSimple';
import Percent from '@phosphor-icons/react/dist/csr/Percent';
import CurrencyDollar from '@phosphor-icons/react/dist/csr/CurrencyDollar';
import Tag from '@phosphor-icons/react/dist/csr/Tag';
import Package from '@phosphor-icons/react/dist/csr/Package';
import DotsThree from '@phosphor-icons/react/dist/csr/DotsThree';
import DownloadSimple from '@phosphor-icons/react/dist/csr/DownloadSimple';
import Plus from '@phosphor-icons/react/dist/csr/Plus';
import Copy from '@phosphor-icons/react/dist/csr/Copy';
import Power from '@phosphor-icons/react/dist/csr/Power';
import Trash from '@phosphor-icons/react/dist/csr/Trash';
import Check from '@phosphor-icons/react/dist/csr/Check';
import Lock from '@phosphor-icons/react/dist/csr/Lock';
import Globe from '@phosphor-icons/react/dist/csr/Globe';
import Ticket from '@phosphor-icons/react/dist/csr/Ticket';
import PlusCircle from '@phosphor-icons/react/dist/csr/PlusCircle';
import Gift from '@phosphor-icons/react/dist/csr/Gift';
import FloppyDisk from '@phosphor-icons/react/dist/csr/FloppyDisk';
import Eye from '@phosphor-icons/react/dist/csr/Eye';
import X from '@phosphor-icons/react/dist/csr/X';
import MapPin from '@phosphor-icons/react/dist/csr/MapPin';
import TrendUp from '@phosphor-icons/react/dist/csr/TrendUp';
import ChartBar from '@phosphor-icons/react/dist/csr/ChartBar';
import Waveform from '@phosphor-icons/react/dist/csr/Waveform';
import Gear from '@phosphor-icons/react/dist/csr/Gear';
import IdentificationCard from '@phosphor-icons/react/dist/csr/IdentificationCard';
import SidebarSimple from '@phosphor-icons/react/dist/csr/SidebarSimple';
import CaretLeft from '@phosphor-icons/react/dist/csr/CaretLeft';
import CaretRight from '@phosphor-icons/react/dist/csr/CaretRight';
import Snowflake from '@phosphor-icons/react/dist/csr/Snowflake';

const SIZE = 16;
const CLASS = 'h-3 w-3 shrink-0';
const CLASS_LG = 'h-4 w-4 shrink-0';

export const OndaIcons = {
  all: <Circle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  sparkle: <Sparkle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  users: <UsersThree size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  flame: <Fire size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  target: <Target size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  alert: <Warning size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  info: <Info size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  crown: <Crown size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  moon: <Moon size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  whatsapp: <WhatsappLogo size={SIZE} weight="regular" className={CLASS_LG} aria-hidden="true" />,
  calendar: <Calendar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  day: <Sun size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  week: <CalendarBlank size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  edit: <PencilSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  percent: <Percent size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  dollar: <CurrencyDollar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  nXm: <Tag size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  product: <Package size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  other: <DotsThree size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  download: <DownloadSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  plus: <Plus size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  copy: <Copy size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  power: <Power size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  trash: <Trash size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  check: <Check size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  lock: <Lock size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  globe: <Globe size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  ticket: <Ticket size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  accumulate: <PlusCircle size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  redeem: <Gift size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  save: <FloppyDisk size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  eye: <Eye size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  close: <X size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  near: <MapPin size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  upgrade: <TrendUp size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chart: <ChartBar size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  activity: <Waveform size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  gear: <Gear size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  pass: <IdentificationCard size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  panelLeft: <SidebarSimple size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronLeft: <CaretLeft size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  chevronRight: <CaretRight size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
  snowflake: <Snowflake size={SIZE} weight="regular" className={CLASS} aria-hidden="true" />,
};

export function badgeIcon(badge?: string | null): ReactNode {
  switch (badge) {
    case 'Nuevo':
      return OndaIcons.sparkle;
    case 'Cerca':
      return OndaIcons.target;
    case 'En riesgo':
      return OndaIcons.alert;
    case 'Dormido':
      return OndaIcons.moon;
    case 'VIP':
      return OndaIcons.crown;
    case 'Top':
      return OndaIcons.sparkle;
    case 'Fría':
      return OndaIcons.snowflake;
    default:
      return OndaIcons.users;
  }
}

export function badgeDescription(badge?: string | null): string {
  switch (badge) {
    case 'Nuevo':
      return 'Se unió al programa en este periodo';
    case 'Cerca':
      return 'Le faltan pocas ondas para canjear una promoción';
    case 'En riesgo':
      return 'No visita hace un tiempo y podría dejar de venir';
    case 'Dormido':
      return 'No ha vuelto hace mucho tiempo';
    case 'VIP':
      return 'Está entre los clientes con más ondas acumuladas';
    case 'Top':
      return 'Es de las promociones con mejor desempeño';
    case 'Fría':
      return 'Es de las promociones con menos actividad';
    default:
      return '';
  }
}

export function BadgePill({
  badge,
  className = 'rounded-full bg-[var(--onda-violet-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--onda-violet)]',
}: {
  badge: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      title={badgeDescription(badge)}
    >
      {badgeIcon(badge)}
      {badge}
    </span>
  );
}
```

- [ ] **Step 2: Mostrar el diff**

Run: `git diff libs/shared/ui/src/icons.tsx`

Expected: el diff muestra la reescritura completa; ninguna otra parte del repo se tocó todavía (los call sites de `OndaIcons.custom` y de `IcoTag` seguirán rotos hasta las tareas 3 y 4 — es esperado en este punto).

- [ ] **Step 3: Commitear**

```bash
git add libs/shared/ui/src/icons.tsx
git commit -m "$(cat <<'EOF'
Rewrite OndaIcons to use @phosphor-icons/react

Replaces the 43 hand-drawn SVG icons with Phosphor components (weight
regular, size baked in). Drops the unused OndaIcon wrapper export, drops
the 'custom' key (consumers move to 'edit'), adds 'snowflake'.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Actualizar los dos call sites pequeños (`index.tsx`, `AnalyticsFilters.tsx`)

**Files:**
- Modify: `libs/shared/ui/src/index.tsx:47`
- Modify: `libs/shared/ui/src/AnalyticsFilters.tsx:32`

**Interfaces:**
- Consumes: `OndaIcons` de Task 2 (ya no tiene `custom` ni `OndaIcon`).

- [ ] **Step 1: Quitar `OndaIcon` del re-export en `index.tsx`**

En `libs/shared/ui/src/index.tsx:47`, reemplazar:

```tsx
export { OndaIcon, OndaIcons, BadgePill, badgeIcon } from './icons';
```

por:

```tsx
export { OndaIcons, BadgePill, badgeIcon } from './icons';
```

- [ ] **Step 2: Cambiar `OndaIcons.custom` por `OndaIcons.edit` en `AnalyticsFilters.tsx`**

En `libs/shared/ui/src/AnalyticsFilters.tsx:32`, dentro de `DATE_PRESETS`, reemplazar:

```tsx
  { id: 'custom', label: 'Custom', icon: OndaIcons.custom },
```

por:

```tsx
  { id: 'custom', label: 'Custom', icon: OndaIcons.edit },
```

- [ ] **Step 3: Mostrar el diff**

Run: `git diff libs/shared/ui/src/index.tsx libs/shared/ui/src/AnalyticsFilters.tsx`

- [ ] **Step 4: Commitear**

```bash
git add libs/shared/ui/src/index.tsx libs/shared/ui/src/AnalyticsFilters.tsx
git commit -m "$(cat <<'EOF'
Update shared-ui call sites for the OndaIcons rewrite

index.tsx stops re-exporting the removed OndaIcon wrapper; the date
filter's "Custom" option points at OndaIcons.edit now that the
duplicate 'custom' key was dropped.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Eliminar `IcoTag` de `MerchantWorkspace.tsx` y usar `OndaIcons`

**Files:**
- Modify: `apps/merchant-dashboard/app/MerchantWorkspace.tsx` (varias secciones)

**Interfaces:**
- Consumes: `OndaIcons`, `PROMO_TYPE_OPTIONS` (ambos ya importados en este archivo — líneas 30 y 34 del import de `@onda/shared-ui`).

- [ ] **Step 1: Eliminar el helper `Icon` y el objeto `IcoTag`**

En `apps/merchant-dashboard/app/MerchantWorkspace.tsx`, localizar el bloque que va desde `function Icon({` hasta el cierre de `const IcoTag = { ... };` (líneas 121-189 al momento de escribir este plan — confirmar con el contenido, no solo el número, porque las tareas previas no tocan este archivo así que los números no deberían haber cambiado). El bloque completo a borrar es:

```tsx
function Icon({
  children,
  className = "h-3 w-3",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const IcoTag = {
  type: (
    <Icon>
      <path d="M2.5 8.5 8.5 2.5h4v4L6.5 12.5z" />
      <circle cx="11" cy="5" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
  ),
  top: (
    <Icon>
      <path d="M8 2.5 9.6 6.2l4 .3-3.1 2.6.9 3.9L8 11.2l-3.4 1.8.9-3.9L2.4 6.5l4-.3z" />
    </Icon>
  ),
  cold: (
    <Icon>
      <path d="M8 2.5v11M4.5 5.5 8 8l3.5-2.5M4.5 10.5 8 8l3.5 2.5" />
    </Icon>
  ),
  on: (
    <Icon>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5.5v5" />
    </Icon>
  ),
  off: (
    <Icon>
      <circle cx="8" cy="8" r="5" />
      <path d="M6 8h4" />
    </Icon>
  ),
  eye: (
    <Icon>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8s-2.5 4.5-6.5 4.5S1.5 8 1.5 8z" />
      <circle cx="8" cy="8" r="1.8" />
    </Icon>
  ),
  power: (
    <Icon>
      <path d="M8 2.5v5.5M4.8 4.2a5 5 0 1 0 6.4 0" />
    </Icon>
  ),
  trash: (
    <Icon>
      <path d="M3 4.5h10M6 4.5V3h4v1.5M5 4.5l.5 8.5h5l.5-8.5" />
    </Icon>
  ),
};
```

Borrarlo completo (no dejar ninguna línea en blanco de más, mantener el `deltaLabel` de arriba y el `function PromoTag` de abajo pegados con una sola línea en blanco entre ellos, igual que el resto del archivo).

- [ ] **Step 2: Reemplazar el ícono de tipo en la tarjeta de promo (vista grid)**

Buscar (primera ocurrencia, dentro del bloque de la tarjeta en grid):

```tsx
                        <PromoTag
                          icon={IcoTag.type}
                          className="bg-white/90 text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={badge === "Top" ? IcoTag.top : IcoTag.cold}
```

Reemplazar por:

```tsx
                        <PromoTag
                          icon={
                            PROMO_TYPE_OPTIONS.find((o) => o.id === p.type)
                              ?.icon || OndaIcons.other
                          }
                          className="bg-white/90 text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={
                              badge === "Top"
                                ? OndaIcons.sparkle
                                : OndaIcons.snowflake
                            }
```

- [ ] **Step 3: Reemplazar el ícono de estado activo/inactivo (vista grid)**

Buscar:

```tsx
                      <PromoTag
                        icon={p.isActive ? IcoTag.on : IcoTag.off}
                        className={`absolute right-2 top-2 ${
```

Reemplazar por:

```tsx
                      <PromoTag
                        icon={p.isActive ? OndaIcons.check : OndaIcons.close}
                        className={`absolute right-2 top-2 ${
```

- [ ] **Step 4: Reemplazar los tres botones de acción (vista grid)**

Buscar y reemplazar cada uno (son tres reemplazos de una línea, dentro de los botones "Ver detalle", "Desactivar/Activar" y "Eliminar" de la vista grid):

```tsx
                          {IcoTag.eye}
                          Ver detalle
```
→
```tsx
                          {OndaIcons.eye}
                          Ver detalle
```

```tsx
                          {IcoTag.power}
                          {p.isActive ? "Desactivar" : "Activar"}
```
→
```tsx
                          {OndaIcons.power}
                          {p.isActive ? "Desactivar" : "Activar"}
```

```tsx
                          {IcoTag.trash}
                          Eliminar
```
→
```tsx
                          {OndaIcons.trash}
                          Eliminar
```

- [ ] **Step 5: Repetir los mismos cuatro reemplazos en la vista lista**

Más abajo en el archivo hay una segunda tarjeta de promo (vista lista) con la misma estructura. Buscar:

```tsx
                        <PromoTag
                          icon={IcoTag.type}
                          className="bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={badge === "Top" ? IcoTag.top : IcoTag.cold}
```

Reemplazar por:

```tsx
                        <PromoTag
                          icon={
                            PROMO_TYPE_OPTIONS.find((o) => o.id === p.type)
                              ?.icon || OndaIcons.other
                          }
                          className="bg-[var(--onda-violet-soft)] text-[var(--onda-violet)]"
                        >
                          {promoTypeLabel(p.type)}
                        </PromoTag>
                        {badge ? (
                          <PromoTag
                            icon={
                              badge === "Top"
                                ? OndaIcons.sparkle
                                : OndaIcons.snowflake
                            }
```

Buscar:

```tsx
                        <PromoTag
                          icon={p.isActive ? IcoTag.on : IcoTag.off}
                          className={
```

Reemplazar por:

```tsx
                        <PromoTag
                          icon={p.isActive ? OndaIcons.check : OndaIcons.close}
                          className={
```

Buscar y reemplazar (botón "Detalle" de la vista lista, nota que el texto es "Detalle" no "Ver detalle" en esta variante):

```tsx
                        {IcoTag.eye}
                        Detalle
```
→
```tsx
                        {OndaIcons.eye}
                        Detalle
```

```tsx
                        {IcoTag.power}
                        {p.isActive ? "Desactivar" : "Activar"}
```
→
```tsx
                        {OndaIcons.power}
                        {p.isActive ? "Desactivar" : "Activar"}
```

```tsx
                        {IcoTag.trash}
                        Eliminar
```
→
```tsx
                        {OndaIcons.trash}
                        Eliminar
```

- [ ] **Step 6: Grep de cierre — cero referencias a `IcoTag`**

Run: `grep -n "IcoTag" apps/merchant-dashboard/app/MerchantWorkspace.tsx`

Expected: sin resultados (exit code 1 de grep).

- [ ] **Step 7: Mostrar el diff completo del archivo**

Run: `git diff apps/merchant-dashboard/app/MerchantWorkspace.tsx`

- [ ] **Step 8: Commitear**

```bash
git add apps/merchant-dashboard/app/MerchantWorkspace.tsx
git commit -m "$(cat <<'EOF'
Remove duplicated IcoTag icon set from MerchantWorkspace

Both promo card variants (grid and list) now use OndaIcons instead of
the local IcoTag duplicate. The type badge shows the actual per-type
icon (matching AnalyticsFilters) instead of a static generic one, and
active/inactive now uses check/close consistently with PromoDetail.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verificación final

**Files:**
- Ninguno (solo lectura/compilación).

**Interfaces:**
- N/A.

- [ ] **Step 1: Grep de cierre en todo el repo**

Run: `grep -rn "IcoTag\|OndaIcons\.custom" apps/merchant-dashboard apps/pwa-client libs/shared/ui --include="*.tsx" --include="*.ts" | grep -v "\.next"`

Expected: sin resultados.

- [ ] **Step 2: Confirmar que no queda ningún ícono SVG hecho a mano en los archivos tocados**

Run: `grep -n "<svg\|viewBox=\"0 0 16 16\"" libs/shared/ui/src/icons.tsx apps/merchant-dashboard/app/MerchantWorkspace.tsx`

Expected: sin resultados.

- [ ] **Step 3: Type-check + build de `merchant-dashboard`**

Run: `pnpm exec next build apps/merchant-dashboard`

Expected: build exitoso, sin errores de TypeScript ni de módulos no encontrados (esto confirma que los 43 imports de `@phosphor-icons/react/dist/csr/*` existen y que todos los call sites de `OndaIcons`/`PROMO_TYPE_OPTIONS` siguen tipando correctamente).

- [ ] **Step 4: Mostrar el resumen de todo lo cambiado en la rama**

Run: `git diff main --stat`

Y mostrarle al usuario el diff completo de cada archivo tocado (`package.json`, `libs/shared/ui/src/icons.tsx`, `libs/shared/ui/src/index.tsx`, `libs/shared/ui/src/AnalyticsFilters.tsx`, `apps/merchant-dashboard/app/MerchantWorkspace.tsx`) para revisión — no hay QA visual en navegador en esta pasada, según la restricción de esta implementación.

No hay Step de commit en esta tarea — es solo verificación de lo ya commiteado en las tareas 1-4.
