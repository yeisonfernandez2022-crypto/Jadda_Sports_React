# Manual de Instalación — JADDA SPORTS

**Versión del documento:** 1.1 · 2026-10-22
**Audiencia:** personal técnico encargado de instalar la plataforma en el equipo del cliente
**Tiempo estimado de instalación:** 30–45 minutos (sin contar descargas iniciales)

---

## 1. Qué instala este procedimiento

Una tienda deportiva completa que funciona en red local:

| Componente | Descripción | Puerto |
|------------|-------------|--------|
| **Tienda web** | Catálogo, carrito, checkout, retos, perfil, panel administrativo | 5173 |
| **API** | Backend Express con toda la lógica de negocio | 5000 |
| **Base de datos** | MySQL 8.0 con esquema y datos iniciales autogenerados | 3306 |

Todo corre dentro de contenedores Docker: no se instala Node, MySQL ni ningún otro software en el equipo aparte de Docker Desktop.

## 2. Requisitos previos

Ver detalle completo en `docs/implantacion/01-preparacion-plataforma.md`. Resumen mínimo:

- Windows 10/11 64 bits con **Docker Desktop** instalado, corriendo y con WSL2.
- 8 GB de RAM recomendados, 20 GB libres en disco.
- Puertos **3306, 5000 y 5173** disponibles.

## 3. Pasos de instalación

### Paso 1 — Obtener el proyecto

Copie o clone la carpeta del proyecto, por ejemplo en `C:\JaddaSports`.

### Paso 2 — Configurar credenciales

**a) Base de datos** — en la raíz del proyecto **NO hay plantilla ni archivo `.env`**: créelo a mano con dos líneas:

```
MYSQL_ROOT_PASSWORD=<contraseña-segura>
DB_PASSWORD=<la misma contraseña>
```

`docker-compose.yml` interpola ambas variables (`${MYSQL_ROOT_PASSWORD}` alimenta al contenedor MySQL y `${DB_PASSWORD}` al backend, que arranca con `DB_USER=root` por defecto). **Ambos valores deben ser idénticos.**

**b) Aplicación** — cree el archivo `backend\.env` copiando `backend\.env.example` y complete al menos:

| Variable | Para qué sirve |
|----------|----------------|
| `SESSION_SECRET` | Firma de las sesiones de usuario (ponga un texto largo aleatorio) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta de administrador creada automáticamente a partir de estas variables; no hay credenciales fijas en el repositorio y en producción el backend se rehúsa a arrancar sin ellas |
| `EMAIL_USER` / `EMAIL_PASS` | Correo que envía verificaciones, facturas y notificaciones (contraseña de aplicación de Gmail) |
| `FRONTEND_URL` | URL que se incrusta en los correos (`http://<IP-SERVIDOR>:5173`) |
| `CLOUDINARY_URL` | Opcional: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` para guardar imágenes/videos en Cloudinary; si se omite, se guardan en disco local |
| `PAYMENT_GATEWAY` / `WOMPI_*` | Opcional: pasarela de pagos. Con `PAYMENT_GATEWAY=wompi` + `WOMPI_PUBLIC_KEY` + `WOMPI_PRIVATE_KEY` + `WOMPI_INTEGRITY_KEY` + `WOMPI_EVENTS_SECRET` el checkout cierra por la pasarela Wompi (llaves `pub_test_/pris_test_` = sandbox de pruebas). Si se omite, la venta nace completada sin pasarela, como antes |

Google/Facebook OAuth son opcionales (solo si se usará inicio social).

### Paso 3 — Levantar los servicios

Abra PowerShell en la carpeta del proyecto:

```powershell
docker compose up -d --build
```

La primera vez tarda varios minutos (descarga imágenes, instala dependencias y crea la base de datos con sus datos iniciales). Verifique:

```powershell
docker ps          # deben aparecer jadda_mysql, jadda_backend y jadda_frontend "Up"
curl http://localhost:5000/health    # {"ok":true,"estado":"disponible"}
```

> El backend crea automáticamente las tablas, las migraciones y los datos iniciales (con URLs de Cloudinary si se copió `backend\.env` con `CLOUDINARY_URL`) al arrancar. No necesita importar SQL manualmente.

### Paso 4 — Seguridad post-instalación (obligatoria)

```powershell
# Usuario de base de datos con permisos mínimos para la operación diaria
docker cp scripts\sql\usuarios-produccion.sql jadda_mysql:/tmp/users.sql
docker exec jadda_mysql sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD < /tmp/users.sql'
docker exec jadda_mysql sh -c 'rm -f /tmp/users.sql'
```

Luego, en `docker-compose.yml`, cambie `DB_USER=root` por `DB_USER=jadda_app` (y `DB_PASSWORD` por la del script) y ejecute `docker compose up -d backend`. La cuenta root queda solo para mantenimiento.

Finalmente ingrese como administrador y cambie la contraseña inicial desde *Perfil → Seguridad*.

### Paso 5 — Primer respaldo

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1
```

Si quedó registrado en `backups\backup.log`, la instalación está completa.

> Nota: el zip de imágenes del respaldo cubre solo los archivos en disco local (`frontend\public\images`). El catálogo de media histórico vive en Cloudinary y NO está en ese zip (ver `scripts/migracion-cloudinary/README.md` y `docs/implantacion/02-plan-migracion-respaldos.md`).

## 4. Verificación final

| Prueba | Resultado esperado |
|--------|--------------------|
| `curl http://localhost:5000/health` | `{"ok":true,"estado":"disponible"}` |
| Abrir `http://localhost:5173` | Página principal de la tienda con catálogo e imágenes cargando (semillas con URL de Cloudinary; 310 filas de `PRODUCTO_IMAGENES` con `URL_IMAGEN LIKE '%cloudinary%'`) |
| Iniciar sesión con el admin | Acceso al Panel Admin |
| Crear una venta de prueba | Pedido visible en *Mis compras* y en *Admin → Órdenes* |
| `scripts\backup.ps1` | Archivos zip nuevos en `backups\mysql` y `backups\imagenes` |

## 5. Publicar a otros equipos de la red

1. Habilite la regla de firewall del puerto 5173 (comando en `docs/implantacion/03-guia-despliegue.md §4`).
2. Entregue a los usuarios la dirección `http://<IP-del-servidor>:5173`.
3. Para la app móvil configure `movil\.env` con esa misma IP.

## 6. Actualización futura

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1   # SIEMPRE antes
git pull                                                       # o copiar nueva versión
docker compose up -d --build                                   # migra la BD automáticamente
```

## 7. Desinstalación

```powershell
docker compose down            # detiene y elimina contenedores (conserva datos)
docker compose down -v         # ⚠ además BORRA la base de datos (volumen mysql_data)
```

Guarde primero la carpeta `backups/` si desea conservar la información.

## 8. Problemas frecuentes

Consulte la tabla de solución de problemas en `docs/implantacion/03-guia-despliegue.md §7`. Los más comunes: puerto ocupado (cambie el mapeo en compose), Docker sin arrancar (verifique virtualización) y errores de parseo viejos del frontend (`docker restart jadda_frontend`).
