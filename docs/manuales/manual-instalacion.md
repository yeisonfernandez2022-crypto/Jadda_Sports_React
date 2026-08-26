# Manual de Instalación — JADDA SPORTS

**Versión del documento:** 1.0 · 2026-08-24
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

**a) Base de datos** — abra `docker-compose.yml` y defina una contraseña segura en las dos partes donde aparece `tu_password_secreto` (servicio `database` → `MYSQL_ROOT_PASSWORD`, y servicio `backend` → `DB_PASSWORD`). Ambas deben ser idénticas.

**b) Aplicación** — cree el archivo `backend\.env` copiando `backend\.env.example` y complete al menos:

| Variable | Para qué sirve |
|----------|----------------|
| `SESSION_SECRET` | Firma de las sesiones de usuario (ponga un texto largo aleatorio) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta de administrador que se crea automáticamente |
| `EMAIL_USER` / `EMAIL_PASS` | Correo que envía verificaciones, facturas y notificaciones (contraseña de aplicación de Gmail) |
| `FRONTEND_URL` | URL que se incrusta en los correos (`http://<IP-SERVIDOR>:5173`) |

Google/Facebook OAuth son opcionales (solo si se usará inicio social).

### Paso 3 — Levantar los servicios

Abra PowerShell en la carpeta del proyecto:

```powershell
docker compose up -d --build
```

La primera vez tarda varios minutos (descarga imágenes, instala dependencias y crea la base de datos con sus datos iniciales). Verifique:

```powershell
docker ps          # deben aparecer jadda_mysql, jadda_backend y jadda_frontend "Up"
```

> El backend crea automáticamente las tablas y el usuario administrador al arrancar. No necesita importar SQL manualmente.

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

## 4. Verificación final

| Prueba | Resultado esperado |
|--------|--------------------|
| Abrir `http://localhost:5173` | Página principal de la tienda con catálogo |
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
