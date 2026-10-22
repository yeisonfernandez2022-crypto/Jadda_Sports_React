# Purgado de media del historial git (`git filter-repo`)

Estado: **EJECUTADO el 2026-10-22** (ver §Resultado real). Se planificó para ejecutar
ANTES de publicar, pero se publicó primero (push y fusión a `main` del usuario) y se
ejecó después — la diferencia es únicamente el `git push --force` extra de `main` y
`chore/produccion`.

## Por qué

La **Fase 5** (cierre de brechas) eliminó del árbol de trabajo ~365 archivos de
imágenes/vídeo (**66,9 MiB medidos en HEAD**):

- `frontend/public/videos/**` (3 mp4, ~63 MB)
- `frontend/public/images/**` (productos ×317, banners ×4, logo transparente,
  perfiles/retos/usuarios/devoluciones) — conservando solo 6 `.gitkeep` para los
  bind-mounts de Docker y 1 archivo raíz (`LogoJadda.png`, favicon del SPA).

`git rm` borra los archivos a partir del commit de la Fase 5, pero **todos los
blobs históricos siguen dentro del packfile** de git (pack actual: 81,5 MiB): un
clone full-history sigue descargando esos ~67 MiB de media histórica. Para
quitarlos del historial hace falta reescribir el historial con `git filter-repo`.

## Comandos ejecutados (2026-10-22, PowerShell 5.1, raíz del repo)

```powershell
# 0) Copia de seguridad previa OBLIGATORIA (rewriting es irreversible)
git bundle create "$env:TEMP\jadda-backup-pre-purga.bundle" --all
git bundle verify "$env:TEMP\jadda-backup-pre-purga.bundle"
# clone de prueba desde el bundle para validar que la historia vieja es recuperable
git clone "$env:TEMP\jadda-backup-pre-purga.bundle" "$env:TEMP\jadda-clone-test"

# 1) Instalación (Python 3 + pip): el shim `git filter-repo` NO quedó en el PATH
#    de git — invocar SIEMPRE como módulo de Python
python -m git_filter_repo --version

# 2) Inventario de basura ANTES de decidir los paths (reportes en .git/filter-repo/analysis/)
python -m git_filter_repo --analyze
# descubrió, además del media de la F5, estos junk históricos: .pnpm-store en la
# raíz (espejo del proyecto entero, 122 MiB packed), frontend/.pnpm-store (66 MiB),
# backend/.pnpm-store (8 MiB), tests/node_modules (2,4 MiB), tests/playwright-report

# 3) Purga real: 8 paths + strip de blobs >1 MB (ningún blob legítimo superó 1 MB
#    fuera de esos dirs; schema.sql 216 KB y LogoJadda.png sobrevivieron)
python -m git_filter_repo --force `
  --invert-paths `
  --path frontend/public/videos `
  --path frontend/public/images `
  --path backend/uploads `
  --path frontend/.pnpm-store `
  --path backend/.pnpm-store `
  --path .pnpm-store `
  --path tests/node_modules `
  --path tests/playwright-report `
  --strip-blobs-bigger-than 1M

# 3b) filter-repo NO reescribe refs ajenas de árboles: 2 refs de checkpoints del
#     editor mantenían la historia vieja viva (el pack CRECIÓ a 94,56 MiB) —
#     enumerarlas y borrar cada una, luego expirar todo antes del GC
git for-each-ref refs/codex/turn-diffs/checkpoints
# por CADA ref listada arriba:
# git update-ref -d <nombre-completo-de-la-ref>
# guardar los nombres antes de borrarlos: quedan solo en este comando
git reflog expire --expire=now --all
git gc --prune=now
git count-objects -vH    # size-pack: 3,77 MiB

# 4) Restaurar el árbol idéntico al pre-purga (los 6 .gitkeep vivían bajo los
#    paths purgados). Verificación: snapshot `git ls-tree -r` pre vs post — la
#    ÚNICA diferencia irreducible fueron los 6 .gitkeep. OJO: el .gitignore de F5
#    ignora esos paths → `git add -f`; `backend/uploads` sigue gitignoreado y su
#    .gitkeep NO se trackea (nunca lo fue).
"frontend/public/images/productos/.gitkeep",
"frontend/public/images/productos/subidas/.gitkeep",
"frontend/public/images/perfiles/.gitkeep",
"frontend/public/images/retos/.gitkeep",
"frontend/public/images/usuarios/.gitkeep",
"frontend/public/images/devoluciones/.gitkeep" | ForEach-Object {
  [IO.File]::WriteAllText($_, "", (New-Object System.Text.UTF8Encoding($false)))
}
git add -f "frontend/public/images/productos/.gitkeep" "frontend/public/images/productos/subidas/.gitkeep" "frontend/public/images/perfiles/.gitkeep" "frontend/public/images/retos/.gitkeep" "frontend/public/images/usuarios/.gitkeep" "frontend/public/images/devoluciones/.gitkeep"
git commit -m "chore(media): restaurar .gitkeep de bind-mounts tras purga filter-repo"

# 5) filter-repo ELIMINA el remote; re-agregarlo y forzar ambas ramas publicadas
git remote add origin https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
git push --force -u origin main chore/produccion
```

## Aviso a colaboradores

El rewrite cambia **TODOS los SHAs** de los commits afectados. Colaboradores con
clones previos deben:

```powershell
git fetch origin
git reset --hard origin/<branch>          # o re-clonar directamente
```

## Verificación después

```powershell
# size-pack debe caer de 81,5 MiB a unos pocos MB
git count-objects -vH

# informe de blobs grandes (filter-repo genera .git/filter-repo/analysis/*):
python -m git_filter_repo --analyze
Get-Content .git\filter-repo\analysis\blob-shas-and-paths.txt -Tail 30
# no debe aparecer media pesada; solo archivos de texto del repo
```

## Resultado real (2026-10-22)

| Métrica | Antes | Después |
|---|---|---|
| `size-pack` local | 81,53 MiB | **3,77 MiB** |
| Clone desde GitHub (pack descargado) | 81,5+ MiB de media histórica | **4,60 MiB** |
| Archivos del árbol (`git ls-tree -r`) | 586 | **586** (idéntico) |
| SHAs (`main` y `chore/produccion`) | `2c54c60` | `ee0c920` / `0534a8b` (gitkeeps) |

- Verificación de integridad: snapshot `git ls-tree -r main --name-only` pre vs
  post (580 archivos reales + 6 `.gitkeep`): la ÚNICA diferencia fueron los
  propios `.gitkeep` (requería `git add -f` por `.gitignore`), cero archivos
  legítimos perdidos.
- Respaldo: bundle 163,9 MB verificado con `git bundle verify` (OK) y clone de
  prueba con HEAD `2c54c60d` idéntico — la historia original es recuperable si
  algo se echa de menos. El bundle NO se sube a GitHub.
- Transitorio: tras el filter-repo el pack CRECIÓ a 94,56 MiB hasta depurar las 2
  refs de checkpoints (paso 3b) — si el size-pack no baja, buscar refs vivas
  fuera de la historia con `git for-each-ref`, `git update-ref -d` de cada una y
  reflog expire antes del GC final.

## Lecciones del proceso

1. `pip install git-filter-repo` no garantiza que git encuentre el shim
   `git filter-repo` como subcomando — invocar SIEMPRE
   `python -m git_filter_repo`.
2. Ejecutar `--analyze` ANTES de decidir los paths: los `.pnpm-store` históricos
   jamás aparecen en el árbol moderno, pero aportaban ~200 MiB packed escondidos
   en la historia (el «espejo del proyecto» en la raíz era una copia con su
   propia media). Sin el inventario, la purga solo habría quitado la mitad.
3. El media no es lo único pesado: `tests/node_modules` y reportes de pruebas
   viejos también ocupan pack considerable aunque el commit que los introdujo
   parezca inofensivo — inventariar TODO el tamaño, no solo lo «visible».
4. Tras el rewrite, las refs externas (checkpoints del editor, stash, etc.) y los
   reflogs sostienen los objetos viejos — el GC sin expire NO libera nada.
5. PowerShell 5.1: guardar snapshots de `git ls-tree` por archivo (no por
   variable) para poder diff pre/post con `Compare-Object`; y separar el path del
   SHA con la Tabla (`[char]9`), no con `.Split(' ')` que trunca paths con
   espacios.

## Referencia

- Documentación oficial: https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html
- Alternativa NO recomendada: `git gc --prune=now` (no purga blobs alcanzables
  por historia; solo objetos sueltos).
