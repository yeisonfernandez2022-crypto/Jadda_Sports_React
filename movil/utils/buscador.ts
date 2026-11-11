/*
 * buscador.ts — BÚSQUEDA de productos UNIFICADA (navbar en vivo + catálogo).
 *
 * Reglas que arregla esta utilidad (bug "balones" 2026-11-10):
 *  - Plurales: "balones" debe encontrar "Balón de Fútbol..." — se compara por
 *    PADRÓN (singular ligero: quita -es/-s final), no por el literal.
 *  - Tildes: "Balón" y "balon" son la misma palabra (se normalizan tildes).
 *  - Sin intrusos: se compara a nivel de PALABRA (igualdad de padrón o sufijo
 *    compuesto), NO con includes suelto — por eso "balones" NO arrastra
 *    "Aro de Baloncesto" ni tenis cuya descripción menciona el balón
 *    ('balon' es PREFIJO de 'baloncesto', pero NUNCA su sufijo).
 *  - Sinónimos: el diccionario se activa cuando la consulta ES la clave (por
 *    padrón) — no por substring, para que "balon" no dispare la rama basket.
 */

/* Diccionario mojado de Catálogo (única fuente ahora: viven aquí) */
const SINONIMOS: Record<string, string[]> = {
  "zapatos": ["zapatillas", "tenis", "calzado", "sneakers", "zapatilla"],
  "zapatilla": ["zapatillas", "zapatos", "tenis", "calzado", "sneakers"],
  "zapatillas": ["zapatos", "tenis", "calzado", "sneakers", "zapatilla"],
  "tenis": ["zapatos", "zapatillas", "calzado", "sneakers", "zapatilla"],
  "guayos": ["botines", "tachones", "guayo"],
  "balon": ["balones", "pelota", "pelotas"],
  "pelota": ["balon", "balones", "pelotas"],
  "mancuernas": ["pesas", "dumbbells", "mancuerna"],
  "mancuerna": ["mancuernas", "pesas", "dumbbells"],
  "pesas": ["mancuernas", "dumbbells", "mancuerna"],
  "proteina": ["proteina", "protein", "whey", "suplemento", "suplementos"],
  "proteinas": ["proteina", "protein", "whey", "suplemento", "suplementos"],
  "creatina": ["creatine", "suplemento", "suplementos"],
  "suplemento": ["suplementos", "proteina", "protein", "creatina", "whey", "vitaminas"],
  "suplementos": ["suplemento", "proteina", "protein", "creatina", "whey", "vitaminas"],
  "vitaminas": ["vitamins", "suplemento", "suplementos"],
  "camiseta": ["camisetas", "jersey", "remera", "playera"],
  "camisetas": ["camiseta", "jersey", "remera", "playera"],
  "pantalon": ["pantalones", "pants", "shorts", "bermudas"],
  "pantalones": ["pantalon", "pants", "shorts", "bermudas"],
  "chaqueta": ["chaquetas", "jacket", "sudaderas", "buzo"],
  "bicicleta": ["bicicletas", "bici", "bikes", "cicla"],
  "casco": ["cascos", "helmet"],
  "futbol": ["futbol", "fútbol", "balompie", "soccer", "balón"],
  "fútbol": ["futbol", "balompie", "soccer", "balón"],
  "baloncesto": ["basquetbol", "basketball", "basket"],
  "running": ["correr", "atletismo"],
  "gimnasio": ["gym", "pesas", "fitness"],
  "natacion": ["natacion", "swimming", "piscina"],
  "ciclismo": ["ciclismo", "biking", "cycling"],
  "accesorio": ["accesorios", "accessories", "complementos"],
  "accesorios": ["accesorio", "accessories", "complementos"],
  "proteccion": ["proteccion", "protección", "protectores", "safety"],
  "cardio": ["cardiovascular"],
  "ofertas": ["descuentos", "promociones"],
  "descuentos": ["ofertas", "promociones"],
  "deportes extremos": ["extremos", "extreme"],
  "ropa deportiva": ["ropa", "vestimenta", "sportswear"],
  "tecnologia": ["tecnologia", "tecnología", "smart", "gadgets"],
};

/* minúsculas + sin tildes (ñ pasas a n en ambos lados, comparación leal) */
export function normalizar(texto: string): string {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* palabras propias del texto (letras y números) */
export function tokenizar(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/* plural ligero: -es luego -s final, con piso de largo para no matar palabras cortas */
export function padron(palabra: string): string {
  if (palabra.length >= 5 && palabra.endsWith("es")) return palabra.slice(0, -2);
  if (palabra.length >= 4 && palabra.endsWith("s")) return palabra.slice(0, -1);
  return palabra;
}

/* ejes de la consulta: padrón de cada palabra + los sinónimos de las claves
   del diccionario que COINCIDEN EXACTOS (por padrón, sin substring) */
export function terminosDe(consulta: string): string[] {
  const palabras = tokenizar(consulta);
  if (palabras.length === 0) return [];
  const terminos = new Set<string>();
  const padronesConsulta = palabras.map(padron);
  padronesConsulta.forEach((t) => terminos.add(t));
  for (const [clave, sinonimos] of Object.entries(SINONIMOS)) {
    if (padronesConsulta.includes(padron(clave))) {
      sinonimos.forEach((sin) => tokenizar(sin).forEach((w) => terminos.add(padron(w))));
    }
  }
  return [...terminos];
}

/* producto X término: la palabra del producto ES el término (igualdad), o el
   término vive COMO SUFIJO de una palabra compuesta (minibanda ⊇ banda); un
   prefijo al inicio de otra palabra ("balon"ce�sto) NUNCA cuenta. */
function palabraMatchea(palabraProducto: string, termino: string): boolean {
  if (palabraProducto === termino) return true;
  if (termino.length >= 4 && palabraProducto.endsWith(termino)) return true;
  return (
    termino.length >= 4 &&
    palabraProducto.length === termino.length + 1 &&
    palabraProducto.startsWith(termino)
  );
}

/* filtra una lista completa de productos por consulta (locale, sin backend) */
export function filtrarProductos<
  T extends { NOMBRE?: string; MARCA?: string | null; CATEGORIA?: string; NOMBRE_CATEGORIA?: string; DESCRIPCION_CATEGORIA?: string },
>(lista: T[], consulta: string | null | undefined): T[] {
  const limpio = normalizar(consulta || "");
  if (!limpio) return lista;
  const terminos = terminosDe(limpio);
  if (terminos.length === 0) return lista;
  return lista.filter((p) => {
    const textoProducto = `${p.NOMBRE || ""} ${p.MARCA || ""} ${p.CATEGORIA || p.NOMBRE_CATEGORIA || ""}`;
    // el producto TAMBIEN pasa al padr\u00f3n: 'Guayos' y 'guayo' son la misma entrada
    const palabras = tokenizar(textoProducto).map(padron);
    return palabras.some((w) => terminos.some((t) => palabraMatchea(w, t)));
  });
}
