const db = require('../config/db');
const transporter = require('../config/mailer');
const { calcularCostoEnvio } = require('../utils/envio');

/**
 * Convierte rutas locales (/images/...) en URLs absolutas para el correo
 * (los clientes de email no resuelven rutas relativas).
 */
const imagenParaCorreo = (url) => {
  if (!url) return 'https://placehold.co/48x48/eee/999?text=No+img';
  if (url.startsWith('/')) {
    return (process.env.FRONTEND_URL || 'http://localhost:5173') + url;
  }
  return url;
};

/**
 * Procesa el checkout completo: inserta venta, detalle, envío, genera plan de
 * entrenamiento y envía factura por correo electrónico.
 */

/**
 * Mapeo de las claves enviadas desde el frontend (tarjeta, pse, nequi, daviplata)
 * a los IDs reales de la tabla METODOS_PAGO en la base de datos.
 */
const METODO_MAP = {
  tarjeta: 2,
  pse: 7,
  nequi: 4,
  daviplata: 5,
};

/**
 * Controlador principal de compra.
 * 1. Valida autenticación del usuario y que el carrito no esté vacío.
 * 2. Calcula subtotal y total FINAL EN EL SERVIDOR (nunca se confía en el
 *    totalFinal que envía el cliente): valida el cupón contra la BD y
 *    aplica su porcentaje.
 * 3. Ejecuta TODO dentro de una transacción: si algo falla a mitad, se
 *    revierte (venta, detalle, envío, carrito, plan).
 * 4. (Pendiente de habilitar tras pruebas) Decrementar stock y registrar
 *    MOVIMIENTOS_STOCK. Por ahora solo VALIDA stock (sin decrementar).
 * 5. Envía factura por correo solo después de confirmar la transacción.
 */
const procesarCompra = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });

    const {
      metodoPago,
      paymentData,
      cuponCodigo,
      nombre,
      correo,
      telefono,
      direccion,
      barrio,
      ciudad,
      departamento,
      codigoPostal,
      observaciones,
    } = req.body;

    const idMetodo = METODO_MAP[metodoPago] || 1;

    const [cart] = await conn.query(
      `SELECT c.ID_CARRITO, c.ID_PRODUCTO, c.CANTIDAD, c.ID_VARIANTE,
              p.PRECIO, p.NOMBRE, pi.URL_IMAGEN, pv.STOCK,
              p.ID_DESCUENTO, d.PORCENTAJE AS DESCUENTO_PORCENTAJE
       FROM CARRITO c
       JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
       LEFT JOIN DESCUENTOS d ON p.ID_DESCUENTO = d.ID_DESCUENTO
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON c.ID_VARIANTE = pv.ID_VARIANTE
       WHERE c.ID_USUARIO = ?`,
      [idUsuario]
    );

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    // ---- Precio con descuento por producto (ID_DESCUENTO) ----
    const items = cart.map((item) => {
      const pct = Number(item.DESCUENTO_PORCENTAJE) || 0;
      const precioOriginal = Number(item.PRECIO);
      const precioFinal = pct > 0
        ? Math.round(precioOriginal * (1 - pct / 100) * 100) / 100
        : precioOriginal;
      return { ...item, PRECIO_FINAL: precioFinal };
    });

    // ---- Validar stock SIN decrementar (el decremento se habilitará tras pruebas) ----
    for (const item of cart) {
      const stockVariante = Number(item.STOCK);
      if (!Number.isNaN(stockVariante) && item.CANTIDAD > stockVariante) {
        const msg = stockVariante <= 0
          ? `El producto "${item.NOMBRE}" está agotado. Quítalo del carrito para continuar.`
          : `El producto "${item.NOMBRE}" solo tiene ${stockVariante} unidades disponibles y pediste ${item.CANTIDAD}. Ajusta la cantidad para continuar.`;
        return res.status(400).json({ error: msg });
      }
    }

    // ---- Total calculado 100% en el servidor (con descuento por producto) ----
    const subtotal = items.reduce((acc, item) => acc + item.PRECIO_FINAL * item.CANTIDAD, 0);

    let descuento = 0;
    let cuponAplicado = null;
    if (cuponCodigo && String(cuponCodigo).trim() !== "") {
      const [cuponRows] = await conn.query(
        `SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, USADO
         FROM DESCUENTOS
         WHERE DESCRIPCION LIKE ?`,
        [`%${String(cuponCodigo).trim()}%`]
      );
      if (cuponRows.length > 0) {
        const cupon = cuponRows[0];
        const hoy = new Date();
        const vigente =
          (!cupon.FECHA_INICIO || new Date(cupon.FECHA_INICIO) <= hoy) &&
          (!cupon.FECHA_FIN || new Date(cupon.FECHA_FIN) >= hoy);
        const esCuponReto = /^RETO-/.test(String(cupon.DESCRIPCION || "").trim());
        const yaUsado = esCuponReto && Number(cupon.USADO) === 1;
        if (vigente && !yaUsado) {
          descuento = Math.round(subtotal * (Number(cupon.PORCENTAJE) / 100));
          cuponAplicado = cupon.ID_DESCUENTO;
        }
      }
    }
    const costoEnvio = calcularCostoEnvio(departamento, subtotal);
    const total = subtotal - descuento + costoEnvio;

    await conn.beginTransaction();

    // ---- Registrar la venta ----
    const referenciaPago = `SIM_${Date.now()}_${idUsuario}`;
    const datosPagoJSON = paymentData ? JSON.stringify(paymentData) : null;

    const [ventaResult] = await conn.query(
      `INSERT INTO VENTAS (ID_CLIENTE, FECHA_VENTA, TOTAL, ESTADO, ID_METODO, REFERENCIA_PAGO, DATOS_PAGO)
       VALUES (?, NOW(), ?, 'COMPLETADA', ?, ?, ?)`,
      [idUsuario, total, idMetodo, referenciaPago, datosPagoJSON]
    );
    const idVenta = ventaResult.insertId;

    for (const item of items) {
      const subtotalItem = item.PRECIO_FINAL * item.CANTIDAD;
      await conn.query(
        `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
         VALUES (?, ?, ?, ?, ?)`,
        [idVenta, item.ID_PRODUCTO, item.CANTIDAD, item.PRECIO_FINAL, subtotalItem]
      );
    }

    await conn.query(
      `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, BARRIO, DEPARTAMENTO, CODIGO_POSTAL, OBSERVACIONES, TELEFONO_CONTACTO, COSTO_ENVIO, ESTADO_ENVIO, FECHA_ENVIO)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', DATE_ADD(NOW(), INTERVAL 3 DAY))`,
      [idVenta, direccion || '', ciudad || '', barrio || '', departamento || '', codigoPostal || '', observaciones || '', telefono || '', costoEnvio]
    );

    await conn.query(`DELETE FROM CARRITO WHERE ID_USUARIO = ?`, [idUsuario]);

    if (cuponAplicado) {
      await conn.query(`UPDATE DESCUENTOS SET USADO = 1 WHERE ID_DESCUENTO = ?`, [cuponAplicado]);
    }

    let planGenerado = false;
    const [cats] = await conn.query(
      `SELECT DISTINCT p.ID_CATEGORIA FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE dv.ID_VENTA = ?`,
      [idVenta]
    );
    for (const c of cats) {
      const [plant] = await conn.query(
        `SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA = ? LIMIT 1`,
        [c.ID_CATEGORIA]
      );
      if (plant.length === 0) continue;
      await conn.query(
        `INSERT IGNORE INTO PLANES_USUARIO (ID_USUARIO, ID_VENTA, ID_PLANTILLA, FECHA_INICIO) VALUES (?, ?, ?, CURDATE())`,
        [idUsuario, idVenta, plant[0].ID_PLANTILLA]
      );
      planGenerado = true;
    }
    if (!planGenerado) {
      const [fallback] = await conn.query(
        `SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES ORDER BY ID_PLANTILLA LIMIT 1`
      );
      if (fallback.length > 0) {
        await conn.query(
          `INSERT IGNORE INTO PLANES_USUARIO (ID_USUARIO, ID_VENTA, ID_PLANTILLA, FECHA_INICIO) VALUES (?, ?, ?, CURDATE())`,
          [idUsuario, idVenta, fallback[0].ID_PLANTILLA]
        );
        planGenerado = true;
      }
    }

    await conn.commit();

    const metodoLabel = { tarjeta: "Tarjeta", pse: "PSE", nequi: "Nequi", daviplata: "Daviplata" };
    const pagoDetalle = paymentData ? (() => {
      if (metodoPago === "tarjeta") {
        const last4 = paymentData.numero ? paymentData.numero.replace(/\s/g, "").slice(-4) : "";
        return `${paymentData.titular || ""} •••• ${last4}`;
      }
      if (metodoPago === "nequi" || metodoPago === "daviplata") {
        return `Teléfono: ${paymentData.telefono || ""}`;
      }
      if (metodoPago === "pse") {
        return `Banco: ${paymentData.banco || ""}`;
      }
      return "";
    })() : "";
    const itemsHtml = items.map((item) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px"><img src="${imagenParaCorreo(item.URL_IMAGEN)}" width="48" height="48" style="border-radius:4px;object-fit:cover;display:block" /></td>
            <td style="vertical-align:middle;font-size:0.9rem">${item.NOMBRE}${item.DESCUENTO_PORCENTAJE ? ` <span style="color:#e63946">(-${item.DESCUENTO_PORCENTAJE}%)</span>` : ""}</td>
          </tr></table>
        </td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.CANTIDAD}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${item.PRECIO_FINAL.toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${(item.PRECIO_FINAL * item.CANTIDAD).toLocaleString()}</td>
      </tr>`
    ).join("");

    if (correo) {
      try {
      await transporter.sendMail({
        from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: `🧾 Factura #${idVenta} - JADDA SPORTS`,
        html: `
          <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif">
            <div style="background:#111827;padding:24px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:1.5rem">JADDA <span style="color:#e63946">SPORTS</span></h1>
            </div>
            <div style="padding:24px;background:#fff">
              <h2 style="margin:0 0 8px">¡Gracias por tu compra!</h2>
              <p style="color:#666">Factura #${idVenta} · ${new Date().toLocaleDateString("es-CO")}</p>
              <p style="color:#666">Referencia: ${referenciaPago}</p>
              <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
              <h3 style="margin:0 0 12px">Detalle de productos</h3>
              <table style="width:100%;border-collapse:collapse;font-size:0.9rem">
                <thead><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Producto</th><th style="padding:8px;text-align:center">Cant</th><th style="padding:8px;text-align:right">P/U</th><th style="padding:8px;text-align:right">Subtotal</th></tr></thead>
                <tbody>${itemsHtml}</tbody>
              </table>
              ${descuento > 0 ? `<p style="text-align:right;margin-top:12px;color:#e63946">Descuento: -$${descuento.toLocaleString()}</p>` : ""}
              ${costoEnvio > 0 ? `<p style="text-align:right;margin-top:4px;color:#666">Envío: $${costoEnvio.toLocaleString()}</p>` : `<p style="text-align:right;margin-top:4px;color:#2ecc71">Envío: Gratis</p>`}
              <p style="text-align:right;font-size:1.2rem;font-weight:700;margin-top:8px">Total: <span style="color:#e63946">$${total.toLocaleString()}</span></p>
              <hr style="border:none;border-top:1px solid #eee;margin:16px 0">
              <h3 style="margin:0 0 8px">Datos de envío</h3>
              <p style="color:#666;margin:0">${direccion || ""}, ${ciudad || ""}, ${departamento || ""}</p>
              <p style="color:#666;margin:4px 0">Método de pago: ${metodoLabel[metodoPago] || metodoPago}${pagoDetalle ? ` <span style="color:#333">(${pagoDetalle})</span>` : ""}</p>
              ${planGenerado ? `<p style="margin-top:16px;padding:12px;background:#fff3f3;border-radius:8px;text-align:center;color:#e63946;font-weight:700">🏋️ Revisa tu plan de entrenamiento en JADDA SPORTS</p>` : ""}
            </div>
            <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:0.8rem;color:#999">
              © ${new Date().getFullYear()} JADDA SPORTS · Todos los derechos reservados
            </div>
          </div>`
      });
      } catch (emailErr) {
        console.error("Error al enviar factura por email:", emailErr);
      }
    }

    res.json({ ok: true, ventaId: idVenta, referencia: referenciaPago, planGenerado, envio: costoEnvio });
  } catch (err) {
    try {
      await conn.rollback();
    } catch (rollbackErr) {
      // Si el rollback falla (p.ej. ya se hizo commit), no importa
    }
    console.error("Error en checkout:", err);
    res.status(500).json({ error: "Error al procesar la compra" });
  } finally {
    conn.release();
  }
};

module.exports = { procesarCompra };
