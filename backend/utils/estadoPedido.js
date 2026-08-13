/**
 * RF-025: Notificaciones de estado de pedido.
 * Cuando una venta o su envío cambian de estado, se crea una notificación
 * in-app (campana) y se envía un correo al cliente. Nunca bloquea el flujo
 * del admin: cualquier error se captura y solo se loguea.
 */

const db = require('../config/db');
const transporter = require('../config/mailer');
const { crearNotificacion } = require('../controllers/notificacionController');
const { plantillaCorreo } = require('./correo');

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

    const [detalles] = await db.query(
      `SELECT p.NOMBRE, dv.CANTIDAD
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE dv.ID_VENTA = ?
       LIMIT 10`,
      [idVenta]
    );
    const escapar = (t) => String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const productosHtml = detalles.length
      ? `<p style="margin:12px 0 4px;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:700">Productos de tu pedido</p>
         <table style="width:100%;border-collapse:collapse">
           ${detalles.map((d, i) => `
           <tr>
             <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#334155">${i + 1}. ${escapar(d.NOMBRE)}</td>
             <td style="padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;text-align:right;white-space:nowrap">×${d.CANTIDAD}</td>
           </tr>`).join("")}
         </table>`
      : "";

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

    if (v.EMAIL && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.EMAIL)) {
      try {
        const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: v.EMAIL,
          subject: `${titulo} #${idVenta} - JADDA SPORTS`,
          html: plantillaCorreo({
            emoji: esEnvio ? "🛵" : "📦",
            titulo,
            subtitulo: `Pedido #${idVenta}`,
            saludo: `Hola ${v.NOMBRE_USUARIO || "cliente"},`,
            contenido: `
              <p style="margin:0 0 6px">Tu pedido <strong>#${idVenta}</strong> ${texto}</p>
              <p style="display:inline-block;margin:4px 0 0;padding:6px 16px;background:${esEnvio ? "#eff6ff" : "#fef2f2"};color:${esEnvio ? "#1d4ed8" : "#dc2626"};border-radius:999px;font-weight:700;font-size:13px">🚦 Estado: ${etiqueta}</p>
              ${productosHtml}
              ${v.REFERENCIA_PAGO ? `<p style="font-size:13px;color:#64748b;margin:10px 0 0">Referencia de pago: <strong>${v.REFERENCIA_PAGO}</strong></p>` : ""}
              ${v.TOTAL ? `<p style="font-size:13px;color:#64748b;margin:4px 0 0">Total: <strong>$${Number(v.TOTAL).toLocaleString("es-CO")}</strong></p>` : ""}
            `,
            botonTexto: "Ver mi pedido",
            botonEnlace: `${frontend}/perfil/compras`,
            notas: ["📌 Recibirás otra actualización cuando tu pedido cambie de estado."],
          }),
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
