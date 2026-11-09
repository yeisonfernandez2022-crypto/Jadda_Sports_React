/*
 * Lectura segura de endpoints que DEBEN responder un array.
 *
 * En producción la BD (Aiven free) entra en ventanas de `connect ETIMEDOUT` —
 * en esos minutos el backend responde 500 con body { error, mensaje }, que es
 * un JSON válido para fetch. Sin validar `r.ok` + `Array.isArray`, ese objeto
 * de error quedaba guardado en el estado (setProductos/setCategorias/setDescuentos)
 * y al renderizar `.filter/.forEach` reventaba → ErrorBoundary «¡Oops!»
 * (Navbar mega-menú y Principal, 2026-11-08).
 *
 * Con este helper el estado queda en [] y la página se pinta vacía en vez de
 * crashear; cuando la BD resucita, basta recargar para reponer los datos.
 */
export async function leerListaJson(url: string, opciones?: RequestInit): Promise<any[]> {
  try {
    const r = await fetch(url, opciones);
    const body = await r.json();
    return r.ok && Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}
