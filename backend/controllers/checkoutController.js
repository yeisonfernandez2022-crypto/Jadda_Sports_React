const db = require('../config/db');
const transporter = require('../config/mailer');
const { calcularCostoEnvio } = require('../utils/envio');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { plantillaCorreo } = require('../utils/correo');
const { registrarMovimientoStock } = require('../utils/movimientosStock');
const { numeroPedido } = require('../utils/numeroPedido');
const { crearNotificacion } = require('./notificacionController');

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
 * 4. Decrementa el stock de cada variante comprada y registra el movimiento
 *    de salida en MOVIMIENTOS_STOCK (actualizado 2026-08-13, RF-029).
 * 5. Envía factura por correo solo después de confirmar la transacción.
 */
const procesarCompra = async (req, res) => {
  const conn = await db.getConnection();

  try {
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });

    // Los vendedores no pueden comprar en la tienda (doble validación: el
    // frontend ya bloquea los botones y el carrito; esto protege la API).
    if (req.user.ID_ROL === 6) {
      return res.status(403).json({ error: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras." });
    }

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

    // La dirección es un DOMICILIO, nunca el correo del comprador
    if (typeof direccion === "string" && direccion.includes("@")) {
      return res.status(400).json({ error: "La dirección no puede ser un correo electrónico. Escribe la dirección del domicilio, por ejemplo: Cra 45 # 23-12." });
    }

    const [cart] = await conn.query(
      `SELECT c.ID_CARRITO, c.ID_PRODUCTO, c.CANTIDAD, c.ID_VARIANTE,
              p.PRECIO, p.NOMBRE, pi.URL_IMAGEN, pv.STOCK,
              p.ID_DESCUENTO, p.ID_VENDEDOR, d.PORCENTAJE AS DESCUENTO_PORCENTAJE
       FROM CARRITO c
       JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
       LEFT JOIN DESCUENTOS d ON p.ID_DESCUENTO = d.ID_DESCUENTO
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON c.ID_VARIANTE = pv.ID_VARIANTE
       WHERE c.ID_USUARIO = ?
         AND (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')`,
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

    // ---- Validar stock antes de la transacción (el decremento ocurre dentro) ----
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
        `SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, USADO, MONTO_MINIMO
         FROM DESCUENTOS
         WHERE TRIM(DESCRIPCION) = ?`,
        [String(cuponCodigo).trim()]
      );
      if (cuponRows.length > 0) {
        const cupon = cuponRows[0];
        const hoy = new Date();
        const vigente =
          (!cupon.FECHA_INICIO || new Date(cupon.FECHA_INICIO) <= hoy) &&
          (!cupon.FECHA_FIN || new Date(cupon.FECHA_FIN) >= hoy);
        const esCuponReto = /^RETO-/.test(String(cupon.DESCRIPCION || "").trim());
        const yaUsado = esCuponReto && Number(cupon.USADO) === 1;

        // Compra mínima del cupón (p. ej. los RETO- escalan con el porcentaje)
        const montoMinimo = cupon.MONTO_MINIMO != null ? Number(cupon.MONTO_MINIMO) : null;
        if (vigente && !yaUsado && montoMinimo && subtotal < montoMinimo) {
          return res.status(400).json({
            error: `El cupón ${String(cuponCodigo).trim()} requiere una compra mínima de $${montoMinimo.toLocaleString("es-CO")} (tu carrito suma $${Math.round(subtotal).toLocaleString("es-CO")}).`,
          });
        }

        if (vigente && !yaUsado) {
          descuento = Math.round(subtotal * (Number(cupon.PORCENTAJE) / 100));
          cuponAplicado = cupon.ID_DESCUENTO;
        }
      }
    }
    const costoEnvio = calcularCostoEnvio(departamento, ciudad, subtotal);
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
        `INSERT INTO DETALLE_VENTAS (ID_VENTA, ID_PRODUCTO, ID_VARIANTE, CANTIDAD, PRECIO_UNITARIO, SUBTOTAL)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idVenta, item.ID_PRODUCTO, item.ID_VARIANTE || null, item.CANTIDAD, item.PRECIO_FINAL, subtotalItem]
      );

      // Decrementar stock de la variante comprada + registro detallado (RF-029)
      if (item.ID_VARIANTE) {
        await conn.query(
          `UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK - ? WHERE ID_VARIANTE = ?`,
          [item.CANTIDAD, item.ID_VARIANTE]
        );
        await registrarMovimientoStock({
          conn,
          idProducto: item.ID_PRODUCTO,
          tipo: 'SALIDA',
          cantidad: item.CANTIDAD,
        });
      }
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

    // Notificaciones post-compra (nunca bloquean)
    // 1) Al comprador: pedido recibido
    try {
      await crearNotificacion({
        idUsuario: idUsuario,
        tipo: 'pedido',
        titulo: '¡Pedido recibido! 🛒',
        mensaje: `Tu pedido #${numeroPedido(idVenta)} por $${Number(total).toLocaleString("es-CO")} fue confirmado. Te avisaremos de cada cambio de estado.`,
        ruta: `/perfil/compra/${idVenta}`,
      });
    } catch (e) { console.error('Error noti comprador:', e.message); }
    // 2) Al admin: nuevo pedido (siempre, aunque sea 100% JADDA)
    try {
      await crearNotificacion({
        idUsuario: null,
        tipo: 'pedido',
        titulo: `🛒 Nuevo pedido #${numeroPedido(idVenta)}`,
        mensaje: `${nombre || correo || 'Un cliente'} compró ${items.length} producto(s) por $${Number(total).toLocaleString("es-CO")}. Revisa los detalles en órdenes.`,
        ruta: '/admin/ordenes',
      });
    } catch (e) { console.error('Error noti admin pedido:', e.message); }
    // 3) A los vendedores cuyos productos se vendieron
    try {
      const vendedores = new Map();
      for (const item of items) {
        if (!item.ID_VENDEDOR) continue;
        if (!vendedores.has(item.ID_VENDEDOR)) {
          const [vfilas] = await db.query(
            `SELECT v.ID_USUARIO, v.NOMBRE_EMPRESA FROM VENDEDORES v
             JOIN PRODUCTOS p ON p.ID_VENDEDOR = v.ID_VENDEDOR
             WHERE p.ID = ?`,
            [item.ID_PRODUCTO]
          );
          if (vfilas.length > 0) vendedores.set(item.ID_VENDEDOR, vfilas[0]);
        }
      }
      for (const [idVendedor, vendedor] of vendedores) {
        await crearNotificacion({
          idUsuario: vendedor.ID_USUARIO,
          tipo: 'vendedor',
          titulo: '¡Tienes una nueva venta! 🎉',
          mensaje: `Se vendieron productos de ${vendedor.NOMBRE_EMPRESA} en el pedido #${numeroPedido(idVenta)}.`,
          ruta: '/vendedor/ventas',
        });
      }
    } catch (notifErr) {
      console.error('Error al notificar venta al vendedor:', notifErr.message);
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
    // El correo NO lleva imágenes de producto (solo el nombre): la factura PDF
    // adjunta sí las muestra. Evita "adjuntos" de imágenes sueltas en el email.
    const itemsHtml = items.map((item) =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;font-size:0.9rem">${item.NOMBRE}${item.DESCUENTO_PORCENTAJE ? ` <span style="color:#e63946">(-${item.DESCUENTO_PORCENTAJE}%)</span>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${item.CANTIDAD}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${item.PRECIO_FINAL.toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${(item.PRECIO_FINAL * item.CANTIDAD).toLocaleString()}</td>
      </tr>`
    ).join("");

    let facturaPdf = null;
    try {
      facturaPdf = await generarFacturaPdf({
        venta: { ID_VENTA: idVenta, FECHA_VENTA: new Date(), TOTAL: total, REFERENCIA_PAGO: referenciaPago },
        usuario: { NOMBRE_USUARIO: nombre || "", APELLIDO_USUARIO: "", EMAIL: correo },
        items: items.map((i) => ({
          NOMBRE: i.NOMBRE,
          CANTIDAD: i.CANTIDAD,
          PRECIO_UNITARIO: i.PRECIO_FINAL,
          SUBTOTAL: i.PRECIO_FINAL * i.CANTIDAD,
          URL_IMAGEN: i.URL_IMAGEN,
        })),
        metodoPago: metodoLabel[metodoPago] || metodoPago,
        envio: { DIRECCION_ENVIO: direccion, CIUDAD: ciudad, BARRIO: barrio, DEPARTAMENTO: departamento, TELEFONO_CONTACTO: telefono, COSTO_ENVIO: costoEnvio },
      });
    } catch (pdfErr) {
      console.error("Error al generar PDF adjunto:", pdfErr);
    }

    if (correo) {
      try {
      const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
      const sujeto = (nombre ? `¡Gracias ${nombre} por tu compra!` : "¡Gracias por tu compra!") + " Aquí está tu factura";
      await transporter.sendMail({
        from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: sujeto,
        attachments: facturaPdf ? [{ filename: `factura-compra-${idVenta}.pdf`, content: facturaPdf, contentType: "application/pdf" }] : [],
        html: plantillaCorreo({
          emoji: "🧾",
          titulo: `¡Gracias${nombre ? ", " + nombre : ""}! Tu compra fue exitosa`,
          subtitulo: `Pedido ${numeroPedido(idVenta)} · ${new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}`,
          saludo: `Hola ${nombre || "cliente"}, confirmamos tu pedido con referencia <strong>${referenciaPago}</strong>.`,
          contenido: `
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0 4px">
              <thead><tr style="background:#f1f5f9;color:#334155;font-size:12px">
                <th style="padding:9px;text-align:left;border-radius:8px 0 0 8px">Producto</th>
                <th style="padding:9px;text-align:center">Cant</th>
                <th style="padding:9px;text-align:right">P/U</th>
                <th style="padding:9px;text-align:right;border-radius:0 8px 8px 0">Subtotal</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            ${descuento > 0 ? `<p style="text-align:right;margin:6px 0 0;font-size:13px;color:#dc2626">Descuento: <strong>-$${descuento.toLocaleString("es-CO")}</strong></p>` : ""}
            ${costoEnvio > 0 ? `<p style="text-align:right;margin:4px 0 0;font-size:13px;color:#64748b">Envío: $${costoEnvio.toLocaleString("es-CO")}</p>` : `<p style="text-align:right;margin:4px 0 0;font-size:13px;color:#16a34a">Envío: <strong>GRATIS</strong></p>`}
            <p style="text-align:right;margin:8px 0 0;font-size:17px;font-weight:800">Total: <span style="color:#e63946">$${total.toLocaleString("es-CO")}</span></p>
            <div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border-left:4px solid #e63946;border-radius:8px;font-size:13px;color:#475569">
              <p style="margin:0 0 4px"><strong>🚚 Datos de envío</strong></p>
              <p style="margin:0">${direccion || ""}, ${ciudad || ""}, ${departamento || ""}</p>
              <p style="margin:4px 0 0">💳 Método de pago: ${metodoLabel[metodoPago] || metodoPago}${pagoDetalle ? ` (${pagoDetalle})` : ""}</p>
              ${planGenerado ? `<p style="margin:6px 0 0;color:#dc2626;font-weight:700">🏋️ Revisa tu plan de entrenamiento en JADDA SPORTS</p>` : ""}
            </div>
          `,
          botonTexto: "Ver mi compra",
          botonEnlace: `${frontend}/perfil/compras`,
          notas: ["📎 Te adjuntamos tu factura en PDF.", "🔔 Te avisaremos por este correo cada vez que tu pedido cambie de estado."],
        })
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
