import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  pagoConfirmadoEnVenta,
  ventaPagada,
  aprobarReembolsosCancelacion,
} = require('./reembolsosCancelacion');

describe('reembolsosCancelacion — pago confirmado', () => {
  test('reconoce pagos reales/simulados y descarta intentos fallidos', () => {
    expect(pagoConfirmadoEnVenta(null)).toBe(false);
    expect(pagoConfirmadoEnVenta('no-es-json')).toBe(false);
    expect(pagoConfirmadoEnVenta({ estado: 'DECLINADA' })).toBe(false);
    expect(pagoConfirmadoEnVenta({ status: 'ERROR' })).toBe(false);
    expect(pagoConfirmadoEnVenta({ status: 'APPROVED' })).toBe(true);
    expect(pagoConfirmadoEnVenta({ token: 'tok_123', last4: '4242' })).toBe(true);
    expect(pagoConfirmadoEnVenta({ simulacion: true, brand: 'VISA', last4: '4242' })).toBe(true);
    expect(pagoConfirmadoEnVenta({ titular: 'Ana' })).toBe(false);
  });

  test('COMPLETADA/CONFIRMADA son pagadas y PENDIENTE_PAGO nunca lo es', () => {
    expect(ventaPagada('COMPLETADA', null)).toBe(true);
    expect(ventaPagada('CONFIRMADA', null)).toBe(true);
    expect(ventaPagada('PENDIENTE_PAGO', { token: 'tok_123' })).toBe(false);
    expect(ventaPagada('PENDIENTE', { token: 'tok_123' })).toBe(true);
    expect(ventaPagada('PENDIENTE', null)).toBe(false);
  });
});

const crearConexionFalsa = ({ actualizadas = 0, aprobadasExistentes = 0 } = {}) => {
  const inserts = [];
  const updates = [];
  const restantes = Array.isArray(actualizadas) ? [...actualizadas] : null;
  const connection = {
    query: async (sql, params) => {
      if (sql.startsWith('UPDATE DEVOLUCIONES')) {
        updates.push(params);
        const filas = restantes ? (restantes.shift() ?? 0) : actualizadas;
        return [{ affectedRows: filas }];
      }
      if (sql.includes('SELECT COUNT(*) AS total FROM DEVOLUCIONES')) {
        const total = typeof aprobadasExistentes === 'function'
          ? aprobadasExistentes(params[2])
          : aprobadasExistentes;
        return [[{ total }]];
      }
      if (sql.startsWith('INSERT INTO DEVOLUCIONES')) {
        inserts.push(params);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Consulta no esperada: ${sql}`);
    },
  };
  return { connection, inserts, updates };
};

describe('reembolsosCancelacion — aprobación automática', () => {
  test('agrega por producto y suma el envío al total', async () => {
    const { connection, inserts } = crearConexionFalsa();
    const resultado = await aprobarReembolsosCancelacion(connection, {
      idUsuario: 9,
      idVenta: 55,
      detalles: [
        { ID_PRODUCTO: 1, CANTIDAD: 1, SUBTOTAL: 10000 },
        { ID_PRODUCTO: 1, CANTIDAD: 2, SUBTOTAL: 20000 },
        { ID_PRODUCTO: 2, CANTIDAD: 1, SUBTOTAL: 5000 },
      ],
      costoEnvio: 9000,
    });

    expect(resultado).toEqual({
      automatico: true,
      totalProductos: 35000,
      costoEnvio: 9000,
      total: 44000,
      filas: 2,
    });
    expect(inserts).toHaveLength(2);
    expect(inserts[0]).toEqual([9, 55, 1, 3, 'Reembolso por cancelación del pedido']);
    expect(inserts[1]).toEqual([9, 55, 2, 1, 'Reembolso por cancelación del pedido']);
  });

  test('reutiliza una fila activa y no duplica una ya aprobada', async () => {
    const { connection, inserts } = crearConexionFalsa({
      actualizadas: [1, 0],
      aprobadasExistentes: (idProducto) => (Number(idProducto) === 2 ? 1 : 0),
    });
    const resultado = await aprobarReembolsosCancelacion(connection, {
      idUsuario: 9,
      idVenta: 55,
      detalles: [
        { ID_PRODUCTO: 1, CANTIDAD: 1, SUBTOTAL: 10000 },
        { ID_PRODUCTO: 2, CANTIDAD: 1, SUBTOTAL: 5000 },
      ],
    });

    expect(resultado).toEqual({
      automatico: true,
      totalProductos: 15000,
      costoEnvio: 0,
      total: 15000,
      filas: 1,
    });
    expect(inserts).toHaveLength(0);
  });

  test('usa PRECIO_UNITARIO * CANTIDAD si SUBTOTAL no viene', async () => {
    const { connection } = crearConexionFalsa();
    const resultado = await aprobarReembolsosCancelacion(connection, {
      idUsuario: 9,
      idVenta: 55,
      detalles: [{ ID_PRODUCTO: 3, CANTIDAD: 2, PRECIO_UNITARIO: 7000 }],
    });

    expect(resultado.total).toBe(14000);
  });
});
