const db = require('../config/db');

/** (Autenticado) Cupones para el panel del checkout:
 *  - tienda: promos públicas vigentes (no RETO-)
 *  - personales: los RETO- ganados por este usuario, con su estado */
exports.listarParaCheckout = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ ok: false, msg: "Debes iniciar sesión" });

  try {
    const [tienda] = await db.query(
      `SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_FIN, MONTO_MINIMO
       FROM DESCUENTOS
       WHERE DESCRIPCION NOT LIKE 'RETO-%'
         AND (FECHA_INICIO IS NULL OR FECHA_INICIO <= CURDATE())
         AND (FECHA_FIN IS NULL OR FECHA_FIN >= CURDATE())
       ORDER BY PORCENTAJE DESC`
    );

    const [personales] = await db.query(
      `SELECT d.ID_DESCUENTO, d.DESCRIPCION, d.PORCENTAJE, d.FECHA_FIN, d.MONTO_MINIMO, d.USADO,
              r.TITULO AS RETO_TITULO
       FROM DESCUENTOS d
       JOIN RETOS_USUARIOS ru ON ru.CUPON_GENERADO = d.DESCRIPCION
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE ru.ID_USUARIO = ?
       ORDER BY d.ID_DESCUENTO DESC`,
      [idUsuario]
    );

    const mapear = (r) => ({
      codigo: r.DESCRIPCION,
      porcentaje: Number(r.PORCENTAJE),
      monto_minimo: r.MONTO_MINIMO != null ? Number(r.MONTO_MINIMO) : null,
      fecha_fin: r.FECHA_FIN,
      usado: Number(r.USADO) === 1,
      expirado: r.FECHA_FIN ? new Date(r.FECHA_FIN) < new Date() : false,
      reto_titulo: r.RETO_TITULO || null,
    });

    res.json({
      ok: true,
      tienda: tienda.map(mapear),
      personales: personales.map((r) => ({ ...mapear(r), usado: Number(r.USADO) === 1 })),
    });
  } catch (err) {
    console.error("Error al listar cupones:", err);
    res.status(500).json({ ok: false, msg: "Error al cargar los cupones" });
  }
};

/** Valida un cupón de descuento buscándolo por descripción (LIKE %codigo%).
 *  Verifica que esté dentro del rango de fechas FECHA_INICIO - FECHA_FIN.
 *  Retorna el objeto descuento si es válido, o un error si no se encuentra o expiró. */
const validarCupon = async (req, res) => {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ ok: false, msg: "Código de cupón requerido" });
  }

  try {
    // Búsqueda EXACTA (el collation de MySQL ya la hace insensible a mayúsculas)
    const [rows] = await db.query(
      `SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, MONTO_MINIMO
       FROM DESCUENTOS
       WHERE TRIM(DESCRIPCION) = ?`,
      [String(codigo).trim()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "Cupón no encontrado" });
    }

    const cupon = rows[0];
    const hoy = new Date();

    if (cupon.FECHA_INICIO && new Date(cupon.FECHA_INICIO) > hoy) {
      return res.status(400).json({ ok: false, msg: "El cupón aún no está vigente" });
    }

    if (cupon.FECHA_FIN && new Date(cupon.FECHA_FIN) < hoy) {
      return res.status(400).json({ ok: false, msg: "El cupón ha expirado" });
    }

    res.json({
      ok: true,
      descuento: {
        id: cupon.ID_DESCUENTO,
        descripcion: cupon.DESCRIPCION,
        porcentaje: Number(cupon.PORCENTAJE),
        monto_minimo: cupon.MONTO_MINIMO != null ? Number(cupon.MONTO_MINIMO) : null,
        fecha_fin: cupon.FECHA_FIN,
      },
    });
  } catch (err) {
    console.error("Error al validar cupón:", err);
    res.status(500).json({ ok: false, msg: "Error al validar cupón" });
  }
};

// OJO: asignar propiedades (un module.exports = {...} aquí pisaría listarParaCheckout)
module.exports.validarCupon = validarCupon;
// listarParaCheckout ya quedó exportada arriba con exports.listarParaCheckout
