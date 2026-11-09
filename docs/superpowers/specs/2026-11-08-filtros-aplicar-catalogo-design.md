# Diseño: filtros del catálogo con botón Aplicar (2026-11-08)

## Por qué
El usuario pidió: los cambios del panel de filtros no deben hacer nada hasta pulsar
«Aplicar», el precio debe ser un rango «$ X hasta $ Y» (dos manecillas y no un solo
máximo), y conservar «Eliminar filtros» para volver al catálogo sin filtros.
«Ordenar por» también espera a Aplicar (decisión del usuario en la conversación).

## Alcance
`frontend/src/pages/Catalogo.tsx` + `frontend/src/css/catalogo.css`. Fuera del
alcance: la barra de búsqueda del navbar (sigue instantánea), el modo
«Ofertas» (`?descuento=true`) y la paginación.

## Estado elegido: borrador + URL como fuente de la verdad
- Estado nuevo «borrador»: `borradorCat`, `borradorMarca`, `borradorVendedor`,
  `borradorOrden`, `borradorPrecioMin`, `borradorPrecioMax` (+ bandera
  «precio tocado»). Inicializada de la URL al montar y re-inicializada con
  cada cambio de URL (atrás/adelante/limpiar) — mismo efecto que ya
  sincroniza la URL (L165-181), extendido a los borradores.
- El filtrado/ordenado sigue leyendo los valores COMPROMETIDOS de la URL
  (el useMemo actual no se toca en su lógica). Al pulsar **APLICAR
  FILTROS**: un solo `setSearchParams` escribe `cat`/`marca`/`vendedor`/
  `orden`/`precioMin`/`precioMax` (los valores por defecto no se escriben:
  cat vacía, orden vacío, precioMin 0, precioMax = tope) y borra `page`.
- **ELIMINAR FILTROS** (renombrado del actual LIMPIAR FILTROS): borra los
  params de filtros de la URL y resetea todos los borradores.

##Precio rango (dual slider sin librerías)
- Dos `<input type="range">` solapados (min 0, max tope real del catálogo,
  step 50000), relleno visible entre ambas manecillas y texto
  «Desde $X hasta $Y».
- Reglas: desde ≤ hasta (si se cruzan, dejan de cruzarse: manecilla min
  clava a la del max y viceversa); si desde==0 y hasta==tope el rango no
  filtra.
- El slider «tocado» del borrador evita que el tope async lo pise
  (misma idea del `sliderTocado` actual, solo durante el borrador).

## Interacción nueva del panel
- Categoría/Marca/Vendedor/Orden/Precio cambian SOLO la vista del panel.
- Botones al pie: «APLICAR FILTROS» (primario rojo) y «ELIMINAR FILTROS»
  (secundario outline).
- Si los borradores ≡ valores comprometidos, Aplicar no cambia nada
  (el botón sigue activo; simplemente no-reescribe la URL).

## Riesgos / notas
- `precioTope` async: como el panel sólo es interactivo después de la carga,
  no hay carrera al aplicar.
-Productos bajo $50.000: el slider actual (min 50000) no permitía excluir
  el inferior de la lista... el rango con desde=0 mantiene igual ese caso;
  primera manecilla en $50.000+ excluye los baratos (nueva posibilidad).
- La lógica del filtrado real (useMemo) no cambia: sólo su fuente de valores.
