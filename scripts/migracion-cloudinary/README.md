# Regeneración de seeds con URLs Cloudinary

Contexto: desde la Fase 5 (commit `b5037b7`) el repo NO versiona imágenes/videos
— todo el media vive en la cuenta Cloudinary (`nggcplfk`) y los seeds de
`backend/database/setup.js` apuntan a sus URLs. Este directorio conserva la
herramienta que hizo esa conversión, por si hay que repetirla (p. ej. una BD
viva con productos/variantes nuevas después de haber tocado los seeds a mano).

## Cómo funciona

`transformar-seeds.js` lee el `setup.js` línea por línea y:

| Seed | Transformación |
|---|---|
| `PRODUCTO_IMAGENES` `/images/productos/Producto_NN/img_K.ext` | → URL de la BD viva por `(ID_PRODUCTO, ORDEN)` |
| Filas demo con producto ≥ 45 sin URL en la BD viva | → fila OMITIDA (la imagen nunca existió; producto 46 v quedó con 1) |
| `RETO_EVIDENCIAS`/`DEVOLUCIONES_EVIDENCIAS` demo con `/images/` | → `RUTA = NULL` (los archivos demo no existen) |
| `USUARIOS` foto del admin `/images/usuarios/admin_admin/...` | → URL viva del TSV de la foto |

Es **idempotente en la práctica**: una segunda corrida reporta `0` cambios (no
encuentra `/images/` que transformar). Si alguna línea no encaja, ABORTA sin
escribir (`ERRORES (abortando sin escribir)`) — nunca deja el setup a medias.

## Cuándo correrlo

Solo si los seeds desalinean de la BD viva: se agregaron productos con
imágenes nuevas, se subieron fotos reales al catálogo, o se restauró la BD
desde un dump hecho DESPUÉS de la migración con assets que los seeds no
tienen. En clones frescos NO hace falta: los seeds versionados ya vienen
puro-Cloudinary verificados.

## Pasos

1. **Fuente de verdad**: BD dev arriba (`jadda_mysql`) con las URLs Cloudinary
   ya sincronizadas (`PRODUCTO_IMAGENES.URL`).
2. **Generar los TSV** (desde **Git Bash**, para que el redirect escriba UTF-8
   limpio — la redirección de PowerShell escribe UTF-16 y el script la lee
   como basura):

   ```bash
   docker exec jadda_mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -e "SELECT ID_PRODUCTO, ORDEN, URL FROM jadda_sports_db.PRODUCTO_IMAGENES ORDER BY ID_PRODUCTO, ORDEN"' > /tmp/imag-producto.tsv

   docker exec jadda_mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -e "SELECT ID_USUARIO, FOTO_URL FROM jadda_sports_db.USUARIOS WHERE ID_USUARIO = 1"' > /tmp/foto-admin.tsv
   ```

   Formato esperado: header + filas `id<TAB>orden<TAB>url` (el script salta la
   primera línea) y `id<TAB>url` para la foto.
3. **Correr** (desde la raíz del repo; acepta rutas alternativas como args):

   ```bash
   node scripts/migracion-cloudinary/transformar-seeds.js
   # Salida esperada de la corrida original:
   # productos: 310 · omitidas: 2 · reto->NULL: 11 · devol->NULL: 15 ·
   # foto admin: 1 · quedan /images/ en líneas: solo el guard de migración
   ```
4. **Regenerar el schema importable** en el host
   (`node backend/database/exportarSchema.js`); si el host no tiene las
   dependencias, correrlo en el contenedor:
   `docker exec jadda_backend node database/exportarSchema.js`.
5. **Verificar**:
   - `node --check backend/database/setup.js`
   - `Select-String -Path backend/database/setup.js -Pattern "'/images/" | Measure-Object`
     → SOLO la línea del guard `migrarImagenesALocales` (temprano return cuando
     ya no queda nada local: no debe revertir las URLs cloud).
   - Importar `schema.sql` en una BD desechable y contar:
     `COUNT(*)` PRODUCTO_IMAGENES ≈ BD viva − filas runtime extra (310 vs 313
     en la corrida original: 3 filas existían solo en vive), 0 URLs `/images/`,
     `PRODUCTOS` 104, producto 46 con 1 imagen, retos/devol demo con RUTA NULL.
   - Suite: `corepack pnpm --prefix backend test` (unit) y la de integración
     `docker compose -f backend/tests/docker-compose.test.yml up -d` +
     `corepack pnpm --prefix backend exec vitest run --config vitest.integration.config.mjs`.

## Lecciones de la corrida original (2026-10-22)

- El `\r` de CRLF rompía el ancla `$` del regex → el script hace
  `split(/\r?\n/)`.
- Los TSV generados con `docker exec ... > archivo` (PowerShell) salían en
  **UTF-16** → regenerarlos con `Out-File -Encoding utf8` o redirection desde
  Git Bash.
- Los seeds DEMO usan `imagen_K.ext` (no `img_K`) e ids de hasta 3 dígitos —
  el regex acepta `\d{2,3}` y `(?:img|imagen)`.
- La última fila del bloque seed termina en `;` (no `,`) — el reemplazo debe
  conservar el terminador.
- La foto del admin NO tenía seed local que reemplazar (la conversión es
  defensiva; el TSV `foto-admin.tsv` queda como insumo si algún día el seed
  agrega la foto).

## No confundir con

- La **purga del historial git** de los archivos binarios ya borrados
  (`docs/auditoria/purga-media-filter-repo.md`) — problema distinto.
- La **migración de medios a Cloudinary** de 2026-10-20 (ya ejecutada; sus
  scripts temporales se eliminaron — este directorio es lo único que sobrevivió
  y sirve SOLO para regenerar seeds, no para subir assets).
