/**
 * Filtro de lenguaje ofensivo para los chats.
 * Censura SOLO palabras completas (no subcadenas): "puta" → "****",
 * pero "reputación" queda intacto. Insensible a mayúsculas y tildes.
 */
const GROSERIAS = [
  'puta', 'putas', 'puto', 'putos', 'puteria', 'putazo',
  'mierda', 'mierdas',
  'verga', 'vergas', 'careverga', 'carebola', 'carebolas',
  'malparido', 'malparida', 'malparidos', 'malparidas',
  'hijueputa', 'hijueputas', 'hijeputa', 'hijoeputa', 'hp',
  'pendejo', 'pendeja', 'pendejos', 'pendejas',
  'cabron', 'cabrona', 'cabrones', 'cabronas',
  'coño', 'coños',
  'joder', 'jodido', 'jodida',
  'marica', 'maricas', 'marico', 'maricos', 'maricon', 'maricones',
  'perra', 'perras',
  'culo', 'culos', 'culetada',
  'chingar', 'chingada', 'chingados',
  'gonorrea', 'gonorreas',
  'imbecil', 'imbécil', 'imbéciles', 'idiotas',
  'estupido', 'estúpido', 'estupida', 'estúpida', 'estupidos', 'estúpidos',
  'desgraciado', 'desgraciada', 'desgraciados',
];

/** Normaliza tildes para detectar variantes sin acentos (cabron ≈ cabrón). */
const quitarTildes = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Mapa para hacer el patrón insensible a tildes y ñ */
const MAPA_TILDES = {
  a: '[aáàäâã]',
  e: '[eéèëê]',
  i: '[iíìïî]',
  o: '[oóòöôõ]',
  u: '[uúùüû]',
  n: '[nñ]',
  c: '[cç]',
};

function patronInsensible(palabra) {
  const base = quitarTildes(palabra).toLowerCase();
  let pat = '';
  for (const ch of base) {
    pat += MAPA_TILDES[ch] || ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return pat;
}

const PATRONES = GROSERIAS.map((g) => ({
  // Palabra completa rodeada de letras o inicio/fin (soporta tildes, ñ y mayúsculas)
  re: new RegExp(`(?<![\\p{L}\\p{N}])${patronInsensible(g)}(?![\\p{L}\\p{N}])`, 'giu'),
  normalizada: quitarTildes(g),
}));

/** Reemplaza cada grosería por asteriscos del mismo largo. */
function censurar(texto) {
  let out = String(texto ?? '');
  for (const { re } of PATRONES) {
    out = out.replace(re, (m) => '*'.repeat(m.length));
  }
  return out;
}

module.exports = { censurar };
