/**
 * cancelacionVenta — transacción de cancelación + reembolso automático.
 * La conexión falsa decide qué devuelve cada query por su SQL; los helpers
 * de reembolso (aprobarReembolsosCancelacion, ventaPagada) se MUTAN antes del
 * require del SUT (vi.mock no intercepta en este setup — lección de la suite).
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const reembolsos = require('../../../backend/utils/reembolsosCancelacion');

// MUTACIÓN ANTES del require del SUT (el destructuring la captura en su carga)
reembolsos.aprobarReembolsosCancelacion = vi.fn(async () => ({ automatico: true, totalProductos: 120000, costoEnvio: 9000, total: 129000 }));

const cancelacionVenta = require('../../../backend/utils/cancelacionVenta');
const { cancelarVentaYReembolsar } = cancelacionVenta;

beforeEach(() => {
  vi.clearAllMocks();
});

function conexionFalsa(mapa) {
  return {
    query: async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      for (const [clave, respuesta] of Object.entries(mapa)) {
        if (s.startsWith(clave.toUpperCase())) {
          return typeof respuesta === 'function' ? respuesta(params) : respuesta;
        }
      }
      return [[]];
    },
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  };
}

const pedir = (mapa, extra = {}) => {
  cancelacionVenta._useDb({ getConnection: vi.fn(async () => conexionFalsa(mapa)) });
  return cancelarVentaYReembolsar({ idVenta: 15, canceladaPor: 'TIENDA', ...extra });
};

describe('cancelarVentaYReembolsar', () => {
  test('venta inexistente → { encontrada: false } con rollback', async () => {
    const resultado = await pedir({ 'SELECT ID_VENTA': [[]] });
    expect(resultado.encontrada).toBe(false);
  });

  test('venta ya cancelada → sinCambios sin tocar nada', async () => {
    const resultado = await pedir({
      'SELECT ID_VENTA': [[{ ID_VENTA: 15, ID_CLIENTE: 7, ESTADO: 'CANCELADA', DATOS_PAGO: null }]],
    });
    expect(resultado).toEqual({ encontrada: true, sinCambios: true, reembolso: null });
  });

  test('pagada pre-despacho: cancela con CANCELADA_POR y aprueba reembolso con envío incluido', async () => {
    const resultado = await pedir({
      'SELECT ID_VENTA': [[{ ID_VENTA: 15, ID_CLIENTE: 7, ESTADO: 'COMPLETADA', DATOS_PAGO: null }]],
      'SELECT ESTADO_ENVIO': [[{ ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: 9000 }]],
      'SELECT ID_PRODUCTO': [[{ ID_PRODUCTO: 1, CANTIDAD: 1 }]],
      'UPDATE VENTAS': [{}],
    });
    expect(resultado.encontrada).toBe(true);
    expect(resultado.reembolso).toBeTruthy();
    expect(reembolsos.aprobarReembolsosCancelacion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idUsuario: 7, costoEnvio: 9000 }),
    );
  });

  test('envío ya en camino: sin reembolso (el pedido salió)', async () => {
    const resultado = await pedir({
      'SELECT ID_VENTA': [[{ ID_VENTA: 15, ID_CLIENTE: 7, ESTADO: 'COMPLETADA', DATOS_PAGO: null }]],
      'SELECT ESTADO_ENVIO': [[{ ESTADO_ENVIO: 'EN_CAMINO', COSTO_ENVIO: 9000 }]],
      'SELECT ID_PRODUCTO': [[{ ID_PRODUCTO: 1, CANTIDAD: 1 }]],
      'UPDATE VENTAS': [{}],
    });
    expect(resultado.reembolso).toBeNull();
    expect(reembolsos.aprobarReembolsosCancelacion).not.toHaveBeenCalled();
  });

  test('venta sin pago confirmado (PENDIENTE_PAGO): cancela sin reembolso', async () => {
    const resultado = await pedir({
      'SELECT ID_VENTA': [[{ ID_VENTA: 15, ID_CLIENTE: 7, ESTADO: 'PENDIENTE_PAGO', DATOS_PAGO: JSON.stringify({ token: 't' }) }]],
      'SELECT ESTADO_ENVIO': [[{ ESTADO_ENVIO: 'PENDIENTE', COSTO_ENVIO: 9000 }]],
      'SELECT ID_PRODUCTO': [[]],
      'UPDATE VENTAS': [{}],
    });
    expect(resultado.reembolso).toBeNull();
    expect(reembolsos.aprobarReembolsosCancelacion).not.toHaveBeenCalled();
  });
});
