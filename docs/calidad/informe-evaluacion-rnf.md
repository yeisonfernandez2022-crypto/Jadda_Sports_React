# Informe de Evaluación de Requisitos No Funcionales (RNF)

**Proyecto:** JADDA SPORTS
**Fecha de evaluación:** 2026-08-24
**Método:** revisión documental de los 15 módulos RNF (`docs/RNFs/`) + **mediciones reales de rendimiento** sobre el despliegue local en producción (`scripts/mediciones-rnf.ps1`, resultados completos en `docs/calidad/resultados-mediciones.md`).

---

## 1. Mediciones de rendimiento ejecutadas

Entorno: Windows 11 + Docker Desktop, i5-11400H/23.8 GB. 10 peticiones por endpoint tras calentamiento.

| Endpoint | Promedio | P95 | Max |
|----------|----------|-----|-----|
| GET / (frontend) | 19,7 ms | 28,8 ms | 28,8 ms |
| GET /api/productos | 39,6 ms | 51,2 ms | 51,2 ms |
| GET /api/productos/1 | 23,0 ms | 29,9 ms | 29,9 ms |
| GET /api/productos/categorias | 20,4 ms | 29,2 ms | 29,2 ms |
| POST /api/auth/login | 91,5 ms* | 147,3 ms* | — |
| GET /api/auth/perfil [autenticado] | 23,7 ms | 34,0 ms | 34,0 ms |

\* En las iteraciones 9–10 el login devolvió **429 Too Many Requests**: el limitador anti fuerza-bruta (10/min por IP) actuó correctamente. Es un hallazgo positivo de seguridad, no un defecto de rendimiento; el coste base del login (~90–150 ms) corresponde al hash bcrypt intencional.

**Conclusión de eficiencia:** todos los endpoints de lectura responden por debajo de 55 ms en P95 — excelente para red local; login <150 ms con justificación criptográfica.

## 2. Evaluación por módulo RNF

| RNF | Atributo ISO/IEC 25010 | Estado | Evidencia de la evaluación |
|-----|------------------------|--------|----------------------------|
| RNF-001 Seguridad de la información | Confianza/seguridad | ✅ Implementado | bcrypt, sesiones httpOnly, RBAC, rate limiting (verificado en vivo con el 429), mensajes anti-enumeración, validaciones de servidor |
| RNF-002 Comunicaciones y datos | Seguridad | ⚠️ Parcial | Falta HTTPS/TLS y defensas CSRF formales en LAN; credenciales fuera de git correcto |
| RNF-003 Eficiencia y desempeño | Eficiencia | ⚠️ Parcial → **medido** | Sin pruebas de carga automatizadas; mediciones puntuales excelentes (§1). Índices y pool BD presentes |
| RNF-004 Disponibilidad y respaldos | Fiabilidad | ⚠️ Parcial → **mejorado en esta entrega** | Ya existe `restart: always` + transacciones; **ahora sí hay backups diarios con script probado** (backup+restauración E2E verificada); falta monitoreo automático externo |
| RNF-005 Usabilidad y UX | Usabilidad | ✅ Implementado | Responsive verificado (375px/1440px), estados vacíos, confirmaciones Swal, manuales de usuario entregados |
| RNF-006 Integración y asincronía | Portabilidad/integración | ✅ Implementado | Correos y notificaciones no bloqueantes; webhooks externos no aplican al alcance |
| RNF-007 Documentación y mantenibilidad | Mantenibilidad | ✅ Implementado | 49 RF, 49 HU, 15 RNF, diagramas, READMEs, esta documentación; TypeScript estricto |
| RNF-008 Despliegue DevOps | Portabilidad | ✅ Implementado | Docker Compose reproducible, migraciones idempotentes automáticas, scripts backup/restore |
| RNF-009 Aplicación móvil | Compatibilidad | 🔶 En desarrollo | Catálogo/carrito/favoritos funcionando; checkout y reseñas pendientes (única brecha grande del producto) |
| RNF-010 Internacionalización y moneda | Usabilidad | ✅ Implementado | Formato COP `es-CO` consistente (precios, facturas, correos) |
| RNF-011 Manejo de errores | Fiabilidad/usabilidad | ✅ Implementado | ErrorBoundary global, página 404, errores con mensaje claro, rollback en transacciones |
| RNF-012 Tolerancia a fallos de correo | Fiabilidad | ✅ Implementado | Envíos envueltos en try/catch; un fallo SMTP nunca rompe compra/revisión |
| RNF-013 Manejo de archivos y subidas | Rendimiento/fiabilidad | ✅ Implementado | multer streaming a disco (100 MB/archivo), validación de tipo/tamaño, limpieza ante error, carpetas por usuario |
| RNF-014 Portabilidad de la BD | Portabilidad | ✅ Implementado | setup.js idempotente + schema.sql exportable; BD nueva funcional en minutos (probado en cada arranque) |
| RNF-015 RBAC | Confianza/seguridad | ✅ Implementado | Roles 1/6/cliente con middlewares centralizados; verificado por API (403 a no-admin) |

**Resumen:** 11 implementados · 3 parciales con plan (RNF-002, 003, 004) · 1 en desarrollo (RNF-009).

## 3. Hallazgos y recomendaciones

1. **Positivo:** el rate limiter demostró funcionamiento real durante las mediciones (bloqueo automático del 10º intento de login por minuto).
2. **Mejorable:** HTTPS ausente — aceptable en LAN; obligatorio si se publica a Internet (ver plan de mejora MC-01).
3. **Mejorable:** incorporar pruebas de carga repetibles (k6/Artillery) para sostener RNF-003 con datos (MC-02).
4. **Prioritario:** cerrar checkout móvil para eliminar la única brecha funcional relevante (MC-05).
