const db = require('../config/db');

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
              p.PRECIO, p.NOMBRE
       FROM CARRITO c
       JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
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

    res.json({ ok: true, ventaId: idVenta, referencia: referenciaPago });
  } catch (err) {
    console.error("Error en checkout:", err);
    res.status(500).json({ error: "Error al procesar la compra" });
  }
};

module.exports = { procesarCompra };
