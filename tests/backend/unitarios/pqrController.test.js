/**
 * pqrController — peticiones, quejas y reclamos (unit).
 *
 * El controlador importa el pool real de config/db (sin _useDb): la BD falsa
 * muta db.query sobre el singleton ANTES del require. notificacionController
 * se muta para la campana admin. Se cubren: 401 sin sesión, 400 de campos
 * (incluido el vacío tras trim), recortes a los límites del DDL, pedido
 * opcional y campana admin.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const db = require('../../../backend/config/db');
const notificacionController = require('../../../backend/controllers/notificacionController');

notificacionController.crearNotificacion = vi.fn(async () => ({}));

const pqrController = require('../../../backend/controllers/pqrController');
const { crearPqr } = pqrController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
  db.query = vi.fn(async () => [[]]);
});

describe('crearPqr', () => {
  test('sin sesión → 401 "No autenticado"', async () => {
    const res = resFalsa();
    await crearPqr({ user: null, body: {} }, res);
    expect(res.codigo).toBe(401);
    expect(res.cuerpo).toEqual({ error: 'No autenticado' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('faltan campos → 400 "Tipo, asunto y descripción son obligatorios"', async () => {
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: 'P', asunto: 'A' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Tipo, asunto y descripción son obligatorios' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('campos en blanco (solo espacios) → 400 tras trim', async () => {
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: '  ', asunto: 'A', descripcion: 'D' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'Tipo, asunto y descripción son obligatorios' });
  });

  test('feliz: INSERT con recortes DDL y pedido null; campana admin', async () => {
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: 'R'.repeat(60), asunto: 'A'.repeat(300), descripcion: 'D'.repeat(2100), numeroPedido: '  PED-99 ' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'PQR creada exitosamente' });
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PQR'));
    expect(insert[1]).toEqual([7, 'R'.repeat(50), 'A'.repeat(255), 'D'.repeat(2000), 'PED-99']);
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: null, tipo: 'pqr', titulo: '📝 Nueva PQR', ruta: '/admin',
    }));
  });

  test('sin numeroPedido → INSERT con null', async () => {
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: 'P', asunto: 'A', descripcion: 'D' } }, res);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO PQR'));
    expect(insert[1]).toEqual([7, 'P', 'A', 'D', null]);
  });

  test('campana admin que lanza → no bloquea la respuesta', async () => {
    notificacionController.crearNotificacion.mockImplementationOnce(async () => { throw new Error('campana caída'); });
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: 'P', asunto: 'A', descripcion: 'D' } }, res);
    expect(res.cuerpo.ok).toBe(true);
  });

  test('fallo de BD → 500 "Error al crear PQR"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await crearPqr({ user: { ID_USUARIO: 7 }, body: { tipo: 'P', asunto: 'A', descripcion: 'D' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al crear PQR' });
  });
});
