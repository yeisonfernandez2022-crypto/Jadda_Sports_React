/*
 * Agrupación temporal para los reportes de ventas (admin y vendedor).
 * Fuente única para:
 *   - La lista cerrada de granularidades admitidas (dia/semana/mes/año).
 *   - La expresión SQL de agrupación para cada granularidad.
 *
 * La expresión NO interpola datos del cliente: la granularidad siempre se
 * valida contra la lista cerrada (cualquier valor raro cae a 'dia') y el
 * identificador de columna lo escriben los controladores con literales
 * fijos ('FECHA_VENTA' o 'v.FECHA_VENTA'), nunca del cuerpo de la petición.
 */

const GRANULARIDADES = ['dia', 'semana', 'mes', 'anio'];

/** Devuelve la granularidad si es válida, o 'dia' (defecto) para cualquier otro valor. */
function granularidadValida(valor) {
  return GRANULARIDADES.includes(valor) ? valor : 'dia';
}

/**
 * Expresión SQL de agrupación temporal para la granularidad pedida.
 * @param {string} granularidad dia|semana|mes|anio (inválido → dia)
 * @param {string} columnaBase  identificador de columna con alias si hace
 *                              falta (p. ej. 'v.FECHA_VENTA') — SOLO
 *                              literales fijos del controlador.
 */
function formatoAgrupacion(granularidad, columnaBase = 'FECHA_VENTA') {
  const col = columnaBase;
  switch (granularidadValida(granularidad)) {
    case 'semana':
      return `DATE_FORMAT(DATE_SUB(${col}, INTERVAL WEEKDAY(${col}) DAY), '%Y-%m-%d')`;
    case 'mes':
      return `DATE_FORMAT(${col}, '%Y-%m')`;
    case 'anio':
      return `DATE_FORMAT(${col}, '%Y')`;
    default:
      return `DATE_FORMAT(${col}, '%Y-%m-%d')`;
  }
}

/**
 * Límite numérico acotado (>=1, <=maximo) para consultas de top/rankings.
 * Devuelve el defecto si la entrada no es un número finito.
 */
function limiteValido(valor, defecto = 10, maximo = 50) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return defecto;
  return Math.min(maximo, Math.max(1, Math.floor(n)));
}

module.exports = { GRANULARIDADES, granularidadValida, formatoAgrupacion, limiteValido };
