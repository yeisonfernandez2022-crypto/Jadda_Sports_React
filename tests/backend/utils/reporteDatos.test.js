/**
 * reporteDatos — fuente única de datos para los reportes Excel/PDF.
 * Suite NUEVA (no tiene base): cubre resolverRango (validación de formato y
 * defaults de 30 días) y obtenerDatosReporte completa: el rango llega a las
 * consultas como límites inclusivos, las CANCELADAS salen del resumen pero
 * quedan en la lista de ventas, el ticket promedio y el resumen quedan en 0
 * cuando no hay órdenes, la serie diaria se rellena con 0 para los días sin
 * ventas y las normalizaciones numéricas de ventas/más vendidos/usuarios/
 * vendedores. La BD se sustituye mutando la propiedad `query` del módulo
 * real de config/db (el SUT no usa getConnection ni execute).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');
const { obtenerDatosReporte, resolverRango } = require('../../../backend/utils/reporteDatos');

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
    'SELECT V.ID_VENTA': extra.ventas ?? [[]],
    'SELECT COUNT(*) AS TOTALUSUARIOS': extra.totalUsuarios ?? [[{ totalUsuarios: 0 }]],
    'SELECT P.NOMBRE': extra.masVendidos ?? [[]],
    'SELECT DATE_FORMAT(V.FECHA_VENTA': extra.serieRaw ?? [[]],
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
  test('feliz: las CANCELADAS salen del resumen pero quedan en la lista de ventas', async () => {
    montarBd({
      ventas: [[
        { ID_VENTA: 1, FECHA: '2026-06-01', CLIENTE: 'Ana Perez', METODO: 'Wompi', ESTADO: 'PAGADA', ARTICULOS: '2', TOTAL: '50000' },
        { ID_VENTA: 2, FECHA: '2026-06-02', CLIENTE: '(sin cuenta)', METODO: '—', ESTADO: 'CANCELADA', ARTICULOS: null, TOTAL: null },
      ]],
      totalUsuarios: [[{ totalUsuarios: 3 }]],
      masVendidos: [[{ NOMBRE: 'Pesas', unidades: '10', ingresos: '200000', stock: '3' }]],
      serieRaw: [[{ dia: '2026-06-01', ordenes: '1', ingresos: '50000', unidades: '2' }]],
      usuariosRaw: [[{ dia: '2026-06-02', nuevos: '5' }]],
      usuarios: [[{ NOMBRE: 'Ana Perez', EMAIL: 'a@t.co', ROL: 'Cliente', REGISTRO: '2026-06-01', COMPRAS: '2', GASTADO: '90000' }]],
      vendedores: [[{ NOMBRE_EMPRESA: 'DeporteX', EMAIL: '', PRODUCTOS: '4', UNIDADES: '7', INGRESOS: '150000' }]],
    });
    const datos = await obtenerDatosReporte(RANGO);

    expect(datos.desde).toBe('2026-06-01');
    expect(datos.hasta).toBe('2026-06-03');
    expect(datos.resumen).toEqual({ totalOrdenes: 1, totalIngresos: 50000, totalUnidades: 2, ticketPromedio: 50000, totalUsuarios: 3 });
    // las CANCELADAS siguen listadas, con TOTAL/ARTICULOS null → 0
    expect(datos.ventas).toHaveLength(2);
    expect(datos.ventas[1]).toEqual(expect.objectContaining({ ESTADO: 'CANCELADA', ARTICULOS: 0, TOTAL: 0 }));
    expect(datos.ventas[0].ARTICULOS).toBe(2);
    expect(datos.ventas[0].TOTAL).toBe(50000);
    // normalizaciones numéricas (strings de MySQL → number)
    expect(datos.masVendidos[0]).toEqual({ NOMBRE: 'Pesas', unidades: 10, ingresos: 200000, stock: 3 });
    expect(datos.usuarios[0]).toEqual(expect.objectContaining({ COMPRAS: 2, GASTADO: 90000 }));
    expect(datos.vendedores[0]).toEqual(expect.objectContaining({ PRODUCTOS: 4, UNIDADES: 7, INGRESOS: 150000 }));

    // el rango llega a la consulta de ventas como límites inclusivos del día
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

  test('serie diaria: los días registrados conservan valores y el resto queda en 0', async () => {
    montarBd({
      serieRaw: [[{ dia: '2026-06-02', ordenes: '2', ingresos: '30000.5', unidades: '4' }]],
      usuariosRaw: [[{ dia: '2026-06-01', nuevos: '5' }]],
    });
    const datos = await obtenerDatosReporte(RANGO);
    expect(datos.serie).toEqual([
      { dia: '2026-06-01', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 5 },
      { dia: '2026-06-02', ordenes: 2, ingresos: 30000.5, unidades: 4, nuevosUsuarios: 0 },
      { dia: '2026-06-03', ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: 0 },
    ]);
  });

  test('bd caída → la promesa rechaza (el controller responde 500)', async () => {
    montarBd({ ventas: async () => { throw new Error('boom'); } });
    await expect(obtenerDatosReporte(RANGO)).rejects.toThrow('boom');
  });
});
