# Diseño: Simular escaneo QR en pwa-client

Fecha: 2026-08-06
Alcance: `apps/pwa-client`
Fuera de alcance: generación real de códigos QR (merchant-dashboard), lectura de cámara real.

## 1. Problema

`apps/pwa-client` no tiene ninguna forma de generar ni leer códigos QR todavía. El único punto de entrada real al flujo de cliente es `/r/[storeId]` ([apps/pwa-client/app/r/[storeId]/page.tsx](../../../apps/pwa-client/app/r/%5BstoreId%5D/page.tsx)), al que hoy solo se llega si ya se conoce el `storeId` de memoria y se escribe la URL a mano. La pantalla "Mis tarjetas" ([apps/pwa-client/app/MisTarjetasClient.tsx](../../../apps/pwa-client/app/MisTarjetasClient.tsx)) le pide al usuario "escanear el QR de un negocio", pero no ofrece ninguna forma de hacerlo, lo cual bloquea las pruebas manuales del flujo completo mientras el proyecto está en etapa de prototipo (sin QR real todavía).

## 2. Solución

Cuando "Mis tarjetas" está vacía (sin sesión, o con sesión pero sin ninguna tarjeta), en vez de mostrar el mensaje "Aún no tienes tarjetas. Escanea el QR..." y quedarse ahí, la app navega automáticamente a la pantalla que se vería justo después de escanear el QR de un negocio — sin lista, sin botón intermedio, sin clic extra.

Mecánica:

1. Se hace `GET /stores` (endpoint público existente en `apps/api/src/stores.controller.ts`, ya devuelve `id`, `name`, `category` sin autenticación) y se toma el primero de la lista (orden ya viene por `createdAt desc` desde el backend).
2. Se navega con `router.replace('/r/' + store.id)` — `replace` (no `push`) para que "Mis tarjetas" no quede en el historial y el botón "atrás" no regrese a una pantalla intermedia que el usuario nunca vio conscientemente.
3. Esa ruta (`/r/[storeId]`) ya es exactamente "la pantalla que sale después de leer el QR": corre `StoreEntryClient`, que evalúa sesión/OTP/preview/tarjeta existente como si el QR real hubiera sido escaneado.

No hay cambios de backend (el endpoint ya existe y ya es público). No se genera ni decodifica ningún QR real; es un atajo de navegación para pruebas.

## 3. Dónde aplica

- **Sin sesión** (`MisTarjetasClient.tsx:47-56`): hoy muestra el mensaje inmediatamente después de cargar. Pasa a redirigir.
- **Con sesión pero sin tarjetas** (`MisTarjetasClient.tsx:79-83`, dentro del render con passes vacío): mismo mensaje hoy: pasa a redirigir también, ya que "no tener tarjetas" es la misma situación aunque haya sesión activa.
- **Con sesión y con tarjetas**: sin cambios — se sigue mostrando la lista de tarjetas normalmente.

## 4. Casos borde

- `GET /stores` devuelve lista vacía (sin negocios creados en la base): no hay a dónde redirigir. Se mantiene el mensaje original de "Aún no tienes tarjetas..." como fallback.
- Error de red al pedir `/stores`: mismo fallback — se muestra el mensaje original en vez de dejar la pantalla en blanco o colgada en loading.

## 5. Visibilidad

El auto-redirect corre solo cuando `process.env.NODE_ENV !== 'production'`. En producción (cuando exista un flujo real de QR) el comportamiento vuelve a ser el mensaje actual sin redirect — así este atajo de prototipo se cae solo sin tener que recordar quitarlo del código.
