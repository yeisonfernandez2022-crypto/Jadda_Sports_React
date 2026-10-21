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
| Admin semilla | `seedAdminUser` garantiza existencia (sin sobreescribir password, salvo `SEED_ADMIN_PASSWORD=true`) | requiere credenciales explícitas — sin default `yeison/Losquiero7` |

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

# 3) backend/.env (correo, Cloudinary, OAuth, FRONTEND_URL=https://<host>/)
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
- [ ] Rotación/rotado de la contraseña admin real (acción del cliente).
- [ ] Certificado CA real si se publica a Internet (self-signed cubre LAN).
- [ ] Prueba de carga (MC-12, pendiente del plan de calidad).

## 6. Volver a desarrollo

```bash
docker compose -f docker-compose.prod.yml down   # NO usa -v aquí
docker compose up -d                              # re-corrige las imágenes dev si el build prod las pisó
```
