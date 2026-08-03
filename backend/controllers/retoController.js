const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { crearNotificacion } = require("./notificacionController");

/** Obtiene todos los retos activos cuya fecha actual esté entre FECHA_INICIO y FECHA_FIN.
 *  Solo retorna retos con ACTIVO = 1, ordenados por fecha de fin ascendente. */
exports.obtenerRetos = async (req, res) => {
  try {
    const [retos] = await db.query(
      `SELECT * FROM RETOS WHERE ACTIVO = 1 AND FECHA_INICIO <= CURDATE() AND FECHA_FIN >= CURDATE() ORDER BY FECHA_FIN ASC`
    );
    res.json(retos);
  } catch (err) {
    console.error("Error al obtener retos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener retos" });
  }
};

/** Inscribe al usuario autenticado en un reto específico.
 *  Verifica que no esté ya inscrito y que el reto exista y esté activo.
 *  Inserta un registro en RETOS_USUARIOS con PROGRESO = 0 y COMPLETADO = 0. */
exports.unirseReto = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto } = req.params;

    const [existe] = await db.query(
      `SELECT * FROM RETOS_USUARIOS WHERE ID_RETO = ? AND ID_USUARIO = ?`,
      [id_reto, idUsuario]
    );
    if (existe.length > 0) {
      return res.status(400).json({ ok: false, msg: "Ya estás inscrito en este reto" });
    }

    const [reto] = await db.query(`SELECT * FROM RETOS WHERE ID_RETO = ? AND ACTIVO = 1`, [id_reto]);
    if (reto.length === 0) {
      return res.status(404).json({ ok: false, msg: "Reto no encontrado o no disponible" });
    }

    await db.query(
      `INSERT INTO RETOS_USUARIOS (ID_RETO, ID_USUARIO, PROGRESO, COMPLETADO) VALUES (?, ?, 0, 0)`,
      [id_reto, idUsuario]
    );

    res.json({ ok: true, msg: "Te has inscrito al reto exitosamente" });
  } catch (err) {
    console.error("Error al unirse al reto:", err);
    res.status(500).json({ ok: false, msg: "Error al unirse al reto" });
  }
};

/**
 * Reporta progreso para un reto del usuario autenticado.
 * El avance SIEMPRE requiere material (imagen o video en base64) y queda
 * PENDIENTE de aprobación por el admin: nada suma al progreso hasta aprobarse.
 * Acepta VARIOS archivos: el primero se guarda en RUTA y los demás en RUTAS_EXTRA (JSON).
 * La cantidad no puede exceder la meta restante (tope = META_VALOR - PROGRESO - pendientes).
 */
exports.reportarProgreso = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto_usuario } = req.params;
    const { cantidad, materiales } = req.body || {};

    // Compatibilidad: si llega `material` solo, se trata como un único archivo
    const listaMateriales = Array.isArray(materiales) && materiales.length > 0
      ? materiales
      : (req.body?.material ? [{ material: req.body.material, tipo_material: req.body.tipo_material }] : []);

    const [rows] = await db.query(
      `SELECT ru.*, r.META_VALOR, r.META_TIPO, r.TITULO FROM RETOS_USUARIOS ru JOIN RETOS r ON ru.ID_RETO = r.ID_RETO WHERE ru.ID_RETO_USUARIO = ? AND ru.ID_USUARIO = ?`,
      [id_reto_usuario, idUsuario]
    );
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, msg: "No estás inscrito en este reto" });
    }

    const ru = rows[0];
    if (ru.COMPLETADO) {
      return res.status(400).json({ ok: false, msg: "Este reto ya fue completado" });
    }

    // Material obligatorio: al menos una imagen o video
    if (listaMateriales.length === 0) {
      return res.status(400).json({ ok: false, msg: "Debes adjuntar al menos una foto o video como evidencia del avance" });
    }

    // Límites de archivos: máximo 10, cada uno ≤ ~10 MB y total ≤ ~60 MB (para no exceder el body de 100mb)
    const MAX_ARCHIVOS = 10;
    const MAX_BASE64_POR_ARCHIVO = 14 * 1024 * 1024; // ≈ 10.5 MB
    const MAX_BASE64_TOTAL = 84 * 1024 * 1024; // ≈ 63 MB

    if (listaMateriales.length > MAX_ARCHIVOS) {
      return res.status(400).json({ ok: false, msg: `Máximo ${MAX_ARCHIVOS} archivos por avance` });
    }
    let totalBase64 = 0;
    for (const archivo of listaMateriales) {
      if (!archivo || typeof archivo.material !== "string") continue;
      if (archivo.material.length > MAX_BASE64_POR_ARCHIVO) {
        return res.status(400).json({ ok: false, msg: "Cada archivo debe pesar máximo 10 MB" });
      }
      totalBase64 += archivo.material.length;
    }
    if (totalBase64 > MAX_BASE64_TOTAL) {
      return res.status(400).json({ ok: false, msg: "El total de archivos supera el límite permitido (60 MB)" });
    }

    // Tope: cantidad no puede superar la meta restante (descontando pendientes)
    const [[{ pendientes }]] = await db.query(
      `SELECT COALESCE(SUM(CANTIDAD), 0) AS pendientes FROM RETO_EVIDENCIAS
       WHERE ID_RETO_USUARIO = ? AND ESTADO = 'pendiente'`,
      [id_reto_usuario]
    );
    const restante = ru.META_VALOR - ru.PROGRESO - Number(pendientes || 0);
    if (restante <= 0) {
      return res.status(400).json({ ok: false, msg: `Ya alcanzaste la meta del reto (${ru.META_VALOR} ${ru.META_TIPO}). Espera a que aprueben tus avances.` });
    }

    let valorCantidad = Math.max(1, Math.floor(Number(cantidad) || 1));
    if (valorCantidad > restante) {
      valorCantidad = restante;
    }

    // Guarda todos los archivos: RUTA = primero, RUTAS_EXTRA = resto (JSON)
    const rutasGuardadas = [];
    for (const archivo of listaMateriales) {
      if (!archivo || typeof archivo.material !== "string") continue;
      const tipo = archivo.tipo_material === "video" ? "video" : "imagen";
      const ruta = guardarMaterial(archivo.material, tipo, id_reto_usuario);
      if (ruta) rutasGuardadas.push(ruta);
    }
    if (rutasGuardadas.length === 0) {
      return res.status(400).json({ ok: false, msg: "Formato de archivo no válido (jpg, png, webp, gif, mp4, webm)" });
    }

    const rutaPrincipal = rutasGuardadas[0];
    const rutasExtra = rutasGuardadas.length > 1 ? JSON.stringify(rutasGuardadas.slice(1)) : null;

    await db.query(
      `INSERT INTO RETO_EVIDENCIAS (ID_RETO_USUARIO, ID_USUARIO, TIPO, RUTA, RUTAS_EXTRA, CANTIDAD, ESTADO)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [id_reto_usuario, idUsuario, listaMateriales[0]?.tipo_material === "video" ? "video" : "imagen", rutaPrincipal, rutasExtra, valorCantidad]
    );

    // Notificación al admin para que revise la evidencia
    const nombreUsuario = `${req.user.NOMBRE_USUARIO || "Un usuario"}${req.user.APELLIDO_USUARIO ? ` ${req.user.APELLIDO_USUARIO}` : ""}`;
    await crearNotificacion({
      idUsuario: null,
      tipo: "reto_evidencia",
      titulo: "Nueva evidencia de reto",
      mensaje: `El usuario ${nombreUsuario} envió evidencia del reto "${ru.TITULO}". Verifícala para aprobar el avance.`,
      ruta: "/admin/retos",
    });

    return res.json({
      ok: true,
      en_revision: true,
      msg: "Avance enviado. Deja que nuestros asesores revisen el material para aprobar el avance. Puede tardar hasta 24 horas en ser revisado.",
    });
  } catch (err) {
    console.error("Error al reportar progreso:", err);
    res.status(500).json({ ok: false, msg: "Error al reportar progreso" });
  }
};

/** Obtiene todos los retos del usuario autenticado con su progreso y metadatos.
 *  Incluye las evidencias pendientes/aprobadas/rechazadas para mostrar el estado de revisión. */
exports.misRetos = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;

    const [retos] = await db.query(
      `SELECT ru.*, r.TITULO, r.DESCRIPCION, r.META_TIPO, r.META_VALOR, r.RECOMPENSA_PORCENTAJE, r.FECHA_INICIO, r.FECHA_FIN,
              (SELECT COUNT(*) FROM RETO_EVIDENCIAS e WHERE e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO AND e.ESTADO = 'pendiente') AS EVIDENCIAS_PENDIENTES,
              (SELECT COUNT(*) FROM RETO_EVIDENCIAS e2 WHERE e2.ID_RETO_USUARIO = ru.ID_RETO_USUARIO AND e2.ESTADO = 'aprobado') AS EVIDENCIAS_APROBADAS,
              (SELECT COUNT(*) FROM RETO_EVIDENCIAS e3 WHERE e3.ID_RETO_USUARIO = ru.ID_RETO_USUARIO AND e3.ESTADO = 'rechazado') AS EVIDENCIAS_RECHAZADAS
       FROM RETOS_USUARIOS ru
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE ru.ID_USUARIO = ?
       ORDER BY ru.COMPLETADO ASC, ru.ID_RETO_USUARIO DESC`,
      [idUsuario]
    );

    res.json(retos);
  } catch (err) {
    console.error("Error al obtener mis retos:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener mis retos" });
  }
};

/** Obtiene las evidencias pendientes de un reto del usuario (para ver sus estados). */
exports.misEvidencias = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_reto_usuario } = req.params;

    const [evidencias] = await db.query(
      `SELECT ID_EVIDENCIA, TIPO, RUTA, RUTAS_EXTRA, CANTIDAD, ESTADO, FECHA_SUBIDA
       FROM RETO_EVIDENCIAS
       WHERE ID_RETO_USUARIO = ? AND ID_USUARIO = ?
       ORDER BY FECHA_SUBIDA DESC`,
      [id_reto_usuario, idUsuario]
    );

    res.json(evidencias);
  } catch (err) {
    console.error("Error al obtener evidencias:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener evidencias" });
  }
};

/* ============================ ADMIN ============================ */

/** (Admin) Obtiene todas las evidencias pendientes con datos del usuario y el reto. */
exports.adminEvidencias = async (req, res) => {
  try {
    const [evidencias] = await db.query(
      `SELECT e.ID_EVIDENCIA, e.TIPO, e.RUTA, e.RUTAS_EXTRA, e.CANTIDAD, e.ESTADO, e.FECHA_SUBIDA,
              e.ID_RETO_USUARIO, e.ID_USUARIO,
              u.NOMBRE_USUARIO AS USUARIO_NOMBRE, u.APELLIDO_USUARIO AS USUARIO_APELLIDO, u.EMAIL AS USUARIO_EMAIL,
              r.TITULO AS RETO_TITULO, ru.PROGRESO, r.META_VALOR, r.META_TIPO
       FROM RETO_EVIDENCIAS e
       JOIN USUARIOS u ON e.ID_USUARIO = u.ID_USUARIO
       JOIN RETOS_USUARIOS ru ON e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       ORDER BY (e.ESTADO = 'pendiente') DESC, e.FECHA_SUBIDA DESC
       LIMIT 200`
    );
    res.json(evidencias);
  } catch (err) {
    console.error("Error al obtener evidencias admin:", err);
    res.status(500).json({ ok: false, msg: "Error al obtener evidencias" });
  }
};

/** (Admin) Aprueba una evidencia: suma la cantidad al progreso del reto.
 *  Si alcanza la meta, marca COMPLETADO y genera el cupón de un solo uso. */
exports.aprobarEvidencia = async (req, res) => {
  try {
    const { id_evidencia } = req.params;

    const [evs] = await db.query(
      `SELECT e.*, ru.PROGRESO, ru.COMPLETADO, ru.ID_RETO, ru.ID_USUARIO AS RU_USUARIO,
              r.META_VALOR, r.RECOMPENSA_PORCENTAJE, r.TITULO AS RETO_TITULO
       FROM RETO_EVIDENCIAS e
       JOIN RETOS_USUARIOS ru ON e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE e.ID_EVIDENCIA = ?`,
      [id_evidencia]
    );
    if (evs.length === 0) {
      return res.status(404).json({ ok: false, msg: "Evidencia no encontrada" });
    }
    const ev = evs[0];
    if (ev.ESTADO !== "pendiente") {
      return res.status(400).json({ ok: false, msg: "Esta evidencia ya fue revisada" });
    }

    const nuevoProgreso = Math.min(ev.PROGRESO + ev.CANTIDAD, ev.META_VALOR);
    const completado = nuevoProgreso >= ev.META_VALOR ? 1 : 0;

    await db.query(`UPDATE RETO_EVIDENCIAS SET ESTADO = 'aprobado' WHERE ID_EVIDENCIA = ?`, [id_evidencia]);
    await db.query(
      `UPDATE RETOS_USUARIOS SET PROGRESO = ?, COMPLETADO = ? WHERE ID_RETO_USUARIO = ?`,
      [nuevoProgreso, completado, ev.ID_RETO_USUARIO]
    );

    let cupon = null;
    if (completado) {
      cupon = await generarCupon(ev.ID_RETO, ev.RU_USUARIO, ev.ID_RETO_USUARIO);
    }

    // Notificación al usuario: avance aprobado (con cupón si completó la meta)
    await crearNotificacion({
      idUsuario: ev.RU_USUARIO,
      tipo: completado ? "reto_completado" : "reto_aprobado",
      titulo: completado ? "¡Reto completado! 🏆" : "¡Avance aprobado!",
      mensaje: completado
        ? `Completaste el reto "${ev.RETO_TITULO}". Tu cupón ${cupon || ""} con ${ev.RECOMPENSA_PORCENTAJE}% de descuento ya está disponible.`
        : `Tu avance del reto "${ev.RETO_TITULO}" fue aprobado. Sigue así, te falta poco para la meta.`,
      ruta: "/retos",
    });

    res.json({
      ok: true,
      msg: completado ? "Evidencia aprobada y reto completado" : "Evidencia aprobada",
      progreso: nuevoProgreso,
      completado: !!completado,
      cupon,
    });
  } catch (err) {
    console.error("Error al aprobar evidencia:", err);
    res.status(500).json({ ok: false, msg: "Error al aprobar evidencia" });
  }
};

/** (Admin) Rechaza una evidencia (no suma progreso). */
exports.rechazarEvidencia = async (req, res) => {
  try {
    const { id_evidencia } = req.params;

    const [evs] = await db.query(
      `SELECT e.*, ru.ID_USUARIO AS RU_USUARIO, r.TITULO AS RETO_TITULO
       FROM RETO_EVIDENCIAS e
       JOIN RETOS_USUARIOS ru ON e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       WHERE e.ID_EVIDENCIA = ?`,
      [id_evidencia]
    );
    if (evs.length === 0) {
      return res.status(404).json({ ok: false, msg: "Evidencia no encontrada" });
    }
    if (evs[0].ESTADO !== "pendiente") {
      return res.status(400).json({ ok: false, msg: "Esta evidencia ya fue revisada" });
    }

    await db.query(`UPDATE RETO_EVIDENCIAS SET ESTADO = 'rechazado' WHERE ID_EVIDENCIA = ?`, [id_evidencia]);

    // Notificación al usuario: avance rechazado
    await crearNotificacion({
      idUsuario: evs[0].RU_USUARIO,
      tipo: "reto_rechazado",
      titulo: "Avance rechazado",
      mensaje: `Tu avance del reto "${evs[0].RETO_TITULO}" no fue aprobado. Revisa la evidencia que enviaste y vuelve a intentarlo.`,
      ruta: "/retos",
    });

    res.json({ ok: true, msg: "Evidencia rechazada" });
  } catch (err) {
    console.error("Error al rechazar evidencia:", err);
    res.status(500).json({ ok: false, msg: "Error al rechazar evidencia" });
  }
};

/* ============================ HELPERS ============================ */

/** Guarda un archivo base64 (imagen o video) en backend/uploads/retos/<id>/
 *  Devuelve la URL pública o null si el formato no es válido. */
function guardarMaterial(materialBase64, tipo, idRetoUsuario) {
  const regexImagen = /^data:image\/(jpeg|png|webp|gif);base64,(.+)$/;
  const regexVideo = /^data:video\/(mp4|webm);base64,(.+)$/;

  const m = tipo === "video" ? regexVideo.exec(materialBase64) : regexImagen.exec(materialBase64);
  if (!m) return null;

  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1];

  const uploadDir = path.join(__dirname, "..", "uploads", "retos", `r${idRetoUsuario}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  const nombre = `${tipo}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, nombre), Buffer.from(m[2], "base64"));

  return `/images/retos/r${idRetoUsuario}/${nombre}`;
}

/** Función interna que genera un cupón de descuento al completar un reto.
 *  Crea un código aleatorio RETO-XXXX-XXXX, con vigencia de 30 días,
 *  de UN SOLO USO (USADO = 0; se marca en checkout al aplicarse). */
async function generarCupon(idReto, idUsuario, idRetoUsuario) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const codigo = `RETO-${rand(4)}-${rand(4)}`;

  const [reto] = await db.query(`SELECT RECOMPENSA_PORCENTAJE FROM RETOS WHERE ID_RETO = ?`, [idReto]);
  if (reto.length === 0) return null;

  const porcentaje = reto[0].RECOMPENSA_PORCENTAJE;
  const hoy = new Date();
  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + 30);

  await db.query(
    `INSERT INTO DESCUENTOS (DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, USADO)
     VALUES (?, ?, ?, ?, 0)`,
    [codigo, porcentaje, hoy.toISOString().split("T")[0], fin.toISOString().split("T")[0]]
  );

  await db.query(`UPDATE RETOS_USUARIOS SET CUPON_GENERADO = ? WHERE ID_RETO_USUARIO = ?`, [codigo, idRetoUsuario]);

  return codigo;
}
