const db = require('../config/db');

/** Valida un cupón de descuento buscándolo por descripción (LIKE %codigo%).
 *  Verifica que esté dentro del rango de fechas FECHA_INICIO - FECHA_FIN.
 *  Retorna el objeto descuento si es válido, o un error si no se encuentra o expiró. */
const validarCupon = async (req, res) => {
  const { codigo } = req.body;

  if (!codigo) {
    return res.status(400).json({ ok: false, msg: "Código de cupón requerido" });
  }

  try {
    const [rows] = await db.query(
      `SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN
       FROM DESCUENTOS
       WHERE DESCRIPCION LIKE ?`,
      [`%${codigo}%`]
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
      },
    });
  } catch (err) {
    console.error("Error al validar cupón:", err);
    res.status(500).json({ ok: false, msg: "Error al validar cupón" });
  }
};

module.exports = { validarCupon };
