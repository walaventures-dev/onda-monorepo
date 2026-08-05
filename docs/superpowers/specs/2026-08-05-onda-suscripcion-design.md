# Onda como suscripción multi-restaurante: tarjeta única + ondas por restaurante

## Contexto

Hoy Onda funciona por restaurante de forma aislada: cada tienda emite su propio `Pass` (que es literalmente la tarjeta wallet de esa tienda), con su propio `walletRef`, y el cliente se registra de forma anónima (nombre + teléfono, sin verificación) cada vez que escanea un QR.

El nuevo enfoque convierte a Onda en una identidad única del cliente ("suscripción a Onda"):

- El cliente crea **una cuenta en Onda** (con verificación OTP), no una cuenta por restaurante.
- Gana **ondas** en cualquier restaurante afiliado a Onda.
- Las ondas son **acumulables globalmente en una sola tarjeta wallet**, pero **solo gastables en el restaurante donde se ganaron** (saldo aislado por restaurante).
- El dashboard de cada restaurante se conserva, pero cambia su rol: pasa a configurar su propia tasa de acumulación y a validar transacciones, ya no a emitir su propia tarjeta.

## Alcance de este documento

Cubre: modelo de datos, flujo de registro/OTP, flujo de acumulación (bono de bienvenida + compra validada con PIN), flujo de redención, portal web del cliente, y cambios en el merchant-dashboard.

Fuera de alcance (decisiones explícitamente diferidas):
- Canal de envío del OTP (SMS vs WhatsApp) — decisión del equipo de backend. El diseño es agnóstico al canal.
- Migración de tarjetas wallet ya emitidas bajo el modelo actual (por restaurante) — se mantienen como datos históricos, no se migran ni se reemiten (ver "Opción B" más abajo).
- Vencimiento/expiración de ondas — no se define en este spec; se asume sin vencimiento salvo que se indique lo contrario más adelante.

## Decisión de arquitectura: modelo aditivo (`OndaCard` nueva) en vez de migración dura

Se evaluaron dos opciones para resolver "dónde vive la tarjeta wallet única":

- **Opción A (descartada):** mover `walletRef` de `Pass` a `User` directamente, con migración y reemisión de todas las tarjetas wallet existentes. Modelo más limpio, pero disruptivo para clientes que ya tienen una tarjeta instalada.
- **Opción B (elegida):** crear una entidad nueva `OndaCard` (1:1 con `User`) que es la única fuente de la tarjeta wallet universal. `Pass` deja de emitir tarjetas propias y pasa a ser puramente el ledger por (usuario, restaurante) — muy cerca de lo que ya es hoy. Los `Pass` existentes no se tocan; `OndaCard` se emite desde cero para cuentas nuevas.

Se eligió la Opción B porque no requiere migración disruptiva del lado del cliente y reutiliza `Pass`/`Transaction`/`Promotion` casi sin cambios.

## Modelo de datos

### Entidad nueva: `OndaCard`

Representa la identidad y tarjeta wallet única del cliente. 1:1 con `User`.

```
OndaCard
  id
  userId        (unique, FK -> User)
  serialNumber  (unique)   // identidad codificada en el QR de la tarjeta
  walletRef                // referencia del pass Apple/Google Wallet, branding genérico "Onda"
  createdAt
```

El total de ondas mostrado en la tarjeta **no se persiste aparte**: se calcula como la suma de `Pass.points` de todos los `Pass` del usuario. Cuando ese total cambia, se empuja la actualización al wallet vía `WalletService.updatePoints` usando el `walletRef` de `OndaCard` (no el de `Pass`).

### `Pass` cambia de rol

Deja de ser "la tarjeta del restaurante" y pasa a ser el **saldo/ledger por (usuario, restaurante)**.

```
Pass
  id
  userId     (FK -> User)
  storeId    (FK -> Store)
  points
  // constraint único (userId, storeId) — evita bonos de bienvenida duplicados
```

`walletRef` deja de usarse para `Pass` nuevos (queda solo en registros históricos, sin reemitir).

### `Store` gana configuración de acumulación

Hoy la acumulación es fija (`points ?? 1` en el endpoint). Pasa a ser configurable por tienda:

```
Store
  ...
  earnMode           FLAT | PER_AMOUNT
  earnFlatPoints      Int      // ej. 1 onda por compra, usado si earnMode = FLAT
  earnAmountPerOnda   Int?     // ej. 1000 (COP) = 1 onda, usado si earnMode = PER_AMOUNT
```

### Sin cambios

- `Transaction` (ACCUMULATE/REDEEM) — se sigue creando igual, ahora referenciando el `Pass` con su nuevo significado.
- `Promotion` (catálogo de recompensas por tienda) — ya soporta `pointsRequired`, `isActive`, `expiryMode`, `maxRedemptions`; se reutiliza tal cual.
- `PassDesign` (branding por tienda: logo/colores) — ya no se usa para pintar una tarjeta wallet física, se reutiliza para pintar las tarjetas visuales por restaurante dentro del portal web.

## Flujos

### A. Cliente escanea el QR de un restaurante

1. Llega a `/r/[storeId]`. Si no tiene sesión activa, pasa por el flujo OTP: ingresa teléfono → recibe código (canal a definir por backend) → verifica.
2. Si el teléfono no existe en `User`, se crea el `User` (verificado) y se crea su `OndaCard` (branding genérico Onda, serial propio).
3. Se busca `Pass` para `(userId, storeId)`:
   - **No existe** → se crea con **1 onda de bienvenida**, registrada como `Transaction` tipo `ACCUMULATE` sin requerir PIN de tienda. Aplica sin importar si el usuario ya tiene cuenta y ondas en otros restaurantes — es su primera vez en *este* restaurante.
   - **Ya existe** → no se acredita nada; se le muestra su estado actual en ese restaurante. Volver a escanear no genera más bonos.
4. Se recalcula el total del usuario (suma de `Pass.points`) y se actualiza el wallet vía `OndaCard.walletRef`. Se envía notificación de WhatsApp (reutilizando el patrón de templates existente).

### B. Acumular por compra (en caja)

1. El cajero, desde el merchant-dashboard, identifica al cliente por su ID Onda o escaneando su `OndaCard`. Si el cliente nunca escaneó el QR de esa tienda antes (no tiene `Pass` ahí), se crea en este momento con la misma lógica de bono de bienvenida del flujo A.3.
2. El cajero ingresa el PIN de la tienda (igual que hoy) y, si `Store.earnMode = PER_AMOUNT`, el monto de la compra.
3. Cálculo de ondas:
   - `FLAT` → `Store.earnFlatPoints`
   - `PER_AMOUNT` → `floor(monto / Store.earnAmountPerOnda)`
4. Se actualiza `Pass.points`, se crea la `Transaction`, se refresca el total en `OndaCard`, se notifica por WhatsApp.

### C. Redimir (catálogo de recompensas)

Prácticamente sin cambios respecto al `redeem` actual: el cajero elige una `Promotion` del catálogo de su tienda, ingresa el PIN, se valida que el `Pass` de **esa tienda específica** tenga ondas suficientes (nunca el total global), se descuenta y se registra la `Transaction`.

## Portal del cliente (nueva sección en `pwa-client`)

Sesión autenticada vía OTP. Incluye:

- **Perfil / Mi tarjeta Onda**: muestra la `OndaCard` (QR/serial), el total de ondas, y botón para agregarla a Apple/Google Wallet.
- **Mis restaurantes**: una tarjeta visual por cada `Pass` que tenga, con el branding (`PassDesign`) de esa tienda, sus ondas ahí, y las recompensas del catálogo que puede pagar con ese saldo.
- **Explorar recompensas**: catálogo general de todos los restaurantes en Onda, para descubrir dónde acumular (el canje solo aplica donde ya tenga saldo suficiente).

## Cambios en el merchant-dashboard

- Nueva pantalla de configuración de `earnMode` (flat / por monto) y sus valores.
- Gestión del catálogo de recompensas (`Promotion`) — se reutiliza si ya existe, o se extiende de forma menor si no.
- Flujo de caja (accumulate/redeem con PIN) — se mantiene la UI actual, agregando el campo de monto cuando `earnMode = PER_AMOUNT`.

## Manejo de errores

- **Bono duplicado**: el constraint único `(userId, storeId)` en `Pass` evita crear un segundo bono; un `upsert` que encuentra el registro existente simplemente no acredita nada.
- **PIN de tienda inválido** → `403` (igual que hoy).
- **Puntos insuficientes al redimir** → `400`, validado contra el `Pass` de esa tienda específica.
- **Falla en la Wallet API** (emitir/actualizar pass) → no bloquea la transacción; el punto se registra igual en `Pass`/`Transaction`; la actualización del wallet es best-effort (igual al patrón actual con `walletRef` opcional).
- **OTP**: expiración de código y límite de intentos — mecanismo exacto a definir por backend, pero el flujo debe soportar reenvío y bloqueo tras varios intentos fallidos.
- **Carrera al crear cuenta** (dos registros simultáneos con el mismo teléfono) → se resuelve con `upsert` sobre `User.phone` (único), igual que hoy.

## Testing y verificación

**Restricción explícita para este proyecto: no se usa Playwright ni se ejecutan pruebas E2E.**

- Unit tests: cálculo de ondas (`FLAT` vs `PER_AMOUNT`, redondeo hacia abajo), lógica find-or-create de `Pass`.
- Integration tests: `accumulate`/`redeem` respetan el saldo por tienda (no el total); un segundo escaneo al mismo restaurante no duplica el bono de bienvenida.
- Verificación de "listo": el build/compilación pasa (`nx build` sobre los proyectos afectados) y revisión manual del diff de cambios. No se ejecutan pruebas E2E automatizadas ni Playwright en ningún punto del proceso.
