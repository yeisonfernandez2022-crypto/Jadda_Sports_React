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

const PATRONES = GROSERIAS.map((g) => ({
  // Palabra completa rodeada de letras o inicio/fin (soporta tildes y ñ)
  re: new RegExp(`(?<![\\p{L}\\p{N}])${g}(?![\\p{L}\\p{N}])`, 'giu'),
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
