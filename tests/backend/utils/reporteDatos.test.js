/**
 * reporteDatos — fuente única de datos para los reportes Excel/PDF.
 *
 * Cubre resolverRango (formato y defaults de 30 días), obtenerDatosReporte
 * (pedidos por alcance, una fila por pedido, serie sin doble conteo,
 * canceladas listadas pero fuera de métricas, más vendidos/vendedores
 * filtrados) y obtenerResumenReporte (consulta ligera para el modal de
 * descarga). La BD se sustituye mutando la propiedad `query` del módulo real
 * de config/db (el SUT no usa getConnection ni execute).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');
const {
  obtenerDatosReporte, obtenerResumenReporte, resolverRango,
} = require('../../../backend/utils/reporteDatos');

// Lección L12: trim tras replace (los template literals empiezan con newline)
const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql, params) => {
    const s = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) {
        const r = rutas[clave];
        return typeof r === 'function' ? r(params) : r;
      }
    }
    return defecto ? defecto(params) : [[]];
  });
};

// el VALOR es [rows]: el SUT hace `const [rows] = await db.query(...)`
const montarBd = (extra = {}) => {
  db.query = dbDe({
    'SELECT ID_VENDEDOR, NOMBRE_EMPRESA FROM VENDEDORES': extra.tienda ?? [[]],
    'SELECT V.ID_VENTA': extra.ventas ?? [[]],
    'SELECT COUNT(*) AS TOTALUSUARIOS': extra.totalUsuarios ?? [[{ totalUsuarios: 0 }]],
    'SELECT P.NOMBRE': extra.masVendidos ?? [[]],
    'SELECT DATE_FORMAT(FECHA_REGISTRO': extra.usuariosRaw ?? [[]],
    'SELECT CONCAT(U.NOMBRE_USUARIO': extra.usuarios ?? [[]],
    'SELECT VE.NOMBRE_EMPRESA': extra.vendedores ?? [[]],
  }, extra.defecto);
};

// fechas a mitad de año: el bucle de la serie y el TZ (UTC-5) no se desalinean
const RANGO = { desde: '2026-06-01', hasta: '2026-06-03' };

beforeEach(() => {
  montarBd();
});

const sqls = () => db.query.mock.calls.map(([sql]) => sql.replace(/\s+/g, ' ').toUpperCase());
const sqlDe = (prefijo) => sqls().find((s) => s.startsWith(prefijo));

describe('resolverRango', () => {
  test('fechas inválidas o ausentes → ventana de los últimos 30 días', () => {
    // nota: resolverRango solo valida el FORMATO AAAA-MM-DD; fechas con
    // formato válido (p. ej. '2026-13-99') pasan tal cual al SQL
    for (const query of [{}, { desde: 'nope', hasta: 123 }, { desde: '01-01-2026', hasta: '' }]) {
      const r = resolverRango(query);
      expect(r.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.hasta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const dias = Math.round((new Date(r.hasta) - new Date(r.desde)) / 86400000);
      expect(dias).toBeGreaterThanOrEqual(29);
      expect(dias).toBeLessThanOrEqual(31);
    }
  });

  test('fechas válidas se conservan tal cual', () => {
    expect(resolverRango(RANGO)).toEqual(RANGO);
  });
});

describe('obtenerDatosReporte', () => {
  test('todo: una fila por pedido, IMPORTE = TOTAL y normalizaciones', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 1, FECHA: '2026-06-01', CLIENTE: 'Ana Perez', METODO: 'Wompi', ESTADO: 'PAGADA', ARTICULOS: '3', IMPORTE: '150000', TOTAL: '150000' },
        { ID_VENTA: 2, FECHA: '2026-06-02', CLIENTE: '(sin cuenta)', METODO: '—', ESTADO: 'CANCELADA', ARTICULOS: null, IMPORTE: null, TOTAL: null },
      ]],
      totalUsuarios: [[{ totalUsuarios: 3 }]],
      masVendidos: [[{ NOMBRE: 'Pesas', unidades: '10', ingresos: '200000', stock: '3' }]],
      usuarios: [[{ NOMBRE: 'Ana Perez', EMAIL: 'a@t.co', ROL: 'Cliente', REGISTRO: '2026-06-01', COMPRAS: '2', GASTADO: '90000' }]],
      vendedores: [[{ NOMBRE_EMPRESA: 'DeporteX', EMAIL: '', PRODUCTOS: '4', UNIDADES: '7', INGRESOS: '150000' }]],
    });
    const datos = await obtenerDatosReporte(RANGO);

    expect(datos.desde).toBe('2026-06-01');
    expect(datos.hasta).toBe('2026-06-03');
    expect(datos.alcance).toEqual(expect.objectContaining({ tipo: 'todo', sufijo: 'todo' }));
    expect(datos.resumen).toEqual({ totalOrdenes: 1, totalIngresos: 150000, totalUnidades: 3, ticketPromedio: 150000, totalUsuarios: 3 });
    expect(datos.ventas).toHaveLength(2);
    expect(datos.ventas[0]).toEqual(expect.objectContaining({ ID_VENTA: 1, ARTICULOS: 3, IMPORTE: 150000, TOTAL: 150000 }));
    expect(datos.ventas[1]).toEqual(expect.objectContaining({ ESTADO: 'CANCELADA', ARTICULOS: 0, IMPORTE: 0, TOTAL: 0 }));
    expect(datos.masVendidos[0]).toEqual({ NOMBRE: 'Pesas', unidades: 10, ingresos: 200000, stock: 3 });
    expect(datos.usuarios[0]).toEqual(expect.objectContaining({ COMPRAS: 2, GASTADO: 90000 }));
    expect(datos.vendedores[0]).toEqual(expect.objectContaining({ PRODUCTOS: 4, UNIDADES: 7, INGRESOS: 150000 }));

    // el rango llega a la consulta de pedidos como límites inclusivos del día
    const [sqlVentas, paramsVentas] = db.query.mock.calls[0];
    expect(sqlVentas.toUpperCase()).toContain('WHERE V.FECHA_VENTA BETWEEN ? AND ?');
    expect(paramsVentas).toEqual(['2026-06-01 00:00:00', '2026-06-03 23:59:59']);
    // el conteo de usuarios usa las fechas SIN hora
    expect(db.query.mock.calls[1][1]).toEqual(['2026-06-01', '2026-06-03']);
  });

  test('sin ventas → resumen en 0, ticketPromedio 0 y serie rellena con 0', async () => {
    const datos = await obtenerDatosReporte(RANGO);
    expect(datos.resumen).toEqual({ totalOrdenes: 0, totalIngresos: 0, totalUnidades: 0, ticketPromedio: 0, totalUsuarios: 0 });
    expect(datos.ventas).toEqual([]);
    expect(datos.serie).toEqual([
      { dia: '2026-06-01', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 },
      { dia: '2026-06-02', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 },
      { dia: '2026-06-03', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 },
    ]);
  });

  test('serie sin doble conteo: un pedido con 3 líneas suma una vez', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 3, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '3', IMPORTE: '120000', TOTAL: '120000' },
      ]],
      usuariosRaw: [[{ dia: '2026-06-01', nuevos: '5' }]],
    });
    const datos = await obtenerDatosReporte(RANGO);
    expect(datos.serie.find((s) => s.dia === '2026-06-01')).toEqual({
      dia: '2026-06-01', ordenes: 1, ingresos: 120000, unidades: 3, nuevosUsuarios: 5,
    });
  });

  test('cancelada: listada, fuera de resumen y serie', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 4, FECHA: '2026-06-01', ESTADO: 'CANCELADA', ARTICULOS: '2', IMPORTE: '80000', TOTAL: '90000' },
      ]],
    });
    const datos = await obtenerDatosReporte(RANGO);
    expect(datos.ventas).toHaveLength(1);
    expect(datos.resumen).toEqual(expect.objectContaining({ totalOrdenes: 0, totalIngresos: 0, totalUnidades: 0 }));
    expect(datos.serie.find((s) => s.dia === '2026-06-01').ingresos).toBe(0);
  });

  test('jadda: pedido mixto conserva TOTAL completo e IMPORTE parcial', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 2, FECHA: '2026-06-02', ESTADO: 'PAGADA', ARTICULOS: '2', IMPORTE: '100000', TOTAL: '150000' },
      ]],
    });
    const datos = await obtenerDatosReporte({ ...RANGO, alcance: 'jadda' });
    expect(datos.alcance).toEqual(expect.objectContaining({ tipo: 'jadda', sufijo: 'jadda', etiqueta: 'Solo JADDA' }));
    expect(datos.ventas[0].IMPORTE).toBe(100000);
    expect(datos.ventas[0].TOTAL).toBe(150000);
    expect(datos.resumen.totalIngresos).toBe(100000);
    const pedidos = sqlDe('SELECT V.ID_VENTA');
    expect(pedidos).toContain('P.ID_VENDEDOR IS NULL');
    expect(sqlDe('SELECT P.NOMBRE')).toContain('P.ID_VENDEDOR IS NULL');
  });

  test('tienda: resuelve el nombre y filtra pedidos, productos y vendedores', async () => {
    montarBd({
      tienda: [[{ ID_VENDEDOR: 7, NOMBRE_EMPRESA: 'DeporteX' }]],
      ventas: [[
        { ID_VENTA: 6, FECHA: '2026-06-03', ESTADO: 'PAGADA', ARTICULOS: '1', IMPORTE: '45000', TOTAL: '54000' },
      ]],
    });
    const datos = await obtenerDatosReporte({ ...RANGO, alcance: 'tienda', tienda: '7' });
    expect(datos.alcance).toEqual(expect.objectContaining({
      tipo: 'tienda', idVendedor: 7, etiqueta: 'Tienda: DeporteX', sufijo: 'tienda-7',
    }));
    const llamadaPedidos = db.query.mock.calls.find(([sql]) => sql.includes('SUM(dv.SUBTOTAL) AS IMPORTE'));
    expect(llamadaPedidos[0]).toContain('p.ID_VENDEDOR = ?');
    expect(llamadaPedidos[1]).toEqual(['2026-06-01 00:00:00', '2026-06-03 23:59:59', 7]);
    const llamadaVendedores = db.query.mock.calls.find(([sql]) => sql.toUpperCase().includes('VE.NOMBRE_EMPRESA'));
    expect(llamadaVendedores[0]).toContain('WHERE ve.ID_VENDEDOR = ?');
    expect(llamadaVendedores[1]).toEqual(['2026-06-01 00:00:00', '2026-06-03 23:59:59', 7]);
  });

  test('tienda inexistente → 404; alcance inválido → 400', async () => {
    await expect(obtenerDatosReporte({ ...RANGO, alcance: 'tienda', tienda: '99' }))
      .rejects.toMatchObject({ statusCode: 404 });
    await expect(obtenerDatosReporte({ ...RANGO, alcance: 'otro' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('jadda no consulta vendedores y el SQL excluye canceladas con CASE', async () => {
    montarBd({
      ventas: [[{ ID_VENTA: 8, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '1', IMPORTE: '1000', TOTAL: '1000' }]],
    });
    const datos = await obtenerDatosReporte({ ...RANGO, alcance: 'jadda' });
    expect(datos.vendedores).toEqual([]);
    expect(sqlDe('SELECT VE.NOMBRE_EMPRESA')).toBeUndefined();

    montarBd({
      ventas: [[{ ID_VENTA: 9, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '1', IMPORTE: '1000', TOTAL: '1000' }]],
      vendedores: [[{ NOMBRE_EMPRESA: 'DeporteX', UNIDADES: '4', INGRESOS: '50000' }]],
    });
    await obtenerDatosReporte(RANGO);
    const vendedoresSql = sqlDe('SELECT VE.NOMBRE_EMPRESA');
    expect(vendedoresSql).toContain('SUM(CASE WHEN V.ID_VENTA IS NOT NULL THEN DV.CANTIDAD ELSE 0 END)');
    expect(vendedoresSql).toContain('SUM(CASE WHEN V.ID_VENTA IS NOT NULL THEN DV.SUBTOTAL ELSE 0 END)');
  });

  test('bd caída → la promesa rechaza (el controller responde 500)', async () => {
    montarBd({ ventas: async () => { throw new Error('boom'); } });
    await expect(obtenerDatosReporte(RANGO)).rejects.toThrow('boom');
  });
});

describe('obtenerResumenReporte', () => {
  test('resumen no consulta usuarios, vendedores ni serie', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 5, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '2', IMPORTE: '50000', TOTAL: '59000' },
        { ID_VENTA: 6, FECHA: '2026-06-02', ESTADO: 'CANCELADA', ARTICULOS: '1', IMPORTE: '20000', TOTAL: '29000' },
      ]],
    });
    const r = await obtenerResumenReporte({ ...RANGO, alcance: 'todo' });
    expect(r).toEqual(expect.objectContaining({
      desde: '2026-06-01', hasta: '2026-06-03',
      alcance: expect.objectContaining({ tipo: 'todo' }),
      ordenes: 1, unidades: 2, importe: 50000,
    }));
    expect(db.query).toHaveBeenCalledTimes(1);
    const consultas = sqls();
    expect(consultas.some((s) => s.includes('FROM USUARIOS'))).toBe(false);
    expect(consultas.some((s) => s.includes('FROM VENDEDORES'))).toBe(false);
    expect(consultas.some((s) => s.includes('DATE_FORMAT(V.FECHA_VENTA'))).toBe(false);
  });

  test('jadda usa el subtotal de las líneas y omite canceladas', async () => {
    montarBd({
      ventas: [[{ ID_VENTA: 7, FECHA: '2026-06-01', ESTADO: 'PAGADA', ARTICULOS: '2', IMPORTE: '100000', TOTAL: '150000' }]],
    });
    const r = await obtenerResumenReporte({ ...RANGO, alcance: 'jadda' });
    expect(r.importe).toBe(100000);
    expect(r.ordenes).toBe(1);
    expect(r.alcance.sufijo).toBe('jadda');
  });

  test('tienda inexistente → 404', async () => {
    await expect(obtenerResumenReporte({ ...RANGO, alcance: 'tienda', tienda: '99' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});
