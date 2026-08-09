# Diseño: Tab bar "Mis tarjetas" / "Perfil" en pwa-client

Fecha: 2026-08-08
Alcance: `apps/pwa-client`, `libs/shared/ui/src/icons.tsx`
Fuera de alcance: cambios de backend (los endpoints necesarios ya existen), diálogo de confirmación al cerrar sesión, refactor del acceso a sesión en `MisTarjetasClient.tsx`/`StoreEntryClient.tsx` (quedan tal cual), Playwright/pruebas E2E (excluidas explícitamente por el usuario).

## 1. Problema

`apps/pwa-client` no tiene ninguna navegación persistente. `MisTarjetasClient.tsx` (ruta `/`) es la única pantalla real: lista de tarjetas + botón de cerrar sesión inline. No existe pantalla de perfil (ver/editar nombre, ver teléfono). `layout.tsx` es un shell vacío sin ningún elemento compartido entre rutas.

Se quiere una barra de navegación inferior con 2 opciones — "Mis tarjetas" y "Perfil" — visible **solo cuando hay una sesión de cliente activa** (después de completar OTP y, si es usuario nuevo, de ingresar su nombre).

## 2. Solución

### 2.1 Reactividad de sesión (`lib/session.ts`)

El login (OTP → nombre) ocurre dentro de `/r/[storeId]` (`StoreEntryClient.tsx`) **sin cambiar de URL** — pasa de `step: 'otp'` a `step: 'home'` en el mismo montaje de componente. Como la barra debe aparecer justo en ese momento, no puede depender solo de la ruta.

Se agrega a `lib/session.ts`:
- `saveSession()` y `clearSession()` disparan un `CustomEvent('onda-session-changed')` en `window` después de escribir/borrar `localStorage`.
- Nuevo hook `useSession()`: mantiene `session` en estado de React, lo inicializa con `loadSession()` y se suscribe al evento para actualizarse cuando cambia, sin importar desde qué componente se llamó `saveSession`/`clearSession`.

`MisTarjetasClient.tsx` y `StoreEntryClient.tsx` **no se modifican** — siguen llamando `loadSession()`/`saveSession()`/`clearSession()` exactamente igual que hoy. Solo el hook nuevo se apoya en esas mismas funciones.

### 2.2 `AppShell` (barra de navegación)

Nuevo componente cliente `apps/pwa-client/app/AppShell.tsx`, montado en `layout.tsx` envolviendo `{children}`.

- Usa `useSession()`. Si `session` es `null`, renderiza solo `{children}` (sin barra) — cubre onboarding, OTP, y cualquier estado sin login.
- Si hay sesión, envuelve `{children}` con la barra usando `Tabs` de `@heroui/react` (`Tabs.Root`/`Tabs.List`/`Tabs.Tab`/`Tabs.Panel` — no existe un componente "bottom nav" dedicado en Hero UI v3; `Tabs` es el primitivo más cercano y ya se usa en su forma base en otras partes del design system):
  - `selectedKey` se deriva de `usePathname()`: `"/perfil"` → `"perfil"`; cualquier otra ruta (`"/"`, `"/r/[storeId]"`) → `"wallet"`.
  - `onSelectionChange` navega con `router.push('/')` o `router.push('/perfil')`.
  - Un único `Tabs.Panel id={selectedKey}` envuelve `{children}` — el contenido real lo sigue dando el routing de Next.js; `Tabs` solo aporta la barra visual (patrón soportado por react-aria-components: renderizar solo el panel de la pestaña activa).
  - Dos `Tabs.Tab`: `"wallet"` (ícono `OndaIcons.wallet` + "Mis tarjetas") y `"perfil"` (ícono `OndaIcons.profile` + "Perfil").
  - Posicionamiento fijo abajo, con `padding-bottom: env(safe-area-inset-bottom, 0)`, siguiendo el mismo patrón que ya usa `.onda-pwa-shell`.

### 2.3 "Mis tarjetas" (`/`) — comportamiento según cantidad de tarjetas

`MisTarjetasClient.tsx` gana un caso nuevo en `boot()`, después de cargar `userPasses`:

- 0 tarjetas → mensaje vacío actual, sin cambios.
- **1 tarjeta** → `router.replace('/r/' + pass.storeId)`. Reutiliza tal cual la vista `step: 'home'` de `StoreEntryClient.tsx` (acumular ondas, reclamar premios, agregar a wallet) — no se crea ninguna vista nueva de detalle.
- 2+ tarjetas → lista actual, sin cambios.

La pestaña "Mis tarjetas" se considera "activa" tanto en `/` como en `/r/[storeId]` (ver 2.2), porque ambas son parte de la misma sección funcional.

### 2.4 `/perfil` (nueva)

Nueva ruta `apps/pwa-client/app/perfil/page.tsx` + `ProfileClient.tsx`.

- Usa `useSession()` para leer `name`/`phone`. Si `session` es `null` (acceso directo a la URL sin sesión), redirige a `/`.
- **Nombre**: texto + ícono de editar (`OndaIcons.edit`, ya existe). Al tocar, cambia a modo edición inline (input) → al guardar, llama `PATCH /customer-auth/profile` (ya existe en `customer-auth.controller.ts`), y con la respuesta llama `saveSession()` (dispara el evento de 2.1, así que si el nombre se ve en otro lado se actualiza).
- **Teléfono**: solo lectura, sin ícono de editar.
- **Cerrar sesión**: mismo botón y misma llamada (`POST /customer-auth/logout`) que hoy tiene `MisTarjetasClient.tsx` — se mueve el comportamiento, no se cambia. Sin diálogo de confirmación (paridad con el comportamiento actual). Tras cerrar sesión, `clearSession()` dispara el evento → `session` pasa a `null` → el mismo `useEffect` que maneja "acceso directo sin sesión" (ver más abajo) redirige a `/`, y `AppShell` deja de mostrar la barra porque ya no hay sesión.

### 2.5 Íconos

En `libs/shared/ui/src/icons.tsx` (único archivo de íconos compartido del proyecto, usado por todas las apps) se agregan dos entradas nuevas a `OndaIcons`, siguiendo el patrón existente (import nombrado desde `@phosphor-icons/react/dist/csr/<Nombre>`, tamaño `SIZE`/`CLASS` constantes del archivo):

- `wallet` → `CreditCardIcon`.
- `profile` → `UserCircleIcon`.

No se define ningún ícono dentro de `apps/pwa-client` directamente — se reutiliza el módulo compartido, igual que ya hace `merchant-dashboard`.

## 3. Sin cambios de backend

`GET /customer-auth/session`, `PATCH /customer-auth/profile` y `POST /customer-auth/logout` ya existen y cubren todo lo necesario (`apps/api/src/customer-auth.controller.ts`). No se toca `apps/api`.

## 4. Casos borde

- Usuario con sesión activa navega directo a `/r/[storeId]` de un negocio donde no tiene tarjeta (vía QR, no vía tab bar): sigue funcionando igual que hoy (`StoreEntryClient.tsx` sin cambios); la barra se muestra porque ya hay sesión, con "Mis tarjetas" marcada como activa.
- Usuario nuevo en medio de `step: 'otp'` o `step: 'name'` dentro de `/r/[storeId]`: sin sesión todavía → sin barra. En cuanto `submitName`/`onOtpVerified` llaman `saveSession()`, el evento dispara y la barra aparece sin recargar ni navegar.
- Acceso directo a `/perfil` sin sesión (URL escrita a mano, sesión expirada), y también justo después de cerrar sesión desde el propio `/perfil`: `ProfileClient` redirige a `/` en cuanto `session` es `null` (mismo camino de código para ambos casos).
- Nombre editado en `/perfil`: al volver a `/` con 1 sola tarjeta, el saludo en `StoreEntryClient.tsx` ya lee `session.user.name` actualizado porque `saveSession()` sobrescribió `localStorage`.

## 5. Verificación

Restricción explícita del usuario: sin Playwright, sin pruebas E2E, sin levantar servidor de desarrollo. Verificación = `pnpm exec nx build pwa-client` (y `pnpm exec nx build shared-ui` si el cambio en `icons.tsx` lo requiere) sin errores de compilación/tipos, más revisión manual del diff.
