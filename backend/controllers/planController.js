const dbReal = require("../config/db");
const path = require("path");
const fs = require("fs");

// P10: el progreso del plan vive EN la fila del usuario (PLANES_USUARIO.
// DIAS_COMPLETADOS), no en backend/data/planes-progreso.json — en Render el
// disco se pierde en cada redeploy. Inyección de BD para pruebas (patrón P7).
let db = dbReal;
exports._useDb = (reemplazo) => { db = reemplazo; };

const ARCHIVO_PROGRESO = path.join(__dirname, "..", "data", "planes-progreso.json");

/** Parsea una columna JSON que puede llegar como string, objeto o null. */
const parsearJson = (valor, porDefecto) => {
  if (valor === null || valor === undefined) return porDefecto;
  if (typeof valor === "string") {
    try {
      return JSON.parse(valor);
    } catch {
      return porDefecto;
    }
  }
  return valor;
};

/**
 * Importa UNA VEZ el mapa legado { id_plan -> dias[] } del archivo
 * planes-progreso.json a las filas PLANES_USUARIO cuyo DIAS_COMPLETADOS aún
 * es NULL (idempotente: nunca pisa el progreso real de la BD).
 */
exports._importarProgreso = async (mapa) => {
  if (!mapa || typeof mapa !== "object") return 0;
  let actualizados = 0;
  for (const [clave, dias] of Object.entries(mapa)) {
    const idPlan = Number(clave);
    if (!Number.isInteger(idPlan) || !Array.isArray(dias)) continue;
    const [r] = await db.query(
      `UPDATE PLANES_USUARIO SET DIAS_COMPLETADOS = ?
       WHERE ID_PLAN = ? AND DIAS_COMPLETADOS IS NULL`,
      [JSON.stringify(dias), idPlan]
    );
    if (r && r.affectedRows > 0) actualizados++; // solo filas realmente rellenadas
  }
  return actualizados;
};

// Al arrancar (best-effort, nunca bloquea ni rompe el boot): si existe el
// archivo legado, rellena las filas a las que aún no les ha marcado nada.
const importarProgresoLegacy = async () => {
  try {
    if (!fs.existsSync(ARCHIVO_PROGRESO)) return;
    const mapa = JSON.parse(fs.readFileSync(ARCHIVO_PROGRESO, "utf8"));
    const n = await exports._importarProgreso(mapa);
    if (n > 0) console.log(`📖 Planes: ${n} filas rellenadas desde planes-progreso.json (legado)`);
  } catch (err) {
    console.error("📖 Planes: import del progreso legado falló (se continúa con la BD):", err.message);
  }
};
void importarProgresoLegacy();

/** Obtiene los planes de entrenamiento del usuario autenticado.
 *  Hace JOIN con PLANTILLAS_PLANES y CATEGORIAS.
 *  Parsea CONTENIDO y DIAS_COMPLETADOS (persistidos en SU fila) de string a array. */
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

    const result = planes.map((p) => {
      let dias = p.DIAS_COMPLETADOS;
      if (!Array.isArray(dias)) dias = Array.isArray(parsearJson(dias, [])) ? parsearJson(dias, []) : [];
      return {
        ...p,
        CONTENIDO: parsearJson(p.CONTENIDO, p.CONTENIDO),
        DIAS_COMPLETADOS: dias,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error al obtener planes:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener planes" });
  }
};

/** Genera uno o más planes de entrenamiento basados en las categorías de los productos
 *  comprados en una venta específica. Busca plantillas que coincidan con cada categoría
 *  y las inserta en PLANES_USUARIO, evitando duplicados. */
exports.generarPlan = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_venta } = req.body;

    const [productos] = await db.query(
      `SELECT p.ID_CATEGORIA FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA
       JOIN PRODUCTOS p ON dv.ID_PRODUCTO = p.ID
       WHERE dv.ID_VENTA = ? AND v.ID_CLIENTE = ?`,
      [id_venta, idUsuario]
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

/** Marca el progreso de un plan de entrenamiento recibiendo el arreglo dias_completados.
 *  Persiste el progreso en la MISMA fila (DIAS_COMPLETADOS) y marca COMPLETADO = 1
 *  si se han cubierto todos los días del CONTENIDO de la plantilla. */
exports.marcarDia = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_plan } = req.params;

    const [plan] = await db.query(
      `SELECT pu.ID_PLAN, pp.CONTENIDO FROM PLANES_USUARIO pu
       JOIN PLANTILLAS_PLANES pp ON pu.ID_PLANTILLA = pp.ID_PLANTILLA
       WHERE pu.ID_PLAN = ? AND pu.ID_USUARIO = ?`,
      [id_plan, idUsuario]
    );
    if (plan.length === 0) return res.status(404).json({ ok: false, msg: "Plan no encontrado" });

    const contenido = parsearJson(plan[0].CONTENIDO, []);
    const totalDias = Array.isArray(contenido) ? contenido.length : 0;
    const bruto = req.body.dias_completados;
    const diasCompletados = Array.isArray(bruto)
      ? bruto.map(Number).filter((v) => Number.isFinite(v))
      : [];

    const completado = diasCompletados.length >= totalDias ? 1 : 0;

    // P10: persistencia en la fila del usuario (sobrevive a redeploys/sleep de Render).
    // A01: el UPDATE también amarra el dueño (mismo criterio que el SELECT).
    await db.query(
      `UPDATE PLANES_USUARIO SET COMPLETADO = ?, DIAS_COMPLETADOS = ? WHERE ID_PLAN = ? AND ID_USUARIO = ?`,
      [completado, JSON.stringify(diasCompletados), id_plan, idUsuario]
    );

    res.json({ ok: true, completado: !!completado, progreso: `${diasCompletados.length}/${totalDias}` });
  } catch (err) {
    console.error("Error al marcar día:", err);
    res.status(500).json({ ok: false, msg: "Error al marcar día" });
  }
};
