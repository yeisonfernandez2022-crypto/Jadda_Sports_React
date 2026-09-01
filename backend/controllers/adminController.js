const db = require('../config/db');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { notificarCambioEstado } = require('../utils/estadoPedido');
const { crearNotificacion } = require('./notificacionController');

/** Obtiene todas las compras del sistema con datos del usuario, método de pago y envío.
 *  Luego, por cada venta, consulta DETALLE_VENTAS con JOIN a PRODUCTOS para incluir los productos.
 *  Solo accesible por administradores. */
const obtenerTodasLasCompras = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.TELEFONO AS TELEFONO_CLIENTE,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.OBSERVACIONES, e.TELEFONO_CONTACTO, e.COSTO_ENVIO, e.ESTADO_ENVIO, e.FECHA_ENVIO
       FROM VENTAS v
       INNER JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       ORDER BY v.FECHA_VENTA DESC`
    );

    const compras = [];
    for (const venta of rows) {
      const [detalles] = await db.query(
        `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, dv.ID_VARIANTE,
                p.NOMBRE, p.ID, p.ID_VENDEDOR,
                COALESCE(pi.URL_IMAGEN, '') AS IMAGEN,
                pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
         FROM DETALLE_VENTAS dv
         INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
         LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
         LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
         WHERE dv.ID_VENTA = ?`,
        [venta.ID_VENTA]
      );
      // Ventas con productos de vendedores externos: el admin solo las VE,
      // el estado del pedido lo gestiona el vendedor desde su panel.
      const idsVendedores = [...new Set(detalles.map((d) => d.ID_VENDEDOR).filter(Boolean))];
      let vendedorNombres = [];
      if (idsVendedores.length > 0) {
        const [vends] = await db.query(
          `SELECT NOMBRE_EMPRESA FROM VENDEDORES WHERE ID_VENDEDOR IN (${idsVendedores.map(() => "?").join(",")})`,
          idsVendedores
        );
        vendedorNombres = vends.map((v) => v.NOMBRE_EMPRESA).filter(Boolean);
      }
      compras.push({
        ...venta,
        TOTAL: Number(venta.TOTAL),
        COSTO_ENVIO: venta.COSTO_ENVIO !== null && venta.COSTO_ENVIO !== undefined ? Number(venta.COSTO_ENVIO) : null,
        TOTAL_ARTICULOS: detalles.length,
        TOTAL_UNIDADES: detalles.reduce((s, d) => s + Number(d.CANTIDAD || 0), 0),
        FECHA_VENTA: venta.FECHA_VENTA,
        ES_DE_VENDEDOR: idsVendedores.length > 0,
        VENDEDORES: vendedorNombres.join(", "),
        productos: detalles
      });
    }

    res.json(compras);
  } catch (err) {
    console.error("Error al obtener compras:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener compras" });
  }
};

/** Bloquea la gestión de ventas que incluyen productos de vendedores externos:
 *  el admin solo las consulta; el estado lo maneja cada vendedor en su panel. */
const ventaConProductosDeVendedor = async (idVenta) => {
  const [[fila]] = await db.query(
    `SELECT COUNT(*) AS total FROM DETALLE_VENTAS dv
     INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
     WHERE dv.ID_VENTA = ? AND p.ID_VENDEDOR IS NOT NULL`,
    [idVenta]
  );
  return Number(fila.total) > 0;
};

/** Actualiza el estado de una compra (VENTAS.ESTADO).
 *  Valida que el estado no esté vacío y retorna 404 si la venta no existe. */
const actualizarEstadoCompra = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!estado) {
    return res.status(400).json({ ok: false, msg: "Estado es obligatorio" });
  }

  try {
    if (await ventaConProductosDeVendedor(id)) {
      return res.status(403).json({ ok: false, msg: "Esta venta incluye productos de un vendedor: su estado se gestiona desde la cuenta del vendedor" });
    }

    const [[actual]] = await db.query(
      "SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ?",
      [id]
    );

    if (!actual) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }

    if (actual.ESTADO === estado) {
      return res.json({ ok: true, msg: "Estado actualizado", sinCambios: true });
    }

    await db.query(
      "UPDATE VENTAS SET ESTADO = ? WHERE ID_VENTA = ?",
      [estado, id]
    );

    await notificarCambioEstado(id, "venta", estado);

    res.json({ ok: true, msg: "Estado actualizado" });
  } catch (err) {
    console.error("Error al actualizar estado:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar estado" });
  }
};

/** Actualiza el estado del ENVÍO de una compra (ENVIOS.ESTADO_ENVIO).
 *  Estados típicos: PENDIENTE, POR_EMPAQUETAR, EMPACADO, EN_CAMINO, ENTREGADO, CANCELADO. */
const actualizarEstadoEnvio = async (req, res) => {
  const { id } = req.params;
  const { estado_envio } = req.body;

  if (!estado_envio) {
    return res.status(400).json({ ok: false, msg: "estado_envio es obligatorio" });
  }

  try {
    if (await ventaConProductosDeVendedor(id)) {
      return res.status(403).json({ ok: false, msg: "Esta venta incluye productos de un vendedor: su envío se gestiona desde la cuenta del vendedor" });
    }

    const [[actual]] = await db.query(
      "SELECT ESTADO_ENVIO FROM ENVIOS WHERE ID_VENTA = ?",
      [id]
    );

    if (!actual) {
      return res.status(404).json({ ok: false, msg: "Compra sin envío registrado" });
    }

    if (actual.ESTADO_ENVIO === estado_envio) {
      return res.json({ ok: true, msg: "Estado de envío actualizado", sinCambios: true });
    }

    await db.query(
      "UPDATE ENVIOS SET ESTADO_ENVIO = ?, FECHA_ENTREGA = IF(? = 'ENTREGADO', NOW(), FECHA_ENTREGA) WHERE ID_VENTA = ?",
      [estado_envio, estado_envio, id]
    );

    await notificarCambioEstado(id, "envio", estado_envio);

    res.json({ ok: true, msg: "Estado de envío actualizado" });
  } catch (err) {
    console.error("Error al actualizar estado de envío:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar estado de envío" });
  }
};

/** Obtiene todos los usuarios del sistema con su rol (JOIN con ROLES).
 *  Ordena por FECHA_REGISTRO descendente. Solo accesible por administradores. */
const obtenerUsuarios = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.ID_USUARIO, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.USUARIO,
              u.TELEFONO, u.FECHA_REGISTRO, u.ID_ROL, u.CONFIRMADO, u.AUTH_PROVIDER,
              r.NOMBRE_ROL
       FROM USUARIOS u
       LEFT JOIN ROLES r ON u.ID_ROL = r.ID_ROL
       ORDER BY u.FECHA_REGISTRO DESC`
    );

    res.json(rows);
  } catch (err) {
    console.error("Error al obtener usuarios:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener usuarios" });
  }
};

/** Detalle completo de un usuario para el admin: perfil, direcciones,
 *  métodos de pago y estadísticas básicas. */
const obtenerUsuarioDetalle = async (req, res) => {
  const id_usuario = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT u.ID_USUARIO, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL, u.USUARIO,
              u.TELEFONO, u.TIPO_DOCUMENTO, u.NUMERO_DOCUMENTO, u.FOTO_URL,
              u.FECHA_REGISTRO, u.ID_ROL, u.CONFIRMADO, u.AUTH_PROVIDER,
              u.DEBE_CAMBIAR_PASSWORD, u.ULTIMA_CONEXION, u.ULTIMA_IP, u.ULTIMA_UBICACION,
              r.NOMBRE_ROL
       FROM USUARIOS u
       LEFT JOIN ROLES r ON u.ID_ROL = r.ID_ROL
       WHERE u.ID_USUARIO = ?`,
      [id_usuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }
    const usuario = rows[0];

    const [direcciones] = await db.query(
      `SELECT ID_DIRECCION, DIRECCION, BARRIO, CIUDAD, DEPARTAMENTO, CODIGO_POSTAL,
              TELEFONO_CONTACTO, ETIQUETA, ES_PRINCIPAL
       FROM DIRECCIONES WHERE ID_USUARIO = ? ORDER BY ES_PRINCIPAL DESC, ID_DIRECCION`,
      [id_usuario]
    );

    const [metodos] = await db.query(
      `SELECT um.ID, um.TITULAR, um.TELEFONO, um.BANCO, um.TIPO,
              um.ES_PRINCIPAL, um.FECHA_CREADO, mp.NOMBRE_METODO
       FROM USUARIOS_METODOS_PAGO um
       JOIN METODOS_PAGO mp ON um.ID_METODO = mp.ID_METODO
       WHERE um.ID_USUARIO = ? ORDER BY um.ES_PRINCIPAL DESC, um.FECHA_CREADO DESC`,
      [id_usuario]
    );

    const [[stats]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM VENTAS v WHERE v.ID_CLIENTE = ?) AS totalCompras,
         (SELECT COALESCE(SUM(v.TOTAL), 0) FROM VENTAS v WHERE v.ID_CLIENTE = ? AND v.ESTADO <> 'CANCELADA') AS totalGastado,
         (SELECT COUNT(*) FROM FAVORITOS f WHERE f.ID_USUARIO = ?) AS totalFavoritos,
         (SELECT COUNT(*) FROM RETOS_USUARIOS r WHERE r.ID_USUARIO = ?) AS totalRetos`,
      [id_usuario, id_usuario, id_usuario, id_usuario]
    );

    let vendedor = null;
    let ventas = [];
    if (Number(usuario.ID_ROL) === 6) {
      const [filasVendedor] = await db.query(
        `SELECT ID_VENDEDOR, ID_USUARIO, NOMBRE_EMPRESA, NIT, EMAIL_VENDEDOR,
                TELEFONO, DEPARTAMENTO, CIUDAD, DIRECCION, CATEGORIAS,
                ESTADO, FECHA_REGISTRO
         FROM VENDEDORES WHERE ID_USUARIO = ?`,
        [id_usuario]
      );
      vendedor = filasVendedor[0] || null;

      if (vendedor) {
        const [[ventasVendedor]] = await db.query(
          `SELECT
             (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_VENDEDOR = ?) AS productosPublicados,
             (SELECT COALESCE(SUM(dv.CANTIDAD), 0)
                FROM DETALLE_VENTAS dv
                JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
                JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
                WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS unidadesVendidas,
             (SELECT COUNT(DISTINCT dv.ID_VENTA)
                FROM DETALLE_VENTAS dv
                JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
                JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
                WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS totalVentas,
             (SELECT COALESCE(SUM(dv.SUBTOTAL), 0)
                FROM DETALLE_VENTAS dv
                JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
                JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
                WHERE p.ID_VENDEDOR = ? AND v.ESTADO <> 'CANCELADA') AS totalIngresos`,
          [vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR, vendedor.ID_VENDEDOR]
        );
        stats.totalCompras = 0;
        stats.totalGastado = 0;
        stats.productosPublicados = Number(ventasVendedor.productosPublicados);
        stats.unidadesVendidas = Number(ventasVendedor.unidadesVendidas);
        stats.totalVentas = Number(ventasVendedor.totalVentas);
        stats.totalIngresos = Number(ventasVendedor.totalIngresos);

        const [filasVentas] = await db.query(
          `SELECT v.ID_VENTA, v.REFERENCIA_PAGO, v.TOTAL, v.ESTADO, v.FECHA_VENTA,
                  u.NOMBRE_USUARIO AS CLIENTE
           FROM DETALLE_VENTAS dv
           JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
           JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
           LEFT JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
           WHERE v.ESTADO <> 'CANCELADA'
           GROUP BY v.ID_VENTA
           ORDER BY v.FECHA_VENTA DESC
           LIMIT 20`,
          [vendedor.ID_VENDEDOR]
        );
        const idsVenta = filasVentas.map((v) => v.ID_VENTA);
        let items = [];
        if (idsVenta.length > 0) {
          const ph = idsVenta.map(() => "?").join(",");
          [items] = await db.query(
            `SELECT dv.ID_VENTA, dv.CANTIDAD, dv.SUBTOTAL,
                    p.NOMBRE, p.PRECIO,
                    pi.URL_IMAGEN AS IMAGEN,
                    pv.COLOR, pv.NOMBRE_ATRIBUTO, pv.ATRIBUTO
             FROM DETALLE_VENTAS dv
             JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID AND p.ID_VENDEDOR = ?
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             LEFT JOIN PRODUCTO_VARIANTES pv ON dv.ID_VARIANTE = pv.ID_VARIANTE
             WHERE dv.ID_VENTA IN (${ph})
             ORDER BY dv.ID_VENTA DESC`,
            [vendedor.ID_VENDEDOR, ...idsVenta]
          );
        }
        const porVenta = {};
        for (const it of items) {
          (porVenta[it.ID_VENTA] = porVenta[it.ID_VENTA] || []).push(it);
        }
        ventas = filasVentas.map((v) => ({ ...v, items: porVenta[v.ID_VENTA] || [] }));
      }
    }

    const [compras] = await db.query(
      `SELECT v.ID_VENTA, v.REFERENCIA_PAGO, v.TOTAL, v.ESTADO,
              mp.NOMBRE_METODO AS METODO_PAGO, v.FECHA_VENTA,
              e.ESTADO_ENVIO,
              (SELECT COUNT(*) FROM DETALLE_VENTAS dv WHERE dv.ID_VENTA = v.ID_VENTA) AS TOTAL_ARTICULOS,
              (SELECT GROUP_CONCAT(p.NOMBRE SEPARATOR ' | ')
                 FROM DETALLE_VENTAS dv
                 JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
                 WHERE dv.ID_VENTA = v.ID_VENTA) AS PRODUCTOS_NOMBRES
       FROM VENTAS v
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       WHERE v.ID_CLIENTE = ?
       ORDER BY v.FECHA_VENTA DESC
       LIMIT 200`,
      [id_usuario]
    );

    const [retos] = await db.query(
      `SELECT ru.ID_RETO_USUARIO, ru.ID_RETO, ru.PROGRESO, ru.COMPLETADO, ru.CUPON_GENERADO,
              r.TITULO, r.META_TIPO, r.META_VALOR, r.RECOMPENSA_PORCENTAJE,
              (SELECT COUNT(*) FROM RETO_EVIDENCIAS re
                WHERE re.ID_RETO_USUARIO = ru.ID_RETO_USUARIO AND re.ESTADO = 'pendiente') AS EVIDENCIAS_PENDIENTES
       FROM RETOS_USUARIOS ru
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE ru.ID_USUARIO = ?
       ORDER BY ru.COMPLETADO ASC, ru.ID_RETO_USUARIO DESC
       LIMIT 200`,
      [id_usuario]
    );

    res.json({ usuario, direcciones, metodos, stats, vendedor, ventas, compras, retos });
  } catch (err) {
    console.error("Error al obtener detalle de usuario:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener el detalle del usuario" });
  }
};

/** Obtiene las estadísticas del dashboard administrativo.
 *  Devuelve KPIs globales y de los últimos 30 días, serie diaria de ventas
 *  (para la gráfica), comparativa hoy vs ayer, top 5 más vendidos,
 *  órdenes/usuarios recientes y contadores de pendientes por revisar. */
const obtenerDashboard = async (req, res) => {
  try {
    const granularidad = granularidadValida(req.query.granularidad);
    const hoy = new Date();
    const iso = (d) => d.toISOString().slice(0, 10);
    // Rango según granularidad: dia=30d, semana=12 semanas, mes=12 meses, anio=5 años
    let haceDesde;
    if (granularidad === 'semana') haceDesde = new Date(hoy.getTime() - 84 * 24 * 60 * 60 * 1000);
    else if (granularidad === 'mes') { haceDesde = new Date(hoy); haceDesde.setMonth(haceDesde.getMonth() - 11); haceDesde.setDate(1); }
    else if (granularidad === 'anio') { haceDesde = new Date(hoy); haceDesde.setFullYear(haceDesde.getFullYear() - 4); haceDesde.setMonth(0,1); }
    else haceDesde = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const hace30 = iso(haceDesde);
    const ayer = iso(new Date(hoy.getTime() - 24 * 60 * 60 * 1000));
    const hoyStr = iso(hoy);
    const hoyIni = `${hoyStr} 00:00:00`;
    const hoyFin = `${hoyStr} 23:59:59`;
    const ayerIni = `${ayer} 00:00:00`;
    const ayerFin = `${ayer} 23:59:59`;
    const desdeIni = `${hace30} 00:00:00`;

    const [[{ totalProductos }]] = await db.query("SELECT COUNT(*) AS totalProductos FROM PRODUCTOS");
    const [[{ totalOrdenes }]] = await db.query("SELECT COUNT(*) AS totalOrdenes FROM VENTAS");
    const [[{ totalUsuarios }]] = await db.query("SELECT COUNT(*) AS totalUsuarios FROM USUARIOS");
    const [[{ totalIngresos }]] = await db.query("SELECT COALESCE(SUM(TOTAL), 0) AS totalIngresos FROM VENTAS WHERE ESTADO = 'COMPLETADA'");

    const [[r30]] = await db.query(
      `SELECT COUNT(*) AS ordenes30,
              COALESCE(SUM(TOTAL), 0) AS ingresos30,
              COALESCE(AVG(TOTAL), 0) AS ticket30,
              (SELECT COALESCE(SUM(dv.CANTIDAD), 0)
               FROM DETALLE_VENTAS dv JOIN VENTAS v2 ON dv.ID_VENTA = v2.ID_VENTA
               WHERE v2.FECHA_VENTA BETWEEN ? AND ? AND v2.ESTADO <> 'CANCELADA') AS unidades30
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'`,
      [desdeIni, hoyFin, desdeIni, hoyFin]
    );

    const agrupDash = getFormatoAgrupacion(granularidad);
    const [serieRaw] = await db.query(
      `SELECT ${agrupDash} AS dia, COUNT(*) AS ordenes, COALESCE(SUM(TOTAL), 0) AS ingresos
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'
       GROUP BY ${agrupDash}
       ORDER BY dia ASC`,
      [desdeIni, hoyFin]
    );
    // Serie completa según granularidad
    const serieMap = new Map(serieRaw.map((s) => [String(s.dia), s]));
    const serie = [];
    if (granularidad === 'dia') {
      for (let d = new Date(hace30); d <= hoy; d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos) } : { dia: iso, ordenes: 0, ingresos: 0 });
      }
    } else if (granularidad === 'semana') {
      const start = new Date(hace30); start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = new Date(hoy);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos) } : { dia: iso, ordenes: 0, ingresos: 0 });
      }
    } else if (granularidad === 'mes') {
      const start = new Date(hace30); start.setDate(1);
      const end = new Date(hoy); end.setDate(1);
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const iso = d.toISOString().slice(0, 7);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos) } : { dia: iso, ordenes: 0, ingresos: 0 });
      }
    } else {
      const startY = new Date(hace30).getFullYear();
      const endY = hoy.getFullYear();
      for (let y = startY; y <= endY; y++) {
        const iso = String(y);
        const row = serieMap.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos) } : { dia: iso, ordenes: 0, ingresos: 0 });
      }
    }

    const [[hoyRes]] = await db.query(
      `SELECT COALESCE(SUM(TOTAL), 0) AS ingresosHoy, COUNT(*) AS ordenesHoy
       FROM VENTAS WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'`,
      [hoyIni, hoyFin]
    );
    const [[ayerRes]] = await db.query(
      `SELECT COALESCE(SUM(TOTAL), 0) AS ingresosAyer
       FROM VENTAS WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'`,
      [ayerIni, ayerFin]
    );

    const [masVendidos] = await db.query(
      `SELECT p.ID, p.NOMBRE,
              (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi
               WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN,
              SUM(dv.CANTIDAD) AS unidades,
              SUM(dv.SUBTOTAL) AS ingresos
       FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
       GROUP BY p.ID, p.NOMBRE
       ORDER BY unidades DESC, ingresos DESC
       LIMIT 5`,
      [desdeIni, hoyFin]
    );

    const [ordenesRecientes] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO
       FROM VENTAS v
       INNER JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       ORDER BY v.FECHA_VENTA DESC LIMIT 6`
    );

    const [usuariosRecientes] = await db.query(
      `SELECT ID_USUARIO, NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, FECHA_REGISTRO
       FROM USUARIOS ORDER BY FECHA_REGISTRO DESC LIMIT 5`
    );

    const [[{ evidenciasPend }]] = await db.query(
      "SELECT COUNT(*) AS evidenciasPend FROM RETO_EVIDENCIAS WHERE ESTADO = 'pendiente'"
    );
    const [[{ devolucionesPend }]] = await db.query(
      "SELECT COUNT(*) AS devolucionesPend FROM DEVOLUCIONES WHERE ESTADO = 'SOLICITADA'"
    );
    const [[{ stockBajo }]] = await db.query(
      `SELECT COUNT(*) AS stockBajo FROM (
         SELECT ID_PRODUCTO FROM PRODUCTO_VARIANTES GROUP BY ID_PRODUCTO HAVING SUM(STOCK) <= 5
       ) t`
    );
    const [[{ avisosPend }]] = await db.query(
      "SELECT COUNT(*) AS avisosPend FROM AVISOS_STOCK WHERE ENVIADO = 0"
    );
    const [[{ vendedoresPend }]] = await db.query(
      "SELECT COUNT(*) AS vendedoresPend FROM SOLICITUDES_VENDEDOR WHERE ESTADO = 'PENDIENTE'"
    );

    const pctHoy = Number(ayerRes.ingresosAyer) > 0
      ? Math.round(((Number(hoyRes.ingresosHoy) - Number(ayerRes.ingresosAyer)) / Number(ayerRes.ingresosAyer)) * 100)
      : null;

    res.json({
      stats: {
        totalProductos,
        totalOrdenes,
        totalUsuarios,
        totalIngresos: Number(totalIngresos),
        ordenes30: Number(r30.ordenes30),
        ingresos30: Number(r30.ingresos30),
        ticket30: Math.round(Number(r30.ticket30)),
        unidades30: Number(r30.unidades30),
      },
      hoy: { ingresosHoy: Number(hoyRes.ingresosHoy), ordenesHoy: Number(hoyRes.ordenesHoy), pctVsAyer: pctHoy },
      pendientes: {
        evidenciasPend: Number(evidenciasPend),
        devolucionesPend: Number(devolucionesPend),
        vendedoresPend: Number(vendedoresPend),
        stockBajo: Number(stockBajo),
        avisosPend: Number(avisosPend),
      },
      serie: serie.map((s) => ({ ...s, ordenes: Number(s.ordenes), ingresos: Number(s.ingresos) })),
      masVendidos: masVendidos.map((m) => ({ ...m, unidades: Number(m.unidades), ingresos: Number(m.ingresos) })),
      ordenesRecientes,
      usuariosRecientes,
    });
  } catch (err) {
    console.error("Error al obtener dashboard:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener dashboard" });
  }
};

/** Endpoint ligero con los contadores de pendientes para el sidebar admin. */
const obtenerPendientes = async (req, res) => {
  try {
    const [[{ evidenciasPend }]] = await db.query(
      "SELECT COUNT(*) AS evidenciasPend FROM RETO_EVIDENCIAS WHERE ESTADO = 'pendiente'"
    );
    const [[{ devolucionesPend }]] = await db.query(
      "SELECT COUNT(*) AS devolucionesPend FROM DEVOLUCIONES WHERE ESTADO IN ('SOLICITADA', 'MAS_PRUEBAS', 'ESCALADA')"
    );
    const [[{ vendedoresPend }]] = await db.query(
      "SELECT COUNT(*) AS vendedoresPend FROM SOLICITUDES_VENDEDOR WHERE ESTADO = 'PENDIENTE'"
    );
    const [[{ productosPend }]] = await db.query(
      "SELECT COUNT(*) AS productosPend FROM PRODUCTOS WHERE ESTADO_PUBLICACION = 'PENDIENTE'"
    );
    const [[{ chatsEscaladas }]] = await db.query(
      "SELECT COUNT(*) AS chatsEscaladas FROM DEVOLUCIONES WHERE ESTADO = 'ESCALADA'"
    );
    res.json({ evidencias: Number(evidenciasPend), devoluciones: Number(devolucionesPend), vendedores: Number(vendedoresPend), productos: Number(productosPend), chats: Number(chatsEscaladas) });
  } catch (err) {
    console.error("Error al obtener pendientes:", err);
    res.status(500).json({ ok: false, msg: "Error" });
  }
};

/** Genera la factura PDF de cualquier compra (RF-021). Solo accesible por administradores. */
const descargarFacturaAdmin = async (req, res) => {
  const id_venta = req.params.id;

  try {
    const [rows] = await db.query(
      `SELECT v.ID_VENTA, v.FECHA_VENTA, v.TOTAL, v.ESTADO, v.REFERENCIA_PAGO,
              mp.NOMBRE_METODO AS METODO_PAGO,
              e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO, e.CODIGO_POSTAL,
              e.TELEFONO_CONTACTO, e.COSTO_ENVIO,
              u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL
       FROM VENTAS v
       LEFT JOIN METODOS_PAGO mp ON v.ID_METODO = mp.ID_METODO
       LEFT JOIN ENVIOS e ON v.ID_VENTA = e.ID_VENTA
       JOIN USUARIOS u ON v.ID_CLIENTE = u.ID_USUARIO
       WHERE v.ID_VENTA = ?`,
      [id_venta]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    const venta = rows[0];

    const [detalles] = await db.query(
      `SELECT dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, p.NOMBRE, pi.URL_IMAGEN
       FROM DETALLE_VENTAS dv
       INNER JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       WHERE dv.ID_VENTA = ?`,
      [id_venta]
    );

    const pdf = await generarFacturaPdf({
      venta,
      usuario: {
        NOMBRE_USUARIO: venta.NOMBRE_USUARIO,
        APELLIDO_USUARIO: venta.APELLIDO_USUARIO,
        EMAIL: venta.EMAIL,
      },
      items: detalles,
      metodoPago: venta.METODO_PAGO,
      envio: venta,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="factura-${id_venta}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error al generar factura PDF (admin):", err);
    res.status(500).json({ ok: false, msg: "Error al generar la factura" });
  }
};

/** Valida que una fecha sea YYYY-MM-DD (para los reportes). */
const fechaValida = (f) => typeof f === "string" && /^\d{4}-\d{2}-\d{2}$/.test(f);
const granularidadValida = (g) => ['dia','semana','mes','anio'].includes(g) ? g : 'dia';
const getFormatoAgrupacion = (gran) => {
  switch (gran) {
    case 'semana': return "DATE_FORMAT(DATE_SUB(FECHA_VENTA, INTERVAL WEEKDAY(FECHA_VENTA) DAY), '%Y-%m-%d')";
    case 'mes': return "DATE_FORMAT(FECHA_VENTA, '%Y-%m')";
    case 'anio': return "DATE_FORMAT(FECHA_VENTA, '%Y')";
    default: return "DATE_FORMAT(FECHA_VENTA, '%Y-%m-%d')";
  }
};
const getFormatoAgrupacionV = (gran) => {
  switch (gran) {
    case 'semana': return "DATE_FORMAT(DATE_SUB(v.FECHA_VENTA, INTERVAL WEEKDAY(v.FECHA_VENTA) DAY), '%Y-%m-%d')";
    case 'mes': return "DATE_FORMAT(v.FECHA_VENTA, '%Y-%m')";
    case 'anio': return "DATE_FORMAT(v.FECHA_VENTA, '%Y')";
    default: return "DATE_FORMAT(v.FECHA_VENTA, '%Y-%m-%d')";
  }
};

/**
 * RF-032: Reporte de ventas por rango de fechas (GET /api/admin/reportes/ventas).
 * Devuelve ingresos totales, cantidad de órdenes, ticket promedio, unidades
 * vendidas y la serie diaria (para el gráfico). Excluye ventas CANCELADAS.
 * Query params opcionales: desde=YYYY-MM-DD, hasta=YYYY-MM-DD (default: últimos 30 días).
 */
const reporteVentas = async (req, res) => {
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const desde = fechaValida(req.query.desde) ? req.query.desde : hace30.toISOString().slice(0, 10);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy.toISOString().slice(0, 10);
    const granularidad = granularidadValida(req.query.granularidad);
    const desdeIni = `${desde} 00:00:00`;
    const hastaFin = `${hasta} 23:59:59`;

    const [[resumen]] = await db.query(
      `SELECT COUNT(*) AS totalOrdenes,
              COALESCE(SUM(TOTAL), 0) AS totalIngresos,
              COALESCE(AVG(TOTAL), 0) AS ticketPromedio,
              (SELECT COALESCE(SUM(dv.CANTIDAD), 0)
               FROM DETALLE_VENTAS dv JOIN VENTAS v2 ON dv.ID_VENTA = v2.ID_VENTA
               WHERE v2.FECHA_VENTA BETWEEN ? AND ? AND v2.ESTADO <> 'CANCELADA') AS totalUnidades,
              (SELECT COUNT(*) FROM USUARIOS WHERE DATE(FECHA_REGISTRO) BETWEEN ? AND ?) AS totalUsuarios
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'`,
      [desdeIni, hastaFin, desde, hasta, desdeIni, hastaFin]
    );

    const agrup = getFormatoAgrupacion(granularidad);
    const agrupU = getFormatoAgrupacion(granularidad).replaceAll('FECHA_VENTA', 'FECHA_REGISTRO');
    const [serieRaw] = await db.query(
      `SELECT ${agrup} AS dia, COUNT(*) AS ordenes, COALESCE(SUM(TOTAL), 0) AS ingresos
       FROM VENTAS
       WHERE FECHA_VENTA BETWEEN ? AND ? AND ESTADO <> 'CANCELADA'
       GROUP BY ${agrup}
       ORDER BY dia ASC`,
      [desdeIni, hastaFin]
    );
    const [unidadesRaw] = await db.query(
      `SELECT ${agrup} AS dia, COALESCE(SUM(dv.CANTIDAD),0) AS unidades
       FROM VENTAS v JOIN DETALLE_VENTAS dv ON dv.ID_VENTA=v.ID_VENTA
       WHERE v.FECHA_VENTA BETWEEN ? AND ? AND v.ESTADO <> 'CANCELADA'
       GROUP BY ${agrup} ORDER BY dia ASC`,
      [desdeIni, hastaFin]
    );
    const [usuariosRaw] = await db.query(
      `SELECT ${agrupU} AS dia, COUNT(*) AS nuevos
       FROM USUARIOS WHERE FECHA_REGISTRO BETWEEN ? AND ? GROUP BY ${agrupU} ORDER BY dia ASC`,
      [desde, hasta]
    );
    // Serie completa del rango según granularidad para que la gráfica sea continua
    const serieMapR = new Map(serieRaw.map((s) => [String(s.dia), s]));
    const unidadesMap = new Map(unidadesRaw.map((s) => [String(s.dia), Number(s.unidades)]));
    const usuariosMap = new Map(usuariosRaw.map((s) => [String(s.dia), Number(s.nuevos)]));
    const serie = [];
    if (granularidad === 'dia') {
      for (let d = new Date(desde); d <= new Date(hasta); d.setDate(d.getDate() + 1)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMapR.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos), unidades: unidadesMap.get(iso) || 0, nuevosUsuarios: usuariosMap.get(iso) || 0 } : { dia: iso, ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: usuariosMap.get(iso) || 0 });
      }
    } else if (granularidad === 'semana') {
      // Genera lunes de cada semana entre desde y hasta
      const start = new Date(desde); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // lunes
      const end = new Date(hasta);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
        const iso = d.toISOString().slice(0, 10);
        const row = serieMapR.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos), unidades: unidadesMap.get(iso) || 0, nuevosUsuarios: usuariosMap.get(iso) || 0 } : { dia: iso, ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: usuariosMap.get(iso) || 0 });
      }
    } else if (granularidad === 'mes') {
      const start = new Date(desde); start.setDate(1);
      const end = new Date(hasta); end.setDate(1);
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        const iso = d.toISOString().slice(0, 7);
        const row = serieMapR.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos), unidades: unidadesMap.get(iso) || 0, nuevosUsuarios: usuariosMap.get(iso) || 0 } : { dia: iso, ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: usuariosMap.get(iso) || 0 });
      }
    } else { // anio
      const startY = new Date(desde).getFullYear();
      const endY = new Date(hasta).getFullYear();
      for (let y = startY; y <= endY; y++) {
        const iso = String(y);
        const row = serieMapR.get(iso);
        serie.push(row ? { dia: iso, ordenes: Number(row.ordenes), ingresos: Number(row.ingresos), unidades: unidadesMap.get(iso) || 0, nuevosUsuarios: usuariosMap.get(iso) || 0 } : { dia: iso, ordenes: 0, ingresos: 0, unidades: 0, nuevosUsuarios: usuariosMap.get(iso) || 0 });
      }
    }

    res.json({
      desde,
      hasta,
      granularidad,
      totalOrdenes: Number(resumen.totalOrdenes),
      totalIngresos: Number(resumen.totalIngresos),
      ticketPromedio: Math.round(Number(resumen.ticketPromedio)),
      totalUnidades: Number(resumen.totalUnidades),
      totalUsuarios: Number(resumen.totalUsuarios || 0),
      serie,
    });
  } catch (err) {
    console.error("Error al generar reporte de ventas:", err);
    res.status(500).json({ ok: false, msg: "Error al generar el reporte de ventas" });
  }
};

/**
 * RF-034: Ranking de productos más vendidos (GET /api/admin/analytics/mas-vendidos).
 * Ordena por unidades facturadas (excluye ventas CANCELADAS) dentro del rango.
 * Query params opcionales: desde, hasta (default: últimos 30 días), limite (default 10, máx 50).
 */
const masVendidos = async (req, res) => {
  try {
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
    const desde = fechaValida(req.query.desde) ? req.query.desde : hace30.toISOString().slice(0, 10);
    const hasta = fechaValida(req.query.hasta) ? req.query.hasta : hoy.toISOString().slice(0, 10);
    const limite = Math.min(Math.max(Number(req.query.limite) || 10, 1), 50);

    const [rows] = await db.query(
      `SELECT p.ID, p.NOMBRE,
              (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi
               WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN,
              SUM(dv.CANTIDAD) AS unidades,
              SUM(dv.SUBTOTAL) AS ingresos,
              (SELECT COALESCE(SUM(pv.STOCK), 0) FROM PRODUCTO_VARIANTES pv
               WHERE pv.ID_PRODUCTO = p.ID) AS stock
       FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE v.ESTADO <> 'CANCELADA' AND v.FECHA_VENTA BETWEEN ? AND ?
       GROUP BY p.ID, p.NOMBRE
       ORDER BY unidades DESC, ingresos DESC
       LIMIT ?`,
      [`${desde} 00:00:00`, `${hasta} 23:59:59`, limite]
    );

    res.json(rows.map((r) => ({ ...r, unidades: Number(r.unidades), ingresos: Number(r.ingresos), stock: Number(r.stock) })));
  } catch (err) {
    console.error("Error al obtener más vendidos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener los productos más vendidos" });
  }
};

/** Descarga del reporte en Excel (.xlsx) con fórmulas reales (RF-032/034 extendido). */
const { generarReporteExcel } = require("../utils/reporteExcel");
const { generarReportePdf } = require("../utils/reportePdf");
const { resolverRango } = require("../utils/reporteDatos");

const descargarReporteExcel = async (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const buffer = await generarReporteExcel(req.query);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="reporte-jadda_${desde}_a_${hasta}.xlsx"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    console.error("Error al generar el Excel del reporte:", err);
    res.status(500).json({ ok: false, msg: "Error al generar el reporte en Excel" });
  }
};

/** Descarga del reporte ejecutivo en PDF. */
const descargarReportePdf = async (req, res) => {
  try {
    const { desde, hasta } = resolverRango(req.query);
    const buffer = await generarReportePdf(req.query);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="reporte-jadda_${desde}_a_${hasta}.pdf"`);
    res.send(buffer);
  } catch (err) {
    console.error("Error al generar el PDF del reporte:", err);
    res.status(500).json({ ok: false, msg: "Error al generar el reporte en PDF" });
  }
};

/** Elimina completamente el registro de una compra CANCELADA (admin). */const eliminarCompra = async (req, res) => {
  const id_venta = req.params.id;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query("SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ? FOR UPDATE", [id_venta]);
    if (rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ ok: false, msg: "Compra no encontrada" });
    }
    if (rows[0].ESTADO !== "CANCELADA") {
      await connection.rollback();
      return res.status(400).json({ ok: false, msg: "Solo puedes eliminar compras canceladas" });
    }

    await connection.query("DELETE FROM DEVOLUCIONES WHERE ID_VENTA = ?", [id_venta]);
    await connection.query("DELETE FROM DETALLE_VENTAS WHERE ID_VENTA = ?", [id_venta]);
    await connection.query("DELETE FROM ENVIOS WHERE ID_VENTA = ?", [id_venta]);
    // OJO: la tabla real es PLANES_USUARIO (no existe una tabla "PLANES")
    await connection.query("DELETE FROM PLANES_USUARIO WHERE ID_VENTA = ?", [id_venta]);
    await connection.query("DELETE FROM VENTAS WHERE ID_VENTA = ?", [id_venta]);

    await connection.commit();
    res.json({ ok: true, msg: "Registro de la compra eliminado" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error al eliminar compra:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar la compra" });
  } finally {
    if (connection) connection.release();
  }
};

/** Todos los productos (de JADDA y de vendedores) con vendedor y estado de aprobación. */
const obtenerProductosAdmin = async (req, res) => {
  try {
    const { stock_bajo, solo_jadda } = req.query;
    const where = [];
    const having = [];
    if (stock_bajo === 'true') {
      // SUM() es un agregado: debe ir en HAVING (WHERE lanza "Invalid use of group function")
      having.push(`COALESCE(SUM(pv.STOCK), 0) <= 10`);
    }
    if (solo_jadda === 'true') {
      where.push(`p.ID_VENDEDOR IS NULL`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const havingSql = having.length ? `HAVING ${having.join(' AND ')}` : '';

    const [productos] = await db.query(
      `SELECT p.ID, p.NOMBRE, p.MARCA, p.PRECIO, p.ID_CATEGORIA, p.ID_DESCUENTO,
              p.ID_VENDEDOR, p.ESTADO_PUBLICACION,
              c.NOMBRE_CATEGORIA AS CATEGORIA,
              pi.URL_IMAGEN AS IMAGEN,
              COALESCE(SUM(pv.STOCK), 0) AS STOCK,
              (SELECT ROUND(AVG(r.CALIFICACION), 1) FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID) AS RATING,
              (SELECT COUNT(*) FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID) AS RESENA_COUNT,
              COALESCE(v.NOMBRE_EMPRESA, 'JADDA SPORTS') AS VENDEDOR_NOMBRE
       FROM PRODUCTOS p
       LEFT JOIN CATEGORIAS c ON p.ID_CATEGORIA = c.ID_CATEGORIA
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_VARIANTES pv ON p.ID = pv.ID_PRODUCTO
       LEFT JOIN VENDEDORES v ON p.ID_VENDEDOR = v.ID_VENDEDOR
       ${whereSql}
        GROUP BY p.ID, p.NOMBRE, p.MARCA, p.PRECIO, p.ID_CATEGORIA, p.ID_DESCUENTO,
                 p.ID_VENDEDOR, p.ESTADO_PUBLICACION, c.NOMBRE_CATEGORIA, pi.URL_IMAGEN,
                 v.NOMBRE_EMPRESA
        ${havingSql}
        ORDER BY p.ID DESC`
    );
    res.json(productos);
  } catch (err) {
    console.error("Error en obtenerProductosAdmin:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener productos" });
  }
};

/** Detalle completo de un producto para el panel admin (incluye PENDIENTE/RECHAZADO). */
const obtenerProductoAdminPorId = async (req, res) => {
  const id = req.params.id;
  try {
    const [producto] = await db.query(
      `SELECT p.*, c.NOMBRE_CATEGORIA AS CATEGORIA,
              COALESCE(v.NOMBRE_EMPRESA, 'JADDA SPORTS') AS VENDEDOR_NOMBRE,
              d.PORCENTAJE AS DESCUENTO_PORCENTAJE
       FROM PRODUCTOS p
       LEFT JOIN CATEGORIAS c ON p.ID_CATEGORIA = c.ID_CATEGORIA
       LEFT JOIN VENDEDORES v ON p.ID_VENDEDOR = v.ID_VENDEDOR
       LEFT JOIN DESCUENTOS d ON p.ID_DESCUENTO = d.ID_DESCUENTO
       WHERE p.ID = ?`,
      [id]
    );
    if (producto.length === 0) {
      return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
    }
    const [imagenes] = await db.query(
      `SELECT URL_IMAGEN AS url, ORDEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ? ORDER BY ORDEN ASC`,
      [id]
    );
    const [caracteristicas] = await db.query(
      `SELECT NOMBRE_ATRIBUTO, VALOR_ATRIBUTO FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?`,
      [id]
    );
    const [variantes] = await db.query(
      `SELECT ID_VARIANTE, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK
       FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? ORDER BY ID_VARIANTE ASC`,
      [id]
    );
    res.json({
      ...producto[0],
      IMAGENES: imagenes || [],
      CARACTERISTICAS: caracteristicas || [],
      VARIANTES: variantes || [],
    });
  } catch (err) {
    console.error("Error en obtenerProductoAdminPorId:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener el producto" });
  }
};

/** Aprueba un producto de vendedor (lo hace visible en la tienda). */
const aprobarProducto = async (req, res) => {
  const id = req.params.id;
  try {
    const [rows] = await db.query(
      `SELECT p.ID, p.NOMBRE, p.ID_VENDEDOR, v.ID_USUARIO
       FROM PRODUCTOS p
       LEFT JOIN VENDEDORES v ON p.ID_VENDEDOR = v.ID_VENDEDOR
       WHERE p.ID = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
    const producto = rows[0];
    if (!producto.ID_VENDEDOR) {
      return res.status(400).json({ ok: false, msg: "Este producto es de JADDA SPORTS y ya está publicado" });
    }
    if (producto.ESTADO_PUBLICACION === "APROBADO") {
      return res.json({ ok: true, sinCambios: true, msg: "El producto ya estaba aprobado" });
    }
    await db.query("UPDATE PRODUCTOS SET ESTADO_PUBLICACION = 'APROBADO' WHERE ID = ?", [id]);
    if (producto.ID_USUARIO) {
      await crearNotificacion({
        idUsuario: producto.ID_USUARIO,
        tipo: 'vendedor',
        titulo: '¡Producto aprobado! ✅',
        mensaje: `Tu producto "${producto.NOMBRE}" ya está a la venta en la tienda.`,
        ruta: '/vendedor/productos',
      });
    }
    res.json({ ok: true, msg: "Producto aprobado y publicado" });
  } catch (err) {
    console.error("Error en aprobarProducto:", err);
    res.status(500).json({ ok: false, msg: "Error al aprobar el producto" });
  }
};

/** Rechaza un producto de vendedor con observación (queda oculto). */
const rechazarProducto = async (req, res) => {
  const id = req.params.id;
  const { observacion } = req.body || {};
  try {
    const [rows] = await db.query(
      `SELECT p.ID, p.NOMBRE, p.ID_VENDEDOR, v.ID_USUARIO
       FROM PRODUCTOS p
       LEFT JOIN VENDEDORES v ON p.ID_VENDEDOR = v.ID_VENDEDOR
       WHERE p.ID = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ ok: false, msg: "Producto no encontrado" });
    const producto = rows[0];
    if (!producto.ID_VENDEDOR) {
      return res.status(400).json({ ok: false, msg: "Este producto es de JADDA SPORTS y no puede rechazarse" });
    }
    if (producto.ESTADO_PUBLICACION === "RECHAZADO") {
      return res.json({ ok: true, sinCambios: true, msg: "El producto ya estaba rechazado" });
    }
    await db.query("UPDATE PRODUCTOS SET ESTADO_PUBLICACION = 'RECHAZADO' WHERE ID = ?", [id]);
    if (producto.ID_USUARIO) {
      await crearNotificacion({
        idUsuario: producto.ID_USUARIO,
        tipo: 'vendedor',
        titulo: 'Producto rechazado',
        mensaje: `Tu producto "${producto.NOMBRE}" no fue aprobado.${observacion ? ` Motivo: ${observacion}` : ""} Puedes editarlo y volver a enviarlo.`,
        ruta: '/vendedor/productos',
      });
    }
    res.json({ ok: true, msg: "Producto rechazado" });
  } catch (err) {
    console.error("Error en rechazarProducto:", err);
    res.status(500).json({ ok: false, msg: "Error al rechazar el producto" });
  }
};

module.exports = { obtenerDashboard, obtenerPendientes, obtenerTodasLasCompras, actualizarEstadoCompra, actualizarEstadoEnvio, obtenerUsuarios, obtenerUsuarioDetalle, descargarFacturaAdmin, reporteVentas, masVendidos, eliminarCompra, obtenerProductosAdmin, obtenerProductoAdminPorId, aprobarProducto, rechazarProducto, descargarReporteExcel, descargarReportePdf };
