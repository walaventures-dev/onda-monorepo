# Configuración de proveedores Onda

Paso a paso para dar de alta cada integración. Postgres/Prisma sigue siendo la base de datos. Los clientes del PWA se autentican con OTP por WhatsApp (Kapso). Firebase Auth es **solo** para el merchant-dashboard.

Sin una key, el servicio correspondiente entra en **modo stub** (logs, atajos de desarrollo). Copia `.env.example` a `.env` y completa lo que vayas a usar.

```
Firebase Auth (merchants) ─┐
Google Places + Cloud Tasks─┤
Wompi (suscripción PRO) ────┼──► Onda API ──► Brevo (email + SMS)
Postgres (Prisma) ──────────┤              ──► Kapso (WhatsApp)
                           ┘              ──► WalletWallet (wallet + push)
```

URLs locales de webhook (en prod cambia el host):

| Proveedor | Endpoint |
|---|---|
| Wompi | `POST /api/billing/wompi/webhook` |
| Kapso | `POST /api/webhooks/kapso` |
| Cloud Tasks worker | `POST /api/jobs/run` |

---

## 1. Firebase Auth (merchant-dashboard)

Email/password para dueños de sede. El PWA **no** usa Firebase.

### Consola

1. Entra a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto (o usa el mismo de Google Cloud).
2. Authentication → Sign-in method → habilita **Email/Password** y **Google**.
3. Authentication → Settings → Authorized domains: agrega `localhost` y el dominio del dashboard (ej. `app.entraenlaonda.com`).
4. Project settings → General → Your apps → agrega una app **Web**. Copia `apiKey`, `authDomain`, `projectId`, `appId`.
5. Project settings → Service accounts → Generate new private key. Guarda el JSON (no lo subas al git).

### Variables

```bash
# API (Admin SDK)
FIREBASE_PROJECT_ID="tu-proyecto"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-...@tu-proyecto.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# merchant-dashboard (cliente)
NEXT_PUBLIC_FIREBASE_API_KEY=""
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="tu-proyecto.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="tu-proyecto"
NEXT_PUBLIC_FIREBASE_APP_ID=""
```

En `.env` la private key va en una línea con `\n` reales escapados.

### Cómo probar

1. Crea un usuario en Authentication, usa “Crear cuenta” en `http://localhost:4202/onboarding`, o entra con Google en `http://localhost:4202/login`.
2. En Postgres, esa sede debe tener `Store.ownerEmail` igual al email de Firebase (seed: `owner0@entraenlaonda.com`).
3. Sin estas vars, el dashboard **no** muestra login y sigue el picker de sedes local.

### Fallos típicos

- `Token de Firebase inválido`: el Admin SDK no coincide con el proyecto de la app web (revisa `projectId`).
- Login ok pero lista de sedes vacía: el email no coincide con `ownerEmail` (case-insensitive).
- `auth/unauthorized-domain`: falta `localhost` en Authorized domains.
- `auth/operation-not-allowed`: el proveedor Google no está habilitado en Sign-in method.

---

## 2. Google Cloud (Places + Cloud Tasks + infra)

El mismo proyecto GCP que Firebase.

### Places (dirección en onboarding)

1. APIs & Services → Enable **Maps JavaScript API** y **Places API**.
2. Credentials → API key. Restríngela a HTTP referrers (`http://localhost:4202/*`, tu dominio) y solo esas APIs.

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""
```

Sin key, el campo de dirección funciona como texto libre.

### Cloud Tasks (cola de jobs en prod)

En local **no hace falta**: si `GCP_PROJECT` y `CLOUD_TASKS_QUEUE` están vacíos, la API usa Redis/BullMQ (`REDIS_URL`) o envío inline.

1. Enable **Cloud Tasks API**.
2. Crea la cola:

```bash
gcloud tasks queues create onda-jobs --location=us-central1
```

3. Service account con `cloudtasks.enqueuer` y, si usas OIDC, permiso de invocar la URL del API.
4. El worker es el propio API: Cloud Tasks hace `POST {JOBS_WORKER_URL}/api/jobs/run`.

```bash
GCP_PROJECT="tu-proyecto"
GCP_LOCATION="us-central1"
CLOUD_TASKS_QUEUE="onda-jobs"
JOBS_WORKER_URL="https://api.entraenlaonda.com"
JOBS_SECRET="un-secreto-largo"
CLOUD_TASKS_SA_EMAIL="onda-tasks@tu-proyecto.iam.gserviceaccount.com"
```

`JOBS_SECRET` viaja en `X-Onda-Jobs-Secret`. En local déjalo vacío.

Tipos de job: `whatsapp-send`, `brevo-email`, `brevo-sms`, `wallet-notify`, `wompi-renew`.

### Infra

El diagrama asume el API en Google (Cloud Run/GCE). Este repo no incluye Terraform: despliega el NestJS (`apps/api`) y apunta `JOBS_WORKER_URL` a su URL pública.

---

## 3. Wompi (cobro de suscripción PRO)

Plan PRO: **$69.900 COP / mes**.

### Consola

1. Crea comercio en [Wompi](https://comercios.wompi.co/) (sandbox primero).
2. Desarrolladores → llaves: **pública**, **privada**, **integridad**, **eventos**.
3. Eventos → URL: `https://<api>/api/billing/wompi/webhook` → evento `transaction.updated`.

```bash
WOMPI_PUBLIC_KEY="pub_test_..."
WOMPI_PRIVATE_KEY="prv_test_..."
WOMPI_INTEGRITY_SECRET=""
WOMPI_EVENTS_SECRET=""
WOMPI_API_URL="https://sandbox.wompi.co/v1"
```

En producción: `https://production.wompi.co/v1` y llaves `pub_prod_` / `prv_prod_`.

### Flujo

1. En el dashboard, Configuración → Upgrade a PRO.
2. La API guarda `Store.wompiTransactionId` (referencia) y devuelve datos del Widget.
3. El merchant paga en el checkout Wompi.
4. El webhook, si la firma es válida y `status=APPROVED`, pone `planType=PRO` y guarda `wompiPaymentSourceId` si viene.
5. Se encola `wompi-renew` a 30 días (Cloud Tasks o BullMQ). Sin payment source, el job solo deja log.

Sin llaves, el botón activa PRO **sin cobro** (modo desarrollo).

### Fallos típicos

- Widget no abre: falta `WOMPI_INTEGRITY_SECRET` o la pública no es `pub_test_`/`pub_prod_`.
- Webhook `Firma Wompi inválida`: `WOMPI_EVENTS_SECRET` incorrecto.
- Pago ok pero sigue BASIC: la referencia no coincide con `wompiTransactionId` (revisa logs del webhook).

---

## 4. Brevo (email + SMS)

1. Cuenta en [Brevo](https://app.brevo.com/).
2. SMTP & API → API key.
3. Senders → verifica `BREVO_SENDER_EMAIL`.
4. SMS: activa el canal y configura el sender (máx. 11 caracteres alfanuméricos).

```bash
BREVO_API_KEY=""
BREVO_SENDER_EMAIL="hola@entraenlaonda.com"
BREVO_SENDER_NAME="Onda"
BREVO_SMS_SENDER="Onda"
```

Usos:

- **Email** al crear un lead (`POST /api/leads`) y al terminar el alta de un comercio (`ownerEmail`).
- **SMS** al crear una campaña (`POST /api/campaigns`) hacia los teléfonos de esa sede. Incluye `CAMPAIGN_FREE_MONTHLY` (default 1) gratis al mes; extras se cobran con Wompi.

Sin `BREVO_API_KEY`, solo hay logs `[Brevo stub]`.

---

## 5. WhatsApp OTP — Meta Cloud API

OTP de login de clientes en la PWA. Va directamente por la Cloud API de Meta (no pasa por Kapso).

### Plantilla requerida

En WhatsApp Manager crea (o verifica que exista) una plantilla de categoría **AUTHENTICATION** con botón **Copiar código**:

| Campo | Valor |
|---|---|
| Nombre | `otp_template` (o el que configures en `WHATSAPP_OTP_TEMPLATE`) |
| Categoría | AUTHENTICATION |
| Idioma | Spanish (`es`) |
| Botón | Copy code (OTP) |

Meta genera el texto fijo del body ("es tu código de verificación") y el pie de página de expiración. No hay variables de texto libre en el body que necesites definir: el código va en el componente `button`.

### Obtener credenciales

1. En [Meta for Developers](https://developers.facebook.com/) → selecciona tu app.
2. **WhatsApp > API Setup** → copia el **Phone number ID** (campo numérico, no el número visible).
3. Crea un **System User** en [Business Settings](https://business.facebook.com/settings/system-users) con rol Worker → asígnale la app → genérale un token con permiso `whatsapp_business_messaging` (sin expiración).

### Variables

```bash
# OTP de clientes — Meta Cloud API
OTP_MOCK="true"
# Token permanente de System User (no el de 24 h del Graph Explorer)
WHATSAPP_TOKEN=""
# ID numérico del número (WhatsApp Manager > API Setup)
WHATSAPP_PHONE_NUMBER_ID=""
# Nombre exacto de la plantilla aprobada en WhatsApp Manager
WHATSAPP_OTP_TEMPLATE="otp_template"
# Código de idioma (debe coincidir exactamente con lo registrado en Meta)
WHATSAPP_OTP_LANGUAGE="es"
# Versión de Graph API
WHATSAPP_API_VERSION="v22.0"
```

Sin token o phone number ID la función entra en modo stub (log sin exponer el código).

### Activar envío real

1. Pega `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` en `.env`.
2. Pon `OTP_MOCK=false`.
3. Reinicia el API (`pnpm dev:api`).
4. Abre la PWA con un número que tenga WhatsApp → pide el código → debe llegar la plantilla con el botón Copiar código. El campo `devCode` ya no aparece en la respuesta.

### Errores frecuentes

| Código Meta | Causa | Solución |
|---|---|---|
| 132001 | Template not found | El nombre o idioma de la plantilla no coincide con lo aprobado |
| 190 | Token inválido o caducado | Usar token de System User, no el de Graph Explorer |
| 131030 | Recipient no tiene WhatsApp | El número no está registrado en WhatsApp |

### Guard de producción

El API no arranca con `NODE_ENV=production` + `OTP_MOCK=false` si faltan `WHATSAPP_TOKEN` o `WHATSAPP_PHONE_NUMBER_ID`.

---

## 5b. Kapso (WhatsApp — mensajes de negocio)

Bienvenida, códigos de caja e invitaciones a eventos. **El OTP ya no pasa por Kapso.**

1. Cuenta en [Kapso](https://kapso.ai/) ligada a Meta WhatsApp Business.
2. Copia API key, Phone number ID y webhook secret.
3. En Meta, aprueba las plantillas (idioma `es`):

| Template | Uso |
|---|---|
| `onda_bienvenida` | Alta de cliente |
| `onda_puntos` | Acumulación |
| `onda_confirmar_codigo` | Código para caja |
| `onda_resena_pro` | Reseña PRO |
| `onda_invitacion_evento` | Invitación a evento |

4. Webhook Kapso: `https://<api>/api/webhooks/kapso`. Firma HMAC-SHA256 en `X-Kapso-Signature` o `X-Webhook-Signature` (hex, opcional prefijo `sha256=`).

```bash
KAPSO_API_KEY=""
KAPSO_PHONE_NUMBER_ID=""
KAPSO_WEBHOOK_SECRET=""
```

Sin `KAPSO_API_KEY`, los envíos de negocio entran en modo stub (log). El OTP sigue funcionando por Cloud API independientemente.

Los envíos pasan por la cola (`JobsService` → Kapso).

---

## 6. WalletWallet (wallet + push)

Pases Apple/Google Wallet y el push de banner al actualizar el pass.

1. Cuenta en [WalletWallet](https://www.walletwallet.dev/docs/).
2. API key formato `ww_live_<32 hex>`.
3. Elige plan (`free` | `trial` | `pro` | `byok`). `pro`/`byok`/`trial` habilitan color/logo custom.

```bash
WALLET_API_KEY=""
WALLET_API_BASE_URL="https://api.walletwallet.dev"
WALLET_PLAN="free"
```

Vacío o `dev-wallet-key` = stub (`walletRef` `stub-...`, sin HTTP).

Las campañas `channel: WALLET` (`POST /api/campaigns`) hacen push (`WalletService.notify`) a todos los pases de la sede con `walletRef`.

---

## Orden recomendado

1. Postgres (Neon en `DATABASE_URL`, o `pnpm docker:up` si es localhost) y jobs (Cloud Tasks, o Redis/BullMQ local). Docker es opcional.
2. Meta Cloud API (`WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID`) — OTP real; sin ello el PWA usa `devCode`.
3. Kapso — mensajes de negocio (bienvenida, invitaciones, código de caja).
4. WalletWallet — pases reales.
5. Google Places — autocomplete en onboarding.
6. Firebase — login del dashboard (crea el usuario con el email del seed).
7. Wompi sandbox — cobro PRO.
8. Brevo — emails y SMS de campañas.
9. Cloud Tasks — cuando el API esté en GCP; hasta entonces BullMQ basta.
