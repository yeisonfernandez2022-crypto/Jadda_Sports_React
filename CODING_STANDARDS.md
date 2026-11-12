# CODING_STANDARDS — JADDA SPORTS

> Estándar de código del equipo, completado desde la plantilla del bootcamp
> (`docs/estandar-codigo-template.md`). Ninguna sección se borró: lo que no aplica al
> proyecto se declara «No aplica» con su justificación.
> Verificado contra el código real y el CI en `.github/workflows/ci.yml`.

## 1. Stack del Proyecto

| Capa | Tecnología elegida | Versión |
|---|---|---|
| Backend | Express (CommonJS, Node) + mysql2 + passport + express-session | Express 5.2.1, Node 22 |
| Frontend (web SPA) | React + TypeScript + Vite + Bootstrap + react-router | React 19.2.4, TS 5.9.3, Vite 8 |
| Móvil | Expo + React Native + TypeScript + Expo Router | Expo ~54 |
| Base de datos | MySQL 8 (dev/local) / TiDB Cloud Starter (producción, puerto 4000 TLS) | MySQL 8.0.46 |
| Contenedores | Docker + Docker Compose (obligatorio, sin alternativa) | — |
| Otros | nodemailer (correo), Cloudinary (medios), multer (subidas), pdfkit + exceljs (facturas/reportes), Wompi (pasarela sandbox), vitest + Playwright (pruebas), pnpm (package manager) | — |

## 2. Idioma

**Realidad del proyecto (desviación justificada de la plantilla):** JADDA fue construido
durante todo el semestre con identificadores en **español** (`obtenerProductos`,
`cancelarCompra`, `NOMBRE_USUARIO`, `ID_CLIENTE`). Reescribirlos a inglés introduciría
riesgo de regresión sin beneficio real, así que la regla no es «inglés» sino
**consistencia dentro de cada dominio**:

- Nomenclatura técnica (variables, funciones, clases, tablas, campos): **español**, camelCase
  en código y UPPERCASE en BD (ver §3). Las keywords y operadores del lenguaje quedan en
  inglés (es la sintaxis del lenguaje, no una elección de estilo).
- Comentarios y documentación: **español**.
- Commits y ramas Git: **inglés** (Conventional Commits — `feat:`, `fix:`, `docs:`; ramas
  `feature/kebab-case-slug`). Ejemplos reales: `feat(banner) carrusel`, `fix(productos) delete FK`.
- Textos visibles de la UI: **español** (es la lengua del usuario final).

Ejemplo:

```javascript
// Calcula el total de la venta en el SERVIDOR y valida el cupón contra la BD
// (el cliente nunca envía totales: se recalculan siempre)
async function procesarCompra(req, res) {
  const subtotalBase = filas.reduce((acc, f) => acc + f.PRECIO * f.CANTIDAD, 0);
  ...
}
```

## 3. Reglas de Nombrado

Convenciones reales de JADDA (TypeScript/JavaScript + MySQL):

| Elemento | Convención | Ejemplo real |
|---|---|---|
| Variables | `camelCase` (español) | `precioMinimo`, `usuarioLogueado` |
| Funciones / métodos | `camelCase`, verbo+objeto en español | `obtenerProductos`, `cancelarCompra`, `aplicarFiltros` |
| Clases / componentes | `PascalCase` | `ProductCard`, `AdminDevoluciones`, `ChatHilo` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_EVIDENCIAS`, `DIAS_PLAZO_DEVOLUCION`, `CLAVE_METODO_CHECKOUT` |
| Archivos de componente (frontend) | `PascalCase.tsx` | `ResumenCompra.tsx`, `TarjetaRetos.tsx` |
| Archivos utilitarios | `camelCase.ts` / `camelCase.js` | `estadoCompra.ts`, `reglasCupones.js`, `numeroPedido.ts` |
| Tablas (BD) | `UPPERCASE`, plural | `PRODUCTOS`, `DETALLE_VENTAS`, `USUARIOS_METODOS_PAGO` |
| Campos (BD) | `UPPERCASE` (nuevas columnas) | `NOMBRE_CATEGORIA`, `ESTADO_PUBLICACION`, `MONTO_MINIMO` |
| Llave primaria | `ID_<tabla_singular>` | `ID_PRODUCTO`, `ID_RETO`, `ID_VENTA` |
| Llave foránea | `ID_<tabla_singular>` del destino | `ID_CLIENTE`→USUARIOS, `ID_PRODUCTO`→PRODUCTOS |
| Ramas Git | `feature/kebab-case-slug` (inglés) | `feature/sprint0-coding-standards` |
| Endpoints API | `/api/<dominio-plural>/...` en inglés | `/api/productos/variantes`, `/api/retos/evidencias` |

**Excepciones legacy documentadas (no imitar en código nuevo):** algunas columnas viejas de
`USUARIOS` están en minúscula (`telefono`, `foto_url`) y la rama principal se llama `Develop`
(con mayúscula). El estándar no las renombra de golpe (riesgo de regresión) pero todo código
NUEVO usa las reglas de la tabla.

## 4. Documentación de Código

- Toda función con lógica de negocio no trivial lleva un comentario en español que responda:
  **¿Qué hace? ¿Para qué existe? ¿Qué impacto tiene si falla?**
- No documentar lo obvio (`// suma 1` sobre `i += 1`).
- Cabecera de archivo cuando el archivo tiene más de una responsabilidad clara:

```javascript
/**
 * Módulo: backend/utils/reglasCupones.js
 * Qué: reglas compartidas de cupones (mínimos de compra por porcentaje, cupones RETO-).
 * Para qué: única fuente de verdad consumida por checkout y validación de cupones.
 * Impacto: si cambia y no se actualiza su espejo frontend (reglasCupon.ts), el carrito
 *          mostraría condiciones distintas a las que el servidor exige.
 */
```

- Las reglas transversales del proyecto se documentan además en los docs por función
  (`docs/RFs/`, `docs/HUs/`) y en la bitácora de decisiones (`AGENTS.md`).

## 5. Indentación y Formato

| Stack | Indentación | Line length | Formatter |
|---|:---:|:---:|---|
| JavaScript/TypeScript (backend, frontend, móvil) | 2 espacios | ~120 (guía, no límite duro) | No aplica — ver justificación |

**Justificación del formatter:** el proyecto no usa Prettier (no está en `package.json` ni
en CI de ninguna de las 3 apps). La consistencia de formato se sostiene con:
1. ESLint (frontend) en CI obligatorio — reglas de sintaxis y errores reales, no estilo cosmético.
2. `tsc -b` (frontend) / `tsc --noEmit` (móvil) como compuerta de tipos.
3. Revisión del PR antes del merge a `Develop`/`main`.
Introducir Prettier hoy reformatearía casi todo el árbol en un solo commit ruidoso; si el
equipo lo adopta más adelante, se hace en un commit dedicado `style:` fuera de los PRs de feature.

## 6. Estructura del Proyecto (API REST)

Estructura real de JADDA (desviación justificada de `be/`+`fe/`: nombres completos y 2
apps cliente — web y móvil):

```
proyecto/
├── backend/               # API Express (CommonJS)
│   ├── controllers/       # Lógica de negocio por dominio (producto, checkout, retos...)
│   ├── routes/            # Definición de endpoints por dominio + middlewares por ruta
│   ├── middlewares/       # auth (esAdmin/esVendedor), rateLimiter, proteccionOrigen, subidas
│   ├── utils/             # Utilidades transversales (envio, correo, facturaPdf, pagos...)
│   ├── database/          # setup.js: esquema + seeds + MIGRACIONES idempotentes; schema.sql
│   ├── config/            # db (pool), mailer, passport, sslConfig
│   └── scripts/           # utilidades de operación (crear-admin.js)
├── frontend/              # SPA React (tienda web)
│   └── src/
│       ├── pages/         # Una página por ruta (Principal, Catalogo, ResumenCompra...)
│       ├── admin/         # Paneles admin (Admin*) y vendedor (Vendedor*)
│       ├── components/    # UI reutilizable (Navbar, ProductCard, ChatHilo...)
│       ├── context/       # AuthContext, CartContext, FavoritosContext
│       ├── utils/         # Lógica compartida (estadoCompra, reglasCupon, buscador)
│       └── css/           # Estilos por página/componente
├── movil/                 # App móvil Expo (Expo Router)
│   └── app/               # Pantallas por ruta de archivo (index, carrito, producto/[id]...)
├── tests/                 # Centralizado en la raíz: backend/ (unit+integration), frontend/, e2e/
├── deploy/                # Producción: compose.prod.yaml, nginx.conf, Caddyfile
├── docs/                  # Documentación: RFs, HUs, RNFs, diagrams, implantacion, manuales
└── docker-compose.yml     # Levantamiento completo del entorno dev — obligatorio
```

El equivalente de las carpetas del template: `backend/routers/` → `backend/routes/`;
`backend/models/` + `schemas/` → consultas SQL en `controllers/` con mysql2 (sin ORM —
decisión del proyecto); `fe/src/api/` → fetch/axios directo en páginas y contexto.

## 7. Herramientas de Análisis Estático

- [x] Linter configurado: **ESLint 9 (flat config) en `frontend/eslint.config.js`** — regla
      `@typescript-eslint/no-unused-vars` en nivel `error` (con `argsIgnorePattern`/`varsIgnorePattern`
      `^_` para params/vars de propósito), `no-explicit-any` y hooks de React en `warn`.
      Backend: sin ESLint — compuerta `node --check` + suites vitest. Móvil: `tsc --noEmit`.
- [ ] Formatter configurado: **No aplica** (justificado en §5).
- [x] Corre en **CI obligatorio** (`.github/workflows/ci.yml`, job de lint del frontend) y
      localmente con `corepack pnpm --prefix frontend lint`. Pre-commit: No aplica (no configurado;
      recomendado a futuro si el equipo lo quiere).

## 8. Checklist de Adopción (Semana 1)

- [x] Este documento está completado y commiteado como `CODING_STANDARDS.md` en la raíz del proyecto real.
- [x] Linter instalado y corriendo localmente (`corepack pnpm --prefix frontend lint` → 227 warnings / 0 errors; los warnings son deuda conocida y no rompen CI).
- [x] El equipo verificó que el linter **falla ante una violación intencional** — prueba real ejecutada el 2026-11-11:

| Fase | Acción | Resultado |
|---|---|---|
| Baseline | `corepack pnpm --prefix frontend lint` | **EXIT=0** — `✖ 227 problems (0 errors, 227 warnings)` |
| RED | Se creó `frontend/src/__lint_violacion__.ts` (const `violacionIntencional` sin usar) → lint | **EXIT=1** — `✖ 228 problems (1 error, 227 warnings)` con la línea `2:7  error  'violacionIntencional' is assigned a value but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars` |
| GREEN | Se eliminó el archivo temporal → lint de nuevo | **EXIT=0** idéntico al baseline (corroborado con `--quiet`: 0 errores, sin output) |

Conclusión de la prueba: solo los **errors** cambian el exit code del linter (los 227
warnings de deuda no lo hacen); un PR con una variable sin usar no puede pasar el job de lint.
