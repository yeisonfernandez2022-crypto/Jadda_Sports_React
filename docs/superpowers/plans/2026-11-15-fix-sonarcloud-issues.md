# Plan — Fix de los 52 issues abiertos de SonarCloud (2026-11-15)

Fuente de verdad: API SonarCloud `resolved=false` → 52 issues (18 BUG, 18 CODE_SMELL, 16 VULNERABILITY).
Rama: `fix/sonarcloud-issues` (desde `main` `4dea511`). Regla de oro: no dañar código, verificar cada cambio.

## Checklist

### Backend código de app
- [ ] **S5131 (BLOCKER)** `newsletterController.js:230` — la página de desuscripción NO interpola el correo de `req.query`: se muestra el correo **almacenado en BD** (SELECT por EMAIL tras validar token HMAC), escapado con `escaparHtml`. Sin fila en BD → página sin bloque de correo. TDD: test unitario rojo primero.
- [ ] **S2245** `newsletterController.js:361` — `Math.random` → `crypto.randomInt(PLANTILLAS.length)` (mismo rango [0, n)).
- [ ] **S7727** `productoController.js:42` — `.filter(urlImagenProductoValida)` → `.filter((u) => urlImagenProductoValida(u))` (lambda explícita; la función solo usa 1 parámetro — neutro).
- [ ] **S2871 (CRITICAL)** `backend/scripts/cobertura-combinada.mjs:161` — `.sort()` → comparador lexicográfico explícito (comportamiento idéntico para claves string).

### Scripts / docs / seeds
- [ ] **S5443 (CRITICAL)** `scripts/migracion-cloudinary/transformar-seeds.js:23` — `TEMP` hard-coded → `os.tmpdir()`.
- [ ] **S8707 ×5** mismo archivo (L42,45,121,122,123) — guard de contención: toda ruta fs debe resolver dentro de RAIZ o del tmpdir. Si el re-scan sigue marcando → ignore documentado e19 (script one-off ya ejecutado).
- [ ] **S8786** `backend/scripts/crear-admin.js:72` — `EMAIL_RE` con backtracking superlineal → función lineal con `split('@')`; verificación por test diferencial (regex original vs función) sobre corpus de casos borde. Semántica exacta: exactamente un @, sin `\s` en todo el string, local ≥1, y ∃ punto en el dominio con ≥1 char antes y ≥2 después.
- [ ] **S2068 ×5** `backend/docs/openapi.js` (L258,276,317,324×2,331) — contraseñas de EJEMPLO de la spec Swagger → placeholder `••••••••` (no son credenciales reales; docs consumidas por docsRoutes).
- [ ] **S3923** `openapi.js:41` — spread con ambas ramas `{}` → eliminarlo.
- [ ] **S7767 ×2** `backend/database/demoComprasResenas.js:31` — `a |= 0` y `(a + 0x6d2b79f5) | 0` → `Math.trunc(...)` (los bits de 32 que consume el algoritmo son idénticos; verificar con test diferencial mulberry32 original vs nuevo, 100k llamadas).
- [ ] **S7773** mismo archivo L330 — `parseInt` → `Number.parseInt`.

### Frontend (React + TS)
- [ ] **S9383 ×14** promesas sin `.catch`: AdminRetos:34, AdminUsuarios:42, AdminVendedores:59, AdminDevoluciones:90, AdminOrdenes:109, Historial:32, MisRetos:30, PerfilMetodosPago:80, Catalogo:242/250/254, ProductDetailPage:265, ResumenCompra:146, DevolucionEstado:165 — cablear `.catch` con el patrón de error ya existente en cada archivo.
- [ ] **S6848 ×13** divs clicables sin rol/teclado: AuthModal 738/742/746/1001/1021/1038, RecortadorFoto:121, TarjetaPlan:59, TarjetaRetos:60, Principal:339, ResumenCompra 1005/1230, SerVendedor:349 — `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Espacio). Cuidado con queries `getByRole` de los 168 tests FE.

### Móvil
- [ ] **S8786** `movil/utils/emailRegex.ts:6` — regex → función `emailValido` (lineal); actualizar 5 call sites (checkout ×3, perfil/editar, Footer). Verificación diferencial del corpus (variante TLD ≥1).
- [ ] **S9383** `movil/app/_layout.tsx:16` — `calentarBackend()` → `.catch` explícito.

### Config Sonar
- [ ] `sonar-project.properties`: e17/e17b `javascript:S7044/S8476` → `jssecurity:*` (drift de namespace); e18/e18b `typescript:*` → `tssecurity:*` (Navbar). NO tocar exclusiones de cobertura.

### Verificación final
- [ ] `node --check` en cada .js/.mjs backend editado.
- [ ] Suite unitaria backend completa (354) + integración MySQL (132) si cambió lógica de controladores (newsletter sí).
- [ ] Frontend: lint + `tsc -b` + 168 tests.
- [ ] Móvil: lint + `tsc --noEmit`.
- [ ] Commits por grupos (Conventional Commits, español) → push → PR → re-escaneo SonarCloud → confirmar 52 → 0 abiertos.
