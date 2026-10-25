# Purga de credenciales del historial git (Fase 4 cierre-produccion)

> Estado: **REDACTADO — NO EJECUTADO** (2026-10-25). Este documento es el runbook
> exacto a seguir cuando el proyecto esté listo para publicarse. La operación
> reescribe el historial completo y_pinta_ el repo remoto (`push --force`), así
> que se ejecuta UNA sola vez y con el respaldo hecho. La misma mecánica ya se
> usó con éxito en la purga de medios (2026-10-22):
> `docs/auditoria/purga-media-filter-repo.md` — las lecciones duras de aquella
> corrida están integradas abajo (respaldo por bundle, refs de árboles externos
> que sostienen objetos viejos, remote eliminado por filter-repo, pack que solo
> se encoge tras el GC).

## 1. Qué se busca retirar del historial

| Objetivo | Dónde está hoy | Método |
| --- | --- | --- |
| Contraseña `***REMOVED***` (admin histórico) | ~3 commits la introdujeron; ya NO está en el árbol de HEAD (Fase 1 la limpió de docs/AGENTS) | `--replace-text` |
| Contraseña `***REMOVED***` (fixture de sesiones de prueba) | ~18 commits la tocaron; ya NO está en el HEAD | `--replace-text` |
| `backend/reinicio.tmp` | **NO APLICA** — verificado 2026-10-25: es un FLAG RUNTIME (server.js/config db.js lo crean por arranque) y `.gitignore:18` lo excluye desde su introducción (`c1b5aac`); NUNCA está en el árbol de HEAD ni hay blobs suyos | sin acción |

> Regla Fase 1 (ya verificada): `git grep -nE "***REMOVED***|***REMOVED***|tu_password_secreto"`
> sobre el HEAD actual está LIMPIO. La purga aplica a TODO el historial, no al
> árbol de trabajo (que ya está sano).

## 2. Paso 0 — decisiones previas (antes de ejecutar nada)

1. **Ventana de congelarmiento**: nadie trabaja en el repo durante la purga
   (el working tree se reemplaza y el push es forzado).
2. **Copia local del árbol**: `git checkout main && git clean -fdx` NO es
   necesario: el filtro escribe a un nuevo historial y se continúa trabajando
   sobre él, pero AMBOS colaboradores con clones locales deben recopiar la
   historia que si persiste (§6).

## 2.1. Sobre `backend/reinicio.tmp` (VEREDICTO: sin acción)

Existe SOLO en disco (8 bytes, flag de "primer arranque Docker" que
`server.js`/`config/db.js` crean y borran). Verificado con `git ls-tree -r
HEAD` (no está), `git check-ignore -v` (ignorado por `.gitignore:18`) e
historia (`git log --all -- backend/reinicio.tmp` → solo cambios que
DEFINEN el flag en `.gitignore`/código; blobs del archivo NUNCA). No
requiere purga.

## 3. Paso 1 — respaldo OBLIGATORIO (mirror bundle)

```bash
git bundle create %TEMP%\jadda-pre-purga-credenciales.bundle --all
git bundle verify %TEMP%\jadda-pre-purga-credenciales.bundle
# prueba en un clone limpio:
git clone %TEMP%\jadda-pre-purga-credenciales.bundle %TEMP%\jadda-test-restore
cd %TEMP%\jadda-test-restore && git log --oneline -1    # debe mostrar el HEAD actual
cd %TEMP%\jadda-test-restore && git ls-tree -r HEAD | Measure-Object -Line  # conteo de archivos antes
cd C:\Users\Yeison\Desktop\Proyecto Jadda Sports
```

El bundle es el ÚNICO camino de vuelta si algo sale mal. Guárdarlo fuera del
directorio del proyecto.

## 4. Paso 2 — análisis y purga

```bash
pip install git-filter-repo        # el subcomando NO es nativo: se invoca con `python -m git_filter_repo`

# (a) inventario honesto
python -m git_filter_repo --analyze     # genera .git/filter-repo/analysis

# (b) reemplazo de literales en TODA la historia
Set-Content -Path %TEMP%\replace.txt -Value "***REMOVED***==>***REMOVED***" -Encoding ascii
Add-Content -Path %TEMP%\replace.txt -Value "***REMOVED***==>***REMOVED***" -Encoding ascii
#    OJO: el literal de la contraseña con '#' NO es un marcador de
#    filter-repo — la sintaxis `literal==>replacement` es literal salvo que el
#    lado izquierdo tenga "regex:" o "glob:".
#    Si un archivo contiene el literal en un sitio legítimo (p. ej. una
#    expectativa de tests E2E que la suite espera), probarlo primero en un
#    clon de prueba (§5) antes del push.

python -m git_filter_repo --replace-text %TEMP%\replace.txt --force
```

Residencias conocidas tras la purga del media (2026-10-22) que NO hay que
repetir pero SI revisar antes del GC:

- **`refs/codex/*` (editor)**: verificadas — hoy ESTÁN limpías (aquella purga
  las borró). Correr `git for-each-ref refs/codex` ANTES del GC por si el
  editor creó checkpoints nuevos; si existen, borrar con
  `git update-ref -d refs/codex/turn-diffs/checkpoints/<id>`.

## 5. Paso 3 — recolección de basura (el pack se encoge AQUÍ)

filter-repo reescribe; la reducción real del pack la hace el GC:

```bash
git reflog expire --expire=now --all
git gc --prune=now
```

Verificación del efecto:

```bash
git count-objects -vH          # size-pack ANTES y DESPUÉS (al día de 2026-10-22: 3,77 MiB final)
git log --all -S "***REMOVED***" --oneline   # debe NO mostrar NINGUNA línea
git log --all -S "***REMOVED***" --oneline # idem
git grep "***REMOVED***" main                 # SIN salida (exit 1) = limpio; con salida = MAL
git grep "***REMOVED***" main                      # idem
```

## 6. Paso 4 — publicación del historial reescrito

```bash
git remote -v                  # filter-repo ELIMINA el remote — re-crear si hace falta:
git remote add origin https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
git push --force -u origin main chore/cierre-produccion
# Si hay branches remotas viejas que ya no existen en el repo local:
git push origin --delete <branch>
# Mismo disciplina para los PRs abiertos: cerrarlos ANTES de la purga.
```

- Los colaboradores reclonan: `git pull` normal FALLÁ (historial
  incompatible). Cada máquina repite: `deploy-env` sin remote → `git clone`
  nuevo + restaurar `backend/.env`, `data/`, `uploads/` locales (nada de eso
  está en git, por diseño).
- Los cachés de CI/Actions de corridas viejas se invalidan al resetear el
  workflow sobre el historial nuevo.

## 7. Tabla de evidencia (se RELLENA al ejecutar)

Al terminar, COMPLETAR esta tabla con los valores reales (como se hizo en la
purga de medios):

| Métrica | Antes | Después |
| --- | --- | --- |
| `git log --all -S "***REMOVED***" --oneline` (commits) | ~18 | 0 |
| `git log --all -S "***REMOVED***" --oneline` (commits) | ~3 | 0 |
| `backend/reinicio.tmp` en `git ls-tree -r HEAD` | no existe (sin acción — §2.1) | no existe |
| `git count-objects -vH` size-pack | 3,77 MiB | medir |
| clone-test desde bundle | — | HEAD correcto |

El push --force es el último paso SIEMPRE. Nadie hace `push` sin que los
greps del §5 hayan dado 0 resultados y el clone-test haya pasado.

## 8. Nota honesta sobre el caché de GitHub

`git push --force` limpia las BRANCHES, no:
- los **PRs antiguos** que GitHub guarda como copias internas,
- los **forks** de terceros (si se hicieran),
- el **caché de blobs** aislados (si alguien cambió de hash en la UI).

Si el repo tiene exposición de la rama `main` crítica, el respaldo duro es la
remoción vía
[Github Support data-removal requests](https://docs.github.com/en/github/authenticating-to-github/removing-sensitive-data-from-a-repository)
— se pide con el hash de blobs/cachés de commit. Para un proyecto de grado
(NO público, repositorio de equipo) la purga de branches con `--force` es
suficiente salvo requisito contractual del estudiante.

## 9. Checklist de la corrida

- [ ] Bundle de respaldo creado FUERA del proyecto y `git bundle verify` OK (§3).
- [ ] `git for-each-ref refs/codex` → sin entradas.
- [ ] `replace.txt` creado con los DOS literales (ASCII; JAMÁS versionado).
- [ ] `--replace-text` corrido.
- [ ] `git reflog expire` + `git gc --prune=now`.
- [ ] Greps de ambos literales (§5) → 0 resultados.
- [ ] `git count-objects -vH` medido y anotado en la tabla §7.
- [ ] clone-test desde el bundle OK.
- [ ] `git push --force` de TODAS las branches relevantes.
- [ ] Colaboradores reclonan y restauran sus locales (`backend/.env`, `data/`, `uploads/`).
- [ ] SHA pre y post de `main` anotados con la fecha de ejecución en este documento.
