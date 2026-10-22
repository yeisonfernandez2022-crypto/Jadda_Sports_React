# Entregable S03 — Hosting, Dominio y Reverse Proxy (HTTPS)

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Semana / criterio | S03 — CE-1 (hosting, dominio, DNS, proxy inverso, HTTPS, transferencia de archivos) |
| Fecha | 2026-10-21 |

> Documento basado en la medición real de S01 (`entregable-s01-ficha-tecnica.md`) y en la
> infraestructura ya probada en S02 (`entregable-s02-planes.md`). Dominio elegido: **jaddasports.com**.
> Artefactos agregados al repositorio en esta entrega: `deploy/Caddyfile` y
> `deploy/docker-compose.caddy.yml`. La prueba se ejecutó con `tls internal` y `curl --resolve`,
> sin tocar el DNS del equipo.

---

## 4.1 Tipo de hosting elegido y justificación

**Decisión: hosting propio (on-premise, LAN de la tienda) sobre equipo torre con Docker.**

| Criterio | Hosting propio (elegido) | VPS en nube (alternativa) |
|---|---|---|
| Costo inicial | Equipo ya disponible (verificado en S01) | VPS 4 vCPU / 8 GB: USD 25–40/mes (~COP 100.000–160.000) |
| Costo recurrente | Energía + dominio (~USD 15/año) | VPS + dominio + backups gestionados |
| Latencia para los clientes | Mínima (LAN/localidad) | Depende de región e Internet |
| Control y datos | Total: la BD y `.env` nunca salen de la oficina | Depende del proveedor |
| Responsabilidad de hardware | Del equipo JADDA (UPS, RAID 1 según S01 §1.6) | Del proveedor (SLA) |
| Publicación a Internet | Requiere configurar router/CAA/CA real | Incluida |
| Escala real del sistema | 3 contenedores, 1 GiB de RAM en reposo (S01 §1.4) | Sobre-aprovisionamiento inicial |

Justificación de la elección: la medición S01 muestra un sistema pequeño (1,18 GiB de RAM pico con
20 usuarios concurrentes) y los clientes (vendedores/familias) operan desde la misma red local;
un servidor dedicado en la tienda deja el despliegue íntegramente en Docker, igual que
durante el desarrollo — mismo `docker-compose`, mismos procesos (S02 §5). Si en el futuro la
tienda decide vender fuera de la LAN, la ruta de crecimiento es bien definida: mover el mismo
proyecto a un VPS (Ubuntu Server 24.04 LTS, recomendado en S01 §1.3) **sin cambiar una línea del
proyecto**, solo la puerta de entrada — el reverse proxy funciona igual en LAN y en la nube.

## 4.2 Dominio elegido y subdominios

| Dominio/subdominio | Programa | Justificación |
|---|---|---|
| **`jaddasports.com`** | Dominio raíz (registrador) | Nombre de la tienda, fácil de memorizar y dueño de la marca |
| **`www.jaddasports.com`** | Tienda (SPA) | Entrada del cliente en el navegador; es la convención |
| **`api.jaddasports.com`** | API REST directa | La app móvil y futuras integraciones consumen el API sin pasar por la SPA |

Registro del dominio: aún no comprado (decisión y pago corresponden al cliente). Este documento
**elige** el nombre y deja la configuración lista. Antes de registrarlo hay que verificar
disponibilidad en un registrador (`whois jaddasports.com`) y presupuestar la renovación anual.
**No se publica ninguna dirección IP ni credencial real en este repositorio.**

### 4.2.1 Registros DNS planeados (al comprar el dominio)

| Tipo | Nombre | Valor | Uso |
|---|---|---|---|
| A | `jaddasports.com` | IP pública del servidor | redirección al www |
| A | `www` | IP pública del servidor | Tienda web |
| A | `api` | IP pública del servidor | API directa |
| CAA | `.` (o por subdominio) | `letsencrypt.org` (+ el emisor elegido) | Restringe **quién puede emitir** certificados HTTPS |
| TXT (opcional) | `default._domainkey` | `v=DKIM1 …` | Firma DKIM del correo transaccional (Nodemailer) |

Mientras el dominio no existe en la nube, **las pruebas locales usan `curl --resolve`**, que
resuelve el nombre de destino por debajo del DNS del sistema operativo (§4.6). En el servidor
de la tienda (LAN) es suficiente con que el DNS interno del router o el `hosts` de los PCs de
servicio apunten los subdominios a la IP interna — mismas líneas del §4.6.

## 4.3 Método de transferencia de archivos

Es el mismo definido en S02 §5 y probado ese día:

1. **Código y configs versionadas:** `git clone https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git` en el destino — el `Caddyfile`, los `docker-compose*` y todo lo demás viajan dentro del repo.
2. **Secretos que no viven en git:** `backend/.env` (y `.env`-raíz para prod) viajan por canal
   externo seguro (manager de contraseñas / chat privado); el repo solo trae placeholders.
3. **Medios:** NO se copian — las URLs absolutas ya viven en la BD y apuntan a la cuenta
   Cloudinary, fuente única de los assets (Fase 5: el repo ya no versiona media,
   ~66,9 MiB eliminados; quedan solo `.gitkeep` para los bind-mounts de subidas).
4. **BD:** dump de `scripts/respaldar.sh` restaurado según S02 §3.4 (opcional, si el destino hereda datos).

Las imágenes Docker no se "trasladan": **se construyen en el destino** con los contextos
`backend/` y `frontend/` (buena práctica: la imagen guarda código, no binarios sueltos).

## 4.4 Reverse proxy — Caddy (agregado en esta entrega)

Elección: **Caddy** como proxy inverso de la puerta de entrada, configuración equivalente al
`deploy/nginx.conf` del perfil de producción (que ya se probó puerta a puerta en el módulo A).

| Aspecto | Caddyfile (este entregable) | nginx.conf (Módulo A) |
|---|---|---|
| Configuración | 1 archivo declarativo (~40 líneas) | 1 archivo con bloques proxy/TLS |
| Certificados | **Automáticos**: `tls internal` (práctica) o Let's Encrypt al quitar la línea — sin OpenSSL manual | Manual con OpenSSL (`deploy/certs/*.pem`) |
| HTTP → HTTPS | Automático (308 permanente) | Configurado a mano |
| HTTP/2 / compresión | Automático (`encode`) | Configurado a mano |
| Backend publicado | `frontend:5173` (SPA), `backend:5000` (API) | Idéntico (misma topología) |

**Archivos agregados al repositorio:**

- `deploy/Caddyfile` — declara los dos sitios con los dominios elegidos, `tls internal`,
  cabeceras de seguridad, compresión, y redirige el tráfico a los **nombres de servicio de
  compose** (los mismos en los stacks dev y prod: `frontend:5173` y `backend:5000`).
- `deploy/docker-compose.caddy.yml` — servicio `caddy` (`caddy:2-alpine`) con los puertos
  **80 (redirección) y 443 (HTTPS)**, volúmenes `caddy_data` (CA local + certificados) y
  `caddy_config`, conectado a la red **existente** del stack (externa) por nombre, para que el
  proxy sea puerta de entrada TANTO en desarrollo como en producción sin tocar nada:

```bash
    # Desarrollo: sin variables — la red y los upstreams valen los valores por defecto
    docker compose -f deploy/docker-compose.caddy.yml up -d

    # Producción (si el stack corrió como jadda-prod): apuntar a SU red
    docker network ls                                  # obtener el nombre real
    export PROXY_NET=jadda-prod_default                # bash  (PowerShell: $env:PROXY_NET="jadda-prod_default")
    docker compose -f deploy/docker-compose.caddy.yml up -d
```

Regla de convivencia: **un solo gateway**. Si el perfil de producción corre con nginx, detener
el servicio `nginx` antes de subir Caddy (o viceversa): ambos toman los puertos 80 y 443 del host.

La topología queda: `Internet/LAN → Caddy (443) → frontend:5173 (SPA, proxea /api e /images al
backend) y → backend:5000 (API directa para `api.*` y la app móvil)`.

## 4.5 HTTPS con `tls internal`

- Caddy mantiene una **CA interna propia** (`Caddy Local Authority`): en la primera corrida
  genera la raíz + certificado leaf con el CN de cada dominio declarado — sin OpenSSL ni
  configuración manual.
- Al detectar certificados de CA interna, curl requiere `-k` (o confiar la raíz,
  que es lo que se verifica en §4.6 sin `-k`).
- Cabeceras de seguridad que el proxy agrega: `Strict-Transport-Security` (HSTS, 180 días),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`, suprime `Server`.
- Camino a la publicación real (S04): con `jaddasports.com` comprado —
  1) quitar la línea `tls internal` del Caddyfile (Caddy emitiría Let's Encrypt automático; requiere los 80/443 publicados en Internet),
  2) apuntar los registros DNS (§4.2.1) a la IP pública del servidor,
  3) dejar el registro CAA restringido a `letsencrypt.org` (§4.2.1).

## 4.6 Prueba local `tls internal` + `curl --resolve` (EVIDENCIA REAL)

### 4.6.1 Preparación

Stack de desarrollo levantado (contenedores `jadda_mysql`, `jadda_backend`, `jadda_frontend`).
Nota honesta del entorno: la máquina venía **sin volúmenes Docker previos** (se limpió en unas
pruebas de espacio del módulo A), por lo que en el arranque `setup.js` recreó la BD completa con
seeds de referencia — comportamiento documentado del proyecto (S02: "docker compose down -v …
setup.js recrea tablas + seeds") y **sin datos de clientes**. Se corrigió además un fallo real
que la prueba reabrió: un comentario `//` (sintaxis JS) quedó **dentro del SQL en crudo** de
`setup.js` (definición de `USUARIOS`) → cambiado a `--` (MySQL solo acepta `#`, `-- ` y
`/* */`). El lote fallaba con `ER_PARSE_ERROR` en TODOS los arranques (30 reintentos ≈ 3–4 min
y luego `server.js` continúa: "Setup falló pero se continúa"), pero en BD ya creadas pasaba
inadvertido porque las tablas existían; con la BD vacía SÍ habría roto el
sistema (sin tablas, APIs 500 y sin seeds). El mismo comentario llegó a `schema.sql` (línea
42, copiado por `exportarSchema.js`) y también está corregido — el archivo se regeneró con
`node backend/database/exportarSchema.js` (hubiese fallado igual al importarlo en Workbench).

Durante la prueba se descubrió y corrigió un segundo ajuste real del repo: **Vite/Preview
rechazaban el Host del dominio** con 403 "Blocked request. This host is not allowed" →
`allowedHosts: ['www.jaddasports.com','jaddasports.com','api.jaddasports.com']` en
`frontend/vite.config.ts` (secciones `server` y `preview` — indispensable para producción con
dominio real).

```
$ docker compose -f deploy/docker-compose.caddy.yml up -d
[+] Running 3/3 ✔ Volume "jadda-caddy_caddy_data" Created  ✔ Volume "jadda-caddy_caddy_config" Created  ✔ Container jadda_caddy  Started

$ docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
NAMES           STATUS                    PORTS
jadda_caddy     Up 28 seconds             0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
jadda_frontend  Up 15 minutes             0.0.0.0:5173->5173/tcp
jadda_backend   Up 15 minutes             0.0.0.0:5000->5000/tcp
jadda_mysql     Up 15 minutes (healthy)   0.0.0.0:3306->3306/tcp

# Primer arranque del contenedor (log de jadda_caddy, extracto):
{"level":"info","logger":"pki.ca.local","msg":"installing root certificate …","path":"storage:pki/authorities/local/root.crt"}
{"level":"info","logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"jaddasports.com","issuer":"local"}
{"level":"info","logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"www.jaddasports.com","issuer":"local"}
{"level":"info","logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"api.jaddasports.com","issuer":"local"}
{"level":"info","msg":"serving initial configuration"}
```

La CA local quedó persistida en el volumen `caddy_data` de Docker (los reinicios del contenedor
NO re-emitieron certificados ni pidieron confiar la raíz de nuevo).

### 4.6.2 Pruebas

| # | Caso | Comando | Resultado esperado |
|---|---|---|---|
| 1 | SPA por HTTPS con dominio de la tienda | `curl -k --resolve www.jaddasports.com:443:127.0.0.1 https://www.jaddasports.com/` | 200 + HTML de la SPA |
| 2 | API por el dominio de la tienda | `curl -k --resolve www.jaddasports.com:443:127.0.0.1 https://www.jaddasports.com/api/productos` | 200 + JSON |
| 3 | API por su propio subdominio | `curl -k --resolve api.jaddasports.com:443:127.0.0.1 https://api.jaddasports.com/api/productos` | 200 + JSON |
| 4 | Redirección HTTP → HTTPS | `curl -s -o NUL -w "%{http_code} -> %{redirect_url}" --resolve www.jaddasports.com:80:127.0.0.1 http://www.jaddasports.com/catalogo` | 308 → https://… |
| 5 | Certificado emitido para el dominio | `openssl s_client -connect 127.0.0.1:443 -servername www… \| openssl x509 -noout -issuer -dates -ext subjectAltName` | issuer `Caddy Local Authority`, SAN = dominio |
| 6 | Cadena TLS válida SIN `-k` (confiando la raíz) | `docker exec jadda_caddy sh -c 'cat /data/caddy/pki/authorities/local/root.crt'` + `openssl s_client … -CAfile` | `Verify return code: 0 (ok)` |
| 7 | Cabeceras de seguridad del proxy | `curl -sk -D - -o NUL … \| grep -Ei 'strict-transport\|x-content…'` | HSTS + nosniff + Referrer + X-Frame |
| 8 | Persistencia tras reiniciar el gateway | `docker restart jadda_caddy` → repetir prueba 2 | 200 (la CA re-usa el volumen) |

> Nota de la corrida: el `curl` de Windows (Schannel) no imprime subject/issuer con `-v` y su
> `--cacert` es limitado, por lo que las pruebas 5 y 6 se hicieron con **openssl** (incluido en
> Git for Windows) — mismo objetivo, evidencia más completa. DOMINIO RAÍZ (extra, no pedido):
> `curl --resolve jaddasports.com:443:127.0.0.1 https://jaddasports.com/api/productos` →
> **301 → https://www.jaddasports.com/api/productos** (el sitio raíz del Caddyfile).

```
== 1. SPA por HTTPS con dominio de la tienda (www.jaddasports.com)
HTTP 200 · text/html · 709 bytes
title: <title>Jadda Sports</title>

== 2. API por el dominio de la tienda (www.../api/productos)
HTTP 200 · application/json; charset=utf-8 · 52594 bytes
muestra: [{"ID":1,"NOMBRE":"Guayos profesionales","PRECIO":"220000.00","MARCA":"Adidas",...

== 3. API por su propio subdominio (api.jaddasports.com)
HTTP 200 · application/json; charset=utf-8 · 52594 bytes
muestra: [{"ID":1,"NOMBRE":"Guayos profesionales","PRECIO":"220000.00","MARCA":"Adidas",...

== 4. Redirección HTTP -> HTTPS (puerta 80)
308 -> https://www.jaddasports.com/catalogo

== 5. Certificado emitido (issuer/validez vía openssl)
issuer=CN=Caddy Local Authority - ECC Intermediate
notBefore=Oct 21 18:06:12 2026 GMT
notAfter=Oct 22 06:06:12 2026 GMT
X509v3 Subject Alternative Name: critical
    DNS:www.jaddasports.com

== 6. Cadena TLS válida SIN -k (confiando la raíz extraída del contenedor)
root.crt bytes: 627
  -> www.jaddasports.com: verificación de cadena OK (2/2 s_client con Verify=0)
  -> api.jaddasports.com: verificación de cadena OK (2/2 s_client con Verify=0)

== 7. Cabeceras de seguridad agregadas por Caddy
HTTP/1.1 200 OK
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=15552000
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN

== 8. Persistencia tras reiniciar el gateway  (docker restart jadda_caddy)
tras reinicio: HTTP 200
```

Todo el tráfico de la tienda pasa por los dominios elegidos: **SPA, /api e /images vía
`www.*`; API directa vía `api.*` — con HTTP→HTTPS obligatorio y sin cabecera `Server`**.

### 4.6.3 Cómo verla en el navegador (opcional, LAN)

1. Añadir al `hosts` del cliente (`C:\Windows\System32\drivers\etc\hosts`):
   `127.0.0.1  www.jaddasports.com api.jaddasports.com` (o la IP LAN del servidor).
2. Instalar la CA raíz de Caddy en el equipo cliente (con `certutil -addstore -f Root
   caddy-root.crt` como administrador): después el candado del navegador queda verde sin avisos.
3. Navegar `https://www.jaddasports.com` — sirve la SPA; la API por `https://api.jaddasports.com`.

*No ejecutado en esta corrida: agregar `hosts`/instalar la CA requiere permisos de
administrador; queda como procedimiento del instalador (§4.6.2 prueba todo por `--resolve`).*

## 4.7 Resultado del criterio de la semana (CE-1)

| Criterio | ¿Cumple? | Evidencia |
|---|---|---|
| Tipo de hosting y justificación | ✅ | §4.1 (decisión medida con S01) |
| Dominio elegido | ✅ | §4.2 `jaddasports.com` + subdominios |
| Registros DNS | ✅ | §4.2.1 (planeados, simbólicos) + `--resolve` en la práctica |
| Reverse proxy | ✅ | §4.4 `deploy/Caddyfile` (Caddy) coherente con nginx del módulo A |
| HTTPS | ✅ | §4.5 + §4.6 con `tls internal` |
| Método de transferencia de archivos | ✅ | §4.3 (git + canal externo de secretos; S02 §5) |

## 4.8 Pendientes hacia producción

| Acción | Responsable | Cuándo |
|---|---|---|
| Comprar `jaddasports.com` y apuntar los registros DNS (§4.2.1) | Administrador de la tienda | S04 (antes de publicar a Internet) |
| Elegir gateway definitivo (nginx o Caddy) y quitar `tls internal` para Let's Encrypt | Líder técnico | S04 |
| CA raíz de Caddy instalada en los PCs del cliente (o CA real) | DevOps de guardia | Al capacitar (S08) |
| Firewall público: solo 80/443 abiertos al ser publicados | Líder técnico | S04 |

---

## 4.9 Preguntas y respuestas del entregable

### P1. ¿Qué componentes tiene tu proyecto y cuál es el tipo de hosting adecuado para cada uno?

| Componente | Tipo de hosting adecuado | Decisión aquí | Por qué |
|---|---|---|---|
| SPA web (React, build servido como archivos) | Detrás de un proxy con HTTPS, mismo host o hosting estático | Contenedor `frontend` en el servidor propio, tras el proxy | Es la puerta del cliente y debe proxtar `/api` e `/images`; en LAN un solo host simplifica |
| API REST (Node/Express) | Proceso Docker con proxy delante (on-premise o VPS) | Contenedor `backend` en el servidor propio | Acceso directo a MySQL y sesiones; nunca expuesto directo a Internet |
| MySQL 8.0 | BD local con volumen + respaldos (S02) | Volumen `mysql_data` en el servidor propio | Los datos no salen de la oficina; una BD gestionada tendría costo y expondría datos por red pública |
| Medios (344 assets) | SaaS con CDN | Cloudinary (plan gratuito ya activo) | El CDN cachea y sirve URLs absolutas; el repo solo guarda `.gitkeep` (sin binarios que portar) |
| Correos transaccionales | SMTP del proveedor | Gmail + Nodemailer | Auto-hospedar SMTP es inviable por reputación/blacklists |
| Dominio y DNS | Registrador + zona DNS | `jaddasports.com` (por comprar, §4.2) | Único componente 100 % externo obligatorio para publicar |

Todos los componentes propios viajan como el mismo proyecto Docker ya probado (S02 §5); si la tienda escala fuera de la LAN, el mismo set corre en un VPS sin cambiar una línea (§4.1).

### P2. ¿Qué nombre de dominio usará el cliente y quién lo pagará y renovará?

En esta entrega se **elige y deja probado** el dominio **`jaddasports.com`** con `www.jaddasports.com` (tienda) y `api.jaddasports.com` (API directa para la app móvil) — §4.2. **Todavía no está registrado**: en las pruebas existió como nombre simulado con `curl --resolve` (§4.6) sin tocar el DNS real.

Quién lo paga y renueva: el **dueño del negocio (administrador de la tienda)**, y hay que registrarlo **a su nombre** — los datos del titular del dominio deben ser del cliente, no del desarrollador, para que el activo (marca, correo con el dominio, DNS) quede del lado del negocio incluso si cambia de equipo técnico. El rol técnico (líder/DevOps) **gestiona** los registros DNS y el certificado, no la propiedad. Presupuesto de referencia ya colocado en §4.1: ~USD 15/año (a confirmar con el registrador elegido al momento de comprar, verificación previa con `whois`).

### P3. ¿Qué puertos de tu servidor deben quedar abiertos a Internet y cuáles no?

Hacia Internet solo quedan abiertos **80 y 443, y ambos sobre la puerta única del reverse proxy** (Caddy o nginx — nunca ambos, §4.4):

| Puerto | Servicio | ¿Abierto a Internet? | Justificación |
|---|---|---|---|
| 80/TCP | HTTP del proxy | Sí (solo redirección 308 → HTTPS) | Estándar web; el proxy responde con HSTS y redirige |
| 443/TCP | HTTPS del proxy | **Sí — única puerta** | SPA (www), API e imágenes (www y api) llegan todas por aquí |
| 5000/TCP | Backend Express | **No** | Solo escucha en la red interna de Docker; el cliente nunca habla directo con él |
| 5173/TCP | Frontend (Vite preview) | **No** | Interno; el acceso en producción es vía proxy |
| 3306/TCP | MySQL | **Nunca a Internet** | En producción el servicio ni siquiera publica el puerto (compose prod sin mapeos); en desarrollo queda limitado a la LAN administrativa |

Evidencia verificada en el módulo A: `docker-compose.prod.yml` deja expuestos únicamente 80/443 (nginx), mientras backend, frontend y BD corren sin puertos publicados y solo son alcanzables por la red interna de Docker. Al publicar (S04) el router/NAT del cliente debe reenviar **solo** 80/443 al servidor.

### P4. ¿Qué archivos, además de la imagen o el código, hay que llevar al servidor? ¿Cómo?

| Qué se lleva | Método | Autenticación / custodia |
|---|---|---|
| Código + configs del proxy + `docker-compose*` | `git clone` (todo el repo, §4.3) | HTTPS/SSH del repositorio |
| Secretos reales: `backend/.env` y `.env` raíz de prod | **Canal externo seguro** (manager de contraseñas / archivo cifrado) — **nunca git** | Solo el líder técnico los entrega; el repo trae placeholders |
| Base de datos (si el destino hereda datos) | Dump de `scripts/respaldar.sh` + restauración S02 §3.4 | Acceso al contenedor MySQL del destino |
| Certificados (solo si se usa nginx) | `deploy/certs/*.pem` por canal cifrado; con Caddy **no hay que llevar nada** (Let's Encrypt automático o CA local autogenerada en volumen) | DevOps de guardia |
| Medios (imágenes/videos) | **No se copian**: los 344 assets viven en Cloudinary; el repo solo guarda `.gitkeep` en las carpetas de subidas (sin binarios que llevar) | — |
| Imágenes Docker | Se **construyen en el destino** (`docker compose up -d`): la imagen guarda código, no binarios sueltos | — |
