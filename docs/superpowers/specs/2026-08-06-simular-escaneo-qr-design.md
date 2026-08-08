# Diseño: Simular escaneo QR en pwa-client

Fecha: 2026-08-06
Alcance: `apps/pwa-client`
Fuera de alcance: generación real de códigos QR (merchant-dashboard), lectura de cámara real, manejo de un QR roto/inválido que apunte a un `storeId` inexistente (queda mapeado para más adelante, ver sección 6).

## 1. Problema

`apps/pwa-client` no tiene ninguna forma de generar ni leer códigos QR todavía. El único punto de entrada real al flujo de cliente es `/r/[storeId]` ([apps/pwa-client/app/r/[storeId]/page.tsx](../../../apps/pwa-client/app/r/%5BstoreId%5D/page.tsx)), al que en la vida real siempre se llega habiendo escaneado el QR de un negocio. La pantalla "Mis tarjetas" ([apps/pwa-client/app/MisTarjetasClient.tsx](../../../apps/pwa-client/app/MisTarjetasClient.tsx)) es un destino agregador al que un cliente real solo llega **después** de tener al menos una tarjeta — nunca es la puerta de entrada.

Durante un refactor de UI reciente, `MisTarjetasClient.tsx` ganó un formulario de login inline (`OtpStep` + paso de nombre) para el caso "sin sesión", y el caso "con sesión pero sin tarjetas" quedó mostrando el mensaje "Aún no tienes tarjetas. Escanea el QR..." sin ninguna salida. Ninguno de los dos refleja cómo se llega realmente a esa pantalla, y en ambiente de pruebas local (sin QR real) el segundo caso es un callejón sin salida.

## 2. Solución

Mis Tarjetas deja de tener su propio login. Cuando está vacía — **sin sesión**, o **con sesión pero sin ninguna tarjeta** — en vez de pedir login inline o mostrarse vacía, la app navega automáticamente a la pantalla que se vería justo después de escanear el QR de un negocio, simulando esa escaneada. Ambos casos se tratan igual: ninguno de los dos ocurre en la vida real (siempre se llega por QR), así que ambos son la misma situación de prueba.

Mecánica:

1. Se hace `GET /stores` (endpoint público existente en `apps/api/src/stores.controller.ts`, sin autenticación, devuelve `id`, `name`, entre otros campos, ordenado por `createdAt desc`).
2. Se busca en la lista un negocio cuyo `name` sea exactamente `"Café del Río"` (negocio fijo de pruebas del seed, `libs/database/prisma/seed.ts`). Si no aparece (otro ambiente, se borró, seed no corrido), se usa el primero de la lista devuelta.
3. Se navega con `router.replace('/r/' + store.id)` — `replace` (no `push`) para que "Mis tarjetas" no quede en el historial.
4. Esa ruta (`/r/[storeId]`) ya es exactamente "la pantalla que sale después de leer el QR": corre `StoreEntryClient`, que evalúa sesión/OTP/nombre/tarjeta existente exactamente como si el QR real hubiera sido escaneado. **No se modifica `StoreEntryClient.tsx`** — ya cubre correctamente los 4 escenarios de la sección 5.

No hay cambios de backend (el endpoint ya existe, es público, y no necesita soportar búsqueda por nombre — el filtrado es en el cliente sobre la lista completa). No se genera ni decodifica ningún QR real; es un atajo de navegación para pruebas.

## 3. Cambios en `MisTarjetasClient.tsx`

- Se elimina el `OtpStep` inline, el paso `'name'` y su formulario "¿Cómo te llamas?". El tipo `Step` vuelve a ser solo `'loading' | 'cards'`.
- Se restaura la lógica de auto-redirect (mismo patrón usado antes en el commit `f51438d`, ahora con selección de negocio por nombre):

```ts
const SIMULATE_QR_SCAN = process.env.NODE_ENV !== 'production';
const PREFERRED_STORE_NAME = 'Café del Río';

async function simulateQrScan(router: ReturnType<typeof useRouter>): Promise<boolean> {
  try {
    const stores = await api<{ id: string; name: string }[]>('/stores');
    const target = stores.find((s) => s.name === PREFERRED_STORE_NAME) || stores[0];
    if (target) {
      router.replace(`/r/${target.id}`);
      return true;
    }
  } catch {
    // sin negocios disponibles o falló la red: se cae al mensaje vacío normal
  }
  return false;
}
```

- En `boot()`: se carga la sesión existente y, si la hay, se piden sus `passes`. Si no hay sesión, o si `userPasses.length === 0`, y `SIMULATE_QR_SCAN` es `true`, se llama `simulateQrScan` antes de terminar de cargar. Si redirige (`true`), la pantalla nunca llega a pintarse — el usuario ve directamente la transición a `/r/{storeId}`. Si no redirige (`false`), se cae al mensaje original "Aún no tienes tarjetas...".
- El resto del componente (lista de tarjetas cuando `passes.length > 0`, logout) no cambia.

## 4. Casos borde

- `GET /stores` devuelve lista vacía (sin negocios creados en la base): no hay a dónde redirigir. Se mantiene el mensaje original de "Aún no tienes tarjetas..." como fallback. En el ambiente de pruebas actual no debería ocurrir, porque el seed ya crea "Café del Río".
- Error de red al pedir `/stores`: mismo fallback — se muestra el mensaje original en vez de dejar la pantalla en blanco o colgada en loading.
- `"Café del Río"` no aparece en la lista pero sí hay otros negocios: se usa el primero de la lista (`createdAt desc`), sin fallback al mensaje.
- Sesión con al menos una tarjeta: sin cambios — se sigue mostrando la lista de tarjetas normalmente, nunca redirige.

## 5. Escenarios cubiertos (sin cambios en `StoreEntryClient.tsx`)

Confirmados como ya correctamente implementados en `/r/[storeId]`, no forman parte de este cambio pero se documentan como criterio de no-regresión:

1. **Usuario nuevo** (sin sesión, sin tarjetas): pide WhatsApp → OTP → nombre → se crea la tarjeta del negocio al que llegó.
2. **Usuario existente con sesión abierta**, escanea el QR de un negocio donde no tiene tarjeta: no pide teléfono ni OTP (ya hay sesión); pasa directo a la pantalla de reclamar (`step: 'preview'`) y se le crea la tarjeta de ese negocio al confirmar.
3. **Usuario existente con sesión cerrada**, escanea el QR de un negocio nuevo para él: pide WhatsApp → OTP, no pide nombre (ya existe), se crea la tarjeta de ese negocio.
4. **Usuario existente con sesión cerrada**, escanea el QR de un negocio donde ya tiene tarjeta: pide WhatsApp → OTP, no pide nombre, pasa directo a `step: 'home'` — ve su tarjeta y recompensas de ese negocio.

## 6. Fuera de alcance (mapeado para más adelante)

- **QR roto o inválido**: un QR real que apunte a un `storeId` que no existe (dañado, mal generado, negocio eliminado). Es un escenario de manejo de errores de producción, distinto del caso "no hay negocios en la base" de la sección 4 (que es puramente de la simulación de pruebas). Hoy `StoreEntryClient.tsx` no tiene un manejo dedicado para esto; se deja pendiente de diseño futuro.
- Comportamiento de Mis Tarjetas vacía **en producción** cuando exista QR real (hoy simplemente no redirige, por el gate de `NODE_ENV`).

## 7. Visibilidad y testing

El auto-redirect corre solo cuando `process.env.NODE_ENV !== 'production'`. En producción, Mis Tarjetas vacía no redirige (comportamiento pendiente de diseño futuro, ver sección 6).

No hay test runner para `apps/pwa-client`, y Playwright/pruebas E2E quedan explícitamente excluidas por restricción del usuario. Verificación: `tsc` + `next build` sin errores, y los cambios se muestran para revisión manual (sin ejecutar recorridos E2E automatizados).
