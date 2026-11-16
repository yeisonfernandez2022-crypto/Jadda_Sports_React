/**
 * metodoPagoController — métodos de pago del cliente (unit).
 *
 * BD inyectada con _useDb (mapa por prefijo SQL). vencimientoValido es REAL
 * (utils/pagos). Se cubren: listado, guardado con validación de tarjetas
 * (número 13-19, vencimiento MM/AA futura REAL, CVV 3-4; el CVV nunca se
 * guarda), primer método → principal, deduplicación, y eliminar/principal
 * con sus 404 y 500.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const metodoPagoController = require('../../../backend/controllers/metodoPagoController');
const { obtenerMetodos, guardarMetodo, eliminarMetodo, establecerPrincipal } = metodoPagoController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ user: { ID_USUARIO: 7 }, params: {}, body: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  metodoPagoController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('obtenerMetodos', () => {
  test('devuelve filas ordenadas por ES_PRINCIPAL', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => [[{ ID: 1, NOMBRE_METODO: 'Visa' }]]) });
    const res = resFalsa();
    await obtenerMetodos(req(), res);
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE_METODO).toBe('Visa');
  });

  test('fallo de BD → 500 "Error al obtener métodos de pago"', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerMetodos(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener métodos de pago' });
  });
});

describe('guardarMetodo', () => {
  test('sin id_metodo → 400', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    metodoPagoController._useDb(db);
    const res = resFalsa();
    await guardarMetodo(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'ID del método de pago es obligatorio' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('id_metodo inexistente en METODOS_PAGO → 400 "Método de pago no válido"', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => [[]]) });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 9 } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Método de pago no válido');
  });

  test('tarjeta con número corto (12 dígitos) → 400', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, numero: '411111111111' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El número de tarjeta debe tener entre 13 y 19 dígitos');
  });

  test('tarjeta con vencimiento pasado (REAL vencimientoValido) → 400', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, numero: '4111111111111111', vencimiento: '01/20' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('La fecha de vencimiento debe ser MM/AA válida y futura');
  });

  test('tarjeta con CVV de 5 dígitos → 400', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, numero: '4111111111111111', vencimiento: '12/30', cvv: '12345' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('El CVV debe tener 3 o 4 dígitos');
  });

  test('tarjeta nueva válida: número → últimos 4, esPrincipal 1 (primero), CVV descartado', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM USUARIOS_METODOS_PAGO')) return [[{ total: 0 }]];
      if (s.startsWith('SELECT ID, ES_PRINCIPAL FROM USUARIOS_METODOS_PAGO')) return [[]];
      return [{ insertId: 12 }];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, titular: 'Ana', telefono: '300', banco: 'Bancolombia', tipo: 'crédito', numero: '4111 1111 1111 1234', vencimiento: '12/30', cvv: '123' } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Método de pago guardado', id: 12, esPrincipal: 1 });
    const insert = dbq.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO USUARIOS_METODOS_PAGO'));
    expect(insert[1]).toEqual([7, 3, 'Ana', '300', 'Bancolombia', 'crédito', '1234', '12/30', 1]);
    // El CVV (123) nunca se guarda: '1234' (últimos 4 del número) sí es un valor exacto.
    expect(insert[1]).not.toContain('123');
  });

  test('segundo método → esPrincipal 0', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 1 }]];
      if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM USUARIOS_METODOS_PAGO')) return [[{ total: 2 }]];
      if (s.startsWith('SELECT ID, ES_PRINCIPAL FROM USUARIOS_METODOS_PAGO')) return [[]];
      return [{ insertId: 13 }];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 1, titular: 'Pepito', telefono: '300', banco: 'Nequi', tipo: 'débito' } }), res);
    expect(res.cuerpo.esPrincipal).toBe(0);
  });

  test('duplicado idéntico → duplicado:true sin INSERT (ya principal)', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM USUARIOS_METODOS_PAGO')) return [[{ total: 1 }]];
      if (s.startsWith('SELECT ID, ES_PRINCIPAL FROM USUARIOS_METODOS_PAGO')) return [[{ ID: 12, ES_PRINCIPAL: 1 }]];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, titular: 'Ana', numero: '4111111111111234', vencimiento: '12/30', cvv: '123' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Método de pago ya guardado', id: 12, esPrincipal: 1, duplicado: true });
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 1 WHERE ID = ?'))).toBe(false);
  });

  test('duplicado no principal con usuario sin métodos → UPDATE a principal', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('SELECT ID_METODO FROM METODOS_PAGO')) return [[{ ID_METODO: 3 }]];
      if (s.startsWith('SELECT COUNT(*) AS TOTAL FROM USUARIOS_METODOS_PAGO')) return [[{ total: 0 }]];
      if (s.startsWith('SELECT ID, ES_PRINCIPAL FROM USUARIOS_METODOS_PAGO')) return [[{ ID: 12, ES_PRINCIPAL: 0 }]];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3, titular: 'Ana' } }), res);
    expect(res.cuerpo.duplicado).toBe(true);
    expect(res.cuerpo.esPrincipal).toBe(1);
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 1 WHERE ID = ?'))).toBe(true);
  });

  test('fallo de BD → 500 "Error al guardar método de pago"', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await guardarMetodo(req({ body: { id_metodo: 3 } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al guardar método de pago' });
  });
});

describe('eliminarMetodo', () => {
  test('ajeno → 404 "Método de pago no encontrado"', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await eliminarMetodo(req({ params: { id: '1' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Método de pago no encontrado' });
  });

  test('eliminado → 200', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => [{ affectedRows: 1 }]) });
    const res = resFalsa();
    await eliminarMetodo(req({ params: { id: '1' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Método de pago eliminado' });
  });

  test('fallo de BD → 500', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await eliminarMetodo(req({ params: { id: '1' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar método de pago' });
  });
});

describe('establecerPrincipal', () => {
  test('feliz: desmarca todos y marca el pedido → 200', async () => {
    const dbq = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 1 WHERE ID = ?')) return [{ affectedRows: 1 }];
      return [[]];
    });
    metodoPagoController._useDb({ query: dbq });
    const res = resFalsa();
    await establecerPrincipal(req({ params: { id: '5' } }), res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Método principal actualizado' });
    const desmarcar = dbq.mock.calls[0];
    expect(desmarcar[0].toUpperCase().startsWith('UPDATE USUARIOS_METODOS_PAGO SET ES_PRINCIPAL = 0')).toBe(true);
    expect(desmarcar[1]).toEqual([7]);
    const marcar = dbq.mock.calls[1];
    expect(marcar[1]).toEqual(['5', 7]);
  });

  test('ajeno → 404 (tras desmarcar)', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => [{ affectedRows: 0 }]) });
    const res = resFalsa();
    await establecerPrincipal(req({ params: { id: '5' } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Método de pago no encontrado' });
  });

  test('fallo de BD → 500 "Error al establecer método principal"', async () => {
    metodoPagoController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await establecerPrincipal(req({ params: { id: '5' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al establecer método principal' });
  });
});
