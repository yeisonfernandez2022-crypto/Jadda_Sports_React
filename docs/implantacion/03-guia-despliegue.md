# 03 · Guía de Despliegue y Publicación

**Proyecto:** JADDA SPORTS
**Documento:** Procedimiento de configuración de servidores, motor de base de datos y publicación de la aplicación
**Escenario:** producción local con Docker Compose
**Fecha:** 2026-08-24

---

## 1. Arquitectura desplegada

```
┌────────────────────────── Equipo servidor (Windows + Docker Desktop) ──────────────────────────┐
│                                                                                                │
│  Navegadores / App móvil (LAN)                                                                 │
│        │ http://<IP-LAN>:5173                                                                  │
│        ▼                                                                                       │
│  ┌───────────────┐   /api/*, /images/* (proxy)   ┌───────────────┐      ┌──────────────────┐  │
│  │ jadda_frontend│ ─────────────────────────────► │ jadda_backend │ ───► │   jadda_mysql    │  │
│  │ Vite :5173    │                                │ Express :5000 │      │ MySQL 8.0 :3306  │  │
│  └───────────────┘                                └───────────────┘      └──────────────────┘  │
│   imágenes públicas                              uploads (bind mounts)     volumen mysql_data  │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

El frontend actúa como puerta de entrada única: sirve la aplicación construida y hace proxy de `/api` y `/images` hacia el backend — los usuarios solo necesitan un puerto abierto (5173).

## 2. Modos de ejecución del frontend

| Modo | Variable | Qué hace | Uso |
|------|----------|----------|-----|
| Desarrollo | *(default)* | `pnpm dev` con HMR | Programación |
| **Producción local** | `MODE=preview` en `.env` raíz | `pnpm build && pnpm preview --host --port 5173` | Entrega/cliente: build optimizado servido por el propio contenedor |

> En modo `preview` el código TypeScript se compila y verifica (`tsc -b`) antes de publicar: si el build falla, el contenedor no publica una versión rota.

## 3. Despliegue paso a paso

### 3.1 Prerrequisitos

- Docker Desktop instalado y corriendo (ver `docs/manuales/manual-instalacion.md`).
- Puertos 3306/5000/5173 libres.

### 3.2 Instalación

```powershell
git clone <repo> ; cd "Proyecto Jadda Sports"   # o copiar carpeta
docker compose up -d --build
```

**Configuración previa recomendada** antes del primer arranque:

| Qué | Dónde | Variables |
|-----|-------|-----------|
| Credenciales de la base de datos | `docker-compose.yml` (deben coincidir entre los servicios `database` y `backend`) | `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Secreto de sesiones, correo SMTP, OAuth, admin seed, newsletter | `backend/.env` (crear desde `backend/.env.example`; está en `.gitignore`) | `SESSION_SECRET`, `EMAIL_USER/PASS`, `GOOGLE_*/FACEBOOK_*`, `ADMIN_EMAIL/PASSWORD`, `FRONTEND_URL` |
| URL de la API para la app móvil | `movil/.env` | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_FRONT_URL` |

> Nota: dentro de Docker, las variables del `environment:` del compose tienen prioridad sobre `backend/.env`. Fuera de Docker, manda el `.env`.

Primer arranque: `backend/database/setup.js` crea las 33 tablas, aplica migraciones idempotentes, siembra datos de referencia (catálogo, retos) y crea el usuario administrador con `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

### 3.3 Post-instalación obligatoria (seguridad)

1. **Crear el usuario de aplicación con menor privilegio** y verificar su salida:

```powershell
docker cp scripts\sql\usuarios-produccion.sql jadda_mysql:/tmp/users.sql
docker exec jadda_mysql sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD < /tmp/users.sql'
docker exec jadda_mysql sh -c 'rm -f /tmp/users.sql'
```

2. **Conmutar el backend a ese usuario** (operación normal): en `docker-compose.yml`, cambiar `DB_USER=root` por `DB_USER=jadda_app` y `DB_PASSWORD=tu_password_secreto` por la clave del script; luego `docker compose up -d backend`. Mantener root **solo para el primer arranque** (creación de esquema) o para mantenimiento.
3. Cambiar la contraseña del admin desde la aplicación (Perfil → Seguridad).
4. Rotar la clave de `jadda_app` periódicamente.

## 4. Publicación en la LAN

- Obtener la IP del servidor: `ipconfig` (ej. `192.168.137.1`).
- Los clientes acceden a `http://<IP>:5173`; la app móvil configura `EXPO_PUBLIC_API_URL=http://<IP>:5173` y `EXPO_PUBLIC_FRONT_URL=http://<IP>:5173`.
- Permitir el puerto en el firewall solo al perfil *Privado*:

```powershell
New-NetFirewallRule -DisplayName "JADDA Frontend" -Direction Inbound -Protocol TCP -LocalPort 5173 -Action Allow -Profile Private
```

- No exponer 3306 ni 5000 a Internet. HTTPS no aplica en LAN plana; si algún día se publica fuera, colocar un reverse proxy (Caddy/Nginx) con certificado delante de 5173 y cerrar el resto de puertos.

## 5. Checklist de verificación post-despliegue (smoke tests)

```powershell
# 1. Contenedores activos
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. Frontend responde (esperado: HTML 200)
curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:5173/

# 3. API a través del proxy (esperado: JSON de productos)
curl.exe -s http://localhost:5173/api/productos | more

# 4. Login admin (esperado: JSON con usuario)
curl.exe -s -X POST http://localhost:5000/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"email\":\"<ADMIN_EMAIL>\",\"password\":\"<ADMIN_PASSWORD>\"}"

# 5. Primer backup exitoso registrado
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```

## 6. Actualizaciones de versión

```powershell
powershell -File scripts\backup.ps1          # 1. respaldar SIEMPRE antes
git pull                                     # 2. traer nueva versión
docker compose up -d --build                 # 3. reconstruir; setup.js migra la BD al arrancar
```

## 7. Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| El frontend muestra errores de parseo viejos tras actualizar código | caché stale de Vite en Docker | `docker restart jadda_frontend` |
| Backend no levanta: `ER_ACCESS_DENIED` | credenciales BD incorrectas en compose/.env | Verificar que `MYSQL_ROOT_PASSWORD` coincida entre servicios; si usas `jadda_app`, validar con `SHOW GRANTS` |
| Imágenes nuevas no aparecen hasta reiniciar | Docker no propaga archivos nuevos al contenedor Vite al instante | Reiniciar `jadda_frontend` (el backend sí sirve `/images` siempre fresco vía express.static) |
| Puerto ocupado al hacer `up` | otro proceso usa 3306/5000/5173 | Detener el proceso o cambiar el mapeo de puertos en compose |
| Se perdieron todos los datos | se ejecutó `docker compose down -v` (borra el volumen) | Restaurar último backup (02-plan-migracion-respaldos.md §2.5); recrear admin con seed automático |
| `429 Too Many Requests` en login durante pruebas | rate limiter anti fuerza-bruta (10/min por IP) | Comportamiento esperado; esperar la ventana o ajustar en `middlewares/rateLimiter.js` |

## 8. Registro de despliegue

| Fecha | Versión/commit | Ejecutado por | Observaciones |
|-------|----------------|---------------|---------------|
| 2026-08-24 | rama principal | Equipo JADDA | Verificación completa: build OK, smoke tests OK, backup+restauración probados |
