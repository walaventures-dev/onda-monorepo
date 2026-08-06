# Migración a Phosphor Icons

## Contexto

El proyecto tiene hoy dos sets de íconos SVG dibujados a mano:

- `OndaIcons` en [`libs/shared/ui/src/icons.tsx`](../../../libs/shared/ui/src/icons.tsx) — 43 íconos, consumido por el dashboard y por componentes compartidos (`AnalyticsFilters`, `TxActivity`, `index.tsx`).
- `IcoTag`, definido localmente en [`apps/merchant-dashboard/app/MerchantWorkspace.tsx`](../../../apps/merchant-dashboard/app/MerchantWorkspace.tsx) (líneas 144-189) — un set duplicado con 8 entradas, 3 de ellas (`eye`, `power`, `trash`) con el path SVG idéntico a las de `OndaIcons`.

`apps/pwa-client` no tiene un sistema de íconos propio hoy (solo un `<svg>` decorativo de progreso en `PendingRequestWait.tsx`, no es un ícono).

Auditando el uso real se encontraron varias inconsistencias visuales:
- El badge "NxM" de la tarjeta de promo usa siempre el mismo ícono genérico (`IcoTag.type`, un lápiz/etiqueta) sin importar el tipo de promo, mientras que `AnalyticsFilters` sí muestra un ícono distinto por tipo (`%`, `$`, `NxM`, `Producto`, `Otro`).
- El estado activo/inactivo de una promo se representa con dos pares de íconos distintos: check/x en `PromoDetail` y un círculo lleno/vacío (`IcoTag.on`/`off`) en la tarjeta de `MerchantWorkspace`.
- El badge "Fría" usa luna (`moon`) para clientes fríos pero un reloj de arena (`IcoTag.cold`) para promos frías.
- El badge "Top" usa `sparkle` para clientes pero un path distinto (`IcoTag.top`) para promos.
- Tres claves de `OndaIcons` (`eye`, `near`, `panelLeft`) no tienen ningún uso detectado en el código fuente actual.

## Objetivo

Migrar todos los íconos del proyecto a [`@phosphor-icons/react`](https://github.com/phosphor-icons/react), dejando una sola fuente de verdad de íconos, sin duplicados ni inconsistencias visuales entre contextos que representan el mismo concepto.

No es un reemplazo puramente 1:1: se corrigen las inconsistencias listadas arriba como parte de la migración.

## Paquete

- `@phosphor-icons/react`, **fijado a `^2.1.10`** (versión publicada y verificada en npm al momento de este spec).
- **Importante:** el repo de GitHub (`master`) ya documenta una v3 no publicada aún, con un breaking change de nomenclatura (todos los componentes pasarán a llevar sufijo `Icon`, ej. `WhatsappLogoIcon` en vez de `WhatsappLogo`). Fijar la versión evita que un `npm install` futuro rompa todos los imports cuando esa v3 se publique.
- Weight fijo: **`regular`** en todos los usos, para no mezclar grosores de trazo.
- Se preserva el tamaño visual actual por contexto (mayoría a 12px / `h-3 w-3` como hoy; casos puntuales como WhatsApp que ya usaban `h-4 w-4` se mantienen en 16px). Phosphor por defecto renderiza a 1em/32px si no se le pasa `size`/`className` — hay que pasarlo explícito en cada entrada para no romper el layout.

## Arquitectura

`libs/shared/ui/src/icons.tsx` deja de tener paths SVG a mano y pasa a ser un wrapper delgado: el objeto `OndaIcons` sigue existiendo con (casi) las mismas claves, pero cada valor ahora es un componente Phosphor real. Esto minimiza el diff en los ~60 call sites del dashboard, que siguen leyendo `OndaIcons.<clave>` sin cambios.

`IcoTag` se elimina por completo de `MerchantWorkspace.tsx`. Sus ~12 call sites pasan a usar `OndaIcons.*`.

## Mapeo de claves

### Claves existentes → Phosphor (weight regular)

| Clave `OndaIcons` | Componente Phosphor | Nota |
|---|---|---|
| all | `Circle` | |
| sparkle | `Sparkle` | también reemplaza `IcoTag.top` (badge "Top" de promo) |
| users | `UsersThree` | |
| flame | `Fire` | |
| target | `Target` | |
| alert | `Warning` | |
| info | `Info` | |
| crown | `Crown` | |
| moon | `Moon` | queda solo para "Dormido" (cliente) |
| whatsapp | `WhatsappLogo` | verificado que existe en el paquete publicado |
| calendar | `Calendar` | |
| day | `Sun` | |
| week | `CalendarBlank` | |
| edit | `PencilSimple` | absorbe la clave `custom` |
| percent | `Percent` | |
| dollar | `CurrencyDollar` | |
| nXm | `Tag` | |
| product | `Package` | |
| other | `DotsThree` | |
| download | `DownloadSimple` | |
| plus | `Plus` | |
| copy | `Copy` | |
| power | `Power` | |
| trash | `Trash` | |
| check | `Check` | también reemplaza `IcoTag.on` (estado "Activa" de promo) |
| lock | `Lock` | |
| globe | `Globe` | |
| ticket | `Ticket` | |
| accumulate | `PlusCircle` | |
| redeem | `Gift` | |
| save | `FloppyDisk` | |
| eye | `Eye` | sin uso detectado hoy, se mantiene definida |
| close | `X` | también reemplaza `IcoTag.off` (estado "Inactiva" de promo) |
| near | `MapPin` | sin uso detectado hoy, se mantiene definida |
| upgrade | `TrendUp` | |
| chart | `ChartBar` | |
| activity | `Waveform` | |
| gear | `Gear` | |
| pass | `IdentificationCard` | |
| panelLeft | `SidebarSimple` | sin uso detectado hoy, se mantiene definida |
| chevronLeft | `CaretLeft` | |
| chevronRight | `CaretRight` | |

### Clave nueva

| Clave | Componente Phosphor | Reemplaza |
|---|---|---|
| snowflake | `Snowflake` | `OndaIcons.moon` (cuando el badge era "Fría") y `IcoTag.cold` |

### Eliminaciones

- `custom` — se borra; `AnalyticsFilters` pasa a usar `OndaIcons.edit` (mismo path que ya compartían).
- `IcoTag` completo — sus 8 claves se resuelven contra `OndaIcons` como se detalla en la tabla de arriba.

## Cambios de comportamiento (no son solo swap de ícono)

1. `badgeIcon()` en `icons.tsx` — el case `'Fría'` pasa de `OndaIcons.moon` a `OndaIcons.snowflake`.
2. Tarjeta de promo en `MerchantWorkspace.tsx` — el badge de tipo (hoy `icon={IcoTag.type}`, siempre el mismo ícono genérico sin importar el tipo de la promo) pasa a mostrar el ícono real del tipo (`percent`/`dollar`/`nXm`/`product`/`other`), igual que ya hace `AnalyticsFilters`. Esto corrige la inconsistencia visual observada entre la tarjeta y el panel de filtros.
3. El badge "Top"/"Fría" y el toggle activo/inactivo de la tarjeta de promo pasan de `IcoTag.*` a `OndaIcons.*` (`sparkle`/`snowflake`/`check`/`close`).

## Alcance

- `libs/shared/ui/src/icons.tsx` — reescritura completa del contenido de `OndaIcons`.
- `apps/merchant-dashboard/app/MerchantWorkspace.tsx` — elimina `IcoTag`, actualiza sus call sites, agrega el ícono dinámico por tipo de promo.
- `libs/shared/ui/src/AnalyticsFilters.tsx` — cambia referencia de `OndaIcons.custom` a `OndaIcons.edit`.
- `apps/pwa-client` — sin cambios de código (no consume `OndaIcons` hoy); queda alineado para cuando lo necesite, ya que importará del mismo `OndaIcons`.
- `package.json` raíz — agrega `@phosphor-icons/react@^2.1.10`.

## Plan de verificación

1. Type-check y build de `merchant-dashboard` deben pasar limpios.
2. Grep de cierre: cero referencias a `IcoTag`, cero `<svg` de íconos hechos a mano en `icons.tsx`/`MerchantWorkspace.tsx`.
3. QA visual manual corriendo la app (es un cambio puramente visual, corresponde probarlo en navegador, no solo compilando):
   - Sidebar de navegación (Resumen/Clientes/Actividad/Promociones/Eventos/Config), colapsado y expandido.
   - Segmentos de clientes (Todos/Nuevos/Activos/Cerca de canje/En riesgo/VIP/Dormidos) y badges en la tabla de clientes.
   - `PromoDetail`: estado check/x, editar, copiar, activar/desactivar, eliminar, guardar.
   - Tarjetas de promo: badge de tipo (ahora dinámico), badge Top/Fría, badge Activa/Inactiva, botones Ver detalle/Desactivar/Eliminar.
   - `AnalyticsFilters`: tipo de promo, rango de fechas, estado.
   - `TxActivity`: acumular vs canjear.
4. Comparación visual contra el estado "antes" para confirmar que ningún ícono cambió de tamaño o quedó descentrado.
