# Entregable S02 — Planes de Migración, Respaldo e Instalación

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Fecha | 2026-10-21 |

> Documento completado con los datos reales del proyecto y evidencias ejecutadas el mismo día.
> Comandos citados = los que se usaron de verdad: `scripts/respaldar.sh` (mysqldump dentro de
> Docker), `scripts/backup.ps1` (respaldo automatizado con rotación), `scripts/verificar-requisitos.sh`
> (verificado en S01) y los conteos `COUNT(*)` contra la BD real `jadda_sports_db`.

---

## 2. Plan de migración de datos

### 2.1 Objetivo medible

*Migrar el sistema completo de JADDA SPORTS (base de datos MySQL con 35 tablas y 2.519 filas,
configuración de entorno e imágenes de medios) del equipo de desarrollo actual a otro equipo o
servidor, con reporte de conteos idénticos en las 35 tablas aprobado por el líder técnico, en una
ventana máxima de 2 horas, sin alterar el inventario de stock, los public_ids de Cloudinary ni el
historial de ventas.*

Criterio de éxito: al abrir el sistema en el destino, las 35 tablas deben tener exactamente el
mismo `COUNT(*)` que el origen, la API debe responder `200` en `/api/productos` y una muestra de
URLs de imágenes debe resolver `200` (HTTP HEAD).

### 2.2 Inventario de origen

| Origen | Formato | Volumen medido (2026-10-21) | Responsable de entregarlo | Estado de calidad |
|---|---|---|---|---|
| Base de datos `jadda_sports_db` (MySQL 8.0.46) | Volumen Docker `mysql_data` + dump lógico SQL | 35 tablas · 2.519 filas (suma de COUNT(*)) · dump de 251.290 bytes | Líder técnico (acceso al contenedor `jadda_mysql`) | Consistente; una evidencia demo de reto (`ev11`) sin archivo asociado, documentada como dato roto histórico |
| Medios (productos, perfiles, retos, banners) | Archivos `frontend/public/**` versionados en git + assets en Cloudinary (cloud `nggcplfk`) | 344 assets (340 imágenes + 4 videos) con public_id determinista `jadda/…` | Administrador del repositorio | Íntegro; auditoría disco↔cuenta 344/344 ✓ |
| Configuración sensible | `backend/.env`, `frontend/.env`, `movil/.env` (fuera de git, por `.gitignore`) | 3 archivos | Líder técnico (compartidos por canal externo seguro) | `backend/.env.example` con placeholders versionado |
| Código y documentación | Repositorio Git (GitHub, rama `main`) | working tree ≈ 87 MB sin `node_modules` | — | Limpio: `git status` sin cambios |

### 2.3 Estrategia

- **Estrategia de corte (big bang).** Justificación: el sistema es un monolito de 3 capas con una
  única BD transaccional; no existen réplicas ni servidores paralelos, y el volumen de datos
  (dump de 0,25 MB) se restaura en segundos, por lo que una migración por fases no aporta valor y
  aumenta la superficie de error en medio de pedidos activos. El corte es total y de una vez.
- **Ventana de mantenimiento propuesta:** 23:00–01:00 (no hay horario pico nocturno en la tienda
  LAN). Duración estimada de la migración: 60–75 min con verificación completa (§5); la ventana de
  2 h cubre imprevistos y rollback.
- Los pedidos creados durante la ventana quedan en "Pendiente de envío" en el origen; se avisa al
  cliente que el checkout quedará fuera de servicio durante la ventana (página de aviso).
- No se puede alterar: el stock, los cupones RETO- (columna `USADO`), el historial de ventas, los
  public_ids de Cloudinary y las credenciales reales del `.env`.

### 2.4 Tabla de mapeo

| Origen | Destino | Transformación | Regla de rechazo |
|---|---|---|---|
| Volumen Docker `mysql_data` (origen) | Volumen Docker `mysql_data` nuevo (destino) | Ninguna — restauración lógica del dump con `mysql < dump.sql` (motor y versión homogéneos, 8.0.46) | Tabla o fila corrupta → restaurar el último dump previo |
| Las 35 tablas | Las mismas 35 tablas (nombre y esquema idénticos via `setup.js`) | 1:1, sin renombres (`schema.sql` + migraciones idempotentes reproducen la misma estructura en BD nuevas) | Diff de conteos ≠ 0 → rollback |
| `backend/.env` | `backend/.env` del destino | Copia manual fuera de git (canal externo), sin reescrituras de credenciales | `.env` ausente → abortar ANTES de `docker compose up` (el sistema no arranca sin `DB_PASSWORD`) |
| Imágenes locales `frontend/public/images/**` | Mismo repositorio en destino (respaldo) | Ninguna — la BD ya guarda URLs absolutas `https://res.cloudinary.com/…`; el backend descarga por URL con `CLOUDINARY_URL`; los archivos locales quedan de fallback | URL que no responde 200 → sustituir referencia por la copia local |
| `MYSQL_ROOT_PASSWORD` / `SESSION_SECRET` | Valores originales vía `.env` | Ninguna | Contraseña faltante → abortar y pedir por canal externo |
| Filas demo (usuarios de prueba, chats, notificaciones) | Se migran tal cual | Ninguna — conservación por reproducibilidad del entorno | Fila sin FK válida → registrar en el reporte de migración (no rechazo silencioso) |

### 2.5 Validaciones

| Validación | Consulta o método | Resultado esperado |
|---|---|---|
| Conciliación de conteos | `SELECT COUNT(*) FROM <tabla>` en las 35 tablas del dump, loop por `SHOW TABLES`, ejecutado en la BD origen y en la BD aparte de destino | origen = migrados + rechazados (aquí: rechazados = 0) |
| Checksum | `sha256sum` del dump + línea de cierre de mysqldump | SHA-256 registrado en el log y línea `-- Dump completed on` presente |
| Muestra funcional HTTP | `curl` a `/api/productos` (vía proxy del frontend) y `HEAD` a una sample URL de Cloudinary | `200 OK` en ambas |
| Smoke E2E | `pnpm test:e2e` (23 checks) contra el entorno migrado | 0 errores |
| Sesiones activas | La tabla `sessions` del dump | Las sesiones del origen NO se reutilizan: login nuevo en destino |

### 2.6 Rollback

- **Criterio para ejecutar rollback:** cualquiera de estos — (a) diff de conteos ≠ 0 tras la
  restauración, (b) la API no levanta o el build falla en el destino, (c) las URLs de medios no
  resuelven y el fallback local tampoco, (d) se excede la ventana de 2 h sin verificación completa.
- **Método principal:** en el destino, restaurar el dump previo a la migración (guardado por
  `scripts/respaldar.sh`) o, si el ambiente destino nunca quedó operable, **volver a levantar el
  sistema en el origen** — el corte big-bang NO destruye el volumen origen (el `docker compose down -v`
  del origen queda prohibido durante la ventana completa).
- **Rol que decide:** el líder técnico (consultando al administrador de la tienda en caso de
  conflicto de horarios si hay pedidos pendientes).

### 2.7 Matriz de riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El destino no tiene Docker/WSL2 funcionales (el `bash` del PATH apunta a WSL sin distro) | Media | Alto | Verificar requisitos con `scripts/verificar-requisitos.sh` (S01) ANTES de la ventana; usar Git Bash (`C:\Program Files\Git\bin\bash.exe`), shell verificado en la práctica |
| Credenciales `.env` perdidas en el traslado | Baja | Alto | Compartidas por canal externo seguro (password manager / WhatsApp); copiarlas al destino ANTES de `docker compose up`; el repo solo contiene placeholders |
| Drift de datos durante la ventana (pedidos mientras se copia) | Baja | Medio | Congelar el checkout (aviso), ventana de baja actividad y `mysqldump --single-transaction` (snapshot consistente en ~1 s) |
| Versión de MySQL distinta en destino | Baja | Alto | Version fijada en `docker-compose.yml` (MySQL 8.0.46); validar con `docker exec jadda_mysql mysql -V` |
| El admin queda bloqueado (hash distinto en BD nueva) | Baja | Medio | Trasladar la misma BD (hash incluido) + `ADMIN_EMAIL`/`ADMIN_PASSWORD` reales del `.env`; el flujo `DEBE_CAMBIAR_PASSWORD` solo aplica a vendedores nuevos |

---

## 3. Plan de respaldo (v0)

### 3.1 Qué se respalda

| Elemento | Ubicación | Método | ¿Contiene datos personales? |
|---|---|---|---|
| Base de datos (35 tablas: usuarios, pedidos, chats, direcciones…) | Servicio `jadda_mysql` (volumen `mysql_data`) | `bash scripts/respaldar.sh` → `mysqldump --single-transaction --routines --triggers --events` (dump lógico SQL; equivalente a `pg_dump -Fc` de la práctica 01, adaptado a MySQL) | **Sí** (33 cuentas de usuario, direcciones, teléfonos, chats) |
| Medios subidos | Cloudinary (344 assets) + copia local git `frontend/public/**` | `scripts/backup.ps1` adjunta zip de `frontend/public/images` — criticable porque las evidencias de retos/devoluciones viven FUERA del volumen MySQL | Sí (fotos de perfil, evidencias de retos) |
| Configuración sensible | `backend/.env` | Copia manual cifrada por canal externo (fuera del repo) | Sí (SMTP, Cloudinary, OAuth) |
| Volumen frío (opcional, DR) | Volumen `mysql_data` | `docker run --rm -v jadda_sports_mysql_data:/db alpine tar czf` (copia binaria exacta; no se usa por defecto) | Sí |
| Código y documentación | Repositorio GitHub | `git push` (ya versionado) | No |

### 3.2 Objetivos

| RPO | RTO | Justificación (acordada con el cliente) |
|---|---|---|
| 24 h | 1 h | Respaldo diario automático a las 23:30 → pérdida máxima aceptable = el día en curso (los pedidos del día se reconstruyen desde el correo de confirmación). RTO 1 h: la restauración de prueba en base aparte tomó 3,4 s (§3.5); el resto de la hora cubre contención, verificación y reactivación |

### 3.3 Política

| Aspecto | Decisión |
|---|---|
| Tipo (completo / incremental / diferencial) | **Completo** (dump lógico 100%; el tamaño actual ~0,25 MB lo permite sin incrementales) |
| Frecuencia y hora | Diaria, 23:30 (también manual: `bash scripts/respaldar.sh`). Tarea programada de Windows con `schtasks /CREATE /SC DAILY /ST 23:30 /TN "JADDA respaldo" /TR "…"` (procedimiento en `docs/implantacion/02-plan-migracion-respaldos.md`) |
| Retención | 7 días con rotación (`scripts/backup.ps1 -RetencionDias 7`) |
| Copia 1 — ubicación y medio | Disco local del host, carpeta `backups/mysql/` (SSD del equipo) |
| Copia 2 — ubicación y medio | Disco externo/USB semanal (carpeta `JADDA-RESPALDOS`), desconectado tras copiar |
| Copia 3 (fuera del sitio) | Nube (Drive/OneDrive) semanal; el `.env` viaja solo cifrado — el repo NO incluye credenciales |
| Cifrado | No activo aún (mejora MC: GPG en copias fuera del sitio; el material físico está en la oficina del cliente) |
| Responsable (rol) | Líder técnico / DevOps de guardia del día |

### 3.4 Procedimiento de restauración

<!-- Los 8 pasos de la teoría 04, con comandos exactos y copiables (Git Bash en el anfitrión). -->

1. **Detectar y decidir:** síntoma (BD inaccesible, contenedor `jadda_mysql` caído, datos
   corruptos por error humano). El líder técnico decide ejecutar el procedimiento y avisa a la
   tienda por WhatsApp con estimación de 1 h.

2. **Contener:** detener el backend para congelar escrituras —
   `docker compose stop backend` (el frontend seguirá arriba mostrando errores de API en checkout,
   señal visible de mantenimiento).

3. **Elegir el respaldo:** listar y validar —
   `ls -lh backups/mysql/` y `sha256sum` del candidato, comparando contra el registro del
   `backups/backup.log` o la salida del script de respaldo. Regla: **el más reciente que pase la
   validación de SHA-256**.

4. **Respaldar el estado actual** (antes de tocar nada):
   `bash scripts/respaldar.sh backups/mysql/emergencia_$(date +%Y%m%d_%H%M%S).sql`

5. **Restaurar:** cargar el dump elegido —
   ```bash
   # variante A — prueba segura en base aparte (recomendada)
   docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS jadda_s02_restore"'
   docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE jadda_s02_restore"'
   docker exec -i jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" jadda_s02_restore' < backups/mysql/<respaldo>.sql

   # variante B — reemplazo en producción
   docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE jadda_sports_db"'
   docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE jadda_sports_db"'
   docker exec -i jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" jadda_sports_db' < backups/mysql/<respaldo>.sql
   ```

6. **Verificar:**
   ```bash
   # (a) conteos de las 35 tablas, origen vs restaurada — diff vacío = OK
   for t in $(docker exec jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -N -e "SHOW TABLES" jadda_sports_db'); do \
     docker exec jadda_mysql sh -c "exec mysql -uroot -p\"\$MYSQL_ROOT_PASSWORD\" -N -e 'SELECT COUNT(*) FROM \`$t\`' jadda_sports_db"; done > /tmp/orden.txt
   #    (mismo loop contra jadda_s02_restore; comparar con diff)
   # (b) API viva
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/api/productos    # → 200
   # (c) smoke E2E
   pnpm test:e2e
   ```
   Criterio de éxito: diff vacío + `200` + smoke sin errores.

7. **Reabrir y comunicar:** `docker compose up -d backend` (y `docker restart jadda_frontend` si
   Vite quedó inconsistente); aviso a la tienda: "sistema restaurado — revisar los pedidos hechos
   después de la hora del dump del día del desastre".

8. **Registrar:** entrada en `backups/backup.log` (situación, dump usado, tiempo total, resultado
   OK/fallo) + incidencia y causa raíz en `docs/calidad/plan-mejora-continua.md` (tabla MC).

### 3.5 Evidencia de restauración

<!-- Respaldo de la base de TU proyecto restaurado en una base aparte. -->

**Respaldo ejecutado** (2026-10-21 09:49, Git Bash en el anfitrión):

```
== JADDA SPORTS — RESPALDO DE BASE DE DATOS (S02) ==
Contenedor: jadda_mysql  Base: jadda_sports_db
[OK]    Dump generado: backups/mysql/20261021_094903_jadda_sports_db.sql
[OK]    Tamaño: 251290 bytes | CREATE TABLE: 35 | Duración: 1s
[OK]    SHA-256: 8f2280fc5fae6fed0b725a43f4ab51904dbf5bb07cabd6bfceb0e7497dd68ac1
Cierre de verificación: -- Dump completed on 2026-10-21  9:49:05
```

**Restauración en base aparte** (`DROP + CREATE jadda_s02_restore` + `mysql < dump`):

```
RESTAURACION_COMPLETADA_EN_MS=3371          (≈ 3,4 s)
```

**Conteos antes (producción `jadda_sports_db`) y después (restaurada `jadda_s02_restore`):**

| Tabla | Filas en producción | Filas restauradas |
|---|---|---|
| AVISOS_STOCK | 5 | 5 |
| CARRITO | 2 | 2 |
| CATEGORIAS | 15 | 15 |
| CHAT | 16 | 16 |
| CHAT_MENSAJE | 36 | 36 |
| DESCUENTOS | 18 | 18 |
| DETALLE_VENTAS | 97 | 97 |
| DEVOLUCIONES | 19 | 19 |
| DEVOLUCIONES_EVIDENCIAS | 17 | 17 |
| DIRECCIONES | 41 | 41 |
| ENVIOS | 55 | 55 |
| FAVORITOS | 95 | 95 |
| HISTORIAL | 25 | 25 |
| METODOS_PAGO | 15 | 15 |
| MOVIMIENTOS_STOCK | 135 | 135 |
| NOTIFICACIONES | 235 | 235 |
| PLANES_USUARIO | 21 | 21 |
| PLANTILLAS_PLANES | 9 | 9 |
| PQR | 3 | 3 |
| PRODUCTOS | 105 | 105 |
| PRODUCTO_CARACTERISTICAS | 576 | 576 |
| PRODUCTO_IMAGENES | 313 | 313 |
| PRODUCTO_VARIANTES | 419 | 419 |
| PROVEEDORES | 15 | 15 |
| RESENAS | 20 | 20 |
| RETOS | 16 | 16 |
| RETOS_USUARIOS | 26 | 26 |
| RETO_EVIDENCIAS | 21 | 21 |
| ROLES | 6 | 6 |
| SOLICITUDES_VENDEDOR | 10 | 10 |
| USUARIOS | 33 | 33 |
| USUARIOS_METODOS_PAGO | 36 | 36 |
| VENDEDORES | 7 | 7 |
| VENTAS | 55 | 55 |
| sessions | 2 | 2 |
| **TOTAL (35 tablas)** | **2.519** | **2.519** |

Verificación: comparación de los dos listados → **35 tablas con conteos exactamente iguales**
(0 diferencias). Tras registrar la evidencia se ejecutó
`DROP DATABASE IF EXISTS jadda_s02_restore` para dejar la BD limpia.

Tiempo de restauración medido: **3.371 ms (≈ 3,4 s)** para el dump completo de 35 tablas (251 KB).

### 3.6 Calendario de pruebas

| Prueba | Frecuencia | Responsable |
|---|---|---|
| Restauración del dump más reciente en base aparte (`jadda_s02_restore`) + diff de conteos | Mensual (primer lunes) | Líder técnico |
| Restauración completa del ambiente (volúmenes limpios, `docker compose down -v` + dump + smoke) | Trimestral | Líder técnico |
| Rotación de medios (Copia 2 USB + Copia 3 nube: validar accesibilidad y SHA) | Trimestral | Administrador de la tienda |
| Revisión del log de respaldos (`backups/backup.log`) — ningún día sin dump | Semanal (viernes) | DevOps de guardia |

---

## 5. Plan de instalación (v0)

| # | Sección | Contenido |
|---|---|---|
| 1 | Alcance | Instalación del sistema JADDA SPORTS (backend + frontend + BD en Docker; app móvil opcional fuera de Docker) en un equipo Windows 10/11 nuevo, uso LAN |
| 2 | Ambientes | Desarrollo y **producción LAN** (mismo runtime Docker; producción usa `MODE=preview` en el contenedor `jadda_frontend`) |
| 3 | Roles | Líder técnico (ejecuta instalación y validaciones), Administrador de la tienda (validación funcional), DevOps de guardia (respaldos post-instalación) |
| 4 | Prerrequisitos | *Ver sección 1 (ficha técnica, semana 1)* — Docker Desktop ≥ 24, Git, RAM ≥ 8 GB, disco ≥ 40 GB y `backend/.env` con credenciales reales |
| 5 | Preparación | `git clone` del repositorio; copiar los `.env` reales por canal seguro; ejecutar `scripts/verificar-requisitos.sh` (corrida S01: salida 0, "OK: 22 · FALLAS: 0") |
| 6 | Procedimiento | *Ver pasos abajo* |
| 7 | Migración de datos | *Ver sección 2* — si el destino hereda datos: restaurar el dump en lugar de sembrar desde cero |
| 8 | Verificación | `scripts/verificar-requisitos.sh` → "CUMPLE LOS REQUISITOS MINIMOS"; smoke E2E `pnpm test:e2e` (23 checks) en verde; login admin manual |
| 9 | Rollback | Si la verificación falla tras 30 min de diagnóstico: restaurar el último dump válido (§3.4) o clonar desde cero (`docker compose down -v` + `setup.js`); si el equipo destino sigue fallando, regresar al origen (su volumen nunca se destruye) |
| 10 | Cronograma | *Ver tabla abajo* |

### Procedimiento

| # | Acción | Comando | Resultado esperado |
|---|---|---|---|
| 1 | *Verificar requisitos del servidor* | *`bash scripts/verificar-requisitos.sh`* | *Código de salida 0* |
| 2 | Clonar el repositorio | `git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git` | Carpeta del proyecto en el destino |
| 3 | Copiar configuraciones reales | pegar `backend/.env` (y `frontend/.env` / `movil/.env` si aplica) entregadas por canal seguro | `.env` presente (git lo ignora) |
| 4 | Levantar contenedores | `docker compose up -d` | 3 contenedores `Up`; `setup.js` crea tablas + seeds automáticamente |
| 5 | (Opcional) Restaurar datos reales | `docker exec -i jadda_mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" jadda_sports_db' < backups/mysql/<respaldo>.sql` (Git Bash) | La BD del destino contiene los datos del origen (conteos §3.5) |
| 6 | Verificar el despliegue | `docker compose ps` + `curl http://localhost:5173/api/productos` | API responde `200` a través del proxy del frontend |
| 7 | Cambiar contraseña del admin | *Perfil → Seguridad* con la cuenta admin del `.env` | Contraseña rotada (fuera del repo y del historial) |
| 8 | Activar respaldos diarios | programar la tarea 23:30 (`schtasks` o manual) y ejecutar `bash scripts/respaldar.sh` de inmediato | `backups/mysql/<fecha>_*.sql` con línea `Dump completed on` |

> Nota sobre Windows: el `bash` del `PATH` del host apunta a WSL (sin distribución Linux instalada).
> Para ejecutar los scripts `.sh` de este proyecto usar Git Bash:
> `& "C:\Program Files\Git\bin\bash.exe" scripts/respaldar.sh`. En un servidor Linux dedicado
> (Ubuntu Server 24.04 LTS recomendado en la ficha S01) los mismos comandos corren con el bash
> del sistema directamente.

### Cronograma de la ventana

| Fase | Duración | Acumulado |
|---|---|---|
| Verificación de requisitos y clonado | 10 min | 0:10 |
| Copia de `.env` + `docker compose up -d` + seeds de `setup.js` | 15 min | 0:25 |
| Restauración del dump (si aplica) + conteos + prueba HTTP | 10 min | 0:35 |
| Smoke E2E + login admin manual + validación funcional de la tienda | 20 min | 0:55 |
| Activación de respaldos + registro de la instalación | 10 min | 1:05 |
| Reserva de contingencia / rollback | 45 min | **≤ 2 h (ventana aprobada)** |

Punto de no retorno: **`docker compose down -v` en el equipo destino con el volumen ya migrado** —
desde ese momento el destino quedó borrado y el camino regreso es restaurar el dump (siempre
recuperable) o volver al origen; por regla el origen no se destruye hasta validar el destino.
