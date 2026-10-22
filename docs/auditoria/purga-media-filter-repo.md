# Purgado de media del historial git (`git filter-repo`)

Estado: **documentado, pendiente de ejecución** (paso final del cierre de brechas,
cuando ya estén los 6 commits de fase en la rama `chore/produccion` y se decida el
push; ejecutarlo ANTES de publicar los cambios a GitHub).

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

## Comandos (ejecutar en PowerShell 5.1, raíz del repo)

```powershell
# 0) Copia de seguridad previa OBLIGATORIA (rewriting es irreversible)
git bundle create "$env:TEMP\jadda-backup-pre-purga.bundle" --all

# 1) Instalación (Python 3 + pip) o binario standalone
pip install git-filter-repo

# 2) Purga: TODO el media bajo images/ y videos/ del front y backend/uploads
#    (strip extra: cualquier blob >1 MB en el resto del repo, por seguridad)
git filter-repo --force `
  --invert-paths `
  --path frontend/public/videos `
  --path frontend/public/images `
  --path backend/uploads `
  --strip-blobs-bigger-than 1M

# 3) Los .gitkeep no sobreviven a la purga (viven bajo los paths purgados);
#    recrear los 6 del spa + el de backend/uploads y commit:
new-item -ItemType Directory -Force frontend/public/images/productos/subidas, backend/uploads | Out-Null
"frontend/public/images/productos/.gitkeep",
"frontend/public/images/productos/subidas/.gitkeep",
"frontend/public/images/perfiles/.gitkeep",
"frontend/public/images/retos/.gitkeep",
"frontend/public/images/usuarios/.gitkeep",
"frontend/public/images/devoluciones/.gitkeep",
"backend/uploads/.gitkeep" | ForEach-Object {
  if (-not (Test-Path $_)) { [IO.File]::WriteAllText($_, "", (New-Object System.Text.UTF8Encoding($false))) }
}
git add frontend/public/images backend/uploads
git commit -m "chore(media): restaurar .gitkeep de bind-mounts tras purga filter-repo"

# 4) filter-repo elimina el remote; volver a apuntarlo
git remote add origin https://github.com/<org>/<repo>.git
git push origin --force <branch>          # solo DESPUES de acordar reescritura
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
git filter-repo --analyze
Get-Content .git\filter-repo\analysis\blob-shas-and-paths.txt -Tail 30
# no debe aparecer media pesada; solo archivos de texto del repo
```

## Referencia

- Documentación oficial: https://htmlpreview.github.io/?https://github.com/newren/git-filter-repo/blob/docs/html/git-filter-repo.html
- Alternativa NO recomendada: `git gc --prune=now` (no purga blobs alcanzables
  por historia; solo objetos sueltos).
