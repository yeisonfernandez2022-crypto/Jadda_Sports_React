/**
 * contactoController — formulario de contacto público (unit).
 *
 * mailer y notificacionController se mutan ANTES del require del SUT. Se
 * cubren las 4 guardas de campos, el envío best-effort (el fallo SMTP no
 * bloquea), la campana admin con recorte a 120 caracteres y el escape HTML
 * anti-XSS del mensaje.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

mailer.sendMail = vi.fn(async () => ({ accepted: true }));
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const contactoController = require('../../../backend/controllers/contactoController');
const { enviarContacto } = contactoController;

const resFalsa = () => {
  const res = {};
  res.codigo = null;
  res.cuerpo = null;
  res.status = (c) => { res.codigo = c; return res; };
  res.json = (c) => { res.cuerpo = c; return res; };
  return res;
};

const bodyOk = { nombre: 'Ana', email: 'ana@test.com', asunto: 'Duda', mensaje: '¿Tienen guayos talla 38?' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('enviarContacto', () => {
  test('nombre faltante → 400 "El nombre es obligatorio."', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, nombre: '' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('El nombre es obligatorio.');
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('email faltante → 400', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, email: null } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('El correo es obligatorio.');
  });

  test('asunto faltante → 400', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, asunto: '   ' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('El asunto es obligatorio.');
  });

  test('mensaje faltante → 400', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, mensaje: undefined } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.message).toBe('El mensaje es obligatorio.');
  });

  test('feliz: correo con from objeto, subject con asunto, HTML escapado y campana', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, nombre: 'An<>"a', mensaje: 'Msg <script>x</script>' } }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.message).toBe('Mensaje enviado correctamente. Te responderemos pronto.');
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.from).toEqual({ name: 'An<>"a', address: process.env.EMAIL_USER });
    expect(correo.to).toBe(process.env.EMAIL_USER);
    expect(correo.subject).toBe('📩 Duda - Contacto desde JADDA SPORTS');
    expect(correo.html).toContain('An&lt;&gt;&quot;a');
    expect(correo.html).toContain('Msg &lt;script&gt;x&lt;/script&gt;');
    expect(correo.html).not.toContain('<script>');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(expect.objectContaining({
      idUsuario: null, tipo: 'contacto', titulo: '📩 Nuevo mensaje de contacto', ruta: '/admin',
    }));
    const campana = notificacionController.crearNotificacion.mock.calls[0][0];
    // La campana usa el nombre SIN escapar (raw) — solo recorta a 120.
    expect(campana.mensaje).toBe('An<>"a (ana@test.com): Duda');
  });

  test('fallo SMTP → best-effort, sigue con campana y 200', async () => {
    mailer.sendMail.mockImplementationOnce(async () => { throw new Error('535 SMTP caído'); });
    const res = resFalsa();
    await enviarContacto({ body: bodyOk }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.message).toBe('Mensaje enviado correctamente. Te responderemos pronto.');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledTimes(1);
  });

  test('fallo de la campana → no bloquea la respuesta', async () => {
    notificacionController.crearNotificacion.mockImplementationOnce(async () => { throw new Error('campana caída'); });
    const res = resFalsa();
    await enviarContacto({ body: bodyOk }, res);
    expect(res.codigo).toBeNull();
    expect(res.cuerpo.message).toBe('Mensaje enviado correctamente. Te responderemos pronto.');
  });

  test('mensaje largo en campana se recorta a 120 caracteres', async () => {
    const res = resFalsa();
    await enviarContacto({ body: { ...bodyOk, asunto: 'a'.repeat(200), nombre: 'Nombre Largo Que Cuenta En El Recorte', email: 'largo@test.com' } }, res);
    const campana = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(campana.mensaje.length).toBeLessThanOrEqual(120);
  });
});
