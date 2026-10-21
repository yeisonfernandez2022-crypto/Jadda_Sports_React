# Entregable S01 — Ficha Técnica y Matriz de Requisitos

| Campo | Valor |
|---|---|
| Proyecto | JADDA SPORTS — plataforma e-commerce de artículos deportivos |
| Equipo | Equipo de Desarrollo JADDA Sports |
| Fecha | 2026-10-20 |
---

## 1.1 Descripción técnica

JADDA SPORTS es una plataforma de comercio electrónico de artículos deportivos con marketplace de vendedores. Está construida como una arquitectura de tres capas: una SPA en React + TypeScript servida por Vite, una API REST en Node.js + Express y una base de datos MySQL 8, todo orquestado con Docker Compose. Incluye catálogo, carrito, checkout, pedidos, facturación PDF, devoluciones, retos con cupones, chat de soporte, reportes, panel administrativo y una app móvil opcional en Expo. La usan visitantes, clientes, vendedores y administradores.

## 1.2 Inventario de software

| Componente | Función | Versión | Licencia | ¿Genera costo? |
|---|---|---|---|---|
| Windows 11 Home Single Language | Sistema operativo anfitrión | 25H2, build 10.0.26200 | Microsoft EULA / OEM | Sí (licencia incluida en el equipo) |
| Docker Desktop + Docker Engine | Motor de contenedores y VM WSL2 | 29.5.2 | Apache-2.0 en componentes; acuerdo comercial de Docker Desktop | No para uso académico; puede requerir suscripción en empresas grandes |
| Docker Compose | Orquestación de contenedores | v5.1.3 | Apache-2.0 | No |
| MySQL Community | Base de datos relacional | 8.0.46 | GPLv2 | No |
| Node.js | Runtime del backend | 22.23.0 | MIT | No |
| pnpm | Gestor de paquetes | 11.8.0 | MIT | No |
| Express | Framework de la API REST | 5.2.1 | MIT | No |
| React + React DOM | Interfaz web (SPA) | 19.2.4 | MIT | No |
| Vite | Servidor de desarrollo y build del frontend | 8.0.1 | MIT | No |
| TypeScript | Verificación de tipos del frontend | 5.9.3 | Apache-2.0 | No |
| Cloudinary Node SDK | Almacenamiento de imágenes y videos en la nube | 2.11.0 | MIT (SDK); servicio comercial | Sí, solo si se supera el plan gratuito |
| Nodemailer | Envío de correos transaccionales | 8.0.3 | MIT | No (el proveedor SMTP puede cobrar) |
| PDFKit + ExcelJS | Generación de facturas PDF y reportes Excel | 0.19.1 / 4.4.0 | MIT | No |
| Expo SDK | App móvil opcional (React Native) | 54.0.34 | MIT | No |
| Bootstrap + SweetAlert2 | Estilos y diálogos del frontend | 5.3.8 / 11.26.25 | MIT | No |

## 1.3 Sistema operativo del servidor

| Campo | Valor |
|---|---|
| Distribución y versión | Windows 11 Home Single Language, versión 25H2, build 10.0.26200 |
| Arquitectura | x86-64 |
| Fin de soporte estándar | 12 de octubre de 2027 (Windows 11 25H2, ediciones Home/Pro) |
| Licencia | Microsoft EULA / licencia OEM incluida en el equipo |
| Requisitos mínimos oficiales (enlace) | [Windows 11 specifications](https://www.microsoft.com/windows/windows-11-specifications): CPU de 2 núcleos de 64 bits, 4 GB RAM, 64 GB de disco, UEFI con Secure Boot y TPM 2.0 |

El equipo verificado supera ampliamente esos mínimos: i5-11400H de 6 núcleos/12 hilos, 23,8 GB de RAM y 177,9 GB libres. Para un servidor dedicado se recomienda **Ubuntu Server 24.04 LTS** (soporte estándar hasta abril de 2029), porque evita la capa WSL2, reduce el consumo de recursos y facilita el endurecimiento del sistema; esta implantación se realizó sobre Windows 11 + Docker Desktop por ser el equipo disponible.

## 1.4 Medición de consumo

Medición realizada con `docker stats --no-stream` sobre los tres contenedores, con el frontend en modo desarrollo (Vite/HMR) y sin usuarios concurrentes en reposo. Los porcentajes de CPU son relativos a un núcleo; el equipo tiene 12 hilos lógicos.

| Servicio | RAM reposo | RAM pico | CPU pico |
|---|---|---|---|
| `jadda_backend` (Express) | 145,7 MiB | 317,6 MiB | 261,81 % (2,62 núcleos) |
| `jadda_mysql` (MySQL 8.0) | 372,5 MiB | 375,1 MiB | 88,78 % |
| `jadda_frontend` (Vite dev) | 511,3 MiB | 512,5 MiB | 49,62 % |
| **Total** | **1.029,5 MiB (1,01 GiB)** | **1.204,8 MiB (1,18 GiB)** | **398,03 % (≈4,0 núcleos)** |

Carga simulada con: **8.000 peticiones GET `/api/productos/categorias`, 20 concurrentes, durante 15,59 s (513,2 req/s), con 0 errores**. El pico de CPU se alcanzó durante esa prueba; la RAM pico corresponde al mismo período. Docker Desktop limita la VM a 11,57 GiB de los 23,8 GB del host. En modo `MODE=preview` (build de producción) el consumo de CPU del frontend será menor que el medido en desarrollo.

## 1.5 Matriz de requisitos

| Requisito | Mínimo | Recomendado | Justificación |
|---|---|---|---|
| CPU | 4 vCPU | 6 vCPU | Pico medido de 4,0 núcleos con 20 usuarios concurrentes; 6 vCPU = pico + 50 % de margen |
| RAM | 8 GB | 16 GB | Contenedores: 1,18 GB en pico + 4–6 GB de Windows/Docker/WSL2 + margen para builds y backups; 16 GB evita swapping |
| Disco | 40 GB libres | 80 GB SSD | Docker consumió 35,3 GB (imágenes 17,65 + volúmenes 2,94 + caché de build 14,68); 40 GB es el mínimo realista y 80 GB cubre backups y crecimiento |
| Tipo de disco / IOPS | SSD SATA/NVMe, 1.000 IOPS | SSD NVMe, 3.000+ IOPS | MySQL y la carga de imágenes/catálogo se benefician de baja latencia; el build de Docker también es intensivo en I/O |
| Red | LAN 100 Mbps | LAN 1 Gbps | El catálogo y las imágenes se sirven por LAN; se requiere internet solo para SMTP, Cloudinary y OAuth |
| Arquitectura | x86-64 | x86-64 | Imágenes Docker, binarios de Node/MySQL y el equipo verificado son x86-64; no se probó ARM |
| Sistema operativo | Windows 11 64-bit + WSL2 | Ubuntu Server 24.04 LTS | Windows 11 Home funciona para la implantación local; Ubuntu reduce overhead y facilita administración en servidor dedicado |
| Docker / runtime | Docker Engine ≥ 24 + Compose v2 | Docker 29.5.2 + Compose v5.1.3 | Versiones probadas y compatibles con el `docker-compose.yml` del proyecto |
| Puertos | 5173/TCP (LAN) | 5173/TCP + reverse proxy 443 si se publica | El frontend hace proxy de `/api` e `/images`; 5000 y 3306 deben quedar solo en localhost/LAN administrativa |
| Crecimiento estimado | — | — | 100 pedidos/mes × ~10 KB ≈ 1 MB/mes de BD; 20 productos/mes × 3 imágenes × 300 KB ≈ 18 MB/mes; a 12 meses: ~12 MB de BD y ~216 MB de imágenes, más respaldos |

> Nota: el documento `01-preparacion-plataforma.md` indica 20 GB de disco como mínimo teórico. La medición real de Docker (35,3 GB con caché de build) obliga a elevar el mínimo de esta ficha a 40 GB; el caché puede purgarse con `docker system prune`, pero no debe asumirse en producción.

## 1.6 Plataforma física recomendada

| Decisión | Elección | Justificación |
|---|---|---|
| Formato (torre / rack / blade) | Torre o mini-torre para oficina; rack 1U si el cliente dispone de datacenter | Solo se ejecutan tres contenedores; una torre es suficiente, silenciosa y fácil de mantener |
| Nivel RAID del servidor de base de datos | RAID 1 con 2 SSD (RAID 10 si supera 50 usuarios concurrentes) | Tolerancia a fallo de un disco sin sacrificar el rendimiento de MySQL; los backups siguen siendo obligatorios |
| Plataforma de ejecución (bare metal / VM / contenedores) | Bare metal con Docker Desktop/WSL2 en la implantación actual; VM con Docker en Hyper-V/Proxmox para un servidor dedicado | La VM permite snapshots y aislamiento; los contenedores mantienen la portabilidad del despliegue |
| Alimentación | UPS de 650 VA como mínimo | Evita apagados bruscos que puedan corromper el volumen de MySQL o perder la última transacción |

## 1.7 Verificación de requisitos

Script: `scripts/verificar-requisitos.sh` del repositorio del proyecto.

Servidor donde se ejecutó: equipo de producción local con Windows 11 + Docker Desktop (nombre real del host omitido; se usó la etiqueta sintética `servidor-local-jadda`). El script se ejecutó con Git Bash porque el host no tiene WSL con una distribución Linux completa.

```
=====================================================================
 JADDA SPORTS - VERIFICACION DE REQUISITOS MINIMOS (S01)
 Fecha: 2026-10-20 21:43:13
 Equipo: servidor-local-jadda
=====================================================================
 Umbrales: CPU >= 4 nucleos | RAM >= 8 GB | Disco libre >= 40 GB
           Docker >= 24 | Docker Compose >= v2

1. Sistema operativo y arquitectura
  [INFO]  Sistema operativo: Microsoft Windows 11 Home Single Language build 26200
  [INFO]  Arquitectura: x86_64 | Entorno de script: Git Bash/MSYS2
  [OK]   Arquitectura x86-64 soportada
  [OK]   Plataforma compatible con Docker (Linux/WSL2 o Windows con Docker Desktop)

2. Procesador
  [INFO]  Nucleos logicos disponibles: 12
  [OK]   CPU cumple el minimo (>= 4 nucleos)

3. Memoria RAM
  [INFO]  RAM total: 23.8 GB
  [OK]   RAM cumple el minimo (>= 8 GB)

4. Disco
  [INFO]  Espacio libre en la unidad del repositorio: 177.9 GB
  [OK]   Disco cumple el minimo (>= 40 GB libres)

5. Docker y Docker Compose
  [INFO]  Docker CLI: 29.5.2
  [OK]   Docker cumple el minimo (>= 24)
  [OK]   Docker daemon disponible
  [INFO]  Docker Compose: v5.1.3
  [OK]   Docker Compose cumple el minimo (>= v2)

6. Archivos base del repositorio
  [OK]   Existe docker-compose.yml
  [OK]   Existe backend/package.json
  [OK]   Existe backend/database/setup.js
  [OK]   Existe backend/.env.example
  [OK]   Existe frontend/package.json
  [OK]   Existe frontend/public/images
  [OK]   Existe scripts/backup.ps1
  [OK]   Existe scripts/verificar-requisitos.sh
  [OK]   Existe backend/.env (configuracion local)
  [INFO]  CLOUDINARY_URL configurada (almacenamiento en la nube)

7. Servicios y puertos de JADDA (si estan desplegados)
  [OK]   Contenedor jadda_mysql activo
  [OK]   Contenedor jadda_backend activo
  [OK]   Contenedor jadda_frontend activo
  [INFO]  MySQL: 8.0.46
  [INFO]  Node.js (backend): 22.23.0
  [OK]   Frontend responde en http://localhost:5173
  [OK]   API responde a traves del proxy en /api/productos
  [INFO]  Puerto 5173: en escucha
  [INFO]  Puerto 5000: en escucha
  [INFO]  Puerto 3306: en escucha

RESUMEN
  OK: 22 | AVISOS: 0 | FALLAS: 0
  RESULTADO: CUMPLE LOS REQUISITOS MINIMOS
```

Resultado: **cumple**. El equipo supera CPU, RAM, disco, Docker y Compose; los tres contenedores están activos y la API responde a través del proxy. No hay acciones correctivas pendientes. Para un servidor dedicado se recomienda migrar a Ubuntu Server 24.04 LTS y repetir este script allí (con los umbrales `MIN_CPU=4`, `MIN_RAM_GB=8`, `MIN_DISK_GB=40`).

## 1.8 Preguntas y respuestas del entregable

### P1. ¿Qué servicios componen tu proyecto y cuánta RAM consume cada uno en reposo y con carga?

El sistema son **3 servicios propios en contenedores Docker** (`jadda_mysql`, `jadda_backend`, `jadda_frontend`) más 3 servicios externos que no consumen RAM local: Cloudinary (medios), el SMTP de correos (Nodemailer) e ip-api.com (geolocalización del login). Medición real con `docker stats --no-stream` (detalle y prueba de carga en §1.4):

| Servicio | RAM en reposo | RAM con carga (20 concurrentes) |
|---|---|---|
| `jadda_backend` (Express/Node 22) | 145,7 MiB | pico 317,6 MiB |
| `jadda_mysql` (MySQL 8.0.46) | 372,5 MiB | pico 375,1 MiB |
| `jadda_frontend` (Vite) | 511,3 MiB | pico 512,5 MiB |
| **Total contenedores** | **≈ 1,0 GiB** | **pico ≈ 1,2 GiB** |

La carga se simula con 8.000 peticiones GET a `/api/productos/categorias`, 20 concurrentes en 15,59 s (513 req/s, 0 errores). Re-muestreo del 2026-10-21 con el stack activo: 75,3 / 435,6 / 391,3 MiB → **0,88 GiB total en reposo** — la variación entre corridas (±0,15 GiB) corresponde al tiempo de vida de los procesos y actividad reciente; el orden de magnitud queda confirmado. Fuera de los contenedores, el host reserva ≈ 4–6 GB para Windows + Docker Desktop/WSL2 (§1.5).

### P2. Si el cliente quisiera alojar el proyecto en sus instalaciones, ¿qué formato de servidor y qué nivel RAID recomendarías? ¿Por qué?

- **Formato: torre / mini-torre** para una tienda (silenciosa, cabe en el mostrador, mantenimiento sin equipo especializado); **rack 1U** solo si dispone de cuarto técnico. Con 3 contenedores y 1–1,2 GiB de RAM no se justifica un servidor corporativo. Encima del hardware: Docker (mismo `docker-compose` del proyecto); idealmente **Ubuntu Server 24.04 LTS** (§1.3, menos overhead que Windows+WSL2) — aunque tal como está probado corre igual en Windows 11.
- **RAID: RAID 1 (espejo) con 2 SSD.** Justificación: (1) tolera la falla de un disco sin detener el servicio; (2) a diferencia de RAID 5/6 no degrada la escritura de MySQL; (3) con 2 discos es el punto de equilibrio costo/protección para un volumen pequeño (BD de 2.519 filas + dumps). Si supera 50 concurrentes, migrar a RAID 10. Complemento obligatorio: **UPS 650 VA** (evita corrupción del volumen ante cortes de luz).
- **RAID no sustituye los respaldos**: protege del fallo físico del disco, no de un borrado lógico (`DROP DATABASE`) ni de un archivo corrupto — el plan S02 (dump diario 23:30 + USB + nube) sigue siendo obligatorio.

### P3. ¿Hay algún componente cuya licencia genere costo o restricción?

Sí — tres restricciones reales que son decisiones del cliente; el resto del software es libre sin costo (tabla §1.2):

| Componente | Restricción / costo | Consecuencia para el proyecto |
|---|---|---|
| **ip-api.com** (geolocalización del login) | Su endpoint gratuito es **solo para uso no comercial** (términos oficiales: "strictly limited for a non-commercial purpose"), HTTP sin TLS y 45 req/min por IP | El sistema lo usa en `registrarConexion` (última conexión en el perfil). En una tienda comercial hay que **decidir**: desactivar la geolocalización o migrar a un proveedor con plan comercial. Ya está en el inventario de brechas (PRV-2 / COST-1) |
| **Cloudinary** | SDK MIT, pero el **servicio es comercial**; el plan gratuito limita créditos de almacenamiento/banda | Si la tienda crece, el consumo extra se cobra; los archivos locales versionados en `frontend/public/**` funcionan como fallback si se cancela |
| **Docker Desktop** | Gratuito para uso personal/educativo y empresas pequeñas; requiere suscripción en organizaciones grandes | En un servidor dedicado Linux se usa el **Docker Engine** (gratuito, Apache-2.0) — recomendado en la ruta Ubuntu de §1.3 |

MySQL Community (GPLv2) no genera costo como servidor de BD (soporte pago de Oracle solo si se exige SLA); Windows 11 ya está cubierto por la licencia del equipo; Nodemailer es MIT, pero el buzón SMTP usado (Gmail) aplica límites de uso que se respetan desde la capa de aplicación.

### P4. ¿Hasta qué fecha tiene soporte el sistema operativo que elegiste?

| Sistema | Papel | Fin de soporte | Fuente |
|---|---|---|---|
| Windows 11 Home, versión 25H2 (build 26200) | SO anfitrión actual | **12 de octubre de 2027** (ediciones Home/Pro; Enterprise/Education hasta 2028-10-10) | Microsoft Learn — Windows 11 release health |
| Ubuntu Server 24.04 LTS | SO recomendado para servidor dedicado | **Abril de 2029** (soporte estándar de LTS) | Canonical (referencia en §1.3) |

Desde hoy (2026-10-21) quedan ≈ 12 meses de soporte del SO anfitrión actual: suficiente para el alcance académico; si el sistema pasa al servidor de la tienda conviene instalar ahí Ubuntu Server 24.04 LTS antes del vencimiento. Docker aísla la aplicación del SO (las imágenes de Node 22 y MySQL 8.0.46 van fijadas), así que actualizar el host no obliga a tocar el proyecto.
