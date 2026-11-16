# JADDA SPORTS — Guía para agentes

## Proyecto y estructura
Monorepo: `backend/` (Node.js + Express, CommonJS), `frontend/` (React + TypeScript + Vite), `movil/` (Expo + React Native), `docs/` (documentación), `tests/` (unitarias, integración y E2E), `deploy/` (Docker y proxy).
Los RF/HU y las reglas del stack están en `docs/README.md` y `CODING_STANDARDS.md`.

## Comandos
Ejecutar desde la raíz con `corepack pnpm`:
- Backend unitario: `corepack pnpm --prefix backend test`
- Backend integración: `$env:USE_CI_MYSQL='1'; corepack pnpm --prefix backend test:integration`
- Cobertura fusionada backend (métrica oficial, unit+integración): `node backend/scripts/cobertura-combinada.mjs <umbral>` (trinquete vigente: variable de repo `COBERTURA_UMBRAL`)
- Frontend: `corepack pnpm --prefix frontend lint`, `build` y `test`
- Móvil: `corepack pnpm --prefix movil lint`; typecheck: `corepack pnpm --prefix movil exec tsc --noEmit`
- Entorno local: `docker compose up -d`; estado: `docker compose ps`

## Convenciones
Seguir `CODING_STANDARDS.md`: identificadores y documentación en español; respetar la organización y los patrones de cada capa. Usar commits Conventional Commits y nombres de rama descriptivos. No cambiar reglas de negocio al hacer cambios de documentación o mantenimiento.

## Seguridad y cuidado del repositorio
No guardar secretos en Git: usar `.env.example` como referencia y entregar credenciales por canal seguro. Ejecutar pruebas de integración contra la BD de prueba, nunca contra producción. Antes de eliminar o mover archivos, buscar referencias. Preservar cambios locales y archivos sin seguimiento; no borrar datos, reescribir historia, publicar ni desplegar sin autorización explícita.
