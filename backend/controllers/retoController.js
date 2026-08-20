const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { crearNotificacion } = require("./notificacionController");
const transporter = require("../config/mailer");
const { plantillaCorreo } = require("../utils/correo");
const { USUARIOS_DIR, claveDeReq } = require("../utils/carpetaUsuario");

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
 * El avance SIEMPRE requiere material (imagen o video) y queda
 * PENDIENTE de aprobación por el admin: nada suma al progreso hasta aprobarse.
 * Acepta VARIOS archivos: el primero se guarda en RUTA y los demás en RUTAS_EXTRA (JSON).
 * La cantidad no puede exceder la meta restante (tope = META_VALOR - PROGRESO - pendientes).
 * Dos modos:
 *  - Multipart (nuevo): req.files ya guardados en disco por multer (streaming, sin
 *    cargar el archivo en memoria → videos grandes sin colapsar la app).
 *  - Base64 (legacy): materiales[] en el body JSON, por compatibilidad.
 */
exports.reportarProgreso = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const clave = claveDeReq(req);
    const { id_reto_usuario } = req.params;
    const { cantidad } = req.body || {};

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

    // ---- Modo multipart: multer ya guardó los archivos en uploads/usuarios/{USUARIO}/retos/r{id}/ ----
    let listaRutas = null;
    let tipoPrincipal = null;

    if (req.files && req.files.length > 0) {
      if (req.files.length > 10) {
        limpiarArchivos(req.files, clave, id_reto_usuario);
        return res.status(400).json({ ok: false, msg: "Máximo 10 archivos por avance" });
      }
      listaRutas = req.files.map((f) => `/images/usuarios/${clave}/retos/r${id_reto_usuario}/${f.filename}`);
      tipoPrincipal = req.files[0].mimetype.startsWith("video/") ? "video" : "imagen";
    } else {
      // ---- Modo base64 (legacy) ----
      const { materiales } = req.body || {};
      const listaMateriales = Array.isArray(materiales) && materiales.length > 0
        ? materiales
        : (req.body?.material ? [{ material: req.body.material, tipo_material: req.body.tipo_material }] : []);

      // Material obligatorio: al menos una imagen o video
      if (listaMateriales.length === 0) {
        return res.status(400).json({ ok: false, msg: "Debes adjuntar al menos una foto o video como evidencia del avance" });
      }

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

      const rutasGuardadas = [];
      for (const archivo of listaMateriales) {
        if (!archivo || typeof archivo.material !== "string") continue;
        const tipo = archivo.tipo_material === "video" ? "video" : "imagen";
        const ruta = guardarMaterial(archivo.material, tipo, clave, id_reto_usuario);
        if (ruta) rutasGuardadas.push(ruta);
      }
      if (rutasGuardadas.length === 0) {
        return res.status(400).json({ ok: false, msg: "Formato de archivo no válido (jpg, png, webp, gif, mp4, webm)" });
      }
      listaRutas = rutasGuardadas;
      tipoPrincipal = listaMateriales[0]?.tipo_material === "video" ? "video" : "imagen";
    }

    // Tope: cantidad no puede superar la meta restante (descontando pendientes)
    const [[{ pendientes }]] = await db.query(
      `SELECT COALESCE(SUM(CANTIDAD), 0) AS pendientes FROM RETO_EVIDENCIAS
       WHERE ID_RETO_USUARIO = ? AND ESTADO = 'pendiente'`,
      [id_reto_usuario]
    );
    const restante = ru.META_VALOR - ru.PROGRESO - Number(pendientes || 0);
    if (restante <= 0) {
      limpiarArchivos(req.files, clave, id_reto_usuario);
      return res.status(400).json({ ok: false, msg: `Ya alcanzaste la meta del reto (${ru.META_VALOR} ${ru.META_TIPO}). Espera a que aprueben tus avances.` });
    }

    let valorCantidad = Math.max(1, Math.floor(Number(req.body.cantidad ?? cantidad) || 1));
    if (valorCantidad > restante) {
      valorCantidad = restante;
    }

    const rutaPrincipal = listaRutas[0];
    const rutasExtra = listaRutas.length > 1 ? JSON.stringify(listaRutas.slice(1)) : null;

    await db.query(
      `INSERT INTO RETO_EVIDENCIAS (ID_RETO_USUARIO, ID_USUARIO, TIPO, RUTA, RUTAS_EXTRA, CANTIDAD, ESTADO)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente')`,
      [id_reto_usuario, idUsuario, tipoPrincipal, rutaPrincipal, rutasExtra, valorCantidad]
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
    limpiarArchivos(req.files, clave, id_reto_usuario);
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
      `SELECT ID_EVIDENCIA, TIPO, RUTA, RUTAS_EXTRA, CANTIDAD, ESTADO, OBSERVACION, FECHA_SUBIDA
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

/** (Usuario) Elimina una evidencia propia que aún esté PENDIENTE de revisión.
 *  Borra los archivos del disco (RUTA + RUTAS_EXTRA) y la fila de la BD.
 *  Sirve para corregir avances mal enviados. */
exports.eliminarEvidencia = async (req, res) => {
  try {
    const idUsuario = req.user.ID_USUARIO || req.user.id;
    const { id_evidencia } = req.params;

    const [evs] = await db.query(
      `SELECT * FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ? AND ID_USUARIO = ?`,
      [id_evidencia, idUsuario]
    );
    if (evs.length === 0) {
      return res.status(404).json({ ok: false, msg: "Evidencia no encontrada" });
    }
    if (evs[0].ESTADO !== "pendiente") {
      return res.status(400).json({ ok: false, msg: "Solo puedes eliminar avances que siguen en revisión" });
    }

    // Borra los archivos del disco (evita huérfanos)
    borrarArchivosEvidencia(evs[0].RUTA, evs[0].RUTAS_EXTRA);

    await db.query(`DELETE FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ?`, [id_evidencia]);

    res.json({ ok: true, msg: "Avance eliminado. Ya puedes enviar uno nuevo con el material correcto." });
  } catch (err) {
    console.error("Error al eliminar evidencia:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar la evidencia" });
  }
};

/* ============================ ADMIN ============================ */

/** (Admin) Obtiene todas las evidencias pendientes con datos del usuario y el reto. */
exports.adminEvidencias = async (req, res) => {
  try {
    const [evidencias] = await db.query(
      `SELECT e.ID_EVIDENCIA, e.TIPO, e.RUTA, e.RUTAS_EXTRA, e.CANTIDAD, e.ESTADO, e.OBSERVACION, e.FECHA_SUBIDA,
              e.ID_RETO_USUARIO, e.ID_USUARIO,
              u.NOMBRE_USUARIO AS USUARIO_NOMBRE, u.APELLIDO_USUARIO AS USUARIO_APELLIDO, u.EMAIL AS USUARIO_EMAIL,
              r.TITULO AS RETO_TITULO, r.DESCRIPCION AS RETO_DESCRIPCION, ru.PROGRESO, r.META_VALOR, r.META_TIPO
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
              r.META_VALOR, r.RECOMPENSA_PORCENTAJE, r.TITULO AS RETO_TITULO,
              u.EMAIL AS USUARIO_EMAIL, u.NOMBRE_USUARIO AS USUARIO_NOMBRE
       FROM RETO_EVIDENCIAS e
       JOIN RETOS_USUARIOS ru ON e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       JOIN USUARIOS u ON e.ID_USUARIO = u.ID_USUARIO
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

    const observacion = (req.body?.observacion || "").toString().trim().slice(0, 500) || null;
    // Se conserva el material en disco: el usuario puede volver a ver lo que envió.
    await db.query(
      `UPDATE RETO_EVIDENCIAS SET ESTADO = 'aprobado', OBSERVACION = ? WHERE ID_EVIDENCIA = ?`,
      [observacion, id_evidencia]
    );
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

    // Correo al usuario (nunca bloquea la operación del admin)
    try {
      if (ev.USUARIO_EMAIL) {
        const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: ev.USUARIO_EMAIL,
          subject: completado
            ? `🏆 ¡Completaste el reto "${ev.RETO_TITULO}"! Tu cupón te espera - JADDA SPORTS`
            : `✅ Tu avance del reto "${ev.RETO_TITULO}" fue aprobado - JADDA SPORTS`,
          html: plantillaCorreo({
            emoji: completado ? "🏆" : "✅",
            titulo: completado ? "¡Reto completado!" : "¡Avance aprobado!",
            subtitulo: `Reto: ${ev.RETO_TITULO}`,
            saludo: `Hola ${ev.USUARIO_NOMBRE || "deportista"},`,
            contenido: completado
              ? `<p style="margin:0 0 8px">¡Increíble! Completaste el reto <strong>"${ev.RETO_TITULO}"</strong> y ya ganaste tu recompensa:</p>
                 <div style="margin:10px 0;padding:14px;background:#fef2f2;border:2px dashed #e63946;border-radius:12px;text-align:center">
                   <p style="margin:0 0 4px;font-size:11px;color:#64748b;letter-spacing:1px">TU CUPÓN DE DESCUENTO</p>
                   <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:2px;color:#dc2626">${cupon || "RETO-XXXX-XXXX"}</p>
                   <p style="margin:6px 0 0;font-size:12px;color:#64748b">${ev.RECOMPENSA_PORCENTAJE}% de descuento · un solo uso · válido 30 días</p>
                 </div>
                 <p style="font-size:13px;color:#475569;margin:6px 0 0">Escríbelo en el checkout y verás tu descuento aplicado al instante.</p>`
              : `<p style="margin:0 0 4px">Tu avance del reto <strong>"${ev.RETO_TITULO}"</strong> fue aprobado. 🎉</p>
                 <p style="margin:0;font-size:13px;color:#475569">Van ${Math.min(ev.PROGRESO + ev.CANTIDAD, ev.META_VALOR)} de ${ev.META_VALOR}. Sigue así, ¡te falta poco para la meta!</p>`,
            botonTexto: "Ver mis retos",
            botonEnlace: `${frontend}/retos`,
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error al enviar email de reto aprobado:", emailErr);
    }

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
      `SELECT e.*, ru.ID_USUARIO AS RU_USUARIO, r.TITULO AS RETO_TITULO,
              u.EMAIL AS USUARIO_EMAIL, u.NOMBRE_USUARIO AS USUARIO_NOMBRE
       FROM RETO_EVIDENCIAS e
       JOIN RETOS_USUARIOS ru ON e.ID_RETO_USUARIO = ru.ID_RETO_USUARIO
       JOIN RETOS r ON ru.ID_RETO = r.ID_RETO
       JOIN USUARIOS u ON e.ID_USUARIO = u.ID_USUARIO
       WHERE e.ID_EVIDENCIA = ?`,
      [id_evidencia]
    );
    if (evs.length === 0) {
      return res.status(404).json({ ok: false, msg: "Evidencia no encontrada" });
    }
    if (evs[0].ESTADO !== "pendiente") {
      return res.status(400).json({ ok: false, msg: "Esta evidencia ya fue revisada" });
    }

    const observacion = (req.body?.observacion || "").toString().trim().slice(0, 500) || null;
    // Se conserva el material en disco: el usuario puede volver a ver lo que envió.
    await db.query(
      `UPDATE RETO_EVIDENCIAS SET ESTADO = 'rechazado', OBSERVACION = ? WHERE ID_EVIDENCIA = ?`,
      [observacion, id_evidencia]
    );

    // Notificación al usuario: avance rechazado (con motivo si el admin lo dio)
    await crearNotificacion({
      idUsuario: evs[0].RU_USUARIO,
      tipo: "reto_rechazado",
      titulo: "Avance rechazado",
      mensaje: `Tu avance del reto "${evs[0].RETO_TITULO}" no fue aprobado.${observacion ? ` Motivo: ${observacion}.` : ""} Revisa la evidencia que enviaste y vuelve a intentarlo.`,
      ruta: "/retos",
    });

    // Correo al usuario (nunca bloquea la operación del admin)
    try {
      if (evs[0].USUARIO_EMAIL) {
        const frontend = process.env.FRONTEND_URL || "http://localhost:5173";
        await transporter.sendMail({
          from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
          to: evs[0].USUARIO_EMAIL,
          subject: `❌ Tu avance del reto "${evs[0].RETO_TITULO}" no fue aprobado - JADDA SPORTS`,
          html: plantillaCorreo({
            emoji: "❌",
            titulo: "Avance no aprobado",
            subtitulo: `Reto: ${evs[0].RETO_TITULO}`,
            saludo: `Hola ${evs[0].USUARIO_NOMBRE || "deportista"},`,
            contenido: `<p style="margin:0 0 6px">Revisamos la evidencia que enviaste para el reto <strong>"${evs[0].RETO_TITULO}"</strong> y no fue aprobada.</p>
                         ${observacion ? `<p style="margin:0 0 10px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:13px;color:#991b1b"><strong>Motivo:</strong> ${observacion}</p>` : ""}
                         <p style="font-size:13px;color:#475569;margin:0">Revisa los requisitos del reto, vuelve a intentarlo y nuestro equipo la evaluará en menos de 24 horas.</p>`,
            botonTexto: "Volver a intentarlo",
            botonEnlace: `${frontend}/retos`,
            notas: ["💡 Asegúrate de que la evidencia cumpla todos los requisitos del reto y sea clara."],
          }),
        });
      }
    } catch (emailErr) {
      console.error("Error al enviar email de reto rechazado:", emailErr);
    }

    res.json({ ok: true, msg: "Evidencia rechazada" });
  } catch (err) {
    console.error("Error al rechazar evidencia:", err);
    res.status(500).json({ ok: false, msg: "Error al rechazar evidencia" });
  }
};

/* ============================ HELPERS ============================ */

/** Borra los archivos de disco de una evidencia (RUTA + RUTAS_EXTRA).
 *  Soporta URLs nuevas (/images/usuarios/{clave}/retos/...) y legacy (/images/retos/r{id}/...).
 *  Nunca lanza: los errores de unlink se ignoran. */
function borrarArchivosEvidencia(rutaPrincipal, rutasExtraJson) {
  let rutasExtra = [];
  try {
    rutasExtra = JSON.parse(rutasExtraJson || "[]");
  } catch {}
  for (const ruta of [rutaPrincipal, ...rutasExtra]) {
    if (!ruta || typeof ruta !== "string") continue;
    let rel, base;
    if (ruta.startsWith("/images/usuarios/")) {
      rel = ruta.replace(/^\/images\/usuarios\//, "");
      base = path.join(__dirname, "..", "uploads", "usuarios");
    } else {
      rel = ruta.replace(/^\/images\/retos\//, "");
      base = path.join(__dirname, "..", "uploads", "retos");
    }
    try {
      fs.unlinkSync(path.join(base, rel));
    } catch {}
  }
}

/** Borra los archivos subidos por multer si la validación falla (evita huérfanos). */
function limpiarArchivos(files, clave, idRetoUsuario) {
  if (!files || files.length === 0) return;
  const dir = path.join(USUARIOS_DIR, clave, "retos", `r${idRetoUsuario}`);
  for (const f of files) {
    try {
      fs.unlinkSync(path.join(dir, f.filename));
    } catch {}
  }
}

/** Guarda un archivo base64 (imagen o video) en uploads/usuarios/{clave}/retos/r{id}/
 *  Devuelve la URL pública o null si el formato no es válido. */
function guardarMaterial(materialBase64, tipo, clave, idRetoUsuario) {
  const regexImagen = /^data:image\/(jpeg|png|webp|gif);base64,(.+)$/;
  const regexVideo = /^data:video\/(mp4|webm);base64,(.+)$/;

  const m = tipo === "video" ? regexVideo.exec(materialBase64) : regexImagen.exec(materialBase64);
  if (!m) return null;

  const ext = m[1].toLowerCase() === "jpeg" ? "jpg" : m[1];

  const uploadDir = path.join(USUARIOS_DIR, clave, "retos", `r${idRetoUsuario}`);
  fs.mkdirSync(uploadDir, { recursive: true });

  const nombre = `${tipo}-${Date.now()}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, nombre), Buffer.from(m[2], "base64"));

  return `/images/usuarios/${clave}/retos/r${idRetoUsuario}/${nombre}`;
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
