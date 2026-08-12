# Diseño: Pantalla dedicada para crear promoción

Fecha: 2026-08-11
Alcance: `apps/merchant-dashboard` (flujo de creación de promociones), `libs/shared/ui` (re-exportar el `Toast` de Hero UI)
Fuera de alcance: agregar un tercer modo de caducidad "No caduca" a `PromotionExpiryMode`, unificar `CreatePromo` y `PromoDetail` en un único componente de formulario compartido, migrar los demás `alert()` de éxito existentes (togglePromo, plan actualizado, etc.) a toast — todo esto quedó identificado en la conversación previa como trabajo futuro, no parte de este cambio.

## 1. Problema

Hoy "Crear promoción" es un `<form>` insertado inline dentro de `MerchantWorkspace.tsx` (líneas ~1714-1984), controlado por el boolean `showPromoForm`. Al abrirlo, la página apila filtros + KPIs + ~15 campos condicionales + la grilla de promos debajo, todo compitiendo por atención en el mismo scroll — viola *aesthetic and minimalist design* y hace que el usuario pierda su posición de scroll en la lista al abrir/cerrar el form.

Además, la confirmación de éxito al crear es un modal bloqueante (`alert()` de `useOndaDialogs`, requiere click en "Entendido"), y la opción "¿Cómo caduca? → Por tiempo / Por cantidad" no explica qué significa cada una — un comerciante nuevo tiene que adivinar.

## 2. Solución

Se extrae el formulario de creación a una pantalla completa propia, reutilizando el patrón de navegación por URL que el archivo ya usa para el detalle de promo (`router.push('/promos/${id}')` / `router.push('/promos')`, parseado en `parseRoute()`).

```
"Nueva promo" (botón) → router.push("/promos/nueva")
CreatePromo → guarda OK → POST /promotions → router.push("/promos") + toast "Promoción creada"
CreatePromo → "Volver" con cambios sin guardar → confirm() → si OK, router.push("/promos")
```

`/promos/nueva` se distingue de un id real de promo (`promoId === "nueva"`) para no disparar el fetch de analytics de detalle (`useEffect` en torno a la línea 556-579 de `MerchantWorkspace.tsx`).

## 3. Cambios en `MerchantWorkspace.tsx`

- Se elimina el estado `promoForm`, `showPromoForm`, la función `createPromo`, y el bloque JSX del `<form>` (líneas ~1714-1984).
- El botón "Nueva promo" (línea ~1704) pasa de `onClick={() => setShowPromoForm(v => !v)}` a `onClick={() => router.push("/promos/nueva")}`. Ya no alterna a "Cerrar" — solo existe en el estado "lista".
- Se agrega una rama de render: cuando `selectedPromoId === "nueva"`, se renderiza `<CreatePromo>` en vez de `<PromoDetail>` (mismo nivel condicional que ya existe para `tab === "promos" && selectedPromoId`).
- `duplicatePromo(source)`: en vez de precargar `promoForm` local y togglear `showPromoForm`, guarda `source` en un nuevo state `duplicateSource` y navega con `router.push("/promos/nueva")`.
- Nuevo state `justCreatedPromoId: string | null`, seteado en el callback `onCreated` que se le pasa a `CreatePromo`. Se usa para resaltar la card correspondiente en la grilla/lista al volver, y se limpia automáticamente después de ~4s o en la siguiente navegación.
- No se toca `useOndaDialogs()` (línea 401, sigue igual) — el toast de éxito se dispara aparte, ver sección 5.

## 4. Nuevo componente `CreatePromo.tsx`

Hermano de `PromoDetail.tsx`, mismo patrón: dueño de su propio estado de formulario en vez de recibirlo del padre.

```ts
type CreatePromoProps = {
  storeId: string;
  store: { maxStamps?: number } | null;
  initialValues?: Partial<PromoFormState>; // desde duplicateSource
  onCreated: (promo: any) => void;
  onClose: () => void;
};
```

Contiene, migrado tal cual desde el `<form>` actual (mismos campos, mismos `PROMO_TYPE_OPTIONS`, misma lógica condicional por `type`):

- Imagen de la promo (`ImageUploadField`).
- Tipo de promo (chips `PERCENT_OFF | AMOUNT_OFF | BUY_GET | PRODUCT | OTHER`).
- Título / Descripción opcional.
- Campos según tipo (Porcentaje / Monto off / Compra-Lleva / Nombre del producto + Precio especial).
- Texto "Preview: ..." (`formatPromoBenefit`).
- Sección "¿Cómo caduca?" con los tooltips nuevos (sección 6).
- Ondas requeridas + "de N sellos del ciclo" + checkbox "Activa al crear".
- Botón "Crear promoción" (submit).

Validación: se mantiene igual que hoy (expiryMode requerido; TIME requiere `endsAt`; QUANTITY requiere `maxRedemptions >= 1`), mostrando los mismos `alert()` de advertencia que ya existen — no se toca ese camino de error.

Al hacer submit con éxito: `POST /promotions` → llama `onCreated(promo)` (el padre hace `loadPromos()` + `loadOverview()` + guarda `justCreatedPromoId` + muestra el toast) → llama `onClose()` (el padre navega a `/promos`).

Botón "Volver": si `promoForm` tiene algún campo distinto de su estado inicial (o de `initialValues` si vino de duplicar), pide confirmación con el `confirm()` ya existente (`useOndaDialogs`) — título "¿Descartar cambios?", mensaje "Vas a perder lo que escribiste en esta promo.", tono `warning`. Si no hay cambios, cierra directo.

## 5. Toast — `Toast` nativo de Hero UI, no un componente custom

`@heroui/react` (`3.2.3`, ya en `package.json`) trae un sistema de toast completo (`ToastProvider`, `toast` singleton, cola con auto-dismiss ya resuelta vía `react-aria-components`) que hoy no está montado en ningún lado del repo. Siguiendo el mismo patrón que `OndaDialogs.tsx` (envolver primitivos de Hero UI en vez de reconstruirlos — ver el resto del repo, sección "componentes Hero UI vs. custom" tratada en la conversación), usamos esto directamente en lugar de un hook custom:

- **`ToastProvider`** se monta **una sola vez**, en `apps/merchant-dashboard/app/DashboardShell.tsx` (el wrapper que ya envuelve todo el dashboard y se mantiene montado entre cambios de ruta) — no en `MerchantWorkspace.tsx`, porque el `toast` de Hero UI es un singleton imperativo, no necesita estar atado al ciclo de vida/estado de ese componente.
- Se re-exporta `toast` (y `ToastProvider` si hace falta el tipo) desde `libs/shared/ui/src/index.tsx`, igual que ya hacen con `Button`, `Card`, `Chip`, etc. — así `CreatePromo.tsx` lo importa desde `@onda/shared-ui` como el resto de los primitivos, no directo de `@heroui/react`.
- En `CreatePromo.tsx`, al terminar el submit exitoso: `toast.success('Promoción creada', { description: 'Ya está disponible para tus clientes.' })`. No hace falta estado propio ni timers — la cola de Hero UI maneja el auto-dismiss.
- Estilo visual: por defecto viene con la skin de Hero UI (`ToastVariants` de `@heroui/styles`); si no calza con el tono "cálido-tecnológico" del DESIGN.md se ajusta con `className` sobre `ToastProvider`/`Toast` apoyándose en los tokens `--onda-*` — mismo mecanismo que `OndaDialogs.tsx` usa (`className="onda-dialog-*"`) para adaptar `AlertDialog` a la marca.
- Solo se usa en este cambio para el mensaje de éxito de creación. No se retrofitea a otros flujos existentes (fuera de alcance, ver cabecera) — aunque, al quedar `ToastProvider` montado globalmente, sí queda disponible para que esos flujos lo adopten después sin trabajo adicional de infraestructura.

## 6. Tooltips en "¿Cómo caduca?"

Se usa `InfoTooltip` (ya existe en `libs/shared/ui/src/index.tsx:76`, hover + `focus-visible`, accesible por teclado) — no se crea un componente nuevo. Uno junto a cada `FilterChip`, dentro de la misma fila flex:

- Junto a **"Por tiempo"**: *"La promo deja de estar disponible en la fecha que elijas."*
- Junto a **"Por cantidad"**: *"La promo deja de estar disponible al llegar al número de reclamaciones que definas, sin importar la fecha."*

## 7. Casos borde

- **Filtros ocultan la promo recién creada** (ej. se crea con "Activa al crear" desmarcado mientras `promoStatusFilter === "active"`): no se resetean los filtros del usuario automáticamente. El toast de éxito es la confirmación primaria; la card simplemente no aparece resaltada porque no está en la vista filtrada actual. Comportamiento aceptado tal cual, no es un bug de este cambio.
- **Duplicar desde el detalle o desde la grilla** (`onDuplicate` en `PromoDetail.tsx:221` y en la card de la grilla, línea ~999 de `MerchantWorkspace.tsx`): ambos siguen llamando `duplicatePromo(source)`, que ahora navega a `/promos/nueva` con `duplicateSource` seteado en vez de abrir el form inline.
- **Error al crear** (POST falla): sin cambios — se muestra el `alert()` de error existente («Error al crear promo»), bloqueante a propósito porque requiere que el usuario corrija algo antes de continuar.
- **Salir sin guardar**: confirmación vía `confirm()` si hay cambios sin guardar (ver sección 4); si el form está vacío o intacto, cierra sin preguntar.
- **Navegación directa a `/promos/nueva`** (recarga de página, link compartido): funciona igual que cualquier otra ruta de este archivo — `CreatePromo` se monta con `initialValues` vacío (no hay `duplicateSource` porque ese state no sobrevive un refresh completo de página).

## 8. Visibilidad y testing

No hay test runner configurado en el repo (`CLAUDE.md`: no hay eslint/jest/vitest). Restricción explícita del usuario para este cambio: no usar Playwright ni ejecutar pruebas E2E.

Verificación: `pnpm exec nx build merchant-dashboard` (o `tsc` sobre los archivos tocados) sin errores, y mostrar el diff de los archivos cambiados/creados para revisión manual — sin recorridos E2E automatizados ni capturas de navegador.
