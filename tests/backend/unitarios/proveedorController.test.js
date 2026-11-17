/**
 * proveedorController — crear proveedor desde el panel admin (unit).
 *
 * BD inyectada con _useDb. Se cubren: validaciones de entrada (nombre corto,
 * teléfono largo, email mal formado o demasiado largo), duplicado por nombre
 * (consulta previa y cascada ER_DUP_ENTRY), la creación feliz (201 con el ID
 * nuevo y los opcionales vacíos como NULL) y el 500 de BD en cada camino.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const proveedorController = require('../../../backend/controllers/proveedorController');
const { obtenerProveedores, crearProveedor } = proveedorController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ params: {}, body: {}, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  proveedorController._useDb({ query: vi.fn(async () => [[]]) });
});

describe('obtenerProveedores', () => {
  test('devuelve la lista tal cual', async () => {
    const dbq = vi.fn(async () => [[{ ID_PROVEEDOR: 3, NOMBRE_PROVEEDOR: 'Deportes Andes' }]]);
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await obtenerProveedores(req(), res);
    expect(res.codigo).toBeNull(); // 200 implícito
    expect(res.cuerpo).toHaveLength(1);
    expect(res.cuerpo[0].NOMBRE_PROVEEDOR).toBe('Deportes Andes');
  });

  test('bd caída → 500', async () => {
    proveedorController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerProveedores(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al obtener los proveedores de la base de datos' });
  });
});

describe('crearProveedor', () => {
  test.each([
    [{ NOMBRE_PROVEEDOR: 'ab' }, 'nombre del proveedor'],
    [{ NOMBRE_PROVEEDOR: ''.padEnd(201, 'x') }, 'nombre del proveedor'],
  ])('validación de nombre → 400', async (body) => {
    const dbq = vi.fn(async () => [[]]);
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/nombre del proveedor debe tener entre 3 y 200/i);
    expect(dbq).not.toHaveBeenCalled();
  });

  test('teléfono de 16 caracteres → 400 sin tocar la BD', async () => {
    const dbq = vi.fn(async () => [[]]);
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Proveedor Válido', TELEFONO_PROVEEDOR: '3101234567890123' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/teléfono no puede superar 15/i);
    expect(dbq).not.toHaveBeenCalled();
  });

  test.each([
    ['correo-sin-arroba', /formato/i],
    ['a'.repeat(101) + '@x.com', /superar 100/i],
  ])('email inválido → 400', async (email, patron) => {
    const dbq = vi.fn(async () => [[]]);
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Proveedor Válido', EMAIL_PROVEEDOR: email } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(patron);
    expect(dbq).not.toHaveBeenCalled();
  });

  test('nombre duplicado (consulta previa) → 400 sin INSERT', async () => {
    const dbq = vi.fn(async (sql) => (sql.startsWith('SELECT ID_PROVEEDOR') ? [[{ ID_PROVEEDOR: 5 }]] : [[]]));
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Deportes Andes' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Ya existe un proveedor con ese nombre' });
    expect(dbq.mock.calls.some(([sql]) => sql.startsWith('INSERT'))).toBe(false);
  });

  test('feliz → 201 con ID nuevo; opcionales vacíos se guardan como NULL', async () => {
    const dbq = vi.fn(async (sql) => (sql.startsWith('SELECT ID_PROVEEDOR') ? [[]] : [{ insertId: 7 }]));
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: '  Deportes Andes  ', TELEFONO_PROVEEDOR: '  ', EMAIL_PROVEEDOR: '' } }), res);
    expect(res.codigo).toBe(201);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Proveedor creado', ID_PROVEEDOR: 7 });
    const insert = dbq.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO PROVEEDORES'));
    expect(insert[1]).toEqual(['Deportes Andes', null, null, null]);
  });

  test('el trim del teléfono se aplica y el contacto se recorta al enviar', async () => {
    const dbq = vi.fn(async (sql) => (sql.startsWith('SELECT ID_PROVEEDOR') ? [[]] : [{ insertId: 8 }]));
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Proveedor B', TELEFONO_PROVEEDOR: ' 3101234567 ', CONTACTO_PROVEEDOR: ' Juan Pérez ' } }), res);
    const insert = dbq.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO PROVEEDORES'));
    expect(insert[1][1]).toBe('3101234567');
    expect(insert[1][3]).toBe('Juan Pérez');
    expect(res.codigo).toBe(201);
  });

  test('ER_DUP_ENTRY en la INSERT → 400 (cascada si la tabla gana UNIQUE)', async () => {
    const err = Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' });
    const dbq = vi.fn(async (sql) => (sql.startsWith('SELECT ID_PROVEEDOR') ? [[]] : Promise.reject(err)));
    proveedorController._useDb({ query: dbq });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Deportes Andes' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/Ya existe un proveedor/i);
  });

  test('bd caída → 500', async () => {
    proveedorController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await crearProveedor(req({ body: { NOMBRE_PROVEEDOR: 'Deportes Andes' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al crear el proveedor' });
  });
});
