# Diseño: Simular escaneo QR en pwa-client

Fecha: 2026-08-06
Alcance: `apps/pwa-client`
Fuera de alcance: generación real de códigos QR (merchant-dashboard), lectura de cámara real.

## 1. Problema

`apps/pwa-client` no tiene ninguna forma de generar ni leer códigos QR todavía. El único punto de entrada real al flujo de cliente es `/r/[storeId]` ([apps/pwa-client/app/r/[storeId]/page.tsx](../../../apps/pwa-client/app/r/%5BstoreId%5D/page.tsx)), al que hoy solo se llega si ya se conoce el `storeId` de memoria y se escribe la URL a mano. La pantalla "Mis tarjetas" ([apps/pwa-client/app/MisTarjetasClient.tsx](../../../apps/pwa-client/app/MisTarjetasClient.tsx)) le pide al usuario "escanear el QR de un negocio", pero no ofrece ninguna forma de hacerlo, lo cual bloquea las pruebas manuales del flujo completo mientras el proyecto está en etapa de prototipo (sin QR real todavía).

## 2. Solución

Agregar un punto de entrada "Simular escaneo QR" al estado vacío de "Mis tarjetas" (se muestra tanto sin sesión como con sesión pero sin tarjetas, ya que ambos casos hoy muestran el mismo mensaje). Al tocarlo:

1. Se hace `GET /stores` (endpoint público existente en `apps/api/src/stores.controller.ts`, ya devuelve `id`, `name`, `category` sin autenticación).
2. Se muestra una lista simple de negocios (nombre + categoría).
3. Al tocar un negocio, se navega a `/r/{storeId}` — el mismo destino al que llevaría escanear el QR real de ese negocio.

No hay cambios de backend (el endpoint ya existe y ya es público). No se genera ni decodifica ningún QR real; es un atajo de navegación para pruebas.

## 3. Componentes

- Nuevo componente `SimulateQrScan` en `apps/pwa-client/app/SimulateQrScan.tsx`:
  - Botón/enlace "Simular escaneo QR" en el estado vacío.
  - Al presionarlo, despliega inline la lista de negocios (fetch on-demand, no en cada carga de la página).
  - Cada ítem es un `Link` a `/r/{store.id}` (mismo patrón que usa `PassPreview` hoy en `MisTarjetasClient.tsx:69`).
  - Estado de carga y error simple (ej. "No se pudieron cargar los negocios").
- Se integra en `MisTarjetasClient.tsx`, reemplazando el bloque de texto plano del estado vacío (las dos ocurrencias: sin sesión y con sesión sin tarjetas) por el mismo texto + este componente debajo.

## 4. Visibilidad

Se renderiza solo cuando `process.env.NODE_ENV !== 'production'`. Esto evita que quede un botón de "simular" visible si el proyecto pasa a producción antes de que exista un flujo real de QR — se cae solo, sin necesidad de recordar quitarlo.

## 5. Casos borde

- `GET /stores` vacío (sin negocios creados aún): mostrar mensaje "No hay negocios disponibles todavía" en vez de una lista vacía silenciosa.
- Error de red al pedir `/stores`: mostrar mensaje de error simple, sin romper el resto de la pantalla "Mis tarjetas".
