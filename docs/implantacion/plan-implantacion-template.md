# 📘 Plan de Implantación — JADDA SPORTS

<!-- 📝 Instrucción: cada equipo copia esta plantilla al repositorio de su proyecto real
(`docs/plan-implantacion.md`) y completa una sección por semana. En la semana 9 el documento
debe permitir que otro equipo instale el proyecto desde cero sin ayuda. Solo datos sintéticos:
nada de IPs, usuarios ni contraseñas reales. Modelo completo: el plan de la app de referencia,
referencia/docs/plan-implantacion.md. -->

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Versión del plan | 1.0 |
| Fecha | 2026-10-20 |

---

## 1. Ficha técnica y requisitos mínimos — Semana 1 (CE-1, CE-2)

<!-- 📝 Arquitectura del software, servicios que lo componen, sistema operativo seleccionado,
matriz de requisitos mínimos (CPU, RAM, disco, red) y resultado del script de verificación. -->

### 1.1 Arquitectura

JADDA SPORTS es una aplicación web de tres capas desplegada con Docker Compose:

```
Navegador / app móvil (LAN)
        │  http://<IP-LAN>:5173
        ▼
┌──────────────────┐   /api/*, /images/*   ┌──────────────────┐      ┌──────────────────┐
│ jadda_frontend   │ ────────────────────► │ jadda_backend    │ ───► │ jadda_mysql      │
│ React + Vite     │                       │ Node.js + Express│      │ MySQL 8.0        │
│ :5173            │                       │ :5000            │      │ :3306            │
└──────────────────┘                       └──────────────────┘      └──────────────────┘
   imágenes públicas                         uploads / Cloudinary       volumen mysql_data
```

El frontend es la única puerta de entrada para los usuarios: sirve la SPA y hace proxy de `/api` e `/images` hacia el backend. El backend expone la API REST y sirve los archivos subidos; MySQL almacena los datos transaccionales. Cloudinary es opcional para medios y el correo/OAuth dependen de servicios externos.

### 1.2 Servicios que componen la solución

| Servicio | Contenedor | Puerto | Función | Dependencia |
|---|---|---|---|---|
| Frontend web | `jadda_frontend` | 5173/TCP | SPA React + Vite; proxy de API e imágenes | Backend |
| API REST | `jadda_backend` | 5000/TCP | Lógica de negocio, autenticación, checkout, reportes | MySQL |
| Base de datos | `jadda_mysql` | 3306/TCP | Persistencia (35 tablas) | Volumen `mysql_data` |
| Almacenamiento de medios | Cloudinary (externo) | 443/TCP | Imágenes de productos, perfiles y evidencias | Internet |
| Correo transaccional | SMTP (externo) | 587/TCP | Verificación, pedidos, devoluciones, newsletter | Internet |
| OAuth | Google / Facebook (externo) | 443/TCP | Login social opcional | Internet |

### 1.3 Sistema operativo seleccionado

| Aspecto | Selección |
|---|---|
| Servidor actual | Windows 11 Home Single Language 25H2, build 10.0.26200, x86-64 |
| Runtime de contenedores | Docker Desktop 29.5.2 + Docker Engine + WSL2 |
| Alternativa recomendada | Ubuntu Server 24.04 LTS x86-64 (soporte estándar hasta abril de 2029) |
| Motivo | El equipo del cliente ya tiene Windows 11 y Docker Desktop; para un servidor dedicado, Ubuntu reduce la capa WSL2 y facilita firewall, usuarios y automatización |

### 1.4 Matriz de requisitos mínimos

| Requisito | Mínimo | Recomendado | Justificación |
|---|---|---|---|
| CPU | 4 vCPU | 6 vCPU | Pico medido de 4,0 núcleos con 20 peticiones concurrentes; 6 vCPU deja 50 % de margen |
| RAM | 8 GB | 16 GB | Contenedores: 1,18 GB en pico; Windows + Docker/WSL2 consumen 4–6 GB adicionales |
| Disco | 40 GB libres | 80 GB SSD | Docker midió 35,3 GB (imágenes, volúmenes y caché de build); 80 GB cubre backups y crecimiento |
| Disco / IOPS | SSD 1.000 IOPS | SSD NVMe 3.000+ IOPS | MySQL, catálogo de imágenes y builds de Docker |
| Red | LAN 100 Mbps | LAN 1 Gbps | Tráfico de catálogo e imágenes; internet solo para SMTP, Cloudinary y OAuth |
| Arquitectura | x86-64 | x86-64 | Imágenes Docker y binarios Node/MySQL probados en x86-64 |
| Sistema operativo | Windows 11 64-bit + WSL2 | Ubuntu Server 24.04 LTS | La implantación actual usa Windows; Ubuntu es mejor para servidor dedicado |
| Docker / Compose | Docker ≥ 24 + Compose v2 | Docker 29.5.2 + Compose v5.1.3 | Versiones verificadas con el compose del proyecto |
| Puertos | 5173/TCP | 5173/TCP + reverse proxy 443 si se publica | 5000 y 3306 no deben exponerse a Internet |

### 1.5 Resultado de la verificación

Script: `scripts/verificar-requisitos.sh` (bash; se ejecutó con Git Bash en el servidor Windows).

Resultado del **2026-10-20**: **22 OK, 0 avisos, 0 fallas — CUMPLE**. El equipo tiene 12 hilos lógicos, 23,8 GB de RAM, 177,9 GB libres, Docker 29.5.2, Compose v5.1.3, MySQL 8.0.46 y Node 22.23.0. La salida completa y la matriz detallada están en `docs/entregable-s01-ficha-tecnica.md` §1.4–§1.7.

---

## 2. Plan de migración de datos — Semanas 2 y 5 (CE-3)

<!-- 📝 Objetivos, origen/destino, mapeo, etapas, riesgos, validación (conteos, checksums),
rollback. En la semana 5 se agrega la evidencia de la migración ejecutada. -->

### 2.1 Objetivos

- Pasar de una base de datos de desarrollo/demostración a una base de producción sin pérdida de datos.
- Conservar IDs, relaciones, imágenes y referencias de pago.
- Validar la migración con conteos y checksums antes de abrir la plataforma a los usuarios.
- Poder volver atrás en menos de 2 horas si la validación falla.

### 2.2 Origen y destino

| Elemento | Origen | Destino |
|---|---|---|
| Base de datos | MySQL 8.0 del entorno de desarrollo o `backend/database/schema.sql` | Contenedor `jadda_mysql`, base `jadda_sports_db`, volumen `mysql_data` |
| Esquema | `backend/database/setup.js` (fuente de verdad) | 35 tablas + migraciones idempotentes |
| Catálogo y datos semilla | `schema.sql` / `setup.js` | Mismas tablas, mismos IDs |
| Imágenes y evidencias | `frontend/public/images/` (bind mount) o Cloudinary | Misma ruta relativa o misma URL de Cloudinary |
| Configuración | `backend/.env.example` + secretos entregados por canal seguro | `backend/.env` del servidor (nunca en git) |

### 2.3 Mapeo

La migración es **1:1**: no hay cambio de modelo ni de nombres de tablas. Se preservan las claves primarias y foráneas. Las tablas críticas son `USUARIOS`, `PRODUCTOS`, `PRODUCTO_VARIANTES`, `VENTAS`, `DETALLE_VENTAS`, `ENVIOS`, `PAGOS`, `DEVOLUCIONES`, `RETOS_USUARIOS`, `RETO_EVIDENCIAS`, `CHAT`, `CHAT_MENSAJE`, `NOTIFICACIONES` y `MOVIMIENTOS_STOCK`. Los datos semilla (categorías, métodos de pago, retos) se insertan con `INSERT IGNORE`; no pisan registros existentes.

### 2.4 Etapas

1. **Congelar escrituras**: detener el backend (`docker stop jadda_backend`) y avisar a los usuarios.
2. **Respaldar**: ejecutar `powershell -ExecutionPolicy Bypass -File scripts\backup.ps1` y verificar el log.
3. **Exportar**: `mysqldump --single-transaction --routines --triggers` dentro de `jadda_mysql`; copiar el dump con `docker cp` (sin pasar por PowerShell para no alterar bytes).
4. **Importar**: restaurar el dump en el destino o, en instalación limpia, importar `schema.sql` / arrancar el backend para que `setup.js` cree las 35 tablas.
5. **Migrar imágenes**: copiar `frontend/public/images/` completa; si se usa Cloudinary, verificar que las URLs respondan 200.
6. **Aplicar migraciones**: arrancar `jadda_backend`; `setup.js` aplica `ALTER`/`CREATE` idempotentes.
7. **Validar**: conteos, checksums, login, catálogo y una compra de prueba.
8. **Abrir**: reiniciar frontend/backend y comunicar la finalización.

### 2.5 Validación

| Control | Criterio |
|---|---|
| Tablas | 35 tablas en `jadda_sports_db` |
| Conteos | `COUNT(*)` de cada tabla crítica igual al origen (o mayor solo en tablas semilla) |
| Checksums | `CHECKSUM TABLE` de `USUARIOS`, `PRODUCTOS`, `VENTAS`, `DETALLE_VENTAS`, `ENVIOS` |
| Integridad | `SELECT` de ventas sin detalle, productos sin variante o envíos sin venta = 0 |
| Imágenes | Muestra aleatoria de 20 URLs responde HTTP 200 |
| Aplicación | Login admin, catálogo visible, detalle de producto, última venta y factura PDF |
| Post-migración | Backup inmediato y registro en `backups/backup.log` |

### 2.6 Rollback

1. Detener backend y frontend.
2. Restaurar el dump previo con `scripts/restaurar-backup.ps1` (confirmar `SI`).
3. Restaurar el zip de imágenes.
4. Volver al commit/tag anterior (`git checkout <TAG_ANTERIOR>`).
5. `docker compose up -d --build` y ejecutar los smoke tests.
6. Registrar el incidente y la causa en el plan de mejora.

### 2.7 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pérdida de datos por dump incompleto | Backup previo + restauración de prueba en `jadda_restore_test` |
| Codificación incorrecta (tildes/emoji) | `utf8mb4` / `utf8mb4_0900_ai_ci`; importar con `--default-character-set=utf8mb4` |
| Imágenes fuera de la BD | Respaldar y copiar `frontend/public/images` en el mismo paso |
| Bloqueo por claves foráneas | Importar en el orden del dump; no truncar tablas manualmente |
| Docker no propaga archivos nuevos | Reiniciar `jadda_frontend` después de copiar imágenes |
| Ventana de indisponibilidad mayor a la prevista | Ensayar la migración en una BD temporal y medir el tiempo |

### 2.8 Evidencia

- Restauración E2E verificada en `jadda_restore_test`: **35 tablas reconstruidas** y base temporal eliminada (2026-08-24).
- Dump de muestra: 111 KB; imágenes: 43,7 MB / 163 archivos (catálogo actual: 57,2 MB).
- La migración real del cliente se ejecutará en la ventana acordada y se anexará aquí el conteo/checksum firmado.

---

## 3. Plan de respaldo — Semanas 2 y 6 (CE-4)

<!-- 📝 Qué se respalda, frecuencia, RPO/RTO, regla 3-2-1, herramienta, cifrado, retención,
procedimiento de restauración probado. -->

### 3.1 Qué se respalda

| Componente | Ubicación | Método |
|---|---|---|
| Base de datos completa (35 tablas) | Volumen Docker `mysql_data` | `mysqldump --single-transaction --routines --triggers` + `docker cp` |
| Imágenes y evidencias | `frontend/public/images/` | `Compress-Archive` de toda la carpeta |
| Configuración | `backend/.env`, `docker-compose.yml` | Copia segura/cifrada; nunca en git ni en el zip público |
| Documentación y código | Repositorio Git | Remoto + tag de entrega |

> Las imágenes NO están dentro del volumen MySQL. Un backup que solo incluya el dump deja fuera el catálogo, las fotos de perfil y las evidencias de retos/devoluciones.

### 3.2 Política

| Parámetro | Valor |
|---|---|
| Frecuencia | Diaria, 23:00 (hora local) |
| Retención | 7 días (configurable con `-RetencionDias`) |
| RPO | 24 horas |
| RTO | ≤ 2 horas (procedimiento probado; medir en el simulacro) |
| Regla 3-2-1 | Copia local + copia semanal en unidad externa + copia opcional en nube |
| Cifrado | BitLocker en el disco de backups; 7-Zip AES-256 si se envía fuera |
| Verificación | Restauración mensual en una BD temporal |

### 3.3 Herramientas

- `scripts/backup.ps1`: dump + zip de imágenes + rotación + `backups/backup.log`.
- `scripts/restaurar-backup.ps1`: restauración en la BD real o en `jadda_restore_test`.
- Programador de tareas de Windows (`schtasks`) para la corrida diaria.
- `docker cp` para transferir el dump sin que PowerShell altere el contenido.

### 3.4 Restauración probada

```
1. Detener backend:                 docker stop jadda_backend
2. Restaurar dump:                  powershell -File scripts\restaurar-backup.ps1 -RutaBackup <ZIP>
                                    (confirmar SI; reemplaza la BD actual)
3. Restaurar imágenes:              Expand-Archive backups\imagenes\<ZIP> -DestinationPath frontend\public\images
4. Reiniciar:                       docker start jadda_backend
5. Validar:                         login admin + catálogo + última compra + factura PDF
```

Resultado de la prueba: restauración en `jadda_restore_test` con **35 tablas**, sin tocar la base real; la base temporal se eliminó al finalizar.

### 3.5 Automatización

```powershell
schtasks /create /tn "JaddaBackupDiario" /tr ^
  "powershell -ExecutionPolicy Bypass -File \"<RUTA_PROYECTO>\scripts\backup.ps1\"" ^
  /sc daily /st 23:00 /rl limited
```

### 3.6 Responsables

| Rol | Responsabilidad |
|---|---|
| Administrador del sistema (cliente) | Revisar `backup.log` semanalmente y guardar la copia externa |
| Equipo de desarrollo | Mantener scripts y regenerar `schema.sql` ante cambios de esquema |
| Responsable de operación | Ejecutar la restauración de prueba mensual y registrar el resultado |

### 3.7 Evidencia

- `backups/backup.log` con cada corrida y la rotación.
- Salida de la restauración en `jadda_restore_test`.
- Este plan y el manual de instalación entregados al cliente.

---

## 4. Hosting y dominio — Semana 3 (CE-1)

<!-- 📝 Tipo de hosting elegido y justificación, dominio, registros DNS, reverse proxy, HTTPS,
método de transferencia de archivos. -->

### 4.1 Tipo de hosting

| Aspecto | Decisión |
|---|---|
| Modalidad | **Producción local/LAN** en un equipo del cliente con Docker Desktop |
| Justificación | El alcance acordado no incluye publicación en Internet; los datos y las imágenes permanecen en la red del cliente; costo mensual $0 |
| Alternativa en nube | VPS con Ubuntu Server 24.04 LTS, 2–4 vCPU, 8 GB RAM, 80 GB SSD y Docker Engine; MySQL en el mismo VPS o gestionado |
| Proveedor sugerido | Cualquiera con región en América; evitar planes de 1 vCPU/2 GB para producción |

### 4.2 Dominio y DNS

- **LAN**: no se usa dominio; se accede con `http://<IP-LAN>:5173`. Se puede configurar `jadda.local` por mDNS o en el archivo `hosts` de los clientes.
- **Internet (opcional)**: dominio `jadda.example` (sintético) con registro `A` hacia la IP pública y `CNAME www` → `jadda.example`. El dominio se adquiere aparte (~USD 10–15/año).
- **Correo**: el envío usa SMTP externo; no se configura MX propio.

### 4.3 Reverse proxy y HTTPS

- En LAN no se usa reverse proxy: Vite sirve la SPA y hace proxy de `/api` e `/images`.
- Si se publica en Internet: Caddy o Nginx en 443 → `jadda_frontend:5173`, con certificado Let's Encrypt; cerrar 5000 y 3306.
- HTTPS no aplica en la LAN plana; si el cliente lo exige, usar un proxy interno con certificado autofirmado o una CA local.

### 4.4 Transferencia de archivos

- Código: `git clone` / `git pull` desde el repositorio, o copia del zip de entrega.
- Backups: unidad externa o nube; no usar FTP.
- Imágenes: incluidas en el backup o en Cloudinary; no se transfieren manualmente una por una.

### 4.5 Costos estimados

| Concepto | Costo |
|---|---|
| Equipo servidor | $0 (equipo existente del cliente) |
| Licencia Windows 11 | Incluida con el equipo |
| Docker Desktop | $0 para uso académico/personal; revisar licencia comercial |
| Cloudinary | $0 en el plan gratuito; costo si se supera |
| Dominio (opcional) | ~USD 10–15/año |
| VPS (alternativa) | ~USD 10–30/mes según recursos |
| Energía/Internet | Consumo del equipo del cliente |

---

## 5. Plan de instalación y despliegue — Semanas 2 y 4 (CE-1, CE-5)

<!-- 📝 Prerrequisitos, pasos numerados y verificables para instalar en servidor local y en la
nube, versión liberada, costos estimados. Semana 10 (opcional): subsección 5.10 con la
instalación automatizada (cloud-init + Ansible). -->

### 5.1 Prerrequisitos

- CPU 4 vCPU, RAM 8 GB, disco 40 GB libres, x86-64.
- Docker Desktop + WSL2 activos (Windows) o Docker Engine + Compose v2 (Ubuntu).
- Puertos 5173, 5000 y 3306 libres.
- Repositorio del proyecto y acceso a `backend/.env.example`.
- Git Bash (Windows) o bash (Linux) para `scripts/verificar-requisitos.sh`.

### 5.2 Instalación local paso a paso

1. **Verificar requisitos**:
   ```bash
   bash scripts/verificar-requisitos.sh
   ```
   Criterio: `RESULTADO: CUMPLE LOS REQUISITOS MINIMOS`.
2. **Clonar/copiar** el repositorio en `<RUTA_PROYECTO>`.
3. **Crear la configuración**:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```
   Completar `SESSION_SECRET`, SMTP, OAuth, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `FRONTEND_URL` y, si se usa, `CLOUDINARY_URL`.
4. **Definir las variables de Compose** en el entorno del host:
   ```powershell
   $env:MYSQL_ROOT_PASSWORD = '<CLAVE_ROOT_SINTETICA>'
   $env:DB_PASSWORD        = '<MISMA_CLAVE_QUE_ROOT>'
   $env:MODE               = 'preview'   # build de producción; en desarrollo usar 'dev'
   docker compose up -d --build
   ```
   En el primer arranque `MYSQL_ROOT_PASSWORD` y `DB_PASSWORD` deben coincidir porque el backend se conecta como `root`. Después se crea `jadda_app`.
5. **Esperar la base**:
   ```powershell
   docker ps --format "table {{.Names}}\t{{.Status}}"
   ```
   `jadda_mysql` debe estar `healthy`; `jadda_backend` y `jadda_frontend`, `Up`.
6. **Crear el usuario de aplicación con menor privilegio**:
   ```powershell
   docker cp scripts\sql\usuarios-produccion.sql jadda_mysql:/tmp/users.sql
   docker exec jadda_mysql sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD < /tmp/users.sql'
   docker exec jadda_mysql rm -f /tmp/users.sql
   ```
7. **Conmutar el backend** a `DB_USER=jadda_app` y `DB_PASSWORD=<CLAVE_APP>`; `docker compose up -d backend`.
8. **Cambiar la contraseña del admin** desde Perfil → Seguridad.
9. **Ejecutar los smoke tests** de §6.3.
10. **Programar el backup** diario (§3.5) y ejecutar el primero.

### 5.3 Instalación en la nube (referencia, no ejecutada)

1. Crear una VM Ubuntu Server 24.04 LTS (2–4 vCPU, 8 GB RAM, 80 GB SSD).
2. Instalar Docker Engine y el plugin Compose; crear un usuario `jadda` sin login root.
3. Clonar el repositorio en `/opt/jadda-sports`.
4. Crear `backend/.env` desde el ejemplo y cargar secretos desde el gestor del proveedor.
5. `docker compose up -d --build`; abrir solo 80/443 en el firewall.
6. Configurar Caddy/Nginx con HTTPS y proxy a 5173.
7. Programar backups a almacenamiento de objetos y probar la restauración.
8. Registrar el resultado en este plan antes de declarar la entrega.

### 5.4 Versión liberada

- Versión funcional: **1.0.0**.
- Tag de entrega: `<TAG_DE_ENTREGA>` (se creará al cierre; el repositorio aún no tiene tags).
- Base de código verificada: rama `main`, commit de referencia al momento de la entrega.
- Artefacto: repositorio + `schema.sql` + scripts de backup/restauración + manuales.

### 5.5 Costos de instalación

| Concepto | Costo |
|---|---|
| Horas de instalación local | 2–4 h (incluye verificación, configuración y smoke tests) |
| Horas de migración/restauración | 1–2 h |
| Licencias | $0 adicionales (Windows/Docker/MySQL/Node son gratuitos o ya están licenciados) |
| Cloudinary/SMTP | $0 en planes gratuitos; revisar límites |
| Nube (opcional) | VPS ~USD 10–30/mes + dominio ~USD 10–15/año |

### 5.6 Actualización y rollback

```powershell
powershell -File scripts\backup.ps1          # 1. respaldar
git pull                                     # 2. traer la versión
docker compose up -d --build                 # 3. reconstruir; setup.js migra
# 4. smoke tests y revisión de logs
```

Rollback: `git checkout <TAG_ANTERIOR>` → `docker compose up -d --build` → restaurar el backup si la migración de esquema lo requiere. Registrar fecha, causa y versión restaurada.

### 5.10 Automatización opcional (no implementada)

Para la semana 10 se propone:

- **cloud-init**: instalar Docker/Compose, crear usuario `jadda`, clonar el repo y cargar variables desde el gestor de secretos.
- **Ansible**: asegurar firewall (solo 5173/443), copiar `backend/.env` con `no_log`, desplegar con `docker compose`, programar backup y verificar healthchecks.
- **Criterio de éxito**: una VM nueva queda operativa con un solo comando y pasa los smoke tests sin intervención manual.

Estado actual: **no implementado**; la instalación es manual y está documentada en `docs/manuales/manual-instalacion.md`.

---

## 6. Configuración y verificación — Semana 5 (CE-1)

<!-- 📝 Variables de entorno por ambiente (sin valores reales), servicios, healthchecks,
smoke tests. -->

### 6.1 Variables de entorno

| Variable | Dónde | Desarrollo | Producción local | CI |
|---|---|---|---|---|
| `MYSQL_ROOT_PASSWORD` | entorno de Compose | `<CLAVE_DEV>` | `<CLAVE_ROOT>` | `jadda_ci_root` (efímera) |
| `DB_HOST` | Compose | `database` | `database` | `127.0.0.1` |
| `DB_USER` | Compose | `root` (primer arranque) | `jadda_app` (operación) | `root` |
| `DB_PASSWORD` | Compose | `<CLAVE_DEV>` | `<CLAVE_APP>` | `<CLAVE_CI>` |
| `DB_NAME` | Compose | `jadda_sports_db` | `jadda_sports_db` | `jadda_sports_db` |
| `MODE` | entorno del host/`.env` raíz | `dev` | `preview` | no aplica |
| `SESSION_SECRET` | `backend/.env` | `<SECRETO_DEV>` | `<SECRETO_LARGO>` | `ci_session_secret` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `backend/.env` | `<ADMIN_DEV>` | `<ADMIN_PROD>` | valores de prueba |
| `FRONTEND_URL` | `backend/.env` | `http://localhost:5173` | `http://<IP-LAN>:5173` | `http://127.0.0.1:5173` |
| `CLOUDINARY_URL` | `backend/.env` | opcional | opcional | no se usa |
| `EMAIL_USER` / `EMAIL_PASS` | `backend/.env` | opcional | SMTP real | simulados |
| `GOOGLE_*` / `FACEBOOK_*` | `backend/.env` | opcional | OAuth real | valores ficticios |
| `NEWSLETTER_INTERVAL_HORAS` | `backend/.env` | 72 | 72 | 72 |
| `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_FRONT_URL` | `movil/.env` | `http://<IP-LAN>:5173` | `http://<IP-LAN>:5173` | no aplica |

> Las variables del `environment:` de `docker-compose.yml` tienen prioridad sobre `backend/.env` dentro de Docker. No commitear `.env`; usar `.env.example` con placeholders.

### 6.2 Servicios y healthchecks

| Servicio | Healthcheck / verificación | Criterio |
|---|---|---|
| MySQL | `mysqladmin ping` cada 5 s, 30 reintentos | `healthy` |
| Backend | `GET /api/productos` y logs de arranque | HTTP 200 y `setup.js` sin errores |
| Frontend | `GET /` y `GET /api/productos` por el proxy | HTTP 200 |
| Backup | `backups/backup.log` | última corrida exitosa |
| Cloudinary (si aplica) | URL de una imagen de prueba | HTTP 200 |

### 6.3 Smoke tests

```powershell
docker ps --format "table {{.Names}}\t{{.Status}}"
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:5173/
curl.exe -s http://localhost:5173/api/productos
curl.exe -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"<ADMIN_EMAIL>\",\"password\":\"<ADMIN_PASSWORD>\"}"
bash scripts/verificar-requisitos.sh
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```

Criterios: frontend 200, API con productos, login con usuario, script con 0 fallas y backup registrado. Además, ejecutar la suite automatizada: backend 28 pruebas, smoke 23 checks y Playwright E2E.

### 6.4 Verificación de la configuración

- Revisar que `docker compose config` no muestre variables vacías.
- Confirmar que `MODE=preview` en producción (build optimizado) y `dev` solo en desarrollo.
- Verificar que 5000/3306 no estén accesibles desde otro equipo de la LAN.
- Confirmar que las rutas `/images` y los uploads responden.
- Registrar fecha, versión y responsable en la bitácora de despliegue.

---

## 7. Seguridad, usuarios y permisos — Semana 6 (CE-1)

<!-- 📝 Matriz de usuarios/roles (sistema operativo y base de datos), políticas de acceso,
firewall, manejo de secretos, resultados de pruebas de privilegios. -->

### 7.1 Usuarios del sistema operativo

| Usuario | Rol | Permisos |
|---|---|---|
| `jadda_admin` | Administrador del servidor | Instalar Docker, gestionar servicios, firewall y backups; uso excepcional |
| `jadda_operador` | Operación diaria | Iniciar/detener contenedores, revisar logs y ejecutar backups; sin cambios de sistema |
| `jadda_backup` | Tarea programada | Ejecutar `backup.ps1` y escribir en `backups/`; sin acceso interactivo |
| `Administrador` (Windows) | Cuenta integrada | Solo para instalación inicial; no para operación diaria |

En Ubuntu: `jadda` con sudo limitado a `docker compose` y un servicio systemd para el arranque; root solo para instalación/actualización del kernel.

### 7.2 Usuarios de base de datos

| Usuario | Uso | Privilegios |
|---|---|---|
| `root` | Solo primer arranque y mantenimiento | Todos; nunca en la operación diaria |
| `jadda_app` | Backend en operación | `SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES` sobre `jadda_sports_db.*` (verificado con `SHOW GRANTS`) |
| `jadda_backup` (recomendado) | Respaldos | `SELECT, LOCK TABLES, SHOW VIEW, TRIGGER, EVENT`; no implementado aún, usar root dentro del contenedor para el dump |

`jadda_app` no tiene `DROP` ni privilegios globales. La clave se rota cada 90 días o ante sospecha de filtración.

### 7.3 Roles de la aplicación

| ID_ROL | Rol | Acceso |
|---|---|---|
| 1 | Administrador | Panel completo, usuarios, productos, órdenes, devoluciones, retos, reportes |
| 2 | Empleado | Apoyo operativo según rutas habilitadas |
| 3 | Proveedor | Gestión de productos propios según permisos |
| 4 | Usuario/cliente | Catálogo, carrito, compras, perfil, retos, chat |
| 5 | Invitado | Catálogo público; sin compras ni datos privados |
| 6 | Vendedor | Panel de vendedor, productos propios, ventas y devoluciones de sus productos; no compra |

La autorización se valida en el backend con `verificarSesion`, `esAdmin` y `esVendedor`; el frontend solo oculta opciones, no es la barrera de seguridad.

### 7.4 Firewall y exposición

- **LAN**: abrir solo 5173/TCP en el perfil Privado; 5000 y 3306 quedan en localhost o en la red interna de Docker.
- **Internet (si se publica)**: 443/TCP al reverse proxy; 80 solo para redirección/ACME; cerrar 5000, 3306 y 5173.
- **Windows Defender Firewall**: regla de entrada para JADDA Frontend; no crear reglas para MySQL/API.
- **MySQL**: nunca exponer 3306 a Internet; idealmente quitar el mapeo de puertos en producción.

### 7.5 Manejo de secretos

- `.env` fuera de git; permisos de lectura solo para la cuenta de servicio.
- Secretos diferentes por ambiente (dev/producción/CI); no reutilizar la clave de root.
- `SESSION_SECRET` largo y aleatorio; rotarlo invalida sesiones activas.
- Cloudinary/SMTP/OAuth en variables de entorno, nunca en el código.
- Backups de `.env` cifrados y separados de los backups de datos.

### 7.6 Pruebas de privilegios

| Prueba | Resultado |
|---|---|
| Endpoint admin sin sesión | 401 |
| Usuario cliente en ruta admin | 403 |
| Vendedor en ruta admin | 403 |
| Vendedor comprando en la tienda | 403 con mensaje de negocio |
| Admin editando venta de vendedor | 403 (solo lectura) |
| Acceso a evidencia de otro usuario | 403/404 |
| `jadda_app` intentando `DROP` | Denegado por privilegios |

Evidencia: suite backend 28/28, smoke 23 checks y pruebas E2E de rutas protegidas.

---

## 8. Pipeline de despliegue y monitoreo — Semana 7 (CE-1, CE-5)

<!-- 📝 Diagrama del pipeline, procedimiento de rollback, monitores configurados. -->

### 8.1 Pipeline de integración continua

```
Desarrollador ──push/PR──► GitHub Actions
                              ├─ Lint + TypeScript (frontend)
                              ├─ Tests unitarios backend (Vitest)
                              ├─ Tests integración backend (MySQL 8 efímero)
                              ├─ Tests frontend (Vitest + cobertura)
                              ├─ Build frontend + node --check backend
                              ├─ Playwright E2E (MySQL efímero)
                              └─ Smoke legacy (playwright-core)
                                        │
                                        ▼
                              Artefactos: cobertura + reporte Playwright
```

El pipeline está definido en `.github/workflows/ci.yml`. No hay despliegue continuo a producción: la entrega es manual y controlada.

### 8.2 Pipeline de despliegue a producción local

```
Backup verificado → git pull/tag → docker compose up -d --build
→ setup.js aplica migraciones → smoke tests → registrar versión → abrir a usuarios
```

Pasos: (1) backup; (2) revisar `git log`/tag; (3) reconstruir; (4) esperar `healthy`; (5) smoke tests; (6) revisar logs; (7) registrar fecha/commit/responsable; (8) comunicar.

### 8.3 Rollback

- Código: `git checkout <TAG_ANTERIOR>` + `docker compose up -d --build`.
- Datos: restaurar el backup previo si la nueva versión cambió el esquema de forma incompatible.
- Configuración: restaurar el `.env` anterior.
- Tiempo objetivo: ≤ 2 h; validar con smoke tests antes de reabrir.

### 8.4 Monitoreo

| Monitor | Herramienta | Frecuencia |
|---|---|---|
| Contenedores activos | `docker ps` | Diaria/manual |
| Salud de MySQL | healthcheck del compose | Cada 5 s |
| Errores del backend | `docker logs jadda_backend` | Diaria o ante incidente |
| Backups | `backups/backup.log` | Diaria |
| Disco | `docker system df` / `Get-PSDrive` | Semanal |
| Disponibilidad web | `curl` a `/` y `/api/productos` | Manual/diaria |
| CI | GitHub Actions | Cada push/PR |

No hay Prometheus/Grafana ni alertas automáticas en esta versión; están previstos en el plan de mejora (MC-12/MC-14). Para producción se recomienda un chequeo programado con `curl` y alerta por correo.

### 8.5 Estado

- CI: implementado.
- CD a producción: manual.
- Monitoreo: básico por logs/healthchecks.
- Alertas automáticas: pendiente (mejora continua).

---

## 9. Mantenimiento, soporte y capacitación — Semana 8 (CE-5)

<!-- 📝 Plan de mantenimiento, niveles de soporte, plan de capacitación, enlaces a ayudas en
línea. -->

### 9.1 Plan de mantenimiento

| Actividad | Frecuencia | Responsable |
|---|---|---|
| Revisar `backup.log` y espacio en disco | Semanal | Operación del cliente |
| Restauración de prueba en BD temporal | Mensual | Operación + desarrollo |
| Actualizar imágenes Docker y dependencias | Mensual/trimestral | Desarrollo |
| Rotar claves de `jadda_app` y admin | Cada 90 días | Operación |
| Revisar logs de errores y rendimiento | Mensual | Desarrollo |
| Renovar certificado HTTPS (si aplica) | Antes de 90 días | Operación |
| Revisar plan de mejora continua | Trimestral | Equipo |

### 9.2 Niveles de soporte

| Nivel | Alcance | Compromiso |
|---|---|---|
| Crítico | Sistema inoperante o pérdida de datos | Respuesta ≤ 48 h durante el período acordado en el acta |
| Menor | Error funcional sin bloqueo | Próxima actualización programada |
| Operación | Dudas de uso, backup, logs | Guías de troubleshooting y manuales |
| Actualizaciones | Nueva versión | Backup → actualizar → verificar → registrar |

El período exacto de soporte se completa en `docs/aceptacion/acta-entrega.md` §6.

### 9.3 Capacitación

| Sesión | Rol | Duración | Contenido |
|---|---|---|---|
| 1 | Cliente final | 45 min | Registro, compra, pedidos, devoluciones, retos |
| 2 | Vendedor | 30 min | Solicitud, publicación, ventas, devoluciones |
| 3 | Administrador | 60 min | Órdenes, productos, usuarios, devoluciones, retos, reportes, backup |

Guion completo: `docs/aceptacion/guia-capacitacion.md`. Se registra la evaluación práctica y la firma en el acta.

### 9.4 Documentación y ayudas

- `docs/manuales/manual-instalacion.md`: instalación, actualización y desinstalación.
- `docs/manuales/manual-tecnico.md`: arquitectura, API, base de datos y convenciones.
- `docs/manuales/manual-usuario-final.md`: tareas por rol.
- `docs/implantacion/03-guia-despliegue.md`: despliegue, publicación y troubleshooting.
- `docs/implantacion/02-plan-migracion-respaldos.md`: migración y backups.
- `docs/calidad/plan-mejora-continua.md`: mejoras y acciones correctivas.

### 9.5 Responsables

| Rol | Responsabilidad |
|---|---|
| Líder de proyecto | Coordinar entrega, acta y capacitación |
| Desarrollador backend | API, base de datos, migraciones y backups |
| Desarrollador frontend | SPA, UX y build de producción |
| Operación del cliente | Backups, monitoreo diario y primer nivel de soporte |

---

## 10. Aceptación y entrega — Semana 9 (CE-1 a CE-5)

<!-- 📝 Resultado de pruebas de aceptación, resultado del simulacro cruzado, acta de entrega
con niveles de servicio acordados. -->

### 10.1 Pruebas de aceptación

- Plan: `docs/aceptacion/pruebas-aceptacion.md` (35 casos, TP-001 a TP-035).
- Criterio: **100 % de casos críticos** (compra, postventa, seguridad) y **≥ 90 % global**.
- Estado: casos definidos y documentados; **ejecución y firma con el cliente pendientes** a la fecha de este plan.
- Evidencia previa: suite backend 28/28, smoke 23 checks, Playwright E2E y pruebas de flujos críticos documentadas.

### 10.2 Simulacro cruzado

- Objetivo: que un equipo distinto instale la plataforma desde cero usando solo este plan, `manual-instalacion.md` y `03-guia-despliegue.md`.
- Criterio: instalación completa en ≤ 2 h, smoke tests OK, backup y restauración OK, sin ayuda del equipo desarrollador.
- Estado: **no ejecutado**; se realizará antes de la firma del acta. Los hallazgos se registrarán como acciones de mejora y se corregirán en la documentación.

### 10.3 Acta de entrega

- Plantilla: `docs/aceptacion/acta-entrega.md`.
- Incluye alcance, exclusiones (soporte/push móvil y publicación en Internet con dominio/HTTPS), resultado UAT, capacitación, niveles de servicio y firmas.
- Estado: plantilla completa; faltan nombres, fechas, métricas de UAT y firmas del cliente.

### 10.4 Checklist de entrega

- [ ] Tag `v1.0.0` creado y publicado.
- [ ] Backup final ejecutado y restauración de prueba verificada.
- [ ] `schema.sql` regenerado con el esquema final.
- [ ] Manuales y plan de implantación revisados.
- [ ] UAT ejecutada: 100 % críticos y ≥ 90 % global.
- [ ] Simulacro cruzado realizado y hallazgos corregidos.
- [ ] Capacitación de los tres roles realizada.
- [ ] Credenciales entregadas por canal seguro (no por git/correo plano).
- [ ] Acta firmada por desarrollo y cliente.
- [ ] Responsable de operación del cliente identificado.

### 10.5 Estado general

| Componente | Estado |
|---|---|
| Documentación de implantación | Completa (01, 02, 03, ficha S01 y este plan) |
| Script de verificación | Implementado y ejecutado: 22 OK / 0 fallas |
| Backup/restauración | Implementado y probado en BD temporal |
| CI | Implementado en GitHub Actions |
| UAT | Pendiente de ejecución con el cliente |
| Simulacro cruzado | Pendiente |
| Acta de entrega | Pendiente de firmas |
