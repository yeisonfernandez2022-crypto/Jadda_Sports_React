## Goal
Polish UX, complete database portability with auto-setup, and align documentation to real stack.

## Constraints & Preferences
- No SQL changes by the assistant; user runs all database modifications manually.
- Build must pass TypeScript and Vite build inside Docker container (`pnpm build`).
- Docker Vite dev server may show stale parse errors; `docker restart jadda_frontend` resolves them.
- Database auto-creates tables + seeds reference data on startup via `setup.js`.
- User uses MySQL Workbench; password prompts remain unresolved.
- `.gitignore` has `mysql_data/` in root and `.env` in backend/ + frontend/.
- Class-based FontAwesome icons (`<i className="fas fa-...">`) used across ~10 files; CSS import kept.
- `.env.example` should contain placeholders, never real credentials.
- Docs structure kept unchanged: `docs/RFs/`, `docs/HUs/`, `docs/RNFs/`.

## Progress
### Done
- ResumenCompra: `limpiarFormDireccion()` clears all address fields when clicking "Agregar dirección".
- ResumenCompra: nested fragment `<>...</>` → `<div>` fix for OXC parser error.
- Catalogo variant selector modal: opens on cart icon click, fetches `GET /api/productos/:id/variantes`, color + attribute buttons filtered by color, stock display, quantity selector, confirm button, 80x80 thumbnail.
- Search improved: prefix matching `LIKE 'word%'` (was `%word%`), all query words must match.
- Related products improved: `ORDER BY RAND()`, fallback to other categories if fewer than 4.
- ProductDetailPage: `addToCart` now passes `ID_VARIANTE` (not `cantidad`); selecting attribute first then color no longer resets attribute.
- Review form in ProductDetailPage: star hover effect, comment textarea, logged-in gate, auto-name from AuthContext, avatar circle.
- Review form in CompraExitosa: product selector buttons, star hover, comment, submit, confirmation.
- Footer compact: reduced padding/margins, `margin-top: auto` via AppLayout flex column.
- FloatingCart draggable: mouse/touch drag, viewport clamped, navbar boundary, click vs drag detection.
- MiniCartMenu: position synced via `cartButtonX/Y` in CartContext, closes on click-outside.
- `backend/database/setup.js` created: 22 `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` for all reference data. Retries MySQL connection up to 10 times.
- `server.js` modified: added `require('./database/setup')` at line 9.
- `docker-compose.yml` modified: bind mount `./mysql_data` → named volume `mysql_data:`.
- READMEs created/updated: root, backend, frontend, movil.
- Mobile app reviewed: Inicio, Catalogo, Detalle Producto, Login, Registro functional. AuthContext lacks AsyncStorage persistence.
- Catalogo two carts bug fixed: removed duplicate FloatingCart/MiniCartMenu.
- Categorias slowness fixed: bg placeholder, fadeIn animation, reduced margin-top.
- Docs analyzed: 39 HUs, 39 RFs, 7 RNFs. Stack mismatches found.
- RNF-001.md: Module 1 only (Security) — separated from monolithic original.
- RNF-002.md through RNF-006.md: extracted from original RNF-001.md modules 2–6, each with proper format.
- RNF-007.md: extracted Module 7 (Documentation/Maintainability) from original.
- RNF-008.md through RNF-011.md: 4 new modules — DevOps, Mobile App, Internationalization, Error Handling.
- `docs/plan de trabajo.md` created.
- `docs/Restricciones del Proyecto.md` created.
- RF-001 through RF-012: stack/endpoints corrected (JWT → express-session, `/api/v1/...` → `/api/...`, table names to real DB schema).
- RF-013 through RF-029, RF-036, RF-039: status/endpoints aligned to real implementation; RF-027 "Parcial".
- HUs updated to match corrected RFs: statuses, acceptance criteria, endpoints, table names aligned.
- HU-002 fixed: was incorrectly containing RF-002 content; replaced with proper HU.
- HU-005 fixed: corrupted acceptance criteria content restored.
- HU-003 through HU-012, HU-013 through HU-029, HU-036, HU-039: statuses updated (Implementada/Parcial), acceptance criteria rewritten.
- Diagrams created: `docs/diagrams/arquitectura.md`, `docs/diagrams/base-de-datos.md`, `docs/diagrams/flujos.md`.
- `docs/README.md` created: index with links to all docs, state table, stack.
- `docs/plan de trabajo.md` fixed: auth stack corrected (JWT → express-session).
- `backend/README.md`: auth stack corrected (JWT removed), route table expanded to 40+ real endpoints, env vars aligned, Facebook route removed.
- `frontend/README.md`: auth stack corrected (jwt-decode → express-session cookie-based).
- `movil/README.md`: API URL reference updated to `EXPO_PUBLIC_API_URL`, status table corrections (added verificar-codigo as Funcional).
- HU-001.md: verification flow corrected — 24h link → 15min 6-digit code, removed "NN Auth" reference.
- RF-001.md: verification flow corrected — 24h → 15min, endpoint `/api/auth/verificar-codigo` → `/api/auth/confirmar`, added `/api/auth/reenviar-codigo`.
- `docs/README.md`: RNF count updated 7 → 11.
- AGENTS.md: comprehensive update with all changes from this session.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- Search uses prefix matching (`LIKE 'word%'`) so "za" only matches products starting with "za".
- FloatingCart draggable: touchAction: none + passive events; MiniCartMenu follows via CartContext shared position.
- Reviews only for logged-in users; name auto-fetched from AuthContext; avatar uses first letter.
- Database setup: `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE` safe for every restart.
- Docker volume: named volume for portability (no `mysql_data/` dir needed on new clones).
- `.env.example` contains only placeholders; real credentials shared outside git.
- Docs corrections preserve existing structure and format.
- RF-027 "Parcial" because only GET categories exists without admin CRUD endpoints.

## Next Steps
1. (User) Implement truly missing features: RF-020 (email confirm), RF-021 (social login), RF-023 (cancel order), RF-025 (email notifications), RF-030 (admin orders), RF-031 (admin products CRUD), RF-032 (admin inventory), RF-033 (returns), RF-034 (admin coupons), RF-035 (admin users), RF-037 (admin dashboard), RF-038 (admin PQRS).
2. (User) Fix mobile app: persist AuthContext with AsyncStorage, replace hardcoded IP with `EXPO_PUBLIC_API_URL`.
3. (User) Create `backend/.env.example` with placeholder values for git sharing.
4. (User) Remove legacy `jsonwebtoken` dependency and unused `verificarToken` middleware.

## Critical Context
- `MYSQL_ROOT_PASSWORD: tu_password_secreto` in `docker-compose.yml` and `.env` — must match between backend and database container.
- `docker compose down -v` deletes the named `mysql_data` volume; on next `up`, setup.js recreates tables + seeds.
- Docker Vite dev server may show stale parse errors; `docker restart jadda_frontend` resolves.
- `addToCart(idProducto, idVariante, cantidad)` — second param is always a variant ID, never a quantity.
- FloatingCart and MiniCartMenu are rendered globally by `App.tsx`; individual pages should NOT import them.
- 27 RFs corrected: RF-001 through RF-012 (stack/endpoints), RF-013 through RF-019, RF-022, RF-024, RF-026, RF-028, RF-029, RF-036, RF-039 (status/endpoints). RF-027 "Parcial". 26 HUs updated to match (HU-001 through HU-029, HU-036, HU-039). 12 remaining "Por implementar" are genuinely missing.
- Real stack: Express sessions + Passport.js (not JWT), `USUARIOS` table, `CONFIRMADO` field, `POST /api/auth/login`, Spanish error messages.
- Remaining unimplemented RFs: RF-020 (email confirm), RF-021 (social login), RF-023 (cancel order), RF-025 (email notifications), RF-030 (admin orders), RF-031 (admin products CRUD), RF-032 (admin inventory), RF-033 (returns), RF-034 (admin coupons), RF-035 (admin users), RF-037 (admin dashboard), RF-038 (admin PQRS).

## Relevant Files
- `backend/database/setup.js`: full DB schema (22 tables) + seed data.
- `docs/README.md`: docs index with state table and stack.
- `docs/plan de trabajo.md`: project phases, module status, cronograma.
- `docs/Restricciones del Proyecto.md`: stack, security, dev workflow constraints.
- `docs/diagrams/arquitectura.md`: system architecture + auth/checkout sequence diagrams.
- `docs/diagrams/base-de-datos.md`: ERD + full table structure.
- `docs/diagrams/flujos.md`: registration, purchase, admin, and navigation flow diagrams.
- `docs/RFs/RF-001.md` through `docs/RFs/RF-039.md`: 27 corrected RFs + 1 Parcial.
- `docs/HUs/HU-001.md` through `docs/HUs/HU-039.md`: 26 HUs updated to match corrected RFs.
- `docs/RNFs/RNF-001.md` through `docs/RNFs/RNF-011.md`: 11 RNFs restructured (7 original modules extracted + 4 new).
