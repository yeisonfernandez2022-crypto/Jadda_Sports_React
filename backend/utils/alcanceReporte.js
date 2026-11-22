/**
 * Alcance de los reportes admin: todo el catálogo, solo JADDA o una tienda.
 *
 * Para "solo JADDA" y "una tienda" el importe es la suma de los subtotales de
 * las líneas incluidas (sin envío). Solo "todo el catálogo" usa VENTAS.TOTAL.
 */
const ALCANCES_VALIDOS = ['todo', 'jadda', 'tienda'];

const ETIQUETAS = {
  todo: 'Todo el catálogo',
  jadda: 'Solo JADDA',
};

const SUFIJOS = {
  todo: 'todo',
  jadda: 'jadda',
};

function resolverAlcance(query = {}) {
  const tipo = query.alcance == null || query.alcance === '' ? 'todo' : String(query.alcance);
  if (!ALCANCES_VALIDOS.includes(tipo)) {
    return { error: 'Alcance de reporte inválido', statusCode: 400 };
  }

  if (tipo === 'tienda') {
    const crudo = query.tienda == null ? '' : String(query.tienda);
    if (!/^\d+$/.test(crudo) || Number(crudo) <= 0) {
      return { error: 'Debes seleccionar una tienda válida', statusCode: 400 };
    }
    const idVendedor = Number(crudo);
    return {
      tipo,
      idVendedor,
      etiqueta: `Tienda #${idVendedor}`,
      sufijo: `tienda-${idVendedor}`,
    };
  }

  return {
    tipo,
    idVendedor: null,
    etiqueta: ETIQUETAS[tipo],
    sufijo: SUFIJOS[tipo],
  };
}

function condicionAlcance(alcance, alias = 'p') {
  if (alias !== 'p' && alias !== 'v') {
    throw new Error(`Alias de alcance no permitido: ${alias}`);
  }
  if (alcance.tipo === 'todo') return { sql: '1=1', params: [] };
  if (alcance.tipo === 'jadda') return { sql: 'p.ID_VENDEDOR IS NULL', params: [] };
  return { sql: `${alias}.ID_VENDEDOR = ?`, params: [alcance.idVendedor] };
}

function etiquetaAlcance(alcance, nombreTienda = null) {
  if (alcance.tipo === 'tienda') {
    return nombreTienda ? `Tienda: ${nombreTienda}` : `Tienda #${alcance.idVendedor}`;
  }
  return ETIQUETAS[alcance.tipo];
}

function sufijoAlcance(alcance) {
  return SUFIJOS[alcance.tipo] || `tienda-${alcance.idVendedor}`;
}

module.exports = {
  resolverAlcance,
  condicionAlcance,
  etiquetaAlcance,
  sufijoAlcance,
};
