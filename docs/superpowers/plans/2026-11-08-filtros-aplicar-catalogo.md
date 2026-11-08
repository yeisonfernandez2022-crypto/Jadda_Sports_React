# Plan de implementación: Filtros del catálogo con botón Aplicar

Este plan convierte el espec aprobado en código. Cada tarea es un conjunto accionable con resultado verificable.

- **Fecha:** 2026-11-08
- **Estado:** listo para revisión
- **Espec:** `docs/superpowers/specs/2026-11-08-filtros-aplicar-catalogo-design.md` (aprobado por el usuario: «sigue»)
- **Complejidad:** ~2/5 — 1 archivo TSX + 1 CSS; sin backend, sin BD, sin librerías nuevas
- **Dependencias bloqueantes:** ninguna (todo en `frontend/`)
- **Notas del usuario que gobiernan este plan:** commits SIN push (el usuario los envía); verificar mínimo suficiente («no hagas tantas pruebas, solo de lo que se arregle»)

## Objetivo (criterios de acabado)

En `frontend/src/pages/Catalogo.tsx` (y `frontend/src/css/catalogo.css`):

1. Categoría / Marca / Vendedor / Ordenar por / Precio **no filtran nada al moverlos** — solo cambian la vista del panel.
2. **APLICAR FILTROS** escribe la URL en UN solo `setSearchParams` (`cat`, `marca`, `vendedor`, `orden`, `precioMin`, `precioMax`; defaults no se escriben) y borra `page`.
3. Precio = **rango dual** «Desde $X hasta $Y» (dos manecillas solapadas, sin librería): `desde ≤ hasta` (clamp, no se cruzan); `desde==0 && hasta==tope` ⇒ no filtra; `desde>0` excluye productos más baratos (posibilidad nueva).
4. **ELIMINAR FILTROS** borra los params de filtros de la URL y resetea los borradores; conserva `search` / `descuento` (Ofertas).
5. Atrás/adelante re-sincroniza el panel (borradores incluidos) desde la URL.
6. El `useMemo` de filtrado/ordenado sigue leyendo los valores comprometidos; su lógica no cambia (solo la fuente). El buscador del navbar, `?descuento=true` y la paginación quedan intactos.
7. `npx tsc -b` exit 0 + sonda Playwright (msedge) del flujo en verde + imágenes antes/después.
8. 1 commit local sin push.

## Ambiente

- Frontend en Docker (`jadda_frontend`, bind mount `./frontend → /app`). Para ver cambios: `docker restart jadda_frontend` y esperar HTTP 200 real de `http://localhost:5173` (el «✓ built in» de `docker logs` puede ser de builds viejos — esperar el 200 con reintentos).
- Compilación: `npx tsc -b` con workdir `frontend` (NO `tsc --noEmit`).
- Sonda: patrón de `%TEMP%\opencode\probe-logout-mantiene.mjs` — `createRequire("<repo>/tests/package.json")` → `playwright-core` → `chromium.launch({ channel: "msedge", headless: true })`, viewport 1440×900. La página de catálogo es pública: la sonda NO necesita registro ni login ni purga de cuenta.
- Selectores reales ya confirmados: cards = `.product-card` (L577), paginación = `ul.pagination .page-item`, panel = `aside.filtros-container` con 4 `<select class="form-select">` en orden Categoría → Marca → Vendedor → Ordenar por.

---

## Task 1 — Estado borrador + handlers APLICAR/ELIMINAR

**Archivo:** `frontend/src/pages/Catalogo.tsx`

Pre-lectura: las secciones a tocar son el helper `actualizarFiltroEnURL` (L110-116), el estado de precio (L119-122), el efecto de sincronización con URL (L165-181), el `useMemo` `productosFiltrados` (L296-352) y el panel (L479-566). Los números de línea son de HOY; si el archivo ya cambió, localizar por contenido.

### Task 1a — declarar borradores, precio mínimo comprometido y refs

1. Línea 1: importar `useRef` → `import { useEffect, useMemo, useRef, useState } from "react";`
2. Justo DESPUÉS de `const [sliderTocado, setSliderTocado] = useState(false);` (L122), agregar:

```tsx
// ═══ FILTROS CON BOTÓN APLICAR (borrador ⇄ URL comprometida) ═══
// Borradores: lo que el usuario mueve en el panel SIN tocar la URL.
// Solo APLICAR FILTROS escribe estos valores en la URL (fuente de verdad del
// filtrado); Atrás/adelante re-sincroniza los borradores en el efecto [searchParams].
const [borradorCat, setBorradorCat] = useState<string>(categoriaInicial);
const [borradorMarca, setBorradorMarca] = useState<string>(marcaInicial);
const [borradorVendedor, setBorradorVendedor] = useState<string>(vendedorInicial);
const [borradorOrden, setBorradorOrden] = useState<string>(searchParams.get("orden") || "");
const [borradorPrecioMin, setBorradorPrecioMin] = useState(0);
const [borradorPrecioMax, setBorradorPrecioMax] = useState(1000000);
const [borradorPrecioTocado, setBorradorPrecioTocado] = useState(false); // el tope async (fetch) no pisa borradores tocados por el usuario
const [precioMinimo, setPrecioMinimo] = useState(0); // compromiso de la manecilla izquierda (espejo de precioMaximo)
// Refs espejo: los valores llegan ASYNC (precioTope del fetch) y el efecto
// [searchParams] (deps: solo searchParams) no vería el último valor en su closure.
const precioTopeRef = useRef(precioTope);
useEffect(() => { precioTopeRef.current = precioTope; }, [precioTope]);
const sliderTocadoRef = useRef(sliderTocado);
useEffect(() => { sliderTocadoRef.current = sliderTocado; }, [sliderTocado]);
```

NOTA de colocación: `categoriaInicial`/`marcaInicial`/`vendedorInicial` (L81-83) y `precioTope` (L121) deben existir ANTES de este bloque — colocarlo después de L122 lo garantiza.

**Check 1a:** `npx tsc -b` (workdir `frontend`) sin errores de orden de declaración.

### Task 1b — reemplazar `actualizarFiltroEnURL` por los dos handlers

REEMPLAZAR el helper completo (L110-116) por:

```tsx
// APLICAR FILTROS: UNA sola escritura de URL con los borradores.
// Defaults NO se escriben (equivale a "sin filtro"): vacíos en selects,
// precioMin 0 y precioMax == tope.
const aplicarFiltros = () => {
  const params = new URLSearchParams(searchParams);
  const setOQuitar = (clave: string, valor: string) => {
    if (valor) params.set(clave, valor); else params.delete(clave);
  };
  setOQuitar("cat", borradorCat);
  setOQuitar("marca", borradorMarca);
  setOQuitar("vendedor", borradorVendedor);
  setOQuitar("orden", borradorOrden);
  params.delete("precio"); // param legacy del slider viejo: ya no se escribe
  if (borradorPrecioMin > 0) params.set("precioMin", String(borradorPrecioMin)); else params.delete("precioMin");
  if (borradorPrecioMax < precioTopeRef.current) params.set("precioMax", String(borradorPrecioMax)); else params.delete("precioMax");
  params.delete("page");
  // Si la URL queda idéntica, no empujar una entrada de historial repetida
  if (params.toString() !== searchParams.toString()) setSearchParams(params);
};

// ELIMINAR FILTROS: borra los params de filtros (conserva search/descuento/otra
// cosa que no sea filtro) y deja que el efecto [searchParams] re-sincronice todo.
const eliminarFiltros = () => {
  const params = new URLSearchParams(searchParams);
  ["cat", "marca", "vendedor", "orden", "precioMin", "precioMax", "precio", "page"]
    .forEach((p) => params.delete(p));
  if (params.toString() !== searchParams.toString()) setSearchParams(params);
};
```

NOTAS de comportamiento:
- `page` se borra al aplicar y al eliminar (los filtros nuevos invalidan la página actual).
- El guard `params.toString() !== ...` evita duplicar entradas de historial al re-aplicar sin cambios (decisión del espec: «Aplicar no cambia nada» se comporta literal).
- Los handlers quedan sin consumir hasta Task 3c — `tsc -b` no marca unused de locales, es OK Optional si el proyecto también apaga `noUnusedLocals`.

**Check 1b:** `npx tsc -b` exit 0.

## Task 2 — Re-sincronización de borradores + filtro de precio compromiso

**Archivo:** `frontend/src/pages/Catalogo.tsx`

### Task 2a — extender el efecto `[searchParams]`

REEMPLAZAR TODO el cuerpo del efecto (L165-181) por:

```tsx
useEffect(() => {
  // ── espejos comprometidos (igual que antes: los usa el useMemo de filtrado)
  const cat = searchParams.get("cat") || "";
  setCategoriaSeleccionada(cat ? [cat] : []);
  setMarcaSeleccionada(searchParams.get("marca") || "");
  setVendedorSeleccionado(searchParams.get("vendedor") || "");
  const ord = searchParams.get("orden") || "";
  setOrdenPrecio(ord);

  // ── precio comprometido: precioMin/precioMax nuevos o legacy ?precio= (solo máximo)
  const precioUrl = searchParams.get("precio");
  const minUrl = searchParams.get("precioMin");
  const maxUrl = searchParams.get("precioMax");
  if (minUrl !== null || maxUrl !== null || precioUrl !== null) {
    const minV = minUrl !== null ? Number(minUrl) : 0;
    const maxV = maxUrl !== null ? Number(maxUrl)
      : (precioUrl !== null ? Number(precioUrl) : precioTopeRef.current);
    setPrecioMinimo(minV);
    setPrecioMaximo(maxV);
    setSliderTocado(true);
    setBorradorPrecioMin(minV);
    setBorradorPrecioMax(maxV);
    setBorradorPrecioTocado(true);
  } else {
    // sin params de precio = sin filtro de precio: resetea espejos y borradores
    if (sliderTocadoRef.current) {
      setPrecioMinimo(0);
      setPrecioMaximo(precioTopeRef.current);
    }
    setSliderTocado(false);
    setBorradorPrecioMin(0);
    setBorradorPrecioMax(precioTopeRef.current);
    setBorradorPrecioTocado(false);
  }

  // ── borradores de los selects (atrás/adelante/eliminar re-sincronizan la vista)
  setBorradorCat(cat);
  setBorradorMarca(searchParams.get("marca") || "");
  setBorradorVendedor(searchParams.get("vendedor") || "");
  setBorradorOrden(ord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams]);
```

Notas:
- Se eliminó el guard `if (ord !== ordenPrecio) setOrdenPrecio(ord)` — setState con valor idéntico se procesa sin re-render, no crea loops.
- La rama `if (minUrl||maxUrl||precioUrl)` cubre: APLICAR escribiendo solo `precioMin` (max implícito = tope vía ref), solo `precioMax`, ambos, o URLs viejas con `?precio=` (shared/bookmarked siguen funcionando).
- El rama else con `sliderTocadoRef` cubre Atrás hacia una URL sin filtros de precio (el espejo comprometido anterior se limpia — hoy queda huérfano y seguiría filtrando con URL «sin filtros»).

### Task 2b — filtro de precio por rango en el useMemo

En `productosFiltrados` (L347-352), reemplazar el filtro de precio y su deps:

```tsx
// FILTRO PRECIO (rango comprometido de la URL; desde>0 excluye los baratos:
// el slider viejo no podía, con min=50000 fijo)
.filter(
  (producto) =>
    producto.PRECIO <= precioMaximo && producto.PRECIO >= precioMinimo
);
}, [productos, mostrarDescuento, categoriaSeleccionada, marcaSeleccionada, vendedorSeleccionado, precioMaximo, precioMinimo, catIdsPorNombre]);
```

(Guard del tope async — L196-197 del fetch: cuando NO hay borrador tocado, sincronizar también la manecilla derecha del borrador:)

```tsx
setPrecioTope(topeNuevo);
if (!sliderTocado) setPrecioMaximo(topeNuevo);
if (!borradorPrecioTocado) setBorradorPrecioMax(topeNuevo);
```

**Check 2:** `npx tsc -b` exit 0 (los消费 no existen todavía).

## Task 3 — El panel pasa a los borradores (vista) y nace el botón

**Archivos:** `frontend/src/pages/Catalogo.tsx`, `frontend/src/css/catalogo.css`

### Task 3a — los 4 selects y el título

En el `aside` del panel (L479-566), reconectar cada control a SUS borradores (ya NO escriben URL):

| Control | `value` | `onChange` |
|---|---|---|
| Categoría (L490-494) | `borradorCat` | `setBorradorCat(e.target.value)` |
| Marca (L512-516) | `borradorMarca` | `setBorradorMarca(e.target.value)` |
| Vendedor (L526-530) | `borradorVendedor` | `setBorradorVendedor(e.target.value)` |
| Ordenar por (L540) | `borradorOrden` | `setBorradorOrden(e.target.value)` |

Y el título del bloque de precio: «Precio maximo» → **«Rango de precio»**.

### Task 3b — slider dual en el TSX

REEMPLAZAR el bloque del slider (L549-556) por:

```tsx
<div className="mb-4">
  <h6 className="fw-bold mb-3 text-danger">Rango de precio</h6>
  <div className="catalogo-precio-dual">
    <span
      className="precio-fill"
      style={{
        left: `${(borradorPrecioMin / (precioTope || 1)) * 100}%`,
        width: `${((borradorPrecioMax - borradorPrecioMin) / (precioTope || 1)) * 100}%`,
      }}
    />
    <input
      type="range" aria-label="Precio mínimo" className="catalogo-precio-min"
      min="0" max={precioTope} step="50000"
      value={borradorPrecioMin}
      onChange={(e) => {
        setBorradorPrecioTocado(true);
        setBorradorPrecioMin(Math.min(Number(e.target.value), borradorPrecioMax)); // clamp: nunca se cruzan
      }}
    />
    <input
      type="range" aria-label="Precio máximo" className="catalogo-precio-max"
      min="0" max={precioTope} step="50000"
      value={borradorPrecioMax}
      onChange={(e) => {
        setBorradorPrecioTocado(true);
        setBorradorPrecioMax(Math.max(Number(e.target.value), borradorPrecioMin)); // clamp: nunca se cruzan
      }}
    />
  </div>
  <p className="fw-bold mt-2 text-dark">
    Desde ${borradorPrecioMin.toLocaleString("es-CO")} hasta ${borradorPrecioMax.toLocaleString("es-CO")}
  </p>
</div>
```

Detalles:
- `min="0"` (antes el slider era min 50000) — la primera manecilla en 0 no filtra; en $50.000+ ahora SÍ excluye los baratos (nueva posibilidad del espec).
- El relleno `precio-fill` es inline (left/width %); no se agrega estado extra.
- Los accents `className` no son necesarios para CSS, pero sí para probar las dos manecillas por separado en la sonda (`aria-label` también sirve; se dejan los DOS marcadores).

### Task 3c — el botón final: APLICAR + ELIMINAR

REEMPLAZAR el botón LIMPIAR FILTROS (L558-564) por:

```tsx
<div className="d-flex flex-column price-filter-btns">
  <button className="btn btn-danger w-100 fw-bold rounded-3" onClick={aplicarFiltros}>
    APLICAR FILTROS
  </button>
  <button className="btn btn-outline-danger w-100 fw-bold rounded-3" onClick={eliminarFiltros}>
    ELIMINAR FILTROS
  </button>
</div>
```

### Task 3d — CSS del slider dual (`frontend/src/css/catalogo.css`, AL FINAL del archivo)

```css
/* ═══ FILTROS CON APLICAR: range dual (2 manecillas solapadas) ═══ */
.catalogo-precio-dual {
  position: relative;
  height: 30px;
}
/* Pista base gris */
.catalogo-precio-dual::before {
  content: "";
  position: absolute;
  top: 12px;
  left: 0;
  right: 0;
  height: 6px;
  border-radius: 3px;
  background: #e2e8f0;
}
/* Relleno del rango elegido (left/width inline desde el TSX) */
.catalogo-precio-dual .precio-fill {
  position: absolute;
  top: 12px;
  height: 6px;
  border-radius: 3px;
  background: #e63946;
}
/* Los DOS inputs apilados: track invisible, thumb clicable_cada uno */
.catalogo-precio-dual input[type="range"] {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  background: transparent;
  pointer-events: none; /* track no captura: клиническ el click pasa al thumb de debajo */
  -webkit-appearance: none;
  appearance: none;
  height: 30px;
}
.catalogo-precio-dual input[type="range"]:focus {
  outline: none;
  box-shadow: none;
}
.catalogo-precio-dual input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  pointer-events: auto; /* SOLO el thumb captura */
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #e63946;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
  cursor: pointer;
}
.catalogo-precio-dual input[type="range"]::-moz-range-thumb {
  pointer-events: auto;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  border: 2px solid #e63946;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.25);
  cursor: pointer;
}
/* Firefox: track propio de -moz invisible para no pintar el suyo sobre los thumbs */
.catalogo-precio-dual input[type="range"]::-moz-range-track {
  background: transparent;
  border: none;
}
/* Móvil: objetivo táctil un pelín mayor */
@media (max-width: 576px) {
  .catalogo-precio-dual { height: 34px; }
}

/* ═══ Botones del panel con Aplicar ═══ */
.price-filter-btns { gap: 8px; }
```

**Check Task 3:** `npx tsc -b` exit 0 (workdir `frontend`).

## Task 4 — Reinicio de contenedores + sonda Playwright + commit

### Task 4a — rebuild

```powershell
docker restart jadda_frontend
# esperar ciclos até HTTP 200 REAL de http://localhost:5173 (reintento cada 3 s, máximo 240 s)
```

### Task 4b — sonda `%TEMP%\opencode\probe-filtros-aplicar.mjs`

Patrón: `createRequire("<repo>/tests/package.json")` → `playwright-core` → `chromium.launch({ channel: "msedge", headless: true })`, viewport 1440×900, `domcontentloaded` + `waitForSelector(".product-card")`. SIN cuenta (página pública) — sin registro ni purga. El summary se imprime DESPUÉS de `await main()` (nivel superior) — lección fbf3149.

Asistentes:
- `page.selectOption(...)` dispara los eventos que React escucha (renders referencias viejas a fuerza bruta).
- Para el range: `locator.focus()` + `page.keyboard.press()` — ArrowLeft/ArrowRight avanzan por step=50000 desde el value actual (determinista; NO drags de mouse: los inputs solapados hacen el hit-test poco firme).
- Capturar la URL con `page.url()` tras cada acción; el COUNT de productos para comparar: `document.querySelectorAll(".product-card").length` con `ul.pagination .page-item` (total de páginas) como segundo señal — 6 portada por página, el count visible puede empatar aunque el dataset cambie.

**Asertos (mínimo justo, «solo lo que se arregle»):**

| # | Acción | Aserción |
|---|---|---|
| 1 | goto `/catalogo` | carga sin 500 + `.product-card` ≥1; guardar BASELINE CARDS + BASELINE PAGES |
| 2 | `selectOption` Categoría = una con productos (ej. «Fútbol») | ΣURL no cambia (sin `cat`) y cards == BASELINE (NO filtra al mover) |
| 3 | click APLICAR FILTROS | URL contiene `cat=<valor>`; cards ≤ BASELINE y ¿páginas cambia? (filtró) |
| 4 | click ELIMINAR FILTROS | URL sin `cat`; cards == BASELINE (restaurado) y selector Categoría vuelve a `""` (borrador re-sincronizado) |
| 5 | focus input `[aria-label="Precio mínimo"]`, ArrowRight ×1 (0→50000) | texto «Desde $50.000» visible; URL SIN `precioMin`; cards == BASELINE (no filtró al mover) |
| 6 | click APLICAR FILTROS | URL contiene `precioMin=50000`; dataset filtrado (páginas ≤ BASELINE PAGES o cards < BASELINE en página 1) |
| 7 | click ELIMINAR FILTROS | URL sin params de filtro; cards == BASELINE |
| 8 | focus input `[aria-label="Precio máximo"]` value actual = tope → mover ArrowLeft hasta 1500000 Σ (3 pasos: tope=1800000) | clamp: APLICAR de manecillas cruzadas — con borrador min=50000 y max=100000, mover min hacia >max queda en 100000 (texto Desde $100.000 hasta $100.000 con desde ≤ hasta) |
| 9 | manecilla MAX arriba al tope + APLICAR | URL SIN `precioMax` (== tope no se escribe) |
| 10 | con filtros aplicados, `page.goBack()` | URL sin los params del Apply; selects en `""` y manecillas en 0/tope; cards == BASELINE |
| 11 | (todo el flujo) | 0 errores de consola (`page.on("pageerror")` + `console` type=error, lista vacía) |

(El aserto 8 omite la comparación «desde el tope»: la sonda toma el width al actual null el value inicial — quiero evitar tarjetas descuentos reales; chat).

**Si algo falla:** corregir y re-correr la sonda COMPLETA (los asertos son idempotentes; no persisten datos — sin purga necesaria).

### Task 4c — captura visual antes/después (igual que con el footer)

Dos screenshots a la sonda: `catalogo-antes.png` (carga sin filtros) y `catalogo-aplicado.png` (tras Apply del aserto 3, con el panel visible) — para que el usuario vea el cambio visual. Guardar en `%TEMP%\opencode\shots\`.

### Task 4d — commit (SIN push)

```powershell
cd "C:\Users\Yeison\Desktop\Proyecto Jadda Sports"
git add frontend/src/pages/Catalogo.tsx frontend/src/css/catalogo.css docs/superpowers/specs/2026-11-08-filtros-aplicar-catalogo-design.md docs/superpowers/plans/2026-11-08-filtros-aplicar-catalogo.md
git commit -m "Catalogo: filtros con botón Aplicar, precio como rango dual y ELIMINAR FILTROS"
```

(Mensaje en 1 línea, sin push — el usuario lo envía, como con el lote fbf3149.)

## Verificación final

- `npx tsc -b` exit 0 (workdir `frontend`).
- Sonda msedge de Task 4b con los 11 asertos en verde y 0 errores de consola.
- Re-verificar que el `useMemo` зад cat/marca/vendedor/orden OK; NO re-correr suites completas (regla del usuario: solo lo corregido) — lo demás no tocó nada.
- 1 commit local sin push + AGENTS.md actualizado con la entrada del día.
