# Diseño: Onboarding con OTP, acumulación de sellos y recompensas por ciclo

Fecha: 2026-08-05
Alcance: `apps/pwa-client`, `apps/merchant-dashboard`, `apps/api`, `libs/database/prisma/schema.prisma`
Fuera de alcance: `apps/organizer-dashboard`, modelo `Event` (mantiene su lógica actual de `globalTarget`, sin cambios).

## 1. Resumen y alcance

El acceso al sitio del cliente (pwa-client) pasa de "nombre + celular → tarjeta creada al instante, sin verificación" a un flujo con verificación real por WhatsApp y sesión persistente:

- **Onboarding**: celular → OTP por WhatsApp → (solo si es la primera vez de ese teléfono) nombre → preview de la tarjeta del negocio → reclamar → tarjeta creada.
- **Sesión**: token respaldado en base de datos, ligado al teléfono. Si el dispositivo ya tiene sesión activa, escanear el QR de otro negocio salta el OTP y va directo al preview/reclamo de ese negocio. Sin expiración automática; se cierra solo manualmente.
- **"Mis tarjetas"**: nueva vista que agrega todas las tarjetas del usuario (por teléfono) en un solo lugar, con botón de cerrar sesión.
- **Tarjeta con 3 acciones**: agregar a billetera digital (Apple/Google Wallet, sin cambios), acumular onda, y reclamar premio (visible solo si el progreso actual coincide con un hito configurado).
- **Acumular / reclamar premio**: mismo mecanismo — código de 6 dígitos enviado por WhatsApp al cliente, caja recibe notificación en tiempo real con ese código y confirma o rechaza. El PIN fijo de tienda que existe hoy se oculta del dashboard, sin borrarse del código.
- **Ciclo de sellos**: cada negocio configura un tope de hasta 12 sellos y promociones ligadas a hitos dentro de ese ciclo. Al completarse el ciclo (reclamando el premio del sello final), el contador se reinicia.
- Todos los códigos (OTP de login, acumular, reclamar) son de 6 dígitos y expiran a los 10 minutos.
- En modo desarrollo (sin `KAPSO_API_KEY` configurada), el código no se manda por WhatsApp real; se muestra directamente en la interfaz para facilitar pruebas locales.

## 2. Modelo de datos

**`Session`** (nueva)
```
id, token (único), userId, createdAt, revokedAt (nullable)
```
Cerrar sesión = marcar `revokedAt`. Sin lógica de expiración automática.

**`OtpCode`** (nueva) — código de login, ligado a teléfono (no a `userId`, porque en el primer ingreso el `User` todavía no existe).
```
id, phone, code, createdAt, expiresAt, consumedAt (nullable)
```
Protección contra fuerza bruta: se bloquea después de 5 intentos fallidos sobre el mismo código (obliga a pedir uno nuevo). Esta protección aplica **solo** al OTP de login, porque es el único código que un usuario escribe manualmente en un formulario.

**`PendingRequest`** (nueva) — unifica "acumular onda" y "reclamar premio", ya que comparten el mismo mecanismo (generar código, notificar por WhatsApp al cliente, notificar a caja, confirmar/rechazar) y solo difieren en el efecto al confirmarse.
```
id, type (ACCUMULATE | CLAIM), code, passId, storeId,
promotionId (solo si type = CLAIM), status (PENDING | CONFIRMED | REJECTED),
createdAt, expiresAt, resolvedAt (nullable)
```
- Este código nunca se escribe manualmente: llega por WhatsApp al cliente y aparece visible en la notificación del dashboard de caja. Caja solo compara visualmente y confirma — no hay campo de texto ni forma de "adivinarlo", por lo que no aplica límite de intentos aquí.
- Si el cliente dispara la acción (acumular o reclamar) mientras ya existe un `PendingRequest` en estado `PENDING` para esa tarjeta, no se crea uno nuevo: se le muestra el que ya está pendiente (mismo código, mismo tiempo restante). Evita códigos duplicados, mensajes de WhatsApp extra y confusión en caja por notificaciones repetidas.
- La expiración (10 min) se valida por fecha (`expiresAt`) al momento de confirmar/rechazar, sin necesidad de un job en segundo plano ni un estado `EXPIRED` separado.

**`Store`** (cambio de esquema)
- Se agrega `maxStamps Int @default(12)` — tope de sellos del ciclo de esa tienda.

**`Promotion`** (sin cambio de esquema, cambio de validación)
- Ya existe `pointsRequired`, se reinterpreta como "en qué sello de este ciclo se puede reclamar este premio".
- Validación nueva: `pointsRequired <= store.maxStamps`.
- Regla obligatoria: al configurar el tope de sellos de una tienda, debe existir una promoción exactamente en ese sello final (puede ser la única, o la última de varias). Sin ese premio en el tope, no se puede guardar la configuración. El reinicio del ciclo queda amarrado a que se reclame ese premio final — no ocurre automáticamente solo por alcanzar el tope.
- Un premio no puede reclamarse dos veces dentro del mismo ciclo. Se valida tanto en la interfaz (opción no disponible) como en el backend (no confía solo en la UI).

**`Pass`** (sin cambio de esquema, cambio de comportamiento)
- `points` pasa a representar los sellos dentro del ciclo actual.
- Al confirmarse un `PendingRequest` de tipo `CLAIM` sobre el premio del sello final, además de registrar la reclamación se resetea `points = 0` (nuevo ciclo).
- Al confirmarse un `PendingRequest` de tipo `CLAIM` sobre un premio intermedio, se registra la reclamación sin modificar `points`.
- Al confirmarse un `PendingRequest` de tipo `ACCUMULATE`, `points += 1`.

## 3. Flujo del cliente (pwa-client)

1. Cliente escanea el QR → entra a `/r/[storeId]`.
2. Si el dispositivo ya tiene una sesión activa (token válido, no revocado), se salta el OTP y pasa directo al paso 5.
3. Si no hay sesión: pantalla pide el celular → se genera un `OtpCode` y se envía por WhatsApp (o se muestra en la UI en modo desarrollo).
4. Cliente ingresa el OTP (con opción de "reenviar" si no llega). Si coincide:
   - Se crea o recupera el `User` por teléfono y se crea la `Session` (token guardado en el dispositivo).
   - Si el `User` es nuevo, se pide el nombre antes de continuar.
5. Preview de la tarjeta del negocio (diseño de marca + grilla de sellos vacíos según `store.maxStamps`) — todavía no existe el `Pass`.
6. Cliente da "reclamar onda" → se crea el `Pass` (`points = 0`) para ese negocio.
7. Tarjeta creada, con las 3 acciones:
   - **Agregar a billetera digital** (sin cambios).
   - **Acumular onda** → crea `PendingRequest(type=ACCUMULATE)`.
   - **Reclamar premio** → visible/activo solo si `pass.points` coincide con algún `promotion.pointsRequired` del ciclo actual aún no reclamado → crea `PendingRequest(type=CLAIM, promotionId=...)`.
8. Mientras el `PendingRequest` está pendiente, el cliente ve una pantalla de "esperando confirmación en caja" con el código y el conteo de los 10 minutos, consultando el estado por *polling* simple cada pocos segundos.
9. Al confirmarse: se aplica el efecto correspondiente (ver sección 2, modelo `Pass`).
10. Al rechazarse: `PendingRequest` queda `REJECTED`. Comportamiento adicional pendiente de definir (ver sección 7).
11. Al expirar sin resolverse: el cliente ve "código expirado" y puede pedir uno nuevo.
12. Si el cliente cierra y reabre la tarjeta mientras el `PendingRequest` sigue `PENDING` y no expiró, la pantalla de espera se recupera tal cual, sin perder el código.
13. **"Mis tarjetas"**: nueva vista (reemplaza el `redirect('/r/demo')` de `apps/pwa-client/app/page.tsx`) que lista todos los `Pass` del usuario logueado, cada uno con su progreso (`X/maxStamps`), acceso al detalle de esa tarjeta, y el botón de cerrar sesión.
14. En la tarjeta, tap sobre un sello con premio abre el detalle de esa promoción puntual. Tap sobre la tarjeta en general abre la lista completa de premios del ciclo, pero solo si hay 2 o más promociones configuradas — con una sola, se accede directo a su detalle vía el sello.
15. Toda la interactividad (tap a sello, lista de premios, los 3 botones de acción) vive únicamente en el sitio/PWA. El pase de Apple/Google Wallet es una vista estática de "vistazo rápido" (ej. progreso "4/6") con enlace de regreso al sitio — no soporta interacción por elemento.

## 4. Flujo de caja (merchant-dashboard)

1. Con el dashboard abierto, se abre una conexión **SSE** (Server-Sent Events) ligada al `storeId` de la sesión del negocio.
2. Al crearse un `PendingRequest` para ese negocio, el backend emite un evento SSE con: tipo, código, nombre del cliente, y detalle (sello o nombre del premio).
3. En el dashboard aparece una notificación con el código y el nombre del cliente, con botones **Confirmar** / **Rechazar**.
4. Caja compara visualmente el código que el cliente le muestra/dice con el que aparece en la notificación:
   - **Confirmar** → se aplica el efecto, `PendingRequest` pasa a `CONFIRMED`, la notificación desaparece.
   - **Rechazar** → `PendingRequest` pasa a `REJECTED`, la notificación desaparece. Comportamiento adicional pendiente de definir (ver sección 7).
5. Si hay varias solicitudes pendientes a la vez, se muestran como una lista/cola.
6. Al abrir o recargar el dashboard, primero se consulta el estado actual vía `GET /requests/pending?storeId=` (por si la conexión SSE se había interrumpido), y de ahí en adelante el SSE solo empuja las novedades.
7. Si caja intenta confirmar un código que expiró justo antes del clic, el backend rechaza con "código expirado" y el front le indica a caja que el cliente debe pedir uno nuevo.

## 5. Configuración del negocio (merchant-dashboard)

**Pantalla "Diseño del pase" (Configuración):**
- Campo nuevo: "Número de sellos del ciclo" (1–12, default 12).
- El panel de "Vista previa" deja de mostrar un número plano de ondas y pasa a mostrar la grilla de sellos según el número configurado, con los sellos que tienen premio asociado visualmente distintos a los demás.

**Pantalla "Promociones":**
- Al crear/editar una promoción, se elige a qué sello del ciclo corresponde (`pointsRequired`), limitado al tope configurado.
- No se puede guardar la configuración de sellos sin una promoción exactamente en el sello final (regla de la sección 2).

## 6. Manejo de errores y casos borde

- Código incorrecto en el OTP de login: mensaje de error, permite reintentar sin generar uno nuevo, hasta 5 intentos fallidos (luego hay que pedir uno nuevo).
- Código expirado (10 min): mensaje "código expirado" + opción de pedir uno nuevo, que invalida el anterior.
- Doble solicitud simultánea de acumular/reclamar: se reusa el `PendingRequest` ya pendiente en vez de crear uno nuevo (ver sección 2).
- Reclamar un premio ya reclamado en el ciclo actual: no permitido, validado en UI y backend.
- Caja confirma un código ya expirado: rechazado por el backend con mensaje claro.

## 7. Decisiones explícitamente pendientes

Estas dos quedan fuera de este diseño a propósito — no bloquean la implementación de lo demás, pero deben resolverse antes o durante la construcción de las partes que tocan:

1. **Comportamiento de "Rechazar" en acumular/reclamar**: hoy el diseño solo define que el `PendingRequest` pasa a `REJECTED`. Qué pasa después (¿se notifica al cliente por WhatsApp?, ¿puede reintentar de inmediato?, ¿hay algún límite de rechazos?) queda sin definir.
2. **Cuota de WhatsApp (`store.whatsappUsed` / límites por plan) para los nuevos mensajes**: si el OTP de login y los códigos de acumular/reclamar cuentan contra la cuota del plan del negocio (`LIMITS` en `apps/api/src/transactions.controller.ts`), o si solo cuenta lo que ya contaba hoy (la confirmación final de acumulación).

## 8. Notas de implementación

- El `WhatsappService` existente (`apps/api/src/whatsapp.service.ts`) se reutiliza para OTP y códigos de acumular/reclamar sin cambios estructurales; ya tiene modo real (Kapso) y modo stub (log) según si `KAPSO_API_KEY` está configurada.
- El PIN fijo de tienda (`Store.pinCode`, usado hoy en `POST /transactions/accumulate` y `POST /transactions/redeem`) se oculta de la interfaz del dashboard pero no se elimina del código ni del esquema.
