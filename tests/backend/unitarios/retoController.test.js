/**
 * retoController — retos deportivos (unit). Pool DIRECTO (sin _useDb):
 * db.query y db.getConnection se mutan sobre el singleton ANTES de cada
 * prueba (la SUT los resuelve en el momento de la llamada). Deps
 * destructuradas en carga (notificacionController.crearNotificacion y las
 * funciones de cloudinary) se mutan ANTES del require del SUT.
 * Se cubren: obtenerRetos, unirseReto (transacción TOCTOU), reportarProgreso
 * (multipart + base64 legacy + guardas de meta/vigencia), misRetos,
 * misEvidencias, eliminarEvidencia (borrado de archivos), admin (aprobar con
 * cupón / rechazar) y los helpers (guardarMaterial, limpiarArchivos,
 * borrarArchivosEvidencia, generarCupon).
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const fs = require('fs');
const db = require('../../../backend/config/db');
const cloudinary = require('../../../backend/utils/cloudinary');
const notificacionController = require('../../../backend/controllers/notificacionController');
const mailer = require('../../../backend/config/mailer');

// Deps destructuradas en carga → mutar ANTES del require del SUT
notificacionController.crearNotificacion = vi.fn(async () => ({}));
cloudinary.estaConfigurado = vi.fn(() => false);
cloudinary.subirArchivoLocal = vi.fn(async () => ({ secure_url: 'https://res.cloudinary.com/subida.png' }));
cloudinary.subirDataUri = vi.fn(async () => ({ secure_url: 'https://res.cloudinary.com/datauri.png' }));
cloudinary.eliminarPorUrl = vi.fn(async () => {});
cloudinary.esUrlCloudinary = vi.fn((url) => /^https:\/\/res\.cloudinary\.com/.test(String(url || '')));
cloudinary.carpetaSegura = vi.fn((...partes) => partes.filter(Boolean).join('/'));

const retoController = require('../../../backend/controllers/retoController');

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const USUARIO = { ID_USUARIO: 7, ID_ROL: 4, USUARIO: 'u7', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Gomez' };

// Router de BD por prefijo SQL normalizado (prefijos MÁS LARGOS primero)
const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ').toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) return rutas[clave];
    }
    return defecto ? defecto() : [[]];
  });
};

const connDe = (rutas, defecto) => ({
  query: dbDe(rutas, defecto),
  beginTransaction: vi.fn(async () => {}),
  commit: vi.fn(async () => {}),
  rollback: vi.fn(async () => {}),
  release: vi.fn(),
});

// Bytes mágicos reales (detectarFormato NO está mockeado)
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const MP4 = Buffer.from('000000206674797069736f6d2020', 'hex');
const dataUri = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;

const mkdirSyncReal = fs.mkdirSync;
const writeFileSyncReal = fs.writeFileSync;
const unlinkSyncReal = fs.unlinkSync;

beforeEach(() => {
  vi.clearAllMocks();
  cloudinary.estaConfigurado.mockImplementation(() => false);
  cloudinary.subirArchivoLocal.mockImplementation(async () => ({ secure_url: 'https://res.cloudinary.com/subida.png' }));
  cloudinary.subirDataUri.mockImplementation(async () => ({ secure_url: 'https://res.cloudinary.com/datauri.png' }));
  notificacionController.crearNotificacion.mockImplementation(async () => ({}));
  mailer.sendMail = vi.fn(async () => ({ accepted: true }));
  fs.mkdirSync = vi.fn();
  fs.writeFileSync = vi.fn();
  fs.unlinkSync = vi.fn();
  db.query = vi.fn(async () => [[]]);
  db.getConnection = vi.fn(async () => connDe({}, async () => [[]]));
});

afterEach(() => {
  fs.mkdirSync = mkdirSyncReal;
  fs.writeFileSync = writeFileSyncReal;
  fs.unlinkSync = unlinkSyncReal;
});

describe('obtenerRetos', () => {
  test('devuelve los retos activos', async () => {
    db.query = vi.fn(async () => [[{ ID_RETO: 1, TITULO: '10K' }]]);
    const res = resFalsa();
    await retoController.obtenerRetos({}, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual([{ ID_RETO: 1, TITULO: '10K' }]);
  });

  test('fallo de BD → 500 "Error al obtener retos"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await retoController.obtenerRetos({}, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al obtener retos' });
  });
});

describe('unirseReto — transacción TOCTOU', () => {
  test('ya inscrito → rollback + 400 "Ya estás inscrito en este reto"', async () => {
    const conn = connDe({ 'SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO': [[{ ID_RETO_USUARIO: 1 }]] });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Ya estás inscrito en este reto' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  test('reto inactivo o inexistente → rollback + 404', async () => {
    const conn = connDe({
      'SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO': [[]],
      'SELECT ID_RETO FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1': [[]],
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Reto no encontrado o no disponible');
  });

  test('límite de 3 retos activos → rollback + 400 amable', async () => {
    const conn = connDe({
      'SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO': [[]],
      'SELECT ID_RETO FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1': [[{ ID_RETO: 1 }]],
      'SELECT COUNT(*) AS TOTAL FROM RETOS_USUARIOS RU': [[{ total: 3 }]],
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo puedes unirte a 3 retos a la vez. Completa uno para poder unirte a otro.');
  });

  test('feliz: INSERT + commit + 200', async () => {
    const conn = connDe({
      'SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO': [[]],
      'SELECT ID_RETO FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1': [[{ ID_RETO: 1 }]],
      'SELECT COUNT(*) AS TOTAL FROM RETOS_USUARIOS RU': [[{ total: 2 }]],
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Te has inscrito al reto exitosamente' });
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.release).toHaveBeenCalledTimes(1);
    const insert = conn.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETOS_USUARIOS'));
    expect(insert[1]).toEqual(['1', 7]);
  });

  test('ER_DUP_ENTRY (carrera de doble click) → 400 amable, no 500', async () => {
    const conn = connDe({
      'SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO': [[]],
      'SELECT ID_RETO FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1': [[{ ID_RETO: 1 }]],
      'SELECT COUNT(*) AS TOTAL FROM RETOS_USUARIOS RU': [[{ total: 0 }]],
    });
    conn.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ').toUpperCase();
      if (s.startsWith('INSERT INTO RETOS_USUARIOS')) { const e = new Error('dup'); e.code = 'ER_DUP_ENTRY'; throw e; }
      if (s.startsWith('SELECT ID_RETO_USUARIO')) return [[]];
      if (s.startsWith('SELECT ID_RETO FROM RETOS')) return [[{ ID_RETO: 1 }]];
      return [[{ total: 0 }]];
    });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Ya estás inscrito en este reto');
  });

  test('error genérico → rollback del catch + 500', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    conn.rollback = vi.fn(async () => {});
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al unirse al reto' });
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  test('rollback que TAMBIÉN lanza dentro del catch → 500 igualmente', async () => {
    const conn = connDe({}, async () => { throw new Error('boom'); });
    conn.rollback = vi.fn(async () => { throw new Error('rollback caído'); });
    db.getConnection = vi.fn(async () => conn);
    const res = resFalsa();
    await retoController.unirseReto({ user: USUARIO, params: { id_reto: '1' } }, res);
    expect(res.codigo).toBe(500);
  });
});

describe('reportarProgreso — guardas iniciales', () => {
  test('id no numérico → 400 "Identificador de reto no válido" (sin tocar la BD)', async () => {
    db.query = vi.fn();
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '1/../..' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Identificador de reto no válido' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('no inscrito → 404 "No estás inscrito en este reto"', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: {} }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('No estás inscrito en este reto');
  });

  test('reto ya completado → 400 "Este reto ya fue completado"', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ COMPLETADO: 1 }]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Este reto ya fue completado');
  });

  test('reto vencido (FECHA_FIN ayer) → 400 "Este reto ya finalizó"', async () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ COMPLETADO: 0, FECHA_FIN: ayer }]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Este reto ya finalizó: no admite más avances');
  });
});

describe('reportarProgreso — modo multipart', () => {
  const archivo = (nombre, mime) => ({ path: `/tmp/${nombre}`, filename: nombre, mimetype: mime });
  const base = { COMPLETADO: 0, PROGRESO: 2, META_VALOR: 10, META_TIPO: 'km', TITULO: '10K', FECHA_FIN: null };

  test('feliz: 2 archivos locales, RUTAS_EXTRA JSON, notificación y 200', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: { cantidad: 3 }, files: [archivo('a.png', 'image/png'), archivo('b.png', 'image/png')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.en_revision).toBe(true);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][2]).toBe('imagen'); // tipoPrincipal
    expect(JSON.parse(insert[1][4])).toHaveLength(1); // rutasExtra
    expect(insert[1][5]).toBe(3); // valorCantidad = cantidad pedida (restante 8)
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'reto_evidencia', ruta: '/admin/retos' }));
    expect(cloudinary.estaConfigurado).toHaveBeenCalled();
  });

  test('más de 10 archivos → limpiarArchivos + 400 "Máximo 10 archivos por avance"', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ ...base }]] });
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: {}, files: Array.from({ length: 11 }, (_, i) => archivo(`a${i}.png`, 'image/png')) };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Máximo 10 archivos por avance');
    expect(fs.unlinkSync).toHaveBeenCalledTimes(11);
  });

  test('meta alcanzada (restante <= 0) → 400 "Ya alcanzaste la meta del reto"', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base, PROGRESO: 8 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 2 }]],
    });
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: {}, files: [archivo('a.png', 'image/png')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Ya alcanzaste la meta del reto (10 km). Espera a que aprueben tus avances.');
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  test('meta por DÍAS con avance ya reportado hoy → 400 "Ya reportaste tu avance de hoy"', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base, META_TIPO: 'dias' }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
      'SELECT COUNT(*) AS AVANCESHOY FROM RETO_EVIDENCIAS': [[{ avancesHoy: 1 }]],
    });
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: {}, files: [archivo('a.png', 'image/png')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toContain('solo permiten un avance por día');
  });

  test('meta por DÍAS sin avance hoy → INSERT con cantidad exactamente 1', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base, META_TIPO: 'sesiones', PROGRESO: 0, META_VALOR: 30 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
      'SELECT COUNT(*) AS AVANCESHOY FROM RETO_EVIDENCIAS': [[{ avancesHoy: 0 }]],
    }, () => [[]]);
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: { cantidad: 99 }, files: [archivo('a.png', 'image/png')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.cuerpo.ok).toBe(true);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][5]).toBe(1); // no acumulable: siempre 1, ignora cantidad
  });

  test('cloudinary configurado: sube, hace unlink del temporal y push a urlsCloudinary', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: {}, files: [archivo('a.png', 'image/png')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(cloudinary.subirArchivoLocal).toHaveBeenCalledWith('/tmp/a.png', { folder: 'retos/u7/r3', resource_type: 'image' });
    expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/a.png');
  });

  test('cloudinary caído con video → fallback local con ruta de usuarios', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    cloudinary.subirArchivoLocal.mockImplementation(async () => { throw new Error('503 cloud'); });
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const req = { user: USUARIO, params: { id_reto_usuario: '3' }, body: {}, files: [archivo('v.mp4', 'video/mp4')] };
    const res = resFalsa();
    await retoController.reportarProgreso(req, res);
    expect(res.cuerpo.ok).toBe(true);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][2]).toBe('video');
    expect(insert[1][3]).toBe('/images/usuarios/u7/retos/r3/v.mp4');
  });
});

describe('reportarProgreso — modo base64 (legacy) y guardarMaterial', () => {
  const base = { COMPLETADO: 0, PROGRESO: 0, META_VALOR: 10, META_TIPO: 'km', TITULO: '10K', FECHA_FIN: null };

  test('sin materiales ni material → 400 "Debes adjuntar al menos una foto o video"', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ ...base }]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Debes adjuntar al menos una foto o video como evidencia del avance');
  });

  test('más de 10 materiales base64 → 400', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ ...base }]] });
    const materiales = Array.from({ length: 11 }, () => ({ material: 'x', tipo_material: 'imagen' }));
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Máximo 10 archivos por avance');
  });

  test('archivo individual > 14 MB base64 → 400 "Cada archivo debe pesar máximo 10 MB"', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ ...base }]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales: [{ material: 'x'.repeat(14 * 1024 * 1024 + 1), tipo_material: 'imagen' }] } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Cada archivo debe pesar máximo 10 MB');
  });

  test('formato inválido (bytes no reconocidos) → guardarMaterial null → 400 de formato', async () => {
    db.query = dbDe({ 'SELECT RU.*, R.META_VALOR': [[{ ...base }]] });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales: [{ material: dataUri('image/png', Buffer.from('notmagic')), tipo_material: 'imagen' }] } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Formato de archivo no válido (jpg, png, webp, gif, mp4, webm)');
  });

  test('items sin material string se saltan; el válido se guarda local (imagen png)', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base, PROGRESO: 2 }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const materiales = [{}, null, { material: dataUri('image/png', PNG), tipo_material: 'imagen' }];
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales } }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][3]).toMatch(/^\/images\/usuarios\/u7\/retos\/r3\/imagen-\d+\.png$/);
  });

  test('video mp4 (magic ftyp) base64 → tipo video con ext mp4', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales: [{ material: dataUri('video/mp4', MP4), tipo_material: 'video' }] } }, res);
    expect(res.cuerpo.ok).toBe(true);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][2]).toBe('video');
    expect(insert[1][3]).toMatch(/\.mp4$/);
  });

  test('material legacy singular (req.body.material) y Cloudinary configurado', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': [[{ pendientes: 0 }]],
    }, () => [[]]);
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { material: dataUri('image/png', PNG), tipo_material: 'imagen' } }, res);
    expect(cloudinary.subirDataUri).toHaveBeenCalled();
    expect(res.cuerpo.ok).toBe(true);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO RETO_EVIDENCIAS'));
    expect(insert[1][3]).toBe('https://res.cloudinary.com/datauri.png'); // esUrlCloudinary true → urlsCloudinary
  });

  test('fallo de BD al consultar pendientes → catch → 500 "Error al reportar progreso"', async () => {
    db.query = dbDe({
      'SELECT RU.*, R.META_VALOR': [[{ ...base }]],
      'SELECT COALESCE(SUM(CANTIDAD), 0) AS PENDIENTES FROM RETO_EVIDENCIAS': async () => { throw new Error('boom'); },
    });
    const res = resFalsa();
    await retoController.reportarProgreso({ user: USUARIO, params: { id_reto_usuario: '3' }, body: { materiales: [{ material: dataUri('image/png', PNG), tipo_material: 'imagen' }] } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al reportar progreso' });
  });
});

describe('misRetos, misEvidencias y adminEvidencias', () => {
  test('misRetos devuelve filas y 500 en fallo', async () => {
    db.query = vi.fn(async () => [[{ ID_RETO_USUARIO: 1, TITULO: '10K' }]]);
    const res = resFalsa();
    await retoController.misRetos({ user: USUARIO }, res);
    expect(res.cuerpo).toHaveLength(1);

    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await retoController.misRetos({ user: USUARIO }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ ok: false, msg: 'Error al obtener mis retos' });
  });

  test('misEvidencias devuelve las evidencias propias y 500 en fallo', async () => {
    db.query = vi.fn(async () => [[{ ID_EVIDENCIA: 5, ESTADO: 'pendiente' }]]);
    const res = resFalsa();
    await retoController.misEvidencias({ user: USUARIO, params: { id_reto_usuario: '3' } }, res);
    expect(res.cuerpo).toHaveLength(1);
    expect(db.query.mock.calls[0][1]).toEqual(['3', 7]);

    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await retoController.misEvidencias({ user: USUARIO, params: { id_reto_usuario: '3' } }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ ok: false, msg: 'Error al obtener evidencias' });
  });

  test('adminEvidencias devuelve el listado completo y 500 en fallo', async () => {
    db.query = vi.fn(async () => [[{ ID_EVIDENCIA: 5 }]]);
    const res = resFalsa();
    await retoController.adminEvidencias({}, res);
    expect(res.cuerpo).toHaveLength(1);

    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await retoController.adminEvidencias({}, res2);
    expect(res2.codigo).toBe(500);
  });

  test('adminEvidenciaDetalle devuelve una evidencia con su reto', async () => {
    db.query = dbDe({
      'SELECT E.ID_EVIDENCIA': [[{
        ID_EVIDENCIA: 7,
        ESTADO: 'pendiente',
        TIPO: 'imagen',
        RUTA: '/evidencias/7.png',
        RETO_TITULO: 'Reto 10K',
        PROGRESO: '3',
        META_VALOR: '10',
      }]],
    });
    const res = resFalsa();
    await retoController.adminEvidenciaDetalle({ params: { id: '7' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.RETO_TITULO).toBe('Reto 10K');
    expect(res.cuerpo.PROGRESO).toBe('3');
    expect(db.query.mock.calls[0][1]).toEqual(['7']);
  });

  test('adminEvidenciaDetalle inexistente → 404 y fallo → 500', async () => {
    db.query = dbDe({ 'SELECT E.ID_EVIDENCIA': [[]] });
    const res = resFalsa();
    await retoController.adminEvidenciaDetalle({ params: { id: '404' } }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Evidencia no encontrada' });

    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res2 = resFalsa();
    await retoController.adminEvidenciaDetalle({ params: { id: '7' } }, res2);
    expect(res2.codigo).toBe(500);
    expect(res2.cuerpo).toEqual({ ok: false, msg: 'Error al obtener la evidencia' });
  });
});

describe('eliminarEvidencia — borrado de archivos propios (helpers)', () => {
  test('no encontrada → 404 "Evidencia no encontrada"', async () => {
    db.query = dbDe({ 'SELECT * FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ? AND ID_USUARIO': [[]] });
    const res = resFalsa();
    await retoController.eliminarEvidencia({ user: USUARIO, params: { id_evidencia: '5' } }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Evidencia no encontrada');
  });

  test('ya revisada → 400 "Solo puedes eliminar avances que siguen en revisión"', async () => {
    db.query = dbDe({ 'SELECT * FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ? AND ID_USUARIO': [[{ ESTADO: 'aprobado' }]] });
    const res = resFalsa();
    await retoController.eliminarEvidencia({ user: USUARIO, params: { id_evidencia: '5' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Solo puedes eliminar avances que siguen en revisión');
  });

  test('pendiente: borra local + legacy + Cloudinary, salta escapes y basura, y DELETE', async () => {
    db.query = dbDe({
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ? AND ID_USUARIO': [[{
        ESTADO: 'pendiente',
        RUTA: '/images/usuarios/u7/retos/r3/a.png',
        RUTAS_EXTRA: JSON.stringify([
          'https://res.cloudinary.com/extra.jpg',
          '/images/retos/r3/b.jpg',
          '/images/usuarios/../../../etc/passwd',
          null,
          42,
        ]),
      }]],
    }, () => [{ affectedRows: 1 }]);
    const res = resFalsa();
    await retoController.eliminarEvidencia({ user: USUARIO, params: { id_evidencia: '5' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Avance eliminado. Ya puedes enviar uno nuevo con el material correcto.' });
    // 2 unlink reales (a.png en uploads/usuarios, b.jpg en uploads/retos); el escape se salta
    expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
    expect(cloudinary.eliminarPorUrl).toHaveBeenCalledWith('https://res.cloudinary.com/extra.jpg');
    const del = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('DELETE FROM RETO_EVIDENCIAS'));
    expect(del[1]).toEqual(['5']);
  });

  test('RUTAS_EXTRA con JSON inválido → catch del parse y sin lanzar', async () => {
    db.query = dbDe({
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ? AND ID_USUARIO': [[{ ESTADO: 'pendiente', RUTA: '/images/usuarios/u7/retos/r3/a.png', RUTAS_EXTRA: '{roto' }]],
    }, () => [{ affectedRows: 1 }]);
    const res = resFalsa();
    await retoController.eliminarEvidencia({ user: USUARIO, params: { id_evidencia: '5' } }, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
  });

  test('fallo de BD → 500 "Error al eliminar la evidencia"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await retoController.eliminarEvidencia({ user: USUARIO, params: { id_evidencia: '5' } }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al eliminar la evidencia' });
  });
});

describe('aprobarEvidencia — revisión admin con cupón', () => {
  const evBase = {
    ID_EVIDENCIA: 5, ESTADO: 'pendiente', PROGRESO: 2, CANTIDAD: 1, META_VALOR: 10,
    RECOMPENSA_PORCENTAJE: 15, ID_RETO: 1, ID_RETO_USUARIO: 3, RU_USUARIO: 7,
    USUARIO_EMAIL: 'u7@test.com', USUARIO_NOMBRE: 'Ana', RETO_TITULO: '10K',
  };
  const dbAprobar = (ev, extra = {}) => dbDe({
    'SELECT E.*, RU.PROGRESO': [[ev]],
    "UPDATE RETO_EVIDENCIAS SET ESTADO = 'APROBADO'": [{ affectedRows: 1 }],
    'UPDATE RETOS_USUARIOS SET PROGRESO': [{ affectedRows: 1 }],
    'SELECT RECOMPENSA_PORCENTAJE FROM RETOS': extra.reto ? [[{ RECOMPENSA_PORCENTAJE: 15 }]] : [[]],
    'INSERT INTO DESCUENTOS': [{ insertId: 9 }],
    'UPDATE RETOS_USUARIOS SET CUPON_GENERADO': [{ affectedRows: 1 }],
  });

  test('no encontrada → 404', async () => {
    db.query = dbDe({ 'SELECT E.*, RU.PROGRESO': [[]] });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Evidencia no encontrada');
  });

  test('ya revisada (estado no pendiente) → 400', async () => {
    db.query = dbAprobar({ ...evBase, ESTADO: 'aprobado' });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta evidencia ya fue revisada');
  });

  test('carrera: UPDATE condicional no toca filas → 400 "Esta evidencia ya fue revisada"', async () => {
    db.query = dbDe({
      'SELECT E.*, RU.PROGRESO': [[evBase]],
      "UPDATE RETO_EVIDENCIAS SET ESTADO = 'APROBADO'": [{ affectedRows: 0 }],
    });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta evidencia ya fue revisada');
  });

  test('feliz SIN completar: progreso 3, sin cupón, notif + correo enviados', async () => {
    db.query = dbAprobar(evBase);
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Evidencia aprobada', progreso: 3, completado: false, cupon: null });
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'reto_aprobado', idUsuario: 7 }));
    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    expect(cloudinary.eliminarPorUrl).not.toHaveBeenCalled(); // material se conserva
  });

  test('feliz COMPLETADO: genera cupón RETO-XXXX-XXXX con monto mínimo y notifica 🏆', async () => {
    db.query = dbAprobar({ ...evBase, PROGRESO: 9, CANTIDAD: 1 }, { reto: true });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.cuerpo.msg).toBe('Evidencia aprobada y reto completado');
    expect(res.cuerpo.completado).toBe(true);
    expect(res.cuerpo.cupon).toMatch(/^RETO-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    const insert = db.query.mock.calls.find(([sql]) => sql.toUpperCase().startsWith('INSERT INTO DESCUENTOS'));
    expect(insert[1][1]).toBe(15); // porcentaje de recompensa
    expect(Number(insert[1][4])).toBeGreaterThan(0); // MONTO_MINIMO (reglasCupones REAL)
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'reto_completado' }));
  });

  test('completado pero el reto desapareció al generar el cupón → cupon null sin caer', async () => {
    db.query = dbAprobar({ ...evBase, PROGRESO: 9, CANTIDAD: 1 }, { reto: false });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.cuerpo.completado).toBe(true);
    expect(res.cuerpo.cupon).toBeNull();
  });

  test('correo que falla NO bloquea la aprobación (catch de email)', async () => {
    mailer.sendMail = vi.fn(async () => { throw new Error('SMTP caído'); });
    db.query = dbAprobar(evBase);
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.cuerpo.ok).toBe(true);
  });

  test('usuario sin email → no se intenta el correo', async () => {
    db.query = dbAprobar({ ...evBase, USUARIO_EMAIL: null });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(res.cuerpo.ok).toBe(true);
  });

  test('fallo de BD → 500 "Error al aprobar evidencia"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await retoController.aprobarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al aprobar evidencia' });
  });
});

describe('rechazarEvidencia — revisión admin', () => {
  const evBase = { ID_EVIDENCIA: 5, ESTADO: 'pendiente', RU_USUARIO: 7, USUARIO_EMAIL: 'u7@test.com', USUARIO_NOMBRE: 'Ana', RETO_TITULO: '10K' };

  test('no encontrada → 404', async () => {
    db.query = dbDe({ 'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[]] });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo.msg).toBe('Evidencia no encontrada');
  });

  test('ya revisada → 400', async () => {
    db.query = dbDe({ 'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[{ ...evBase, ESTADO: 'rechazado' }]] });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.cuerpo.msg).toBe('Esta evidencia ya fue revisada');
  });

  test('carrera del UPDATE condicional → 400', async () => {
    db.query = dbDe({
      'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[evBase]],
      "UPDATE RETO_EVIDENCIAS SET ESTADO = 'RECHAZADO'": [{ affectedRows: 0 }],
    });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toBe('Esta evidencia ya fue revisada');
  });

  test('feliz con observación: notif con Motivo + correo con el motivo escapado', async () => {
    db.query = dbDe({
      'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[evBase]],
      "UPDATE RETO_EVIDENCIAS SET ESTADO = 'RECHAZADO'": [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: { observacion: 'La foto no es clara <img>' } }, res);
    expect(res.cuerpo).toEqual({ ok: true, msg: 'Evidencia rechazada' });
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.tipo).toBe('reto_rechazado');
    expect(notif.mensaje).toContain('Motivo: La foto no es clara <img>');
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.html).toContain('&lt;img&gt;'); // escaparHtml REAL
  });

  test('sin observación → notif sin Motivo', async () => {
    db.query = dbDe({
      'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[evBase]],
      "UPDATE RETO_EVIDENCIAS SET ESTADO = 'RECHAZADO'": [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.mensaje).not.toContain('Motivo');
  });

  test('usuario sin email → sin correo, respuesta igual ok', async () => {
    db.query = dbDe({
      'SELECT E.*, RU.ID_USUARIO AS RU_USUARIO': [[{ ...evBase, USUARIO_EMAIL: null }]],
      "UPDATE RETO_EVIDENCIAS SET ESTADO = 'RECHAZADO'": [{ affectedRows: 1 }],
    });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(res.cuerpo.ok).toBe(true);
  });

  test('fallo de BD → 500 "Error al rechazar evidencia"', async () => {
    db.query = vi.fn(async () => { throw new Error('boom'); });
    const res = resFalsa();
    await retoController.rechazarEvidencia({ params: { id_evidencia: '5' }, body: {} }, res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al rechazar evidencia' });
  });
});
