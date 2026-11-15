/**
 * imagenController — subida de imágenes base64 desde el panel (unit).
 *
 * Dependencias MUTADAS ANTES del require del SUT (destructuradas en carga):
 * - utils/cloudinary: estaConfigurado/subirBuffer/carpetaSegura (vi.fn)
 * - fs: mkdirSync/readdirSync/writeFileSync por propiedad (restaurados).
 * detectarFormato es REAL (magic bytes); la BD entra por _useDb.
 * Se cubren: guardas de entrada (vacío/no array/9 imgs/límite base64),
 * ownership de vendedor (403/404/propio), idProducto inválido (A03), flujo
 * Cloudinary (ok, fallo → local), escritura local con numeración img_N,
 * rechazos por contenido (6MB, bytes no reconocidos, MIME≠real) y 500.
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const fs = require('fs');
const cloudinary = require('../../../backend/utils/cloudinary');

cloudinary.estaConfigurado = vi.fn(() => false);
cloudinary.subirBuffer = vi.fn(async () => ({ secure_url: 'https://cdn.cloudinary/stub.png' }));
cloudinary.carpetaSegura = vi.fn((raiz, sub) => `${raiz}/${sub}`);

const imagenController = require('../../../backend/controllers/imagenController');
const { subirImagenes } = imagenController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const req = (over = {}) => ({ user: null, vendedor: null, body: {}, ...over });

// Bytes mágicos REALES (detectarFormato no está mockeado)
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a46494600', 'hex');

const dataUrl = (mime, buffer) => `data:${mime};base64,${buffer.toString('base64')}`;
const ADMIN = { ID_USUARIO: 1, ID_ROL: 1 };
const VENDEDOR = { ID_USUARIO: 7, ID_ROL: 6 };

const mkdirSyncReal = fs.mkdirSync;
const readdirSyncReal = fs.readdirSync;
const writeFileSyncReal = fs.writeFileSync;

beforeEach(() => {
  vi.clearAllMocks();
  cloudinary.estaConfigurado.mockImplementation(() => false);
  cloudinary.subirBuffer.mockImplementation(async () => ({ secure_url: 'https://cdn.cloudinary/stub.png' }));
  cloudinary.carpetaSegura.mockImplementation((raiz, sub) => `${raiz}/${sub}`);
  fs.mkdirSync = vi.fn();
  fs.readdirSync = vi.fn(() => ['img_1.png', 'img_3.jpg', 'banner.txt']);
  fs.writeFileSync = vi.fn();
});

afterEach(() => {
  fs.mkdirSync = mkdirSyncReal;
  fs.readdirSync = readdirSyncReal;
  fs.writeFileSync = writeFileSyncReal;
});

describe('subirImagenes — guardas de entrada', () => {
  test('sin imagenes → 400 "No se enviaron imágenes"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ body: {} }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'No se enviaron imágenes' });
  });

  test('imagenes no es un array → 400', async () => {
    const res = resFalsa();
    await subirImagenes(req({ body: { imagenes: 'no' } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe('No se enviaron imágenes');
  });

  test('array vacío → 400', async () => {
    const res = resFalsa();
    await subirImagenes(req({ body: { imagenes: [] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe('No se enviaron imágenes');
  });

  test('9 imágenes → 400 "Máximo 8 imágenes por solicitud"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ body: { imagenes: Array.from({ length: 9 }, () => ({ data: 'x' })) } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe('Máximo 8 imágenes por solicitud');
  });

  test('total base64 > 14 MB → 400 límite', async () => {
    const res = resFalsa();
    await subirImagenes(req({ body: { imagenes: [{ data: 'a'.repeat(14 * 1024 * 1024 + 1) }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe('El total de imágenes supera el límite permitido (10 MB)');
  });
});

describe('subirImagenes — ownership del vendedor (A03)', () => {
  test('idProducto con caracteres no numéricos → 400 "idProducto inválido"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { idProducto: '../../hack', imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'idProducto inválido' });
  });

  test('no admin sin idVendedor → 403 "No autorizado"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: { ID_USUARIO: 8, ID_ROL: 4 }, body: { idProducto: '5', imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo).toEqual({ error: 'No autorizado' });
  });

  test('producto no encontrado → 404', async () => {
    const db = { query: vi.fn(async () => [[]]) };
    imagenController._useDb(db);
    const res = resFalsa();
    await subirImagenes(req({ user: VENDEDOR, vendedor: { ID_VENDEDOR: 5 }, body: { idProducto: '5', imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(404);
    expect(res.cuerpo).toEqual({ error: 'Producto no encontrado' });
  });

  test('producto de OTRO vendedor → 403 "Solo puedes subir imágenes a tus propios productos"', async () => {
    const db = { query: vi.fn(async () => [[{ ID_VENDEDOR: 99 }]]) };
    imagenController._useDb(db);
    const res = resFalsa();
    await subirImagenes(req({ user: VENDEDOR, vendedor: { ID_VENDEDOR: 5 }, body: { idProducto: '5', imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(403);
    expect(res.cuerpo).toEqual({ error: 'Solo puedes subir imágenes a tus propios productos' });
  });

  test('fallo de BD en el ownership → 500 "Error al guardar las imágenes"', async () => {
    const db = { query: vi.fn(async () => { throw new Error('boom'); }) };
    imagenController._useDb(db);
    const res = resFalsa();
    await subirImagenes(req({ user: VENDEDOR, vendedor: { ID_VENDEDOR: 5 }, body: { idProducto: '5', imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al guardar las imágenes en el servidor' });
  });
});

describe('subirImagenes — flujo Cloudinary', () => {
  test('cloudinary configurado: sube por Cloudinary y NO escribe en local', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    imagenController._useDb({ query: vi.fn(async () => [[{ ID_VENDEDOR: 5 }]]) });
    const res = resFalsa();
    await subirImagenes(req({ user: VENDEDOR, vendedor: { ID_VENDEDOR: 5 }, body: { idProducto: '5', imagenes: [{ nombre: 'a.png', data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ urls: ['https://cdn.cloudinary/stub.png'] });
    expect(cloudinary.subirBuffer).toHaveBeenCalledWith(expect.any(Buffer), { folder: 'productos/producto-5', resource_type: 'image' });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  test('cloudinary configurado pero FALLA: cae al disco local', async () => {
    cloudinary.estaConfigurado.mockImplementation(() => true);
    cloudinary.subirBuffer.mockImplementation(async () => { throw new Error('503 cloud caído'); });
    imagenController._useDb({ query: vi.fn(async () => [[{ ID_VENDEDOR: 5 }]]) });
    const res = resFalsa();
    await subirImagenes(req({ user: VENDEDOR, vendedor: { ID_VENDEDOR: 5 }, body: { idProducto: '5', imagenes: [{ nombre: 'a.png', data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.cuerpo.urls).toEqual(['/images/productos/Producto_05/img_4.png']);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });
});

describe('subirImagenes — escritura local', () => {
  test('con idProducto: carpeta Producto_NN y numeración img_N desde el máximo existente', async () => {
    imagenController._useDb({ query: vi.fn(async () => [[{ ID_VENDEDOR: 5 }]]) });
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { idProducto: '5', imagenes: [{ nombre: 'a.png', data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo).toEqual({ urls: ['/images/productos/Producto_05/img_4.png'] });
    expect(fs.mkdirSync).toHaveBeenCalled();
    const ruta = fs.writeFileSync.mock.calls[0][0];
    expect(ruta.replace(/\\/g, '/')).toContain('/uploads/Producto_05/');
    expect(fs.readdirSync).toHaveBeenCalled();
    expect(cloudinary.carpetaSegura).toHaveBeenCalledWith('productos', 'producto-5');
  });

  test('sin idProducto: carpeta subidas, nombre aleatorio y carpetaCloud "nuevos"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ nombre: 'a.png', data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.cuerpo.urls[0]).toMatch(/^\/images\/productos\/subidas\/\d+-[0-9a-f]+\.png$/);
    expect(cloudinary.carpetaSegura).toHaveBeenCalledWith('productos', 'nuevos');
  });

  test('varios formatos válidos (png + jpeg) → ext por formato REAL en orden', async () => {
    imagenController._useDb({ query: vi.fn(async () => [[{ ID_VENDEDOR: 5 }]]) });
    const res = resFalsa();
    await subirImagenes(req({
      user: ADMIN,
      body: {
        idProducto: '5',
        imagenes: [
          { nombre: 'a.png', data: dataUrl('image/png', PNG) },
          { nombre: 'b.jpg', data: dataUrl('image/jpeg', JPEG) },
        ],
      },
    }), res);
    const nombres = fs.writeFileSync.mock.calls.map(([ruta]) => String(ruta).split(/[\\/]/).pop());
    expect(nombres).toEqual(['img_4.png', 'img_5.jpg']);
  });

  test('items sin data o con data inválida se descartan (regex) y no bloquean', async () => {
    const res = resFalsa();
    await subirImagenes(req({
      user: ADMIN,
      body: {
        imagenes: [
          { nombre: 'sin-data' },
          { nombre: 'no-url', data: 'no-es-data-url' },
          { nombre: 'ok.png', data: dataUrl('image/png', PNG) },
        ],
      },
    }), res);
    expect(res.cuerpo.urls[0]).toMatch(/^\/images\/productos\/subidas\/\d+-[0-9a-f]+\.png$/);
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  test('fallo de mkdirSync → 500 "Error al guardar las imágenes"', async () => {
    fs.mkdirSync = vi.fn(() => { throw new Error('permiso denegado'); });
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ data: dataUrl('image/png', PNG) }] } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ error: 'Error al guardar las imágenes en el servidor' });
  });
});

describe('subirImagenes — rechazos por contenido', () => {
  test('buffer > 6 MB → 400 "supera el límite de 6 MB por imagen"', async () => {
    const enorme = Buffer.alloc(7 * 1024 * 1024, 0x89);
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ nombre: 'grande.png', data: dataUrl('image/png', enorme) }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El archivo grande.png supera el límite de 6 MB por imagen' });
  });

  test('bytes no reconocidos → 400 "no es una imagen válida (bytes no reconocidos)"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ nombre: 'raro.png', data: dataUrl('image/png', Buffer.from('notmagic')) }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El archivo raro.png no es una imagen válida (bytes no reconocidos)' });
  });

  test('MIME declarado ≠ contenido real → 400 "declara ... pero su contenido es otro"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ nombre: 'mente.png', data: dataUrl('image/jpeg', PNG) }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo).toEqual({ error: 'El archivo mente.png declara image/jpeg pero su contenido es otro' });
  });

  test('ningún formato válido → 400 "Ningún archivo tenía un formato de imagen válido"', async () => {
    const res = resFalsa();
    await subirImagenes(req({ user: ADMIN, body: { imagenes: [{ nombre: 'raro.png', data: 'no-es-data-url' }] } }), res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.error).toBe('Ningún archivo tenía un formato de imagen válido (jpg, png, webp, gif)');
  });
});
