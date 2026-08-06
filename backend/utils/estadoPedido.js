/**
 * RF-025: Notificaciones de estado de pedido.
 * Cuando una venta o su envío cambian de estado, se crea una notificación
 * in-app (campana) y se envía un correo al cliente. Nunca bloquea el flujo
 * del admin: cualquier error se captura y solo se loguea.
 */

const db = require('../config/db');
const transporter = require('../config/mailer');
const { crearNotificacion } = require('../controllers/notificacionController');

const TEXTO_ENVIO = {
  PENDIENTE: "está pendiente por despachar.",
  POR_EMPAQUETAR: "está listo para empacar.",
  EMPACADO: "fue empacado y está por salir.",
  EN_CAMINO: "está en camino a tu dirección.",
  ENTREGADO: "fue entregado. ¡Disfruta tu compra!",
  CANCELADO: "fue cancelado.",
};

const TEXTO_ESTADO = {
  COMPLETADA: "está confirmado y completado.",
  CONFIRMADA: "está confirmado.",
  ENVIADA: "fue enviado.",
  CANCELADA: "fue cancelado.",
  PENDIENTE: "está pendiente de confirmación.",
};

const NOMBRE_ESTADO_ENVIO = {
  PENDIENTE: "Pendiente",
  POR_EMPAQUETAR: "Por empaquetar",
  EMPACADO: "Empacado",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

/**
 * Notifica al cliente del pedido que su pedido/envío cambió de estado.
 * @param {number} idVenta
 * @param {"envio"|"venta"} tipo
 * @param {string} estadoNuevo
 */
async function notificarCambioEstado(idVenta, tipo, estadoNuevo) {
  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.ESTADO, v.TOTAL, v.REFERENCIA_PAGO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.ID_USUARIO
       FROM VENTAS v
       JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       WHERE v.ID_VENTA = ?`,
      [idVenta]
    );
    if (rows.length === 0) return;
    const v = rows[0];

    const esEnvio = tipo === "envio";
    const texto =
      (esEnvio ? TEXTO_ENVIO[estadoNuevo] : TEXTO_ESTADO[estadoNuevo]) ||
      `cambió de estado a: ${estadoNuevo}.`;
    const titulo = esEnvio ? "🛵 Actualización de tu envío" : "📦 Estado de tu pedido";
    const etiqueta = esEnvio ? (NOMBRE_ESTADO_ENVIO[estadoNuevo] || estadoNuevo) : estadoNuevo;

    await crearNotificacion({
      idUsuario: v.ID_USUARIO,
      tipo: "pedido",
      titulo,
      mensaje: `Tu pedido #${idVenta} ${texto} (${etiqueta})`,
      ruta: "/perfil/compras",
    });

    if (v.EMAIL) {
      try {
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: v.EMAIL,
          subject: `${titulo} #${idVenta} - JADDA SPORTS`,
          html: `
            <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
              <div style="background:#111827;padding:24px;text-align:center">
                <h1 style="color:#fff;margin:0;font-size:1.5rem">JADDA <span style="color:#e63946">SPORTS</span></h1>
              </div>
              <div style="padding:24px;background:#fff">
                <h2 style="margin:0 0 8px">${titulo}</h2>
                <p style="color:#666">Hola ${v.NOMBRE_USUARIO || ""},</p>
                <p style="font-size:1.1rem">Tu pedido <strong>#${idVenta}</strong> ${texto}</p>
                <p style="display:inline-block;padding:8px 16px;background:#fef2f2;color:#e63946;border-radius:8px;font-weight:700">Estado: ${etiqueta}</p>
                ${v.REFERENCIA_PAGO ? `<p style="color:#666;margin-top:12px">Referencia: ${v.REFERENCIA_PAGO}</p>` : ""}
                <p style="margin-top:16px"><a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/perfil/compras" style="background:#e63946;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">Ver mi pedido</a></p>
              </div>
              <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:0.8rem;color:#999">
                © ${new Date().getFullYear()} JADDA SPORTS · Todos los derechos reservados
              </div>
            </div>`,
        });
      } catch (emailErr) {
        console.error("Error al enviar email de estado:", emailErr);
      }
    }
  } catch (err) {
    console.error("Error en notificarCambioEstado:", err);
  }
}

module.exports = { notificarCambioEstado };
