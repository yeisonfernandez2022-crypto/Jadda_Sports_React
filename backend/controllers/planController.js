const db = require("../config/db");

exports.misPlanes = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const [planes] = await db.query(
      `SELECT pu.*, pp.TITULO, pp.DESCRIPCION AS PLAN_DESC, pp.DURACION_DIAS, pp.NIVEL, pp.CONTENIDO,
              c.NOMBRE_CATEGORIA
       FROM PLANES_USUARIO pu
       JOIN PLANTILLAS_PLANES pp ON pu.ID_PLANTILLA = pp.ID_PLANTILLA
       LEFT JOIN CATEGORIAS c ON pp.ID_CATEGORIA = c.ID_CATEGORIA
       WHERE pu.ID_USUARIO = ?
       ORDER BY pu.FECHA_INICIO DESC`,
      [idUsuario]
    );

    const result = planes.map((p) => ({
      ...p,
      CONTENIDO: typeof p.CONTENIDO === "string" ? JSON.parse(p.CONTENIDO) : p.CONTENIDO,
    }));

    res.json(result);
  } catch (err) {
    console.error("Error al obtener planes:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener planes" });
  }
};

exports.generarPlan = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_venta } = req.body;

    const [productos] = await db.query(
      `SELECT p.ID_CATEGORIA FROM DETALLE_VENTAS dv
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE dv.ID_VENTA = ?`,
      [id_venta]
    );

    const categorias = [...new Set(productos.map((p) => p.ID_CATEGORIA))];

    for (const idCat of categorias) {
      const [plantillas] = await db.query(
        `SELECT ID_PLANTILLA FROM PLANTILLAS_PLANES WHERE ID_CATEGORIA = ? LIMIT 1`,
        [idCat]
      );
      if (plantillas.length === 0) continue;

      const [existe] = await db.query(
        `SELECT ID_PLAN FROM PLANES_USUARIO WHERE ID_USUARIO = ? AND ID_VENTA = ? AND ID_PLANTILLA = ?`,
        [idUsuario, id_venta, plantillas[0].ID_PLANTILLA]
      );
      if (existe.length > 0) continue;

      await db.query(
        `INSERT INTO PLANES_USUARIO (ID_USUARIO, ID_VENTA, ID_PLANTILLA, FECHA_INICIO) VALUES (?, ?, ?, CURDATE())`,
        [idUsuario, id_venta, plantillas[0].ID_PLANTILLA]
      );
    }

    res.json({ ok: true, msg: "Plan(es) generado(s)" });
  } catch (err) {
    console.error("Error al generar plan:", err);
    res.status(500).json({ ok: false, msg: "Error al generar plan" });
  }
};

exports.marcarDia = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_plan } = req.params;
    const { dia } = req.body;

    const [plan] = await db.query(
      `SELECT pu.*, pp.CONTENIDO FROM PLANES_USUARIO pu
       JOIN PLANTILLAS_PLANES pp ON pu.ID_PLANTILLA = pp.ID_PLANTILLA
       WHERE pu.ID_PLAN = ? AND pu.ID_USUARIO = ?`,
      [id_plan, idUsuario]
    );
    if (plan.length === 0) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });

    const contenido = typeof plan[0].CONTENIDO === "string" ? JSON.parse(plan[0].CONTENIDO) : plan[0].CONTENIDO;
    const diasCompletados = req.body.dias_completados || [];

    const totalDias = contenido.length;
    const completado = diasCompletados.length >= totalDias ? 1 : 0;

    await db.query(`UPDATE PLANES_USUARIO SET COMPLETADO = ? WHERE ID_PLAN = ?`, [completado, id_plan]);

    res.json({ ok: true, completado: !!completado, progreso: `${diasCompletados.length}/${totalDias}` });
  } catch (err) {
    console.error("Error al marcar día:", err);
    res.status(500).json({ ok: false, msg: "Error al marcar día" });
  }
};
