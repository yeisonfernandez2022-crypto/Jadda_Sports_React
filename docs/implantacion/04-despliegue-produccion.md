# Módulo A · Despliegue de producción (docker-compose.prod.yml)

> Estado: actualizado 2026-10-21. La topología de desarrollo
> (`docker-compose.yml`) queda intacta; este perfil es el que hay que usar para
> "lanzar a producción" en una máquina o LAN.

## 1. Qué cambia respecto al despliegue de desarrollo

| Riesgo (revisión) | En desarrollo (`docker-compose.yml`) | En producción (`docker-compose.prod.yml`) |
| --- | --- | --- |
| Código vivo montado (`./backend:/app`, `./frontend:/app`) | bind-mount, editable en caliente | **sin mounts de código** — imagen construida con `Dockerfile.prod` |
| Dependencias con `pnpm install` en cada arranque + `pnpm dev` (nodemon) | sí | **CMD directo** (`node server.js`, `vite preview`) con deps baked |
| Puertos 3306 (MySQL), 5000 (backend), 5173 (Vite) publicados en todas las interfaces | sí | **ninguno publicado** — solo nginx (80→443) |
| Código OTP (códigos a 15 min) | se guarda como hash bcrypt (60 chars, `USUARIOS.TOKEN VARCHAR(255)`) | igual |
| Datos de demostración | se insertan en cada arranque | **`DEMO_DATA=false` + `NODE_ENV=production`** → no se crean |
| Cookies de sesión | `secure:false` (HTTP) | `secure:true` (HTTPS terminado en nginx) |
| Secretos | `.env` con valores cómodos de dev | `.env`-raíz con `${VAR:?}` → el compose NO arranca sin: `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Admin semilla | `seedAdminUser` garantiza existencia (sin sobreescribir password, salvo `SEED_ADMIN_PASSWORD=true`) | requiere credenciales explícitas — el seed ya no tiene valores por defecto en el código |

## 2. Preparar la máquina

```bash
# 1) Clonar/actualizar y entrar en el proyecto
git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
cd Jadda_Sports_React

# 2) .env de la raíz CON los secretos obligatorios
cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=<password raiz proyectada>
DB_PASSWORD=<misma>
SESSION_SECRET=<64 hex>
ADMIN_EMAIL=<correo real del admin>
ADMIN_PASSWORD=<contraseña fuerte>
EOF

# Generar SESSION_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3) backend/.env (correo, Cloudinary, OAuth, FRONTEND_URL=https://<host>/,
#    y si habrá pasarela de pagos: PAYMENT_GATEWAY=wompi + WOMPI_* de PRODUCCIÓN
#    con WOMPI_EVENTS_SECRET apuntando a la URL de eventos https://<host>/api/pagos/webhook)
cp backend/.env.example backend/.env
#   → editar con el editor (el .env real no se versiona)

# 4) Certificados TLS (self-signed para LAN; sustituibles por CA real)
mkdir -p deploy/certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout deploy/certs/key.pem -out deploy/certs/cert.pem -subj "/CN=localhost"
```

Los navegadores pedirán aceptar el certificado self-signed una vez por equipo (o
instalar `cert.pem` en "Autoridades de certificación de confianza" del
equipo/cliente).

### 2.1. Pasarela de pagos: bloqueo al arranque (Fase 0 cierre-produccion)

En producción el backend se **niega a arrancar** si la pasarela no está
configurada completa (antes, un `PAYMENT_GATEWAY` vacío dejaba el checkout
silenciosamente en modo simulado: venta `COMPLETADA` con referencia `SIM_` SIN
cobro real). Requisito: `PAYMENT_GATEWAY=wompi` + `WOMPI_PUBLIC_KEY`,
`WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_KEY` y `WOMPI_EVENTS_SECRET`. Única
excepción, explícita y con aviso fuerte en el log: `ALLOW_SIMULATED_PAYMENTS=true`
(solo demostraciones junto a datos de prueba, NUNCA junto a dinero real). Si las
llaves son de SANDBOX (`pub_test_...`) arranca igual pero registra "cobrará con
DINERO DE PRUEBA" — es la demo actual, no producción real. La validación vive en
`backend/utils/pagos.js` (`validarPasarelaProduccion`, con 6 tests unitarios) y
se ejecuta en `server.js` dentro del bloque fail-fast de producción.

## 3. Levantar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker logs -f jadda_backend_prod   # ver "Setup de BD OK" / "Pool MySQL conectado"
```

Con las BD ya migradas (respaldo vía `scripts/backup.ps1` etc.) los datos
existentes (usuarios reales, Cloudinary URLs) se reciclan aprovechando el
volumen compartido `mysql_data` (referenciado por nombre literal
`proyectojaddasports_mysql_data` en el bloque `volumes`). **Baja el stack dev
con `docker compose down` antes**, para no tener dos MySQL sobre el mismo
volumen.

## 3.1. Recuerda que Linux es case-sensitive

El servidor de producción contiene imágenes basadas en Linux: una import
`./css/navbar.css` (N minúscula) resolvía en Windows pero fallaba el `vite
build` dentro del contenedor porque el archivo real es `Navbar.css`. Corregidos
(y verificado con un barrido case-check en todo `src/` en la prueba). Si un
build nuevo falla en Linux y no en tu PC, sospecha primero de mayúsculas/rutas.

## 3.2. `.dockerignore` (backend y frontend)

Los Dockerfile.prod hacen `COPY . .`; sin `.dockerignore`, el `node_modules`
del HOST (creado con pnpm de Windows, con symlinks/junctions con rutas
`C:\Users\...`) se copia al contenedor y rompe el arranque (`Cannot find
module 'express'`). Ambos carpetas ya tienen `.dockerignore` que excluye
`node_modules`, `.env`, `dist`, `data`, `uploads`, `.git` — mantenerlo si se
agregan carpetas nuevas. Bonus: excluye `backend/.env` del contexto, así las
credenciales reales NUNCA quedan horneadas en la imagen (llegan por
`env_file`/compose).

## 4. Smoke tests post-arranque

```powershell
curl.exe -k https://localhost/                     # SPA (vía nginx)
curl.exe -k https://localhost/api/productos        # proxy → backend
curl.exe -k -X POST https://localhost/api/auth/registro ... # flujo OTP comprobado en §5
```

## 5. Checklist de seguridad que este perfil resuelve

- [x] OTP unificado en hash bcrypt (`registro`, `reenvio`, `recuperar`,
      `cambiar correo`) + `TOKEN` VARCHAR(255) (migración idempotente).
- [x] Archivos privados con verificación de propiedad por recurso
      (`server.js`: perfil abierto a autenticados; retos/devoluciones solo
      dueño/vendedor/admin).
- [x] Demo data aislada (variables `DEMO_DATA=false`/`NODE_ENV=production`).
- [x] Subidas: 25 MB c/u, 5 archivos, MIME real + coherencia ext/mime.
- [x] Google OAuth web usa userinfo con accessToken (implementación oficial).
- [x] HTTPS en la puerta pública (nginx) + cookies Secure.
- [x] Defensa CSRF por verificación de Origin en mutaciones (2026-10-21, exenta para el móvil nativo; guía §3).
- [x] `trust proxy` — `req.ip` real detrás del proxy para rate limiting (2026-10-21; guía §5).
- [x] Cabeceras de seguridad idénticas en nginx y Caddy + `server_tokens off` (2026-10-21; guía §6).
- [x] Auditoría de dependencias en CI (`pnpm audit`, informativa; guía §10).
- [ ] Rotación/rotado de la contraseña admin real (acción del cliente).
- [ ] Certificado CA real si se publica a Internet (self-signed cubre LAN).
- [ ] Prueba de carga (MC-12, pendiente del plan de calidad).

> Guía completa: [`05-guia-seguridad.md`](05-guia-seguridad.md) · Inventario vivo de brechas: [`../auditoria/estado-brechas.md`](../auditoria/estado-brechas.md)

## 6. Alternativa de reverse proxy: Caddy (entregable S03)

Este perfil usa **nginx** como puerta pública. Desde la semana S03 el repo incluye
la alternativa **Caddy** (`deploy/Caddyfile` + `deploy/docker-compose.caddy.yml`) que
publica los MISMOS servicios por los dominios elegidos (`www.jaddasports.com`,
`api.jaddasports.com`) con certificados automáticos — `tls internal` para práctica
en LAN, o Let's Encrypt si se quita esa línea tras comprar el dominio.

Regla: **un solo gateway** con los puertos 80/443 del host. Para cambiar de nginx a
Caddy en la misma máquina:

```bash
docker compose -f docker-compose.prod.yml stop nginx    # liberar 80/443
docker network ls                                       # red del stack prod (jadda-prod_default)
$env:PROXY_NET = "jadda-prod_default"                   # PowerShell (bash: export PROXY_NET=…)
docker compose -f deploy/docker-compose.caddy.yml up -d
```

Detalle completo y prueba con `curl --resolve`: [entregable-s03-hosting-dominio.md](../entregables/entregable-s03-hosting-dominio.md).

## 7. Volver a desarrollo

```bash
docker compose -f docker-compose.prod.yml down   # NO usa -v aquí
docker compose up -d                              # re-corrige las imágenes dev si el build prod las pisó
```
