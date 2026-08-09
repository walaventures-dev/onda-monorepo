# Onda — Design System

**Fuente única de verdad para diseño de UI.** Este documento describe el sistema de diseño real y vigente de Onda, extraído del código en producción (`libs/shared/ui`, `apps/pwa-client`, `apps/merchant-dashboard`, `apps/organizer-dashboard`). Cualquier agente de IA (o humano) que genere componentes para este monorepo debe leer este archivo primero y ceñirse a él.

No es un documento aspiracional: cada token y regla aquí existe hoy en el código. Donde el código no define un valor (dark mode, algunas escalas), se propone un valor coherente con el sistema existente y se marca explícitamente como **(propuesto)**.

---

## 1. Brand & Aesthetic Overview

Onda es una plataforma de fidelización (sellos/puntos) para comercios y eventos en Colombia, con un flujo de WhatsApp como canal principal. El copy de producto es 100% en español (es-CO).

**Tono visual:** cálido-tecnológico, óptimista, "fintech amigable". Ni corporativo-frío ni infantil. Piensa en Wallet de Apple + apps fintech LatAm (Nequi, Rappi) más que en SaaS B2B genérico.

Pilares:

- **Azul sólido como firma de marca.** El azul primario (`--onda-primary-500`, `#052DDE`) es el elemento más distintivo de Onda: se usa en el logo, en el ícono de la app y en CTAs destacados — siempre sólido, **sin degradados**. Hover/active de CTAs usa `--onda-primary-600` (`#041DB2`).
- **Superficies claras y neutras.** Fondo general en gris de marca (`--onda-bg: #F2F2F2`), tarjetas blancas puras (`--onda-card: #FFFFFF`) y bordes `#E4E4E4`. Misma familia fría que el azul primario — sin beige/crema que choque con gris y blanco.
- **Formas redondeadas consistentes.** Casi nada es rectangular puro: botones y chips son `pill` (radio total), tarjetas e inputs usan radios grandes (`0.85rem`–`1.5rem`). Esto es intencional y central a la identidad — un componente con esquinas a 90° o `rounded-md` se ve "fuera de marca" salvo excepciones puntuales (badges de estado en tablas, algún ícono contenedor).
- **Dos temperaturas de azul con roles fijos.** Celeste (`--onda-sky`, `#3DB9E8`) = "acumulación / entrada de datos / información neutra". Azul primario (`--onda-primary-500` / `--onda-violet`, `#052DDE`) = "acción principal / canje / marca". Son de la misma familia cromática (azul) pero con temperatura y saturación distintas — el primario es notablemente más profundo y saturado que el celeste, nunca los uses como si fueran intercambiables. No intercambies estos roles.
- **Dos apps, un mismo lenguaje, distinta densidad.** El **PWA Client** (cliente final en el celular) es de una sola columna, gestual, con CTAs grandes tipo app nativa. Los **dashboards** (merchant / organizer) son de trabajo, con más densidad de datos, tablas, KPIs y gráficas, pero comparten paleta, radios, tipografía y tono con el PWA.

---

## 2. Color Palette

### 2.1 Tokens de marca (`libs/shared/ui/src/styles.css`, `:root`)

Estas variables CSS están disponibles globalmente en las 4 apps front (se importan vía `styles.css`). Úsalas siempre por token — nunca hardcodees el hex salvo que estés *definiendo* el token.

| Token | Valor | Rol semántico |
|---|---|---|
| `--onda-sky` | `#3DB9E8` | Color secundario — acumulación, datos, links informativos |
| `--onda-sky-soft` | `#E5F6FC` | Fondo suave para hover/estado activo de elementos "sky" |
| `--onda-violet` | `var(--onda-primary-500)` → `#052DDE` | **Primario** — CTA principal, marca, canje, navegación activa. Alias histórico: el nombre de la variable quedó de la época en que el primario era violeta; hoy resuelve a azul. Ver [2.1.1](#211-escala-primaria-50900) |
| `--onda-violet-soft` | `var(--onda-primary-100)` → `#E2EAFD` | Fondo suave para hover/estado activo de elementos "primary" |
| `--onda-bridge` | `#5B8AF0` | Azul puente — usado en `:hover`/`:focus` de bordes de inputs |
| `--onda-lime` | `#DDF24E` | Acento — avatar de "usuario" en el PWA, detalles de energía/gamificación. Uso puntual, nunca como color de texto o superficie grande |
| `--onda-ink` | `#1A1B2E` | Texto principal / fondo de overlays oscuros |
| `--onda-muted` | `#6B7289` | Texto secundario, labels, metadatos, timestamps |
| `--onda-bg` | `#F2F2F2` | Fondo de página (body) — gris de marca |
| `--onda-card` | `#FFFFFF` | Fondo de tarjetas/superficies elevadas |
| `--onda-border` | `#E4E4E4` | Bordes de tarjetas, inputs, separadores (un paso más oscuro que el bg para contraste) |
| `--onda-success` | `#2BB673` | Éxito, deltas positivos, confirmaciones |
| `--onda-danger` | `#E5484D` | Error, deltas negativos, acciones destructivas |
| `--onda-gradient` | `var(--onda-primary-500)` → `#052DDE` | Alias legacy (antes era un degradado). `.onda-gradient` / `GradientButton` son azul **sólido** |

Alias semánticos adicionales (mapeados a los tokens de arriba, usados por HeroUI):

```css
--accent: var(--onda-violet);
--accent-foreground: #ffffff;
--background: var(--onda-bg);
--foreground: var(--onda-ink);
--primary: var(--onda-violet);
--secondary: var(--onda-sky);
```

#### 2.1.1 Escala primaria 50–900

El color principal de Onda es un azul saturado, **`#052DDE`**, fijado como el peso **500** de una escala completa de 10 pesos. La escala vive en `libs/shared/ui/src/styles.css` como `--onda-primary-50` … `--onda-primary-900`, y es la fuente de verdad — `--onda-violet`/`--onda-violet-soft` son solo alias hacia `500`/`100` para no romper los componentes existentes que ya referencian esos nombres.

Generada interpolando en HSL a partir del H/S/L exacto de `#052DDE` (H 228.9°, S 95.6%, L 44.5%): la luminosidad decrece de forma monótona de 50→900, la saturación se atenúa levemente en los extremos (evita un blanco "sucio" en 50 y un negro-azulado plano en 900, siguiendo el principio de "el tono más oscuro no es negro puro"), y el matiz se desplaza unos pocos grados hacia el violeta en los tonos oscuros (600–900) y hacia el cian en los claros (50–300) para que la escala se sienta rica y no plana.

| Peso | Hex | HSL aprox. | Uso |
|---|---|---|---|
| 50 | `#F1F5FE` | H222 S85 L97 | Fondo muy sutil (hover apenas perceptible, superficies "seleccionadas" grandes) |
| 100 | `#E2EAFD` | H223 S88 L94 | = `--onda-violet-soft`. Fondo de hover/activo estándar (nav, chips, badges) |
| 200 | `#C0CFFC` | H225 S90 L87 | Bordes/fondos de estado activo con más presencia que 100 |
| 300 | `#8EA6FA` | H227 S92 L77 | Elementos decorativos claros, disabled-state de algo "primary" |
| 400 | `#3E63F9` | H228 S94 L61 | Variante más clara del primario — hover de superficies oscuras, gráficas |
| **500** | **`#052DDE`** | **H228.9 S95.6 L44.5** | **Primario** — CTA, marca, navegación activa, foco. El valor exacto pedido, sin redondear |
| 600 | `#041DB2` | H230 S96 L35 | `:hover`/`:active` de botones primarios sobre fondo claro — azul oscuro de marca |
| 700 | `#081C91` | H231 S90 L30 | Texto sobre fondo `primary-50`/`100` cuando se necesita alto contraste con tinte de marca |
| 800 | `#09166D` | H232 S85 L23 | Superficies oscuras de marca (raro; úsalo solo si hace falta un "primary" casi-navy) |
| 900 | `#080F44` | H233 S78 L15 | Extremo oscuro — reservado, análogo a `--onda-ink` pero con tinte de marca |

**Contraste (WCAG, sobre blanco):** `primary-500` → 8.62:1, `primary-600` → 10.87:1, `primary-700` → 13.25:1 (los tres de sobra para texto AA/AAA). `primary-400` → 4.82:1 (pasa AA solo para texto normal, justo). `primary-300` → 2.34:1 — no uses `primary-300` ni tonos más claros como color de texto sobre blanco, solo como fondo/decorativo.

### 2.2 Estados semánticos — mapa de uso

| Estado | Color | Fondo suave asociado | Ejemplo real |
|---|---|---|---|
| Éxito / positivo | `--onda-success` `#2BB673` | `color-mix(in srgb, var(--onda-success) 16%, white)` (propuesto, sigue el patrón de sky/violet) | Delta `+100%` en KPI card, ícono de confirmación en diálogos |
| Error / peligro / negativo | `--onda-danger` `#E5484D` | ídem patrón `color-mix` | Delta negativo en KPI, botón `.onda-dialog-btn--danger`, borrar recurso |
| Alerta / atención | Naranja/ámbar — **no hay token dedicado hoy**; el dashboard usa un naranja de acento (`#f5a524`-ish, visible en la barra lateral de "Recomendaciones") para severidad "Atención" | — | Barra izquierda de tarjetas de recomendación en Resumen del dashboard |
| Info / neutro | `--onda-sky` `#3DB9E8` | `--onda-sky-soft` | Tooltips informativos, chip "Bien"/neutral |
| Urgente (severidad alta, distinta de "danger" de UI) | Rojo, igual family que `--onda-danger` | — | Punto "Urgente" en leyenda de Recomendaciones |

> **Nota para IA:** cuando necesites un color de alerta/warning que no sea éxito ni error, usa un ámbar (`#F5A524` o similar) consistente con la saturación de la paleta — no inventes un tono que no case con sky/violet/success/danger. No existe hoy una variable `--onda-warning`; si vas a introducir una, colócala junto a las demás en `:root` de `libs/shared/ui/src/styles.css`, no en un archivo nuevo.

### 2.3 Superficies — PWA Client vs. Dashboards

Ambos comparten el mismo fondo base (`--onda-bg`) y tarjeta base (`--onda-card` + `--onda-border`), pero difieren en cómo las usan:

| | PWA Client | Merchant / Organizer Dashboard |
|---|---|---|
| Fondo de página | `--onda-bg`, ancho máximo `28rem` centrado (`onda-pwa-shell`) — simula un contenedor móvil incluso en desktop | `--onda-bg`, ancho completo con sidebar fijo |
| Tarjeta primaria | Fondo `--onda-card` (`#FFFFFF`), sombra difusa grande (`0 8px 24px rgba(26,27,46,.06)`), radios muy grandes (`1rem`–`1.5rem`) | `.onda-card`: `--onda-card`, borde `1px solid var(--onda-border)`, sombra sutil `0 10px 30px rgba(26,27,46,.06)`, radio `1rem` |
| Header/hero | Bloque primario sólido a sangre (`onda-pwa-hola-banner`, `background: var(--onda-violet)`) con texto blanco — usado en pantallas de bienvenida | Topbar translúcido sobre `--onda-card` con `backdrop-filter: blur(8px)` sobre borde inferior sutil |
| Overlay/backdrop de modal | `rgba(26,27,46,.45)` + `blur(4px)` | mismo token (`--onda-dialog-backdrop`) — compartido |

### 2.4 Dark mode

**No existe hoy.** No hay clases `dark:` de Tailwind autoría propia ni `prefers-color-scheme` en el CSS de las apps (solo aparece en artefactos compilados de dependencias de terceros). Si se solicita dark mode, no lo improvises por componente: es una decisión de sistema que requiere definir una segunda tabla de tokens en `:root[data-theme="dark"]` primero.

---

## 3. Typography System

### 3.1 Familias

| Familia | Uso | Carga |
|---|---|---|
| **Sora** (400–700) | Headings (`h1`, `h2`, `h3`, clase `.font-display`), números destacados (KPIs, puntos), logo | `@font-face` vía Google Fonts CDN (`fonts.gstatic.com`), `font-display: swap` |
| **Manrope** (400–700) | Body text, UI (`html, body`), fallback de headings | ídem |

Stack de fallback: `"Sora", "Manrope", system-ui, sans-serif` para display; `"Manrope", system-ui, sans-serif` para body. Nunca más de estas dos familias — no introduzcas una tercera.

Aplica `.font-display` (o usa directamente `h1`/`h2`/`h3`) para cualquier texto que deba sentirse "de marca": títulos de sección, valores numéricos grandes, títulos de modal. El resto del texto (labels, párrafos, botones) usa Manrope por defecto — no fuerces Sora en texto de UI denso, se ve pesado a tamaños pequeños.

### 3.2 Escala de tamaños

Escala real observada en el código (no es una escala modular estricta 1.25 — es más densa en el rango pequeño, típico de UI de datos). Usa estos valores; no inventes tamaños intermedios como `15px` o `13px`.

| Token Tailwind | rem / px | Uso principal |
|---|---|---|
| `text-[10px]` / `text-[11px]` | 10–11px | Micro-labels: eyebrow uppercase, texto legal, badges muy pequeños |
| `text-xs` | 0.75rem / 12px | Labels, metadatos, texto de tabla secundario, timestamps — **el tamaño más usado del sistema (40+ ocurrencias)** |
| `text-sm` | 0.875rem / 14px | Body por defecto en UI densa, inputs, botones — **el tamaño más usado en general (100+ ocurrencias)** |
| `text-base` | 1rem / 16px | Body en contexto de lectura (PWA, formularios legales) |
| `text-lg` | 1.125rem / 18px | Sub-encabezados de tarjeta |
| `text-xl` | 1.25rem / 20px | Títulos de sección de dashboard, título de tarjeta de pase |
| `text-2xl` | 1.5rem / 24px | Valor numérico de KPI card |
| `text-3xl` | 1.875rem / 30px | Valor numérico grande (pase, contador de puntos) |
| `text-4xl` / `text-5xl` | 2.25rem / 3rem | Headlines de pantalla completa en PWA (login, onboarding) |
| `clamp(1.35rem, 5vw, 1.7rem)` | fluido | `.onda-pwa-title` — título de hero en PWA, escala con viewport |
| `clamp(1.6rem, 7vw, 2.1rem)` | fluido | `.onda-pwa-headline` — headline principal de pantalla PWA |
| `clamp(2rem, 10vw, 2.6rem)` | fluido | `.onda-pwa-hola-banner h1` — saludo grande en banner de bienvenida |

En PWA, para textos que son literalmente el elemento más importante de la pantalla (saludo, headline), usa `clamp()` fluido en vez de un tamaño fijo — es el patrón establecido, no un `text-4xl` fijo.

### 3.3 Pesos

| Peso | Tailwind | Uso |
|---|---|---|
| 400 (normal) | `font-normal` | Body text de lectura larga (legal, descripciones) |
| 500 (medium) | `font-medium` | Nav links, valores de tabla, botones secundarios |
| 600 (semibold) | `font-semibold` | Títulos de tarjeta, botones primarios, labels destacados |
| 700 (bold) | `font-bold` | Headlines, valores de KPI, números de pase |

No uses pesos por debajo de 400 en ningún texto — ambas familias solo cargan 400–700.

### 3.4 Alturas de línea

| Contexto | `line-height` | Ejemplo |
|---|---|---|
| Headings / números grandes | `1.1`–`1.3` (`leading-tight` o valor explícito) | `.onda-pwa-title` (1.15), `.onda-dialog-title` (1.3) |
| Body / texto de lectura | `1.35`–`1.45` | `.onda-dialog-body` (1.45), `.onda-pwa-sub` (1.35) |
| Micro-texto / badges | `1.2`–`1.3` | `.onda-tx-time` (1.2), `.onda-tx-detail` (1.3) |

No uses `leading-relaxed` (1.75) — no aparece en el sistema; la densidad de Onda es más ajustada que la de un blog.

### 3.5 Tracking (letter-spacing)

Los eyebrows/labels uppercase usan tracking amplio, siempre en combinación con `text-transform: uppercase` + tamaño pequeño + `--onda-muted` o color de marca:

- `letter-spacing: 0.04em`–`0.08em` para labels tipo "PASE DE LEALTAD", "MIEMBRO", eyebrows de sección.
- `letter-spacing: 0.14em`–`0.15em` para micro-labels aún más pequeños (10px) en `PassPreview`.

---

## 4. Spacing & Layout Tokens

### 4.1 Espaciado

Onda usa la escala por defecto de Tailwind (múltiplos de 0.25rem/4px) sin extenderla — no hay tokens de espaciado custom en `:root`. En CSS propio (`.onda-*`), los valores más frecuentes son:

| Valor | Uso |
|---|---|
| `0.25rem`–`0.35rem` (4–5.6px) | Gap entre ícono y label, gap interno de badges |
| `0.5rem`–`0.65rem` (8–10.4px) | Gap entre elementos relacionados (fila de transacción, toolbar) |
| `0.85rem`–`1rem` (13.6–16px) | Padding interno de botones, inputs, nav links |
| `1.25rem`–`1.5rem` (20–24px) | Padding de tarjeta, gap entre bloques de una tarjeta |
| `1.5rem`–`2rem` (24–32px) | Padding de contenido de página (`.onda-content`: `1.5rem` mobile → `2rem` desktop) |

Regla práctica: gap **dentro** de un componente (ícono+texto, label+valor) ≤ `0.5rem`; gap **entre** componentes relacionados `0.75rem`–`1rem`; gap **entre secciones** de página `1.5rem`+ (ver `.onda-two-col` con `gap: 1.5rem`, `.onda-kpi-grid` con `gap: 1rem`).

### 4.2 Anchos de contenedor

| Contexto | Ancho máx. | Token/valor |
|---|---|---|
| Shell completo del PWA Client | `28rem` (448px), centrado con `margin-inline: auto` | `.onda-pwa-shell` — el PWA siempre se ve como una app móvil, incluso en pantallas anchas |
| Diálogo/modal estándar | `min(92vw, 24rem)` | `.onda-dialog-container` |
| Popover de select | `min(92vw, 420px)` | `.onda-select-popover` |
| Sidebar de dashboard (expandido) | `260px` | `.onda-sidebar` |
| Sidebar de dashboard (colapsado) | `4.5rem` (72px) | `.onda-sidebar.is-collapsed` |
| Layout de 2 columnas en dashboard | `1.2fr 1fr` desde `1024px` | `.onda-two-col` |
| Panel derecho (preview) en editor de pase | `280px`–`320px` desde `1024px` | `.onda-pass-designer-layout` |

### 4.3 Border radius

Este es el token más distintivo del sistema — **radios grandes y consistentes**, casi todo termina en `rounded-xl` o `rounded-full`:

| Radio | rem/px | Uso |
|---|---|---|
| `rounded-full` / `999px` | pill | **Todos los botones de acción, chips, badges, avatares, inputs de selección, campos de OTP-container**. Es el radio por defecto para cualquier elemento interactivo pequeño/mediano |
| `rounded-2xl` / `1.5rem` (24px) | Banners grandes de PWA, tarjeta de pase (`1.35rem`), diálogos (`1.25rem`) |
| `rounded-xl` / `0.85rem`–`1rem` (13.6–16px) | **El radio de tarjeta por defecto** — `.onda-card`, inputs de texto, popovers de select, avatar cuadrado del logo |
| `rounded-lg` / `0.75rem` (12px) | Contenedores de ícono medianos, tooltip |
| `rounded-md` | Uso puntual — evítalo salvo que un componente HeroUI lo traiga por defecto |
| `rounded-sm` / `1–3px` | Elementos decorativos minúsculos (barritas del "código de barras" en `PassPreview`) |

**Regla para IA:** si dudas entre dos radios, elige el más grande de los dos razonables. Un botón, chip, badge o avatar nuevo casi siempre debería ser `rounded-full`. Una tarjeta o input nuevo casi siempre `rounded-xl`. `rounded-md`/`rounded-sm` son la excepción, no la norma.

### 4.4 Sombras y elevación

No hay una escala `shadow-sm/md/lg/xl` formal en tokens — las sombras están escritas ad-hoc como `rgba(26, 27, 46, X)` (siempre con el tinte `--onda-ink`, nunca gris/negro puro), pero siguen un patrón de 3 niveles de elevación consistente:

| Nivel | Valor | Uso |
|---|---|---|
| **Nivel 1 — reposo** | `0 1px 2px rgba(26, 27, 46, 0.04)` | Trigger de select, botón de color, elementos apenas elevados sobre el fondo |
| **Nivel 2 — tarjeta** | `0 8px 24px rgba(26, 27, 46, 0.06)` (PWA) / `0 10px 30px rgba(26, 27, 46, 0.06)` (dashboard) | `.onda-card`, inputs flotantes del PWA, KPI cards |
| **Nivel 3 — flotante (popover/menú)** | `0 16px 40px rgba(26, 27, 46, 0.12)` | Popover de select |
| **Nivel 4 — modal/diálogo** | `0 24px 60px rgba(26, 27, 46, 0.2)` | `.onda-dialog` |
| **Nivel 5 — hero/destacado** | `0 20px 50px rgba(26, 27, 46, 0.22)` | `PassPreview` (la tarjeta de pase es el elemento más "flotante" de toda la UI) |

Sombras de color (no neutras) se usan solo para reforzar un CTA de marca: `.onda-pwa-cta` usa `0 12px 28px rgba(5, 45, 222, 0.28)` (primario), el botón de WhatsApp usa `rgba(37, 211, 102, 0.28)` (verde WhatsApp). Reserva sombras de color para el botón principal de la pantalla, no las uses en elementos secundarios.

**Regla:** la opacidad de sombra siempre es baja (0.04–0.28) y el color siempre es `--onda-ink` (`#1a1b2e`) o el color de marca del elemento — nunca negro puro ni gris genérico de Tailwind (`shadow-black/20`, etc.).

---

## 5. Iconography & Assets

### 5.1 Librería

**Phosphor Icons** (`@phosphor-icons/react`), exclusivamente. Import siempre de exports nombrados y de la ruta `csr` para tree-shaking, nunca el paquete raíz completo:

```tsx
import { TagIcon as Tag } from '@phosphor-icons/react/dist/csr/Tag';
```

No uses `import { Tag } from '@phosphor-icons/react'` (importa todo el barrel) ni el export default.

### 5.2 Weight y tamaño

- **Weight:** `"regular"` siempre. No mezcles `bold`, `duotone`, `fill` u otros pesos de Phosphor — rompería la consistencia visual del set completo.
- **Tamaño base:** `size={16}` en la prop del componente Phosphor, pero el tamaño *renderizado* se controla con className de Tailwind, que sobreescribe el `width`/`height` del SVG:
  - `h-3 w-3` (12px) — tamaño por defecto para casi todos los íconos inline (`CLASS`)
  - `h-4 w-4` (16px) — íconos con más protagonismo, p. ej. WhatsApp (`CLASS_LG`)
- `aria-hidden="true"` siempre en el ícono cuando va acompañado de texto visible (accesibilidad — el texto ya comunica el significado).

### 5.3 Ícono centralizado — `OndaIcons`

Todos los íconos de producto están centralizados en `libs/shared/ui/src/icons.tsx` como `OndaIcons.<nombre>` (ya instanciados como JSX, no como componentes). **Antes de importar un ícono de Phosphor directamente en un componente nuevo, revisa si ya existe una entrada equivalente en `OndaIcons`** — hay ~40 íconos ya mapeados a conceptos de producto (`OndaIcons.accumulate`, `OndaIcons.redeem`, `OndaIcons.pass`, `OndaIcons.gear`, etc.). Reutilízalos por su rol semántico en vez de crear una nueva instancia del mismo ícono de Phosphor.

### 5.4 Otros assets

- No hay set de ilustraciones custom ni SVGs de estado vacío — los empty states actuales son solo texto (`"Sin actividad aún."`). Si se necesita una ilustración, debe mantenerse en la paleta de marca (sky/violet/lime sobre blanco), no introducir un estilo de ilustración ajeno.
- El logo (`OndaLogo`) es un cuadrado `rounded-xl` con fondo azul sólido primario (clase `.onda-gradient`, alias legacy) + wordmark en `.font-display`. No existe un archivo de logo estático (SVG/PNG) — se genera en CSS/JSX.

---

## 6. Component Guidelines

Los componentes base (Button, Card, Table, Chip, Avatar, Badge, Form, Input, TextField, TextArea, InputOTP, Select, Spinner, AlertDialog, ColorPicker) vienen de **HeroUI v3** y se re-exportan desde `@onda/shared-ui` (`libs/shared/ui/src/index.tsx`). **Siempre importa estos primitivos desde `@onda/shared-ui`, nunca directamente desde `@heroui/react`** en código de aplicación — así el wrapping/theming queda centralizado en un solo lugar.

### 6.1 Botones

| Variante | Cuándo usarla | Apariencia |
|---|---|---|
| `primary` (HeroUI `<Button variant="primary">`) | Acción principal de la pantalla/diálogo | Fondo `--onda-violet` (= `--onda-primary-500`, `#052DDE`), texto blanco, `rounded-full` |
| `secondary` | Acción secundaria / cancelar | Outline o fondo neutro, `rounded-full` |
| `danger` | Confirmar una acción destructiva | Fondo `--onda-danger`, texto blanco (ver `.onda-dialog-btn--danger`) |
| `GradientButton` (`@onda/shared-ui`) | CTA de marca de muy alto protagonismo (poco frecuente — no lo uses como botón por defecto) | Azul sólido `--onda-primary-500` (clase `.onda-gradient`, nombre legacy), hover `--onda-primary-600`, `rounded-full`, `px-5 py-2.5 text-sm font-medium` |
| `.onda-wa-btn` | Deep-link a WhatsApp exclusivamente | Verde WhatsApp `#25D366`, `rounded-full`, ícono + label, sombra verde |
| `.onda-pwa-cta` (PWA) | CTA principal de pantalla completa en el flujo del cliente | Ancho completo, `min-height: 3.25rem`, `rounded-full`, fondo primario, sombra de color primario grande, `active:scale(0.98)` |

**Reglas comunes:** todos los botones son `rounded-full` (pill) — nunca esquinas cuadradas. Estado `disabled` = `opacity: 0.45–0.5`, sin cambiar el color de fondo. Feedback táctil en botones grandes de PWA vía `transform: scale(0.98)` en `:active`, no vía cambio de color.

- **PWA:** botones grandes, ancho completo, un CTA primario por pantalla como máximo. El botón secundario (si existe) es de menor peso visual (fondo `--onda-card`, texto en color primario) — nunca dos botones del mismo peso visual compitiendo.
- **Dashboard:** botones de tamaño estándar HeroUI, agrupados en toolbars/headers de tarjeta, pueden coexistir varios de peso similar (ej. filtros tipo `SegmentedControl`).

### 6.2 Inputs

- Radio `rounded-xl` (texto libre) o `rounded-full` (selects/pill inputs como `PhoneInput`, campos de búsqueda).
- Borde `1px solid var(--onda-border)` en reposo; `:hover`/`:focus` cambia el borde a `--onda-bridge` (nunca a `--onda-violet` directo en el borde — ese matiz queda para el outline de foco).
- Foco: `outline: 2px solid var(--onda-violet-soft); outline-offset: 2px` — un halo suave, no un borde duro de alto contraste.
- En PWA, los inputs son "flotantes": sin borde, fondo `--onda-card`, `box-shadow` en vez de borde (`.onda-pwa-field`), `font-size: 17px` explícito (evita el zoom automático de iOS Safari en inputs <16px — no bajes de ese tamaño en inputs de PWA).
- Labels de formulario: siempre de-enfatizados respecto al valor — uppercase, `0.7rem`, `font-weight: 600`, `letter-spacing: 0.04em`, color `--onda-muted` (ver `.onda-pass-designer label > span`). Nunca el mismo tamaño/peso que el valor que describen.
- Campos OTP (`InputOTP` / `.onda-pwa-otp-slot`): celdas cuadradas grandes (`3.5rem` alto), `rounded-xl`, número en `.font-display` bold, celda activa con el mismo halo de foco (`--onda-violet-soft` = `--onda-primary-100`).

### 6.3 Tarjetas (Cards)

- Clase base: `.onda-card` — fondo `--onda-card` (`#FFFFFF`), borde `--onda-border`, `rounded-xl`, sombra Nivel 2. Es el contenedor por defecto para **cualquier bloque de contenido agrupado** en el dashboard (KPI, gráfica, lista de actividad, panel de recomendaciones).
- Padding interno estándar: `px-4 py-3.5` (KPI card) hasta `p-4`–`p-5` para tarjetas con más contenido.
- Jerarquía dentro de una tarjeta: label pequeño/muted arriba → valor grande/bold debajo → metadata/delta pequeño al final. No inviertas este orden.
- Tarjetas con severidad (ej. "Recomendaciones" del dashboard) usan un borde/barra de color a la izquierda para codificar urgencia (naranja/azul primario/verde) — el resto de la tarjeta se mantiene neutro (blanco/gris), el color solo vive en el indicador, no satura toda la tarjeta.
- En PWA, la "tarjeta" más importante es el pase de fidelidad (`PassPreview`) — usa el color de marca del comercio (`backgroundColor`/`foregroundColor` dinámicos, no tokens fijos) porque representa la marca del comercio, no la de Onda.

### 6.4 Tablas

- Componente base: HeroUI `Table` re-exportado vía `@onda/shared-ui`. Usar siempre ese, no construir `<table>` a mano.
- Headers de tabla: pequeños, uppercase o muted, nunca compitiendo visualmente con las celdas de datos (mismo principio de jerarquía que los labels de formulario).
- Datos numéricos: `tabular-nums` (ver `font-variant-numeric: tabular-nums` en `.onda-tx-points`, y `class="tabular-nums"` en KPI values) para que las columnas de números alineen verticalmente.
- Las tablas viven exclusivamente en el **dashboard** (merchant/organizer) — el PWA Client nunca muestra tablas, solo listas verticales de tarjetas/filas (`.onda-tx-row`, `.onda-tx-list`).

### 6.5 Modales / Diálogos

- Usa siempre `useOndaDialogs()` (`confirm()` / `alert()`) para confirmaciones y avisos simples — **no uses `window.confirm`/`window.alert` nativos** ni construyas un modal ad-hoc para estos casos; el hook ya maneja tono (`default | success | warning | danger | accent`), foco y promesas.
- Estructura fija: backdrop `rgba(26,27,46,.45)` + `blur(4px)` → contenedor centrado `min(92vw, 24rem)` → diálogo `rounded-2xl` (`1.25rem`), sombra Nivel 4, padding `1.15rem 1.25rem 1.1rem`.
- Footer de diálogo: acciones alineadas a la derecha (`justify-content: flex-end`), botón secundario (cancelar) antes que el primario/danger (confirmar) en el DOM, siguiendo el orden izquierda→derecha = menor→mayor compromiso.
- Para diálogos de contenido más complejo que confirm/alert (ej. selector de color `OndaColorPicker`, formularios), usa el mismo lenguaje visual (`rounded-xl`+, sombra Nivel 3, borde `--onda-border`) pero como popover/panel propio, no fuerces todo dentro de `AlertDialog`.

---

## 7. AI Generation Guardrails

Reglas estrictas — **NUNCA** hagas lo siguiente al generar o modificar UI en este repo:

1. **No inventes colores nuevos.** No uses hex arbitrarios (`bg-[#4287f5]`, `text-[#333]`, paletas Tailwind por defecto como `bg-blue-500` o `bg-gray-700`) cuando ya existe un token equivalente en `--onda-*`. Si de verdad falta un token (p. ej. warning/ámbar), propón añadirlo a `:root` en `libs/shared/ui/src/styles.css`, no lo hardcodees inline en el componente.
2. **No rompas el sistema de radios.** No generes botones, chips, avatares ni badges con `rounded-md`, `rounded-lg` o esquinas cuadradas — deben ser `rounded-full`. No generes tarjetas o inputs con esquinas cuadradas (`rounded-none`) — mínimo `rounded-xl`.
3. **No importes `@heroui/react` directamente en código de app.** Todo primitivo (`Button`, `Card`, `Table`, etc.) debe venir de `@onda/shared-ui`. Si un primitivo que necesitas no está re-exportado ahí, añádelo al export de `libs/shared/ui/src/index.tsx` en vez de importar el paquete original en el componente de la app.
4. **No mezcles pesos de ícono de Phosphor.** Todo ícono es `weight="regular"`. No uses `bold`, `fill`, `duotone`, ni mezcles con otra librería de íconos (Lucide, Heroicons, Font Awesome, emoji como ícono funcional).
5. **No importes el barrel completo de Phosphor.** Siempre `import { XIcon as X } from '@phosphor-icons/react/dist/csr/X'`, nunca `import { X } from '@phosphor-icons/react'`. Y antes de añadir un ícono nuevo, comprueba si ya existe un rol equivalente en `OndaIcons`.
6. **No implementes dark mode "de facto".** No añadas clases `dark:` sueltas a un componente aislado — hoy no existe dark mode en el sistema. Si el usuario lo pide, es una decisión de tokens a nivel de `:root`, no un parche por componente.
7. **No uses `window.confirm` / `window.alert` / modales custom para confirmaciones simples.** Usa `useOndaDialogs()`.
8. **No generes texto de UI en inglés.** Todo el copy del producto es español (es-CO). Mantén el tono directo y cercano ya presente (ej. "El pase se siente vivo estas dos semanas", no "Your pass is performing well").
9. **No hagas la app "full-width" sin criterio.** El PWA Client SIEMPRE se contiene a `max-width: 28rem` centrado, incluso en desktop — no lo expandas a pantalla completa. Formularios y bloques de texto en dashboard deben constreñirse (no dejes un `<input>` o párrafo estirarse a 100% del ancho de un contenedor grande sin razón).
10. **No sobrecargues de sombras.** Máximo un elemento "flotante" (Nivel 4–5) visible a la vez por pantalla (el modal abierto, o la tarjeta de pase). No pongas sombra grande en elementos secundarios/repetidos de una lista — usa el Nivel 1–2, o ninguna sombra y solo el borde `--onda-border`.
11. **No inventes una tercera familia tipográfica** ni cargues fuentes nuevas vía `<link>`/`next/font` sin que Sora/Manrope sean insuficientes — no lo son para el 99% de los casos.
12. **No confundas los roles de sky vs. primary.** Sky (`--onda-sky`, celeste) = información/acumulación/neutro. Primary (`--onda-violet` / `--onda-primary-500`, azul profundo `#052DDE`) = acción principal/marca/canje. Ambos son azules, pero de temperatura y saturación distintas — un botón de acción primaria en sky, o un dato puramente informativo en el azul primario saturado, es un error de sistema, no una variación válida.
13. **No uses degradados de marca.** La firma es azul sólido (`--onda-primary-500`). La clase `.onda-gradient` / token `--onda-gradient` son alias legacy a ese sólido — no reintroduzcas `linear-gradient` celeste→azul. Limita el azul primario sólido a logo, ícono y CTAs destacados; no lo uses como fondo de página completa.
14. **No mezcles densidades entre PWA y dashboard.** No traigas tablas HeroUI al PWA Client, ni reduzcas los CTAs del dashboard al tamaño gigante de los botones del PWA. Cada superficie tiene su densidad establecida (ver sección 6).
15. **Al proponer un valor que no está en este documento** (un tamaño, un color, un radio nuevo), interpola desde los valores existentes más cercanos en las tablas de arriba — no adivines un número arbitrario. Si el valor resultante no calza claramente en ninguna escala existente, señálalo explícitamente en tu respuesta en vez de introducirlo en silencio.
16. **No generes un nuevo tono de "primary" a mano.** Usa siempre uno de los 10 pesos de `--onda-primary-50`…`900` (sección 2.1.1) — no mezcles un `color-mix()` improvisado o un hex intermedio no listado ahí cuando necesites una variante más clara/oscura del primario.
17. **`--onda-violet`/`--onda-violet-soft` son alias, no la fuente de verdad.** Hoy resuelven a `--onda-primary-500`/`100` (azul, no violeta) para no romper componentes existentes. Si vas a escribir CSS nuevo desde cero, prefiere `--onda-primary-500` directamente sobre `--onda-violet` — es más explícito y no depende de un nombre histórico engañoso.
18. **No asumas que todo el código ya refleja `#052DDE`.** Varios componentes (gráficas Recharts, color por defecto del editor de pase, mapa de color por tipo de promo) tienen el hex del violeta anterior (`#6E5AE6`) *hardcodeado* en `.tsx`, fuera de las variables CSS — no fueron parte de este cambio de tokens y **no** se actualizan solos. Si tocas uno de esos archivos, pregunta o usa `var(--onda-primary-500)`/`#052DDE` en vez de reintroducir el hex viejo por copiar-pegar del código vecino.
