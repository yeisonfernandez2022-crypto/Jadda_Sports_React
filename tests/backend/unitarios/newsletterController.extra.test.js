/**
 * newsletterController — caminos que la suite base (newsletter.test.js) no
 * cubre: el ENVÍO del lote completo (enviarNewsletterAhora con suscritos:
 * ofertas reales de la BD, htmlOfertas con data URIs, reemplazo de SU_CORREO/
 * SU_TOKEN por suscriptor, el delay anti-spam y el lote registrado con sus
 * conteos), enviarAhora (200/500), y los catch de suscribir/desuscribir/
 * obtenerSuscritos/desuscribirPagina ante fallo de BD. Suite NUEVA: la base
 * no se edita. Deps destructuradas en carga (plantillaCorreo,
 * imagenComoDataUri) se mutan ANTES del require; el token HMAC queda REAL
 * (con SESSION_SECRET fijado) y el transporter es el módulo mailer.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const correoMod = require('../../../backend/utils/correo');
const mailer = require('../../../backend/config/mailer');

// destructuring en carga → mutar ANTES del require del SUT
correoMod.plantillaCorreo = vi.fn((datos) => `<html>${(datos.notas || []).join(' ')}</html>`);
correoMod.imagenComoDataUri = vi.fn(async () => 'data:image/png;base64,QQ==');
mailer.sendMail = vi.fn(async () => ({ accepted: true }));

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'secreto-test-newsletter';

const newsletterController = require('../../../backend/controllers/newsletterController');
const {
  suscribirNewsletter, desuscribirNewsletter, desuscribirPagina,
  obtenerSuscritos, enviarNewsletterAhora, enviarAhora,
} = newsletterController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.enviado = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  res.send = (c) => { res.enviado = c; return res; };
  return res;
};

const dbDe = (rutas = {}, defecto) => {
  const claves = Object.keys(rutas).sort((a, b) => b.length - a.length);
  return vi.fn(async (sql, params) => {
    // trim: los template literals del SUT empiezan con newline → ' SELECT...'
    const s = sql.replace(/\s+/g, ' ').trim().toUpperCase();
    for (const clave of claves) {
      if (s.startsWith(clave.toUpperCase())) {
        const r = rutas[clave];
        return typeof r === 'function' ? r(params) : r;
      }
    }
    return defecto ? defecto(params) : [{}];
  });
};

const req = (over = {}) => ({ user: null, params: {}, body: {}, query: {}, ...over });

const OFERTAS = [
  { ID: 1, NOMBRE: 'Guayos Speed', PRECIO: 50000, MARCA: 'Nike', PORCENTAJE: 10, IMAGEN: '/img1.png' },
  { ID: 2, NOMBRE: 'Balon Pro', PRECIO: 80000, MARCA: 'Adidas', PORCENTAJE: 25, IMAGEN: '/img2.png' },
];
const SUSCRITOS = [{ EMAIL: 'a@t.co', FECHA_SUSCRIPCION: '2026-01-01' }, { EMAIL: 'b@t.co', FECHA_SUSCRIPCION: '2026-01-02' }];

beforeEach(() => {
  vi.clearAllMocks();
  correoMod.plantillaCorreo.mockImplementation((datos) => `<html>${(datos.notas || []).join(' ')}</html>`);
  correoMod.imagenComoDataUri.mockImplementation(async () => 'data:image/png;base64,QQ==');
  mailer.sendMail.mockImplementation(async () => ({ accepted: true }));
  newsletterController._useDb({ query: dbDe() });
});

describe('catches de BD (suscribir, desuscribir, lista y página)', () => {
  test('suscribir con BD caída → 500 "Error al suscribirse"', async () => {
    newsletterController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await suscribirNewsletter(req({ body: { email: 'a@t.co' } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al suscribirse' });
  });

  test('desuscribir con BD caída → 500 "Error al desuscribirse"', async () => {
    const { generarTokenDesuscripcion } = require('../../../backend/utils/desuscripcionToken');
    newsletterController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await desuscribirNewsletter(req({ body: { email: 'A@T.co', token: generarTokenDesuscripcion('a@t.co') } }), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al desuscribirse' });
  });

  test('obtenerSuscritos con BD caída → 500 "Error al leer suscritos"', async () => {
    newsletterController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const res = resFalsa();
    await obtenerSuscritos(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'Error al leer suscritos' });
  });

  test('página: SELECT del correo rechaza → página ok SIN bloque de correo y UPDATE igual ejecutado', async () => {
    const { generarTokenDesuscripcion } = require('../../../backend/utils/desuscripcionToken');
    const dbq = dbDe({
      'SELECT EMAIL FROM NEWSLETTER_SUSCRIPTOS WHERE EMAIL': async () => { throw new Error('boom'); },
    });
    newsletterController._useDb({ query: dbq });
    const res = resFalsa();
    await desuscribirPagina(req({ query: { email: 'a@t.co', token: generarTokenDesuscripcion('a@t.co') } }), res);
    expect(res.codigo).toBeNull();
    expect(res.enviado).toContain('Te desuscribiste');
    expect(res.enviado).not.toContain('Correo desuscripto'); // sin fila no se muestra el correo
    expect(dbq.mock.calls.some(([sql]) => sql.toUpperCase().startsWith('UPDATE NEWSLETTER_SUSCRIPTOS'))).toBe(true);
  });

  test('página: UPDATE rechaza → igual responde ok (best-effort)', async () => {
    const { generarTokenDesuscripcion } = require('../../../backend/utils/desuscripcionToken');
    newsletterController._useDb({
      query: dbDe({
        'SELECT EMAIL FROM NEWSLETTER_SUSCRIPTOS WHERE EMAIL': [[{ EMAIL: 'a@t.co' }]],
        'UPDATE NEWSLETTER_SUSCRIPTOS SET ACTIVO = 0': async () => { throw new Error('boom'); },
      }),
    });
    const res = resFalsa();
    await desuscribirPagina(req({ query: { email: 'a@t.co', token: generarTokenDesuscripcion('a@t.co') } }), res);
    expect(res.enviado).toContain('Te desuscribiste');
    expect(res.enviado).toContain('Correo desuscripto'); // la fila SÍ estaba: bloque con correo enmascarado
  });
});

describe('enviarNewsletterAhora — lote completo con suscritos', () => {
  const rutasLote = ({ ofertas = OFERTAS, suscritos = SUSCRITOS } = {}) => {
    const capturadas = { lote: null, plantilla: null };
    const dbq = dbDe({
      // el valor de la ruta es lo que resuelve db.query: [rows] (SUT: const [rows] = ...)
      'SELECT EMAIL, FECHA_SUSCRIPCION FROM NEWSLETTER_SUSCRIPTOS': [suscritos],
      'SELECT P.ID, P.NOMBRE, P.PRECIO, P.MARCA': [ofertas],
      'INSERT INTO NEWSLETTER_ENVIOS': (params) => { capturadas.lote = params; return [{}]; },
    });
    return { dbq, capturadas };
  };

  test('feliz: 2 correos con SU_CORREO/SU_TOKEN reemplazados, data URIs y lote [tema, 2, 0]', async () => {
    const { dbq, capturadas } = rutasLote();
    newsletterController._useDb({ query: dbq });
    const resultado = await enviarNewsletterAhora();
    expect(resultado.ok).toBe(true);
    expect(resultado.enviados).toBe(2);
    expect(resultado.suscritos).toBe(2);
    expect(resultado.fallidos).toBe(0);
    expect(['¡Ofertas que no te puedes perder!', 'Lo mejor en deportes, directo a tu correo', 'Novedades y descuentos exclusivos', '¡Tu próxima compra deportiva espera!']).toContain(resultado.tema);
    expect(capturadas.lote).toEqual([resultado.tema, 2, 0]); // registrarLote
    expect(mailer.sendMail).toHaveBeenCalledTimes(2);
    expect(mailer.sendMail.mock.calls[0][0].to).toBe('a@t.co');
    const html = mailer.sendMail.mock.calls[0][0].html;
    expect(html).toContain('a%40t.co'); // SU_CORREO → encodeURIComponent del email
    expect(html).not.toContain('SU_TOKEN'); // SU_TOKEN → token HMAC real
    expect(correoMod.imagenComoDataUri).toHaveBeenCalledTimes(2);
    // las ofertas van con precio final $45.000 (-10%) y $60.000 (-25%)
    expect(correoMod.plantillaCorreo.mock.calls[0][0].contenido).toContain('$45.000');
    expect(correoMod.plantillaCorreo.mock.calls[0][0].contenido).toContain('$60.000');
    expect(correoMod.plantillaCorreo.mock.calls[0][0].contenido).toContain('data:image/png;base64,QQ==');
  });

  test('sin ofertas en la BD → el contenido cae al párrafo del catálogo', async () => {
    const { dbq, capturadas } = rutasLote({ ofertas: [] });
    newsletterController._useDb({ query: dbq });
    const resultado = await enviarNewsletterAhora();
    expect(resultado.enviados).toBe(2);
    expect(correoMod.plantillaCorreo.mock.calls[0][0].contenido).toContain('catálogo completo');
    expect(correoMod.imagenComoDataUri).not.toHaveBeenCalled();
    expect(capturadas.lote).toEqual([expect.any(String), 2, 0]);
  });

  test('SMTP falla en UN suscriptor → enviados 1, fallidos 1 y el lote lo registra', async () => {
    // encolar sobre el mock compartido (mockImplementationOnce NO se limpia con clearAllMocks:
    // reasignar el vi.fn completo fuga la cola pendiente al test siguiente)
    mailer.sendMail.mockImplementationOnce(async () => ({ accepted: true }));
    mailer.sendMail.mockImplementationOnce(async () => { throw new Error('smtp caído'); });
    const { dbq, capturadas } = rutasLote();
    newsletterController._useDb({ query: dbq });
    const resultado = await enviarNewsletterAhora();
    expect(resultado).toEqual({ ok: true, enviados: 1, suscritos: 2, tema: expect.any(String), fallidos: 1 });
    expect(capturadas.lote).toEqual([expect.any(String), 1, 1]);
  });

  test('BD caída al leer suscritos → { ok: false } con el mensaje del error', async () => {
    newsletterController._useDb({ query: vi.fn(async () => { throw new Error('boom'); }) });
    const resultado = await enviarNewsletterAhora();
    expect(resultado).toEqual({ ok: false, msg: 'boom' });
  });
});

describe('enviarAhora (POST /api/newsletter/enviar, solo admin)', () => {
  test('200 con el resultado del envío', async () => {
    newsletterController._useDb({ query: dbDe({
      'SELECT EMAIL, FECHA_SUSCRIPCION FROM NEWSLETTER_SUSCRIPTOS': [SUSCRITOS],
      'SELECT P.ID, P.NOMBRE, P.PRECIO, P.MARCA': [OFERTAS],
      'INSERT INTO NEWSLETTER_ENVIOS': [{}],
    }) });
    const res = resFalsa();
    await enviarAhora(req(), res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.enviados).toBe(2);
  });

  test('envío fallido → 500 con el mensaje del error', async () => {
    newsletterController._useDb({ query: vi.fn(async () => { throw new Error('bd caída'); }) });
    const res = resFalsa();
    await enviarAhora(req(), res);
    expect(res.codigo).toBe(500);
    expect(res.cuerpo).toEqual({ ok: false, msg: 'bd caída' });
  });
});
