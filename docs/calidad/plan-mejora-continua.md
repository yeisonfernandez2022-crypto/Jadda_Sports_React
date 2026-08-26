# Plan de Mejora Continua

**Proyecto:** JADDA SPORTS
**Fecha:** 2026-08-24
**Origen:** resultados de la evaluación de calidad (`informe-evaluacion-calidad.md`), evaluación de RNFs y bitácora de lecciones aprendidas.

---

## 1. Objetivo

Determinar las acciones **correctivas**, **preventivas** y de **ajuste al proceso** derivadas de la verificación del software, con responsable y seguimiento.

## 2. Matriz de acciones

| ID | Tipo | Descripción | Origen | Prioridad | Responsable | Plazo | Estado |
|----|------|-------------|--------|-----------|-------------|-------|--------|
| MC-01 | Preventiva | Publicar solo tras reverse proxy con HTTPS (Caddy/Nginx + certificado) si el sistema sale de la LAN; cerrar 3306/5000 externos | RNF-002 parcial | Alta | DevOps | Antes de exposición pública | Pendiente |
| MC-02 | Mejora | Automatizar pruebas de carga (k6/Artillery) sobre endpoints críticos para sostener RNF-003 con datos periódicos | Evaluación RNF §1 | Media | QA | Próxima iteración | Pendiente |
| MC-03 | Preventiva | Sustituir rate limiter en memoria por store persistente (p. ej. Redis o tabla BD) para sobrevivir reinicios | Deuda técnica §5.3 | Media | Backend | Próxima iteración | Pendiente |
| MC-04 | Correctiva | Remover dependencias/muertos: `jsonwebtoken`, middleware `verificarToken`, `resenaController.js` legacy | Informe calidad §5.4 | Baja | Backend | Limpieza programada | Pendiente |
| MC-05 | Correctiva | Completar app móvil: checkout real y reseñas de producto — única brecha funcional frente al 100% | RNF-009 en desarrollo | **Alta** | Móvil | En curso | Pendiente |
| MC-06 | Proceso | Pipeline CI mínimo (GitHub Actions): lint + `tsc -b` + build Docker en cada push | Marco CMMI (PI básico) | Media | Equipo | Próximo sprint | Pendiente |
| MC-07 | Proceso | Verificación mensual del backup: restaurar último respaldo en BD temporal (`restaurar-backup.ps1 -BaseDatosPrueba`) | RNF-004 | **Alta** | Admin servidor | Recurrente mensual | Pendiente |
| MC-08 | Preventiva | Rotación semestral de credenciales (admin app, jadda_app BD, SESSION_SECRET) y revisión de .env sin secretos en git | Seguridad RNF-001 | Media | Admin servidor | Recurrente | Pendiente |
| MC-09 | Proceso | Mantener viva la bitácora de lecciones: todo defecto nuevo suma fila (causa raíz + acción preventiva) | Bitácora §16 lecciones | Baja | Todo el equipo | Continuo | Activo |
| MC-10 | Mejora | Extender mediciones de rendimiento a flujos autenticados completos (checkout E2E cronometrado) cuando existan pruebas de carga | Evaluación RNF | Baja | QA | Backlog | Pendiente |

## 3. Seguimiento

- Revisión del plan: cada cierre de iteración/sprint en el tablero Jira/Azure DevOps (estas acciones se importan como historias de mejora).
- Criterio de cierre: acción ejecutada **y verificada** (no basta implementarla).
- Lecciones nuevas pueden generar acciones adicionales que se agregan a esta matriz conservando el consecutivo.
