# Purga de credenciales del historial git (Fase 4 cierre-produccion)

> Estado: **EJECUTADO (2026-10-25)**. La mecánica reescribe el historial
> completo y pinta el repo remoto (push --force), así que se ejecuta UNA sola
> vez y con el respaldo hecho. La misma mecánica ya se
> usó con éxito en la purga de medios (2026-10-22):
> `docs/auditoria/purga-media-filter-repo.md` — las lecciones duras de aquella
> corrida están integradas abajo (respaldo por bundle, refs de árboles externos
> que sostienen objetos viejos, remote eliminado por filter-repo, pack que solo
> se encoge tras el GC). Evidencia real de la corrida en §7.

Nota de auto-asepsia: filter-repo también reemplazó los literales DENTRO de
este documento al pasar por todo el historial (por eso verás la marca
`***REMOVED***` en la tabla §1 en lugar del texto real); los comandos de
verificación §5 describen los literales de forma genérica.

## 1. Qué se busca retirar del historial

| Objetivo | Dónde está hoy | Método |
| --- | --- | --- |
| Contraseña `***REMOVED***` (admin histórico) | ~3 commits la introdujeron; ya NO está en el árbol de HEAD (Fase 1 la limpió de docs/AGENTS) | `--replace-text` |
| Contraseña `***REMOVED***` (fixture de sesiones de prueba) | ~18 commits la tocaron; ya NO está en el HEAD | `--replace-text` |
| `backend/reinicio.tmp` | **NO APLICA** — verificado 2026-10-25: es un FLAG RUNTIME (server.js/config db.js lo crean por arranque) y `.gitignore:18` lo excluye desde su introducción (`c1b5aac`); NUNCA está en el árbol de HEAD ni hay blobs suyos | sin acción |

> Regla Fase 1 (verificada): tras la Fase 1, `git grep` de los dos literales
> (tabla §1) daba 0 ocurrencias sobre el HEAD. La purga aplicó a TODO el
> historial, no solo al árbol de trabajo.

## 2. Paso 0 — decisiones previas (antes de ejecutar nada)

1. **Ventana de congelamiento**: nadie trabaja en el repo durante la purga
   (el working tree se reemplaza y el push es forzado).
2. **Clones locales de colaboradores**: quedan huérfanos (historial
   incompatible). Se continúa trabajando en un clone limpio; el resto
   reclona igual (§6).

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

Residuos conocidos tras la purga de medios (2026-10-22) que NO hay que
repetir pero SI revisar antes del GC:

- **`refs/codex/*` (editor)**: verificadas — hoy ESTÁN limpias (aquella purga
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
git count-objects -vH          # size-pack ANTES y DESPUÉS
git log --all -S "<literal-admin-historico>" --oneline   # SIN salida = limpio
git log --all -S "<literal-fixture>" --oneline           # idem
git grep "<literal-admin-historico>" main --             # SIN salida (exit 1)
git grep "<literal-fixture>" main --                     # idem
```

> (Los literales reales están SOLO en `replace.txt`, que se borra al terminar;
> este runbook no los menciona para dejar el árbol final limpio de self-hits.)

## 6. Paso 4 — publicación del historial reescrito

```bash
git remote -v                  # filter-repo ELIMINA el remote — re-crear si hace falta:
git remote add origin https://github.com/yeisonfernandez2022-crypto/Jadda_Sports_React.git
git push --force -u origin main chore/cierre-produccion
# Branches remotas viejas que ya no existan en el mirror purgado: eliminarlas,
# PERO recuerda que pisarlas destruye también el historial con credenciales
# que conservan en GitHub — esa es exactamente la cobertura que se busca.
# Mismo criterio con los PRs abiertos: cerrarlos ANTES de la purga.
```

- Los colaboradores reclonan: `git pull` normal FALLA (historial
  incompatible). Cada máquina: `git clone` nuevo + restaurar `backend/.env`,
  `data/`, `uploads/` locales (nada de eso está en git, por diseño).
- Los cachés de CI/Actions de corridas viejas se invalidan al resetear el
  workflow sobre el historial nuevo.

## 7. Tabla de evidencia de la corrida (EJECUTADA 2026-10-25)

| Métrica | Antes | Después |
| --- | --- | --- |
| `git log --all -S "<literal-fixture>"` (commits) | 18 | **0** |
| `git log --all -S "<literal-admin>"` (commits) | 3 | **0** (la única mención restante era este runbook — retirada en esta edición) |
| `backend/reinicio.tmp` en `git ls-tree -r HEAD` | no existe (sin acción — §2.1) | no existe |
| `git count-objects -vH` size-pack | 3,77 MiB (2026-10-22) | **6,07 MiB** — creció con los ~13 commits del cierre; NO encoge (el pack previo ya estaba podado en la purga de medios) |
| clone-test desde bundle | — | OK: HEAD `a3900c2` (pre-purga), 602 archivos |

Resumen de la corrida real (mecánica reutilizada de la purga de medios):

- Bundle `C:\Users\Yeison\Desktop\jadda-pre-purga-2026-10-25.bundle` — `git
  bundle verify` OK (13 refs, "records a complete history").
- Mirror `C:\Users\Yeison\Desktop\jadda-mirror.git` clonado de GitHub + rama
  local insertada con `git update-ref refs/heads/chore/cierre-produccion
  a3900c2...` — OJO: `git fetch <ruta-rama> <branch>` SIN refspec NO crea la
  ref, solo llena FETCH_HEAD.
- `replace.txt` con los SOLO dos literales (ASCII; borrado del escritorio al
  terminar; JAMÁS versionado).
- **Corrida 1** `--force --replace-text`: solo "Parsed 1 commits" — NO
  reescribió nada (SHAs idénticos, las métricas -S sin bajar). filter-repo se
  comporta como "no fresh" tras cualquier fetch/update-ref sobre el mirror.
- **Corrida 2** `--debug --force --replace-text`: parseó los 106 commits y
  reescribió de verdad. Lección: ante "Parsed 1 commits", re-corrida con
  `--debug` y verificar los SHAs punta — no fiarse del exit code.
- **Corrida 3 — MENSAJES de commit** (`--force --debug --replace-message`):
  `--replace-text` SOLO sanea BLOBS — el subject del commit del runbook F-4
  contenía los DOS literales planos. Corren `--replace-message` (mismo
  formato `literal==>nuevo`) + verificación OBLIGATORIA complementaria con
  `git log --all --grep="<literal>"` — el pickaxe `-S` NO bate en mensajes.
- **Corrida 4 — asepsia de blobs históricos del runbook** (`--replace-text`):
  los pasos de verificación antiguos del propio runbook contenían el prefijo
  corto del literal-admin como comando de ejemplo → pasada con el prefijo
  como patrón −→ sin self-hits en NINGÚN patrón.
- `git reflog expire --expire=now --all` + `git gc --prune=now` → pack 6,07 MiB.
- SHAs punta ANTES→DESPUÉS: `main` `4c5305c`→`33c1d36` (estable tras la 1ª
  pasada); `chore/cierre-produccion` `a3900c2`→`648d0cf`→`d6d21a3` (3
  reescrituras; el commit de evidencia de este documento agrega una punta
  más).
- Clone limpio de trabajo: `C:\Users\Yeison\Desktop\Proyecto Jadda Sports -
  LIMPIO` (597 archivos; su `origin` apunta al MIRROR local hasta el push).

El push --force es el último paso SIEMPRE. Nadie hace `push` sin que los
greps del §5 hayan dado 0 resultados y el clone-test haya pasado.
**Advertencia de cobertura (viva en esta corrida):** si el push solo pisa
`main` + `chore/cierre-produccion`, las branches remotas viejas (aquí: 6, entre
ellas `chore/produccion`) conservan el historial con credenciales en GitHub —
pisarlas desde el mirror o eliminarlas en la misma ventana.

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

- [x] Bundle de respaldo creado FUERA del proyecto y `git bundle verify` OK (§3) — escritorio, 13 refs.
- [x] `git for-each-ref refs/codex` → vacío (limpias desde la purga de medios 2026-10-22).
- [x] `replace.txt` creado con los DOS literales (ASCII; JAMÁS versionado).
- [x] `--replace-text` corrido (2 pasadas; la reescritura real fue la con `--debug` — §7).
- [x] `git reflog expire` + `git gc --prune=now` → size-pack 6,07 MiB (§7).
- [x] Greps de los dos literales (§5) → 0 resultados en commits y árbol.
- [ ] `git push --force` de (al menos) `main` + `chore/cierre-produccion`, y de las 6 branches remotas viejas o su eliminación.
- [ ] Colaboradores reclonan y restauran sus locales (`backend/.env`, `data/`, `uploads/`).
- [x] SHA pre y post de `main`/`chore` anotados con la fecha en §7.
