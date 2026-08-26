# 02 · Plan de Migración de Datos y Respaldos

**Proyecto:** JADDA SPORTS
**Documento:** Plan de migración de datos y esquema de copias de seguridad
**Fecha:** 2026-08-24
**Alcance:** mitigar riesgos sobre los datos durante la puesta en producción y la operación.

---

## 1. Estrategia de migración de datos

### 1.1 Dos rutas según el punto de partida

| Escenario | Herramienta | Procedimiento |
|-----------|-------------|---------------|
| **A. Base de datos nueva** (instalación limpia en el cliente) | `backend/database/schema.sql` (archivo SQL único, generado desde el código) | Importar el archivo desde MySQL Workbench o: `docker exec -i jadda_mysql sh -c 'exec mysql -uroot -p$MYSQL_ROOT_PASSWORD jadda_sports_db' < backend/database/schema.sql`. Incluye las 33 tablas + datos semilla (catálogo, categorías, retos, métodos de pago). |
| **B. Base de datos existente** (actualizaciones del sistema) | `backend/database/setup.js` (se ejecuta SOLO al arrancar el contenedor backend) | Automático e idempotente: aplica `CREATE TABLE IF NOT EXISTS`, migraciones de columnas nuevas (verifica `INFORMATION_SCHEMA` antes de cada `ALTER`) e `INSERT IGNORE` de datos de referencia. No requiere intervención manual. |

### 1.2 Reglas de oro de la migración

1. **Siempre hacer backup ANTES de migrar**: `powershell -File scripts\backup.ps1`.
2. El esquema vive en el código (`setup.js`); `schema.sql` es su exportación oficial — regenerarlo tras cambios de esquema con `node backend/database/exportarSchema.js`.
3. Las migraciones son **idempotentes**: reiniciar el backend es seguro y repetible.
4. Nunca editar la base de datos "a mano" en producción sin registrar el cambio como migración en `setup.js`.

### 1.3 Procedimiento paso a paso (puesta inicial en el cliente)

```
1. Instalar Docker Desktop (ver manual de instalación).
2. Clonar/copiar el proyecto.
3. Crear .env desde .env.example (credenciales reales).
4. docker compose up -d          ← primer arranque: setup.js crea BD+seeds
5. Ejecutar scripts\sql\usuarios-produccion.sql   ← usuario app con menor privilegio
6. powershell -ExecutionPolicy Bypass -File scripts\backup.ps1   ← primer respaldo
7. Ejecutar checklist de smoke tests (03-guia-despliegue.md §5)
```

## 2. Esquema de copias de seguridad (backups)

### 2.1 Qué se respalda

| Componente | Dónde vive | Cómo se respalda |
|------------|-----------|------------------|
| Base de datos completa (33 tablas) | volumen Docker `mysql_data` | `mysqldump --single-transaction --routines --triggers` dentro del contenedor; transferencia byte-perfecta con `docker cp` |
| Imágenes subidas (productos, perfiles, retos, devoluciones) | `frontend/public/images/` (bind mount, **fuera** del volumen MySQL) | `Compress-Archive` de toda la carpeta |

> ⚠️ Punto crítico: los archivos subidos NO están en el volumen de MySQL. Un backup que solo incluya el dump deja fuera las imágenes del catálogo y las evidencias. El script incluido cubre ambos.

### 2.2 Scripts entregados y verificados

| Script | Función | Estado de prueba |
|--------|---------|------------------|
| `scripts/backup.ps1` | Dump SQL + zip de imágenes + rotación por antigüedad + log | ✅ Ejecutado 2026-08-24: dump 111 KB (35 CREATE TABLE), imágenes 43,7 MB (163 archivos) |
| `scripts/restaurar-backup.ps1` | Restaurar un zip/dump en la BD real **o en una BD temporal de prueba** | ✅ Restauración E2E verificada: 35 tablas reconstruidas en `jadda_restore_test`, luego eliminada |

Uso:

```powershell
# Respaldo diario (retención de 7 días por defecto)
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1

# Respaldo con retención de 14 días
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -RetencionDias 14

# Probar un respaldo SIN tocar la base de datos real (recomendado mensual)
powershell -ExecutionPolicy Bypass -File scripts\restaurar-backup.ps1 `
    -RutaBackup backups\mysql\jadda_sports_db_20260824_121836.zip `
    -BaseDatosPrueba jadda_restore_test
```

Estructura generada:

```
backups/
├── mysql/jadda_sports_db_YYYYMMDD_HHMMSS.zip
├── imagenes/imagenes_YYYYMMDD_HHMMSS.zip
└── backup.log                     ← bitácora de cada corrida
```

### 2.3 Política de respaldos

| Parámetro | Valor | Justificación |
|-----------|-------|---------------|
| Frecuencia | Diaria | Datos transaccionales (ventas/devoluciones cambian a diario) |
| Retención | 7 días (configurable `-RetencionDias`) | Balance espacio/seguridad; el disco de producción tiene >100 GB libres |
| Ubicación | Carpeta `backups/` local | Excluida de git (`.gitignore`); se recomienda copiar semanalmente a unidad externa/nube |
| Verificación | Mensual: restaurar último backup en BD temporal | Detecta backups corruptos ANTES de necesitarlos |
| Registro | `backups/backup.log` | Trazabilidad de cada corrida y de la rotación |

### 2.4 Automatización (Programador de tareas de Windows)

```powershell
# Crear tarea diaria 11:00 p.m. (ejecutar una sola vez como administrador)
schtasks /create /tn "JaddaBackupDiario" /tr ^
  "powershell -ExecutionPolicy Bypass -File \"<RUTA_PROYECTO>\scripts\backup.ps1\"" ^
  /sc daily /st 23:00 /rl limited
```

### 2.5 Procedimiento de recuperación ante desastres

```
1. Detener backend:        docker stop jadda_backend
2. Restaurar dump:         powershell -File scripts\restaurar-backup.ps1 -RutaBackup <zip>
                           (confirmar con SI; reemplaza la BD actual)
3. Restaurar imágenes:     Expand-Archive backups\imagenes\<zip> -DestinationPath frontend\public\images
4. Reiniciar:              docker start jadda_backend
5. Validar:                login admin + revisar catálogo y últimas compras
```

**RPO estimado (pérdida máxima de datos): 24 h** (frecuencia diaria). Si el negocio exige menos, subir frecuencia a cada 6 h cambiando `/sc daily /st 23:00` por varias horas o `/sc hourly`.

## 3. Responsables

| Rol | Responsabilidad |
|-----|-----------------|
| Administrador del sistema (cliente) | Verificar semanalmente que `backup.log` registre corridas exitosas; guardar copia externa semanal |
| Equipo de desarrollo | Mantener scripts de backup/migración; regenerar `schema.sql` ante cambios de esquema |

## 4. Checklist final antes de poner en producción

- [ ] Backup previo ejecutado y verificado (si había datos previos)
- [ ] `schema.sql` importado O backend arrancado al menos una vez (setup aplicado)
- [ ] Usuario de aplicación con menor privilegio creado (`scripts/sql/usuarios-produccion.sql`)
- [ ] Primer `backup.ps1` exitoso registrado en `backup.log`
- [ ] Prueba de restauración en BD temporal exitosa
- [ ] Tarea programada del backup diario activa
