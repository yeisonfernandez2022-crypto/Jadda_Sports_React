const db = require('../config/db');
const transporter = require('../config/mailer');

const METODO_MAP = {
  tarjeta: 2,
  pse: 7,
  nequi: 4,
  daviplata: 5,
};

const procesarCompra = async (req, res) => {
  try {
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });

    const {
      metodoPago,
      paymentData,
      cuponCodigo,
      descuentoAplicado,
      totalFinal,
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

    const [cart] = await db.query(
      `SELECT c.ID_CARRITO, c.ID_PRODUCTO, c.CANTIDAD, c.ID_VARIANTE,
              p.PRECIO, p.NOMBRE, pi.URL_IMAGEN
       FROM CARRITO c
       JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE c.ID_USUARIO = ?`,
      [idUsuario]
    );

    if (!cart || cart.length === 0) {
      return res.status(400).json({ error: "El carrito está vacío" });
    }

    let subtotal = cart.reduce((acc, item) => acc + Number(item.PRECIO) * item.CANTIDAD, 0);
    let descuento = descuentoAplicado || 0;
    let total = totalFinal || (subtotal - descuento);

    const referenciaPago = `SIM_${Date.now()}_${idUsuario}`;

    const datosPagoJSON = paymentData ? JSON.stringify(paymentData) : null;

    const [ventaResult] = await db.query(
      `INSERT INTO VENTAS (ID_CLIENTE, FECHA_VENTA, TOTAL, ESTADO, ID_METODO, REFERENCIA_PAGO, DATOS_PAGO)
       VALUES (?, NOW(), ?, 'COMPLETADA', ?, ?, ?)`,
      [idUsuario, total, idMetodo, referenciaPago, datosPagoJSON]
    );
    const idVenta = ventaResult.insertId;

    for (const item of cart) {
      const subtotalItem = Number(item.PRECIO) * item.CANTIDAD;
      await db.query(
        `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
         VALUES (?, ?, ?, ?, ?)`,
        [idVenta, item.ID_PRODUCTO, item.CANTIDAD, item.PRECIO, subtotalItem]
      );
    }

    await db.query(
      `INSERT INTO ENVIOS (ID_VENTA, DIRECCION_ENVIO, CIUDAD, BARRIO, DEPARTAMENTO, CODIGO_POSTAL, OBSERVACIONES, TELEFONO_CONTACTO, ESTADO_ENVIO, FECHA_ENVIO)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', DATE_ADD(NOW(), INTERVAL 3 DAY))`,
      [idVenta, direccion || '', ciudad || '', barrio || '', departamento || '', codigoPostal || '', observaciones || '', telefono || '']
    );

    await db.query(`DELETE FROM CARRITO WHERE ID_USUARIO = ?`, [idUsuario]);

    let planGenerado = false;
    const [cats] = await db.query(
      `SELECT DISTINCT p.ID_CATEGORIA FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE dv.ID_VENTA = ?`,
      [idVenta]
    );
    for (const c of cats) {
      const [plant] = await db.query(
        `SELECT ID_PLANTILLA, TITULO FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA = ? LIMIT 1`,
        [c.ID_CATEGORIA]
      );
      if (plant.length === 0) continue;
      await db.query(
        `INSERT IGNORE INTO PLANES_USUARIO (ID_USUARIO, ID_VENTA, ID_PLANTILLA, FECHA_INICIO) VALUES (?, ?, ?, CURDATE())`,
        [idUsuario, idVenta, plant[0].ID_PLANTILLA]
      );
      planGenerado = true;
    }
    if (!planGenerado) {
      const [fallback] = await db.query(
        `SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES ORDER BY ID_PLANTILLA LIMIT 1`
      );
      if (fallback.length > 0) {
        await db.query(
          `INSERT IGNORE INTO PLANES_USUARIO (ID_USUARIO, ID_VENTA, ID_PLANTILLA, FECHA_INICIO) VALUES (?, ?, ?, CURDATE())`,
          [idUsuario, idVenta, fallback[0].ID_PLANTILLA]
        );
        planGenerado = true;
      }
    }

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
    const itemsHtml = cart.map((item) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px"><img src="${item.URL_IMAGEN || 'https://placehold.co/48x48/eee/999?text=No+img'}" width="48" height="48" style="border-radius:4px;object-fit:cover;display:block" /></td>
            <td style="vertical-align:middle;font-size:0.9rem">${item.NOMBRE}</td>
          </tr></table>
        </td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.CANTIDAD}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${Number(item.PRECIO).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${(Number(item.PRECIO) * item.CANTIDAD).toLocaleString()}</td>
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

    res.json({ ok: true, ventaId: idVenta, referencia: referenciaPago, planGenerado });
  } catch (err) {
    console.error("Error en checkout:", err);
    res.status(500).json({ error: "Error al procesar la compra" });
  }
};

module.exports = { procesarCompra };
