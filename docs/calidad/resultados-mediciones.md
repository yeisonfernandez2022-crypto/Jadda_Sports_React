# Resultados de mediciones de rendimiento (RNF)

- **Fecha:** 2026-08-24 12:30:47
- **Entorno:** Windows local con Docker Desktop; frontend Vite preview/dev (:5173) y backend Express (:5000)
- **Metodo:** 10 peticiones por endpoint tras 1 calentamiento; tiempos en milisegundos medidos con Stopwatch

| Endpoint | Muestras | Promedio (ms) | Min (ms) | P95 (ms) | Max (ms) |
|----------|----------|---------------|----------|----------|----------|
| GET / (frontend HTML) | 10 | 19.7 | 15.6 | 28.8 | 28.8 |
| GET /api/productos (catalogo) | 10 | 39.6 | 34.3 | 51.2 | 51.2 |
| GET /api/productos/1 (detalle) | 10 | 23 | 18.1 | 29.9 | 29.9 |
| GET /api/productos/categorias | 10 | 20.4 | 17.5 | 29.2 | 29.2 |
| POST /api/auth/login | 10 | 91.5 | 5.2 | 147.3 | 147.3 |
| GET /api/auth/perfil (autenticado) | 10 | 23.7 | 19.2 | 34 | 34 |

## 2. Prueba de carga del stack de producción y sizing de servidor (2026-11-07)

- **Fecha:** 2026-11-07
- **Entorno:** stack de producción local (`deploy/compose.prod.yaml`) sobre Docker Desktop en el PC i5-11400H (6c/12t): nginx borde con TLS self-signed :443, frontend, backend Express :5000, MySQL 8.0.
- **Método:** rampa con script Node propio (clientes con keep-alive) sobre el mix de rutas realmente visitado — `/` (SPA), `/api/productos`, `/api/productos/1`, `/api/productos/categorias` — mientras `docker stats` muestreaba recursos (248 muestras). Deliberadamente SIN login/checkout bajo carga (rate limits de login 10/15 min y registro 5/15 min por diseño).
- **Propósito:** cerrar **MC-11 (utilización de recursos)** y **MC-12 (prueba de carga)** y dimensionar el servidor mínimo para la VM Oracle Cloud (ver `docs/implantacion/06-despliegue-oracle.md`).

### Rampa de clientes concurrentes (0 errores en todas las fases)

| Clientes concurrentes | RPS | P95 (ms) | Observación |
| --- | --- | --- | --- |
| 10 | 351 | 54 | lineal |
| 25 | 374–398 | 114–124 | **tope práctico** |
| 50 | 281–283 | 301–318 | cola crece, sin errores |

### Latencia base (1 cliente, p50)

| Ruta | P50 (ms) |
| --- | --- |
| GET / (SPA) | 1–2 |
| GET /api/productos | 14–19 |
| GET /api/productos/1 | 8–11 |
| GET /api/productos/categorias | 5 |

### Recursos bajo carga (248 muestreos)

| Contenedor | CPU media | RAM |
| --- | --- | --- |
| backend | ~20 % (≈0.4 vCPU) | máx 71.4 MiB |
| mysql | ~13 % | 415.9 MiB estable |
| nginx (borde) | ~5 % | — |
| frontend | ~0 % | 13.7 MiB |

- Stack en reposo: **486.6 MiB** (web 2.9 + frontend 13.7 + backend 54.4 + mysql 415.6); pico con carga: **504 MiB**, sin fuga de memoria (MySQL estable durante toda la rampa).
- Disco medido: MySQL prod desde cero **207 MB** · código del repo **11 MB** · `.git` **25 MB**.

### Conclusión — servidor mínimo y VM elegida

- **Piso real:** 1 vCPU + 1 GB RAM (con swap 4 GB) + ~12 GB disco + **0 GPU**. Cómodo: 2 GB RAM.
- **Rendimiento medido:** 0.4 vCPU sostienen ~374 rps con p95 114–124 ms (25 concurrentes).
- **VM elegida (Oracle Always Free):** **Ampere A1.Flex 1 OCPU / 6 GB** — ~2.5× el CPU y ~12× la RAM del stack medido; 3/4 de la cuota A1 (4 OCPU/24 GB) queda libre.

### Anexo — alternativa x86 `E2.1.Micro` (1/8 OCPU compartida, 1 GB RAM)

- El stack completo (486 MiB sobre kernel) cabe pero **justo**: exige **swap 4 GB**.
- El **build de imágenes** pica ~1.5–2 GB → riesgo de OOM durante `docker compose build`: construir fuera de la VM (buildx multi-arch) o ampliar la instancia solo para compilar.
- Rendimiento esperado en runtime comparable (el 0.4 vCPU medido ya era CPU real compartida del host), con arranque y builds notablemente más lentos.
- Conclusión: el A1 1/6 es superior y a la vez deja cuota libre; `E2.1.Micro` queda documentado como plan C.

