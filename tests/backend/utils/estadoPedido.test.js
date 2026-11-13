/**
 * estadoPedido (RF-025): notificación in-app + correo con la tabla de
 * productos del pedido. NUNCA bloquea: errores de BD/SMTP capturados.
 *
 * NOTA DE INFRA: archivo CJS-style (require puro, cero `import`) — vi.mock
 * no intercepta en este setup de Vitest; las dependencias (BD con _useDb,
 * transporter, crearNotificacion) se MUTAN antes del require del SUT.
 */

const { vi, beforeEach, describe, test, expect } = globalThis;

const mailer = require('../../../backend/config/mailer');
const notificacionController = require('../../../backend/controllers/notificacionController');

// MUTACIONES ANTES del require del SUT: estadoPedido captura la referencia
// por destructuring en su carga — reasignar después no lo alcanza.
mailer.sendMail = vi.fn(async () => ({}));
notificacionController.crearNotificacion = vi.fn(async () => ({}));

const estadoPedido = require('../../../backend/utils/estadoPedido');
const { notificarCambioEstado } = estadoPedido;

const db = { query: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  db.query = vi.fn();
  estadoPedido._useDb(db);
});

const ventaBase = {
  ID_VENTA: 15,
  ESTADO: 'COMPLETADA',
  TOTAL: 207000,
  REFERENCIA_PAGO: 'SIM_1',
  NOMBRE_USUARIO: 'Ana',
  APELLIDO_USUARIO: 'Gómez',
  EMAIL: 'ana@test.com',
  ID_USUARIO: 7,
};

describe('notificarCambioEstado', () => {
  test('envío EN CAMINO: notificación de envío + correo con productos y estado legible', async () => {
    db.query
      .mockResolvedValueOnce([[ventaBase]]) // venta + cliente
      .mockResolvedValueOnce([[{ NOMBRE: 'Guayos Pro', CANTIDAD: 2 }]]); // detalle
    await notificarCambioEstado(15, 'envio', 'EN_CAMINO');

    expect(notificacionController.crearNotificacion).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuario: 7,
        tipo: 'pedido',
        titulo: '🛵 Actualización de tu envío',
        ruta: '/perfil/compras',
      }),
    );
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.mensaje).toContain('En camino');

    expect(mailer.sendMail).toHaveBeenCalledTimes(1);
    const correo = mailer.sendMail.mock.calls[0][0];
    expect(correo.subject).toContain('Actualización de tu envío');
    expect(correo.html).toContain('Guayos Pro');
    expect(correo.html).toContain('Referencia de pago');
  });

  test('cambio de ESTADO de la venta usa los textos de venta', async () => {
    db.query
      .mockResolvedValueOnce([[ventaBase]])
      .mockResolvedValueOnce([[]]);
    await notificarCambioEstado(15, 'venta', 'CANCELADA');
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.titulo).toBe('📦 Estado de tu pedido');
    expect(notif.mensaje).toContain('fue cancelado');
  });

  test('estado desconocido cae al texto genérico sin reventar', async () => {
    db.query
      .mockResolvedValueOnce([[ventaBase]])
      .mockResolvedValueOnce([[]]);
    await notificarCambioEstado(15, 'venta', 'ESTADO_RARO');
    const notif = notificacionController.crearNotificacion.mock.calls[0][0];
    expect(notif.mensaje).toContain('ESTADO_RARO');
  });

  test('venta inexistente: no notifica ni manda correo', async () => {
    db.query.mockResolvedValueOnce([[]]);
    await notificarCambioEstado(999, 'envio', 'ENTREGADO');
    expect(notificacionController.crearNotificacion).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('correo inválido (sin @) se SALTA sin error', async () => {
    db.query
      .mockResolvedValueOnce([[{ ...ventaBase, EMAIL: 'yeison' }]])
      .mockResolvedValueOnce([[]]);
    await notificarCambioEstado(15, 'envio', 'ENTREGADO');
    expect(notificacionController.crearNotificacion).toHaveBeenCalledTimes(1);
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  test('fallo de SMTP NO revienta (best-effort)', async () => {
    db.query
      .mockResolvedValueOnce([[ventaBase]])
      .mockResolvedValueOnce([[]]);
    mailer.sendMail = vi.fn(async () => { throw new Error('SMTP caído'); });
    await expect(notificarCambioEstado(15, 'envio', 'ENTREGADO')).resolves.toBeUndefined();
    expect(notificacionController.crearNotificacion).toHaveBeenCalledTimes(1);
  });

  test('fallo de BD capturado (la notificación nunca bloquea al admin)', async () => {
    db.query = vi.fn(async () => { throw new Error('BD caída'); });
    await expect(notificarCambioEstado(15, 'envio', 'ENTREGADO')).resolves.toBeUndefined();
  });
});
