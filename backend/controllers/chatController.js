/**
 * chatController: conversaciones del marketplace.
 * - SOPORTE     → usuario ↔ admins (dudas generales)
 * - VENDEDOR    → usuario ↔ vendedor (envíos, detalles del producto)
 * - DEVOLUCION  → comprador ↔ vendedor por una solicitud de devolución/reembolso
 *                 de un producto de vendedor; si no hay acuerdo cualquiera puede
 *                 ESCALAR y el equipo JADDA decide el desenlace.
 * Acceso: participantes del chat; los admins ven todos. Mensajería por polling.
 */
const db = require('../config/db');
const { crearNotificacion } = require('./notificacionController');
const { censurar } = require('../utils/groserias');

const MAX_MENSAJE = 2000;

/** Fila de VENDEDORES para un usuario con rol 6 */
async function vendedorDeUsuario(idUsuario) {
  const [rows] = await db.query('SELECT * FROM VENDEDORES WHERE ID_USUARIO = ?', [idUsuario]);
  return rows[0] || null;
}

/** Carga el chat verificando que el usuario participe.
 *  PARTE = 'CLIENTE' → solo cliente + admins; 'VENDEDOR' → solo vendedor + admins;
 *  NULL → chat de acuerdo original (cliente ↔ vendedor). */
async function chatConAcceso(idChat, usuario) {
  const [[chat]] = await db.query('SELECT * FROM CHAT WHERE ID_CHAT = ?', [idChat]);
  if (!chat) return { error: 404, msg: 'Conversación no encontrada' };

  if (usuario?.ID_ROL === 1) return { chat, rol: 'ADMIN' };

  const esClienteDelChat = chat.ID_CLIENTE === usuario?.ID_USUARIO;
  let esVendedorDelChat = false;
  if (usuario?.ID_ROL === 6) {
    const vend = await vendedorDeUsuario(usuario.ID_USUARIO);
    esVendedorDelChat = !!vend && chat.ID_VENDEDOR === vend.ID_VENDEDOR;
  }

  if (chat.PARTE === 'CLIENTE' && esClienteDelChat) return { chat, rol: 'CLIENTE' };
  if (chat.PARTE === 'VENDEDOR' && esVendedorDelChat) return { chat, rol: 'VENDEDOR' };
  if (!chat.PARTE && esClienteDelChat) return { chat, rol: 'CLIENTE' };
  if (!chat.PARTE && esVendedorDelChat) return { chat, rol: 'VENDEDOR' };

  return { error: 403, msg: 'No participas en esta conversación' };
}

/** Ruta correcta de la conversación según quién la recibe:
 *  admins → /admin/chats, vendedores → /vendedor/chats, clientes → /chats */
function rutaSegunDestinatario(chat) {
  return {
    admin: `/admin/chats?chat=${chat.ID_CHAT}`,
    vendedor: `/vendedor/chats?chat=${chat.ID_CHAT}`,
    cliente: `/chats?chat=${chat.ID_CHAT}`,
  };
}

async function notificarUsuarios(idsUsuarios, chat, preview, tipoDestinatario = "cliente") {
  const unicos = [...new Set(idsUsuarios.filter(Boolean))];
  const ruta = rutaSegunDestinatario(chat)[tipoDestinatario];
  for (const id of unicos) {
    try {
      await crearNotificacion({
        idUsuario: id,
        tipo: "chat",
        titulo: "💬 Nuevo mensaje",
        mensaje: String(preview || "").slice(0, 180),
        ruta,
      });
    } catch (e) {
      console.error("Error al notificar mensaje de chat:", e.message);
    }
  }
}

async function idsAdmins() {
  const [rows] = await db.query('SELECT ID_USUARIO FROM USUARIOS WHERE ID_ROL = 1');
  return rows.map((r) => r.ID_USUARIO);
}

/** Inserta un mensaje del sistema (escalaciones, decisiones finales...) */
async function mensajeSistema(idChat, texto) {
  await db.query(
    "INSERT INTO CHAT_MENSAJE (ID_CHAT, ROL_AUTOR, MENSAJE, LEIDO) VALUES (?, 'SISTEMA', ?, 0)",
    [idChat, texto]
  );
  await db.query('UPDATE CHAT SET ULTIMA_ACTIVIDAD = NOW() WHERE ID_CHAT = ?', [idChat]);
}

/**
 * Cierra TODOS los chats vinculados a una devolución tras una decisión final
 * (hilo de acuerdo + hilos separados con JADDA si los hubo).
 * Lo usan devolucionController (admin) y vendedorController (vendedor).
 */
async function cerrarChatDeDevolucion(idDevolucion, textoFinal) {
  try {
    const [chats] = await db.query('SELECT ID_CHAT FROM CHAT WHERE ID_DEVOLUCION = ?', [idDevolucion]);
    for (const c of chats) {
      if (textoFinal) await mensajeSistema(c.ID_CHAT, textoFinal);
      await db.query("UPDATE CHAT SET ESTADO = 'CERRADA' WHERE ID_CHAT = ?", [c.ID_CHAT]);
    }
  } catch (e) {
    console.error('Error al cerrar chats de devolución:', e.message);
  }
}

/** (Usuario autenticado) Inicia o recupera una conversación. Body: { tipo, id_producto?, id_devolucion? } */
exports.iniciar = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });

  const { tipo, id_producto, id_devolucion } = req.body || {};
  try {
    if (tipo === 'SOPORTE') {
      // El equipo JADDA ES el soporte: no abre tickets propios
      if (usuario.ID_ROL === 1) {
        return res.status(400).json({ ok: false, msg: 'El equipo JADDA es el soporte: responde los tickets desde la lista de conversaciones' });
      }
      const [[existente]] = await db.query(
        "SELECT ID_CHAT FROM CHAT WHERE TIPO = 'SOPORTE' AND ID_CLIENTE = ? AND ID_VENDEDOR IS NULL AND ESTADO <> 'CERRADA' LIMIT 1",
        [usuario.ID_USUARIO]
      );
      if (existente) return res.json({ ok: true, id_chat: existente.ID_CHAT });
      const [r] = await db.query(
        "INSERT INTO CHAT (TIPO, ID_CLIENTE) VALUES ('SOPORTE', ?)",
        [usuario.ID_USUARIO]
      );
      await mensajeSistema(r.insertId, '👋 Bienvenido al soporte de JADDA SPORTS. Cuéntanos en qué podemos ayudarte.');
      return res.status(201).json({ ok: true, id_chat: r.insertId });
    }

    if (tipo === 'VENDEDOR') {
      if (!id_producto) return res.status(400).json({ ok: false, msg: 'Falta el producto' });
      const [[prod]] = await db.query('SELECT ID, NOMBRE, ID_VENDEDOR FROM PRODUCTOS WHERE ID = ?', [id_producto]);
      if (!prod) return res.status(404).json({ ok: false, msg: 'Producto no encontrado' });
      // Chat por producto: sea JADDA (ID_VENDEDOR null) o vendedor externo, ambos usan tipo VENDEDOR con producto
      if (!prod.ID_VENDEDOR) {
        const [[existenteJadda]] = await db.query(
          "SELECT ID_CHAT FROM CHAT WHERE TIPO = 'VENDEDOR' AND ID_CLIENTE = ? AND ID_VENDEDOR IS NULL AND ID_PRODUCTO = ? AND ESTADO <> 'CERRADA' LIMIT 1",
          [usuario.ID_USUARIO, prod.ID]
        );
        if (existenteJadda) return res.json({ ok: true, id_chat: existenteJadda.ID_CHAT });
        const [r] = await db.query(
          "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_PRODUCTO) VALUES ('VENDEDOR', ?, NULL, ?)",
          [usuario.ID_USUARIO, prod.ID]
        );
        await mensajeSistema(r.insertId, `💬 Chat ${prod.NOMBRE} - ${usuario.NOMBRE_USUARIO || usuario.USUARIO || 'cliente'}. Producto JADDA: "${prod.NOMBRE}". Un asesor te responderá aquí.`);
        return res.status(201).json({ ok: true, id_chat: r.insertId });
      }
      // Producto de vendedor externo
      const [[existente]] = await db.query(
        "SELECT ID_CHAT FROM CHAT WHERE TIPO = 'VENDEDOR' AND ID_CLIENTE = ? AND ID_VENDEDOR = ? AND (ID_PRODUCTO = ? OR ID_PRODUCTO IS NULL) AND ESTADO <> 'CERRADA' ORDER BY ID_PRODUCTO DESC LIMIT 1",
        [usuario.ID_USUARIO, prod.ID_VENDEDOR, prod.ID]
      );
      if (existente) {
        await db.query('UPDATE CHAT SET ID_PRODUCTO = ? WHERE ID_CHAT = ? AND ID_PRODUCTO IS NULL', [prod.ID, existente.ID_CHAT]);
        return res.json({ ok: true, id_chat: existente.ID_CHAT });
      }
      const [r] = await db.query(
        "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_PRODUCTO) VALUES ('VENDEDOR', ?, ?, ?)",
        [usuario.ID_USUARIO, prod.ID_VENDEDOR, prod.ID]
      );
      await mensajeSistema(r.insertId, `💬 Chat ${prod.NOMBRE} - ${usuario.NOMBRE_USUARIO || usuario.USUARIO || 'cliente'}. Producto: "${prod.NOMBRE}". Aquí puedes resolver dudas de envío, disponibilidad o detalles.`);
      return res.status(201).json({ ok: true, id_chat: r.insertId });
    }

    if (tipo === 'DEVOLUCION') {
      if (!id_devolucion) return res.status(400).json({ ok: false, msg: 'Falta la solicitud' });
      const [[sol]] = await db.query(
        `SELECT d.*, p.ID_VENDEDOR FROM DEVOLUCIONES d
         JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID WHERE d.ID_DEVOLUCION = ?`,
        [id_devolucion]
      );
      if (!sol) return res.status(404).json({ ok: false, msg: 'Solicitud no encontrada' });

      let autorizado = sol.ID_USUARIO === usuario.ID_USUARIO;
      if (!autorizado && usuario.ID_ROL === 6) {
        const vend = await vendedorDeUsuario(usuario.ID_USUARIO);
        autorizado = !!vend && sol.ID_VENDEDOR === vend.ID_VENDEDOR;
      }
      if (!autorizado) return res.status(403).json({ ok: false, msg: 'No participas en esta solicitud' });
      if (!sol.ID_VENDEDOR) return res.status(400).json({ ok: false, msg: 'Esta solicitud es gestionada directamente por JADDA SPORTS' });

      // Resuelve el hilo correcto para quien pregunta: su hilo con JADDA si ya
      // escaló, o el de acuerdo original; crea uno solo si no existe ninguno.
      const [chats] = await db.query(
        "SELECT * FROM CHAT WHERE TIPO = 'DEVOLUCION' AND ID_DEVOLUCION = ?",
        [sol.ID_DEVOLUCION]
      );
      if (chats.length > 0) {
        const soyElVendedor = usuario.ID_ROL === 6;
        const miParte = soyElVendedor ? 'VENDEDOR' : 'CLIENTE';
        const objetivo = chats.find((c) => c.PARTE === miParte) || chats.find((c) => !c.PARTE);
        if (objetivo) return res.json({ ok: true, id_chat: objetivo.ID_CHAT });
      }

      const [r] = await db.query(
        "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_DEVOLUCION) VALUES ('DEVOLUCION', ?, ?, ?)",
        [sol.ID_USUARIO, sol.ID_VENDEDOR, sol.ID_DEVOLUCION]
      );
      await mensajeSistema(r.insertId, `🔄 Espacio de acuerdo para la solicitud #${sol.ID_DEVOLUCION} (${sol.TIPO}). Coordina la solución aquí; si no llegan a un acuerdo, cualquiera puede escalarla al equipo JADDA.`);
      return res.status(201).json({ ok: true, id_chat: r.insertId });
    }

    res.status(400).json({ ok: false, msg: 'Tipo de conversación inválido' });
  } catch (err) {
    console.error('Error en iniciar chat:', err);
    res.status(500).json({ ok: false, msg: 'Error al iniciar la conversación' });
  }
};

/** (Autenticado) Lista mis conversaciones ordenadas por actividad, con no leídos. */
exports.misConversaciones = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  try {
    let filtroRol = '';
    let params = [];
    if (usuario.ID_ROL === 1) {
      filtroRol = '';
    } else if (usuario.ID_ROL === 6) {
      const vend = await vendedorDeUsuario(usuario.ID_USUARIO);
      if (!vend) return res.json([]);
      filtroRol = 'WHERE c.ID_VENDEDOR = ?';
      params = [vend.ID_VENDEDOR];
    } else {
      filtroRol = 'WHERE c.ID_CLIENTE = ?';
      params = [usuario.ID_USUARIO];
    }
    const miRol = usuario.ID_ROL === 1 ? 'ADMIN' : usuario.ID_ROL === 6 ? 'VENDEDOR' : 'CLIENTE';

    const [rows] = await db.query(
      `SELECT c.*, c.PARTE,
              uc.NOMBRE_USUARIO AS CLIENTE_NOMBRE,
              vd.NOMBRE_EMPRESA AS VENDEDOR_EMPRESA,
              vu.NOMBRE_USUARIO AS VENDEDOR_NOMBRE_LOGIN,
              d.ESTADO AS DEVOLUCION_ESTADO, d.TIPO AS DEVOLUCION_TIPO,
              COALESCE(p.NOMBRE, p2.NOMBRE) AS PRODUCTO_NOMBRE,
              COALESCE(pi.URL_IMAGEN, pi2.URL_IMAGEN) AS PRODUCTO_IMAGEN,
              p2.ID AS PRODUCTO_ID_DIRECTO,
              (SELECT m.MENSAJE FROM CHAT_MENSAJE m WHERE m.ID_CHAT = c.ID_CHAT ORDER BY m.ID_MENSAJE DESC LIMIT 1) AS ULTIMO_MENSAJE,
              (SELECT m.ROL_AUTOR FROM CHAT_MENSAJE m WHERE m.ID_CHAT = c.ID_CHAT ORDER BY m.ID_MENSAJE DESC LIMIT 1) AS ULTIMO_ROL,
              (SELECT COUNT(*) FROM CHAT_MENSAJE m
                WHERE m.ID_CHAT = c.ID_CHAT AND m.LEIDO = 0 AND m.ROL_AUTOR <> ?) AS NO_LEIDOS
       FROM CHAT c
       LEFT JOIN USUARIOS uc ON c.ID_CLIENTE = uc.ID_USUARIO
       LEFT JOIN VENDEDORES vd ON c.ID_VENDEDOR = vd.ID_VENDEDOR
       LEFT JOIN USUARIOS vu ON vd.ID_USUARIO = vu.ID_USUARIO
       LEFT JOIN DEVOLUCIONES d ON c.ID_DEVOLUCION = d.ID_DEVOLUCION
       LEFT JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID
       LEFT JOIN PRODUCTOS p2 ON c.ID_PRODUCTO = p2.ID
       LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
       LEFT JOIN PRODUCTO_IMAGENES pi2 ON p2.ID = pi2.ID_PRODUCTO AND pi2.ORDEN = 1
       ${filtroRol}
       ORDER BY c.ULTIMA_ACTIVIDAD DESC`,
      [miRol, ...params]
    );
    res.json(rows);
  } catch (err) {
    console.error('Error en misConversaciones:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar las conversaciones' });
  }
};

/** (Autenticado) Total de mensajes sin leer en mis conversaciones (para badges). */
exports.noLeidos = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  try {
    let filtroRol = '';
    const params = [];
    if (usuario.ID_ROL === 1) {
      filtroRol = '';
    } else if (usuario.ID_ROL === 6) {
      const vend = await vendedorDeUsuario(usuario.ID_USUARIO);
      if (!vend) return res.json({ ok: true, total: 0 });
      filtroRol = 'AND c.ID_VENDEDOR = ?';
      params.push(vend.ID_VENDEDOR);
    } else {
      filtroRol = 'AND c.ID_CLIENTE = ?';
      params.push(usuario.ID_USUARIO);
    }
    const miRol = usuario.ID_ROL === 1 ? 'ADMIN' : usuario.ID_ROL === 6 ? 'VENDEDOR' : 'CLIENTE';

    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total
       FROM CHAT_MENSAJE m
       JOIN CHAT c ON m.ID_CHAT = c.ID_CHAT
       WHERE c.ESTADO <> 'CERRADA' ${filtroRol}
         AND m.LEIDO = 0 AND m.ROL_AUTOR <> ?`,
      [...params, miRol]
    );
    res.json({ ok: true, total: Number(row.total) || 0 });
  } catch (err) {
    console.error('Error en noLeidos:', err);
    res.status(500).json({ ok: false, msg: 'Error al contar los mensajes sin leer' });
  }
};

/** (Participante) Mensajes de una conversación; marca como leídos los del otro bando. */
exports.mensajes = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  try {
    const acceso = await chatConAcceso(req.params.id, usuario);
    if (acceso.error) return res.status(acceso.error).json({ ok: false, msg: acceso.msg });
    const { chat, rol } = acceso;

    await db.query(
      'UPDATE CHAT_MENSAJE SET LEIDO = 1 WHERE ID_CHAT = ? AND LEIDO = 0 AND ROL_AUTOR <> ?',
      [chat.ID_CHAT, rol]
    );
    const [mensajes] = await db.query(
      `SELECT m.*, u.NOMBRE_USUARIO AS AUTOR_NOMBRE
       FROM CHAT_MENSAJE m
       LEFT JOIN USUARIOS u ON m.ID_AUTOR = u.ID_USUARIO
       WHERE m.ID_CHAT = ?
       ORDER BY m.FECHA ASC, m.ID_MENSAJE ASC`,
      [chat.ID_CHAT]
    );

    let empresaVendedor = null;
    if (chat.ID_VENDEDOR) {
      const [[vd]] = await db.query('SELECT NOMBRE_EMPRESA FROM VENDEDORES WHERE ID_VENDEDOR = ?', [chat.ID_VENDEDOR]);
      empresaVendedor = vd?.NOMBRE_EMPRESA || null;
    }
    let productoChat = null;
    if (chat.ID_PRODUCTO) {
      const [[prod]] = await db.query('SELECT p.ID, p.NOMBRE, (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN FROM PRODUCTOS p WHERE p.ID = ?', [chat.ID_PRODUCTO]);
      productoChat = prod || null;
    } else if (chat.ID_DEVOLUCION) {
      const [[prod]] = await db.query('SELECT p.ID, p.NOMBRE, (SELECT pi.URL_IMAGEN FROM PRODUCTO_IMAGENES pi WHERE pi.ID_PRODUCTO = p.ID AND pi.ORDEN = 1 LIMIT 1) AS IMAGEN FROM DEVOLUCIONES d JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID WHERE d.ID_DEVOLUCION = ?', [chat.ID_DEVOLUCION]);
      productoChat = prod || null;
    }
    res.json({ ok: true, chat: { ...chat, VENDEDOR_EMPRESA: empresaVendedor, PRODUCTO: productoChat }, mi_rol: rol, mensajes });
  } catch (err) {
    console.error('Error en mensajes:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar los mensajes' });
  }
};

/** (Participante) Envía un mensaje. Admins pueden escribir en cualquier chat activo/escalado. */
exports.enviar = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  const texto = censurar(String(req.body?.mensaje ?? '').trim());
  if (!texto) return res.status(400).json({ ok: false, msg: 'Escribe un mensaje' });
  if (texto.length > MAX_MENSAJE) return res.status(400).json({ ok: false, msg: `El mensaje no puede superar ${MAX_MENSAJE} caracteres` });

  try {
    const acceso = await chatConAcceso(req.params.id, usuario);
    if (acceso.error) return res.status(acceso.error).json({ ok: false, msg: acceso.msg });
    const { chat, rol } = acceso;
    if (chat.ESTADO === 'CERRADA') {
      return res.status(400).json({ ok: false, msg: 'Esta conversación ya está cerrada' });
    }

    const [r] = await db.query(
      'INSERT INTO CHAT_MENSAJE (ID_CHAT, ID_AUTOR, ROL_AUTOR, MENSAJE) VALUES (?, ?, ?, ?)',
      [chat.ID_CHAT, usuario.ID_USUARIO, rol, texto]
    );
    await db.query('UPDATE CHAT SET ULTIMA_ACTIVIDAD = NOW() WHERE ID_CHAT = ?', [chat.ID_CHAT]);

    // Notifica al otro bando (nunca bloquea la respuesta)
    try {
      if (rol === "CLIENTE") {
        if (chat.TIPO === "SOPORTE") {
          await notificarUsuarios(await idsAdmins(), chat, texto, "admin");
        } else {
          if (!chat.ID_VENDEDOR) {
            await notificarUsuarios(await idsAdmins(), chat, texto, "admin");
          } else {
            const [[vend]] = await db.query('SELECT ID_USUARIO FROM VENDEDORES WHERE ID_VENDEDOR = ?', [chat.ID_VENDEDOR]);
            await notificarUsuarios([vend?.ID_USUARIO], chat, texto, "vendedor");
          }
        }
      } else if (rol === "VENDEDOR") {
        await notificarUsuarios([chat.ID_CLIENTE], chat, texto, "cliente");
      } else if (rol === "ADMIN") {
        await notificarUsuarios([chat.ID_CLIENTE], chat, texto, "cliente");
        if (chat.TIPO !== "SOPORTE" && chat.ID_VENDEDOR) {
          const [[vend]] = await db.query('SELECT ID_USUARIO FROM VENDEDORES WHERE ID_VENDEDOR = ?', [chat.ID_VENDEDOR]);
          await notificarUsuarios([vend?.ID_USUARIO], chat, texto, "vendedor");
        }
      }
    } catch (e) {
      console.error("Error al notificar:", e.message);
    }

    const [[msg]] = await db.query(
      `SELECT m.*, u.NOMBRE_USUARIO AS AUTOR_NOMBRE FROM CHAT_MENSAJE m
       LEFT JOIN USUARIOS u ON m.ID_AUTOR = u.ID_USUARIO WHERE m.ID_MENSAJE = ?`,
      [r.insertId]
    );
    res.status(201).json({ ok: true, mensaje: msg });
  } catch (err) {
    console.error('Error al enviar mensaje:', err);
    res.status(500).json({ ok: false, msg: 'Error al enviar el mensaje' });
  }
};

/** (Cliente o vendedor del chat) Escala una disputa de devolución al equipo JADDA. */
exports.escalar = async (req, res) => {
  const usuario = req.user;
  if (!usuario?.ID_USUARIO) return res.status(401).json({ ok: false, msg: 'Debes iniciar sesión' });
  try {
    const acceso = await chatConAcceso(req.params.id, usuario);
    if (acceso.error) return res.status(acceso.error).json({ ok: false, msg: acceso.msg });
    const { chat, rol } = acceso;
    if (chat.TIPO !== 'DEVOLUCION') {
      return res.status(400).json({ ok: false, msg: 'Solo las conversaciones de devolución se pueden escalar' });
    }
    if (rol === 'ADMIN') {
      return res.status(400).json({ ok: false, msg: 'El equipo JADDA ya tiene esta solicitud' });
    }
    if (chat.ESTADO !== 'ACTIVA') {
      return res.status(400).json({ ok: false, msg: `Esta conversación ya está ${chat.ESTADO.toLowerCase()}` });
    }

    await db.query("UPDATE DEVOLUCIONES SET ESTADO = 'ESCALADA', FECHA_PROCESADA = NULL WHERE ID_DEVOLUCION = ?", [chat.ID_DEVOLUCION]);

    // Cierra el hilo de acuerdo entre comprador y vendedor
    await db.query("UPDATE CHAT SET ESTADO = 'CERRADA' WHERE ID_CHAT = ?", [chat.ID_CHAT]);
    await mensajeSistema(
      chat.ID_CHAT,
      '⚠️ La conversación fue escalada al equipo JADDA SPORTS. Este espacio se cierra: cada parte continúa en su chat con el asesor.'
    );

    // Crea un hilo separado para cada parte (mismo caso, chats distintos para no confundirse) - mantiene producto para título "chat devolucion {producto}"
    let idProdEscalada = chat.ID_PRODUCTO || null;
    if (!idProdEscalada && chat.ID_DEVOLUCION) {
      try {
        const [[solProd]] = await db.query('SELECT ID_PRODUCTO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [chat.ID_DEVOLUCION]);
        idProdEscalada = solProd?.ID_PRODUCTO || null;
      } catch {}
    }
    // Obtener datos completos para el mensaje enriquecido del admin
    const [[solFull]] = await db.query(
      `SELECT d.*, p.NOMBRE AS PRODUCTO_NOMBRE, u.NOMBRE_USUARIO AS CLIENTE_NOMBRE, u.EMAIL AS CLIENTE_EMAIL, vd.NOMBRE_EMPRESA AS VENDEDOR_EMPRESA
       FROM DEVOLUCIONES d
       LEFT JOIN PRODUCTOS p ON d.ID_PRODUCTO = p.ID
       LEFT JOIN USUARIOS u ON d.ID_USUARIO = u.ID_USUARIO
       LEFT JOIN VENDEDORES vd ON d.ID_PRODUCTO IN (SELECT ID FROM PRODUCTOS WHERE ID_VENDEDOR = vd.ID_VENDEDOR)
       WHERE d.ID_DEVOLUCION = ? LIMIT 1`,
      [chat.ID_DEVOLUCION]
    );
    let vendedorNombre = solFull?.VENDEDOR_EMPRESA || null;
    if (!vendedorNombre && chat.ID_VENDEDOR) {
      const [[vd]] = await db.query('SELECT NOMBRE_EMPRESA FROM VENDEDORES WHERE ID_VENDEDOR = ?', [chat.ID_VENDEDOR]);
      vendedorNombre = vd?.NOMBRE_EMPRESA || null;
    }
    const resumenAdmin = `Solicitud #${chat.ID_DEVOLUCION} | ${solFull?.TIPO || 'DEVOLUCION'} | Producto: ${solFull?.PRODUCTO_NOMBRE || 'N/A'} x${solFull?.CANTIDAD || 1} | Motivo: ${solFull?.MOTIVO || 'N/A'} | Cliente: ${solFull?.CLIENTE_NOMBRE || chat.ID_CLIENTE} (${solFull?.CLIENTE_EMAIL || ''}) | Vendedor: ${vendedorNombre || (chat.ID_VENDEDOR ? 'Vendedor #'+chat.ID_VENDEDOR : 'JADDA')}`;

    const [rCli] = await db.query(
      "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_PRODUCTO, ID_DEVOLUCION, PARTE, ESTADO) VALUES ('DEVOLUCION', ?, NULL, ?, ?, 'CLIENTE', 'ESCALADA')",
      [chat.ID_CLIENTE, idProdEscalada, chat.ID_DEVOLUCION]
    );
    await mensajeSistema(
      rCli.insertId,
      `⚖️ Escalada #${chat.ID_DEVOLUCION} | ${solFull?.PRODUCTO_NOMBRE || 'Producto'} | Motivo: ${solFull?.MOTIVO || 'N/A'} | Cliente: ${solFull?.CLIENTE_NOMBRE || ''} -> El asesor decidirá aquí.`
    );

    let rVen = null;
    if (chat.ID_VENDEDOR) {
      const [r] = await db.query(
        "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_PRODUCTO, ID_DEVOLUCION, PARTE, ESTADO) VALUES ('DEVOLUCION', ?, ?, ?, ?, 'VENDEDOR', 'ESCALADA')",
        [chat.ID_CLIENTE, chat.ID_VENDEDOR, idProdEscalada, chat.ID_DEVOLUCION]
      );
      rVen = r;
      await mensajeSistema(
        rVen.insertId,
        `⚖️ Escalada #${chat.ID_DEVOLUCION} | ${solFull?.PRODUCTO_NOMBRE || 'Producto'} | Motivo: ${solFull?.MOTIVO || 'N/A'} | Vendedor: ${vendedorNombre || ''} -> Coordina aquí con el asesor.`
      );
    }

    const [[sol]] = await db.query('SELECT TIPO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [chat.ID_DEVOLUCION]);
    for (const idAdmin of await idsAdmins()) {
      try {
        await crearNotificacion({
          idUsuario: idAdmin,
          tipo: 'devolucion',
          titulo: '⚖️ Devolución escalada',
          mensaje: resumenAdmin.slice(0, 180),
          ruta: '/admin/chats',
        });
      } catch (e) { /* nunca bloquea */ }
    }
    await notificarUsuarios([chat.ID_CLIENTE], { ID_CHAT: rCli.insertId }, `Tu solicitud #${chat.ID_DEVOLUCION} fue escalada al equipo JADDA`, "cliente");
    if (rVen) {
      const [[vend]] = await db.query('SELECT ID_USUARIO FROM VENDEDORES WHERE ID_VENDEDOR = ?', [chat.ID_VENDEDOR]);
      await notificarUsuarios([vend?.ID_USUARIO], { ID_CHAT: rVen.insertId }, `La solicitud #${chat.ID_DEVOLUCION} escaló al equipo JADDA`, "vendedor");
    }

    res.json({ ok: true, msg: 'Solicitud escalada: el equipo JADDA abrirá un espacio contigo y otro con la otra parte' });
  } catch (err) {
    console.error('Error al escalar:', err);
    res.status(500).json({ ok: false, msg: 'Error al escalar la conversación' });
  }
};

/**
 * Crea (o recupera) el chat de acuerdo de una devolución y deja el mensaje
 * inicial del comprador. Lo usan devolucionController (al solicitar) y el
 * propio endpoint iniciar.
 */
async function abrirChatDevolucion({ idCliente, idVendedor, idDevolucion, mensajeInicial }) {
  const [[existente]] = await db.query(
    "SELECT ID_CHAT FROM CHAT WHERE TIPO = 'DEVOLUCION' AND ID_DEVOLUCION = ? LIMIT 1",
    [idDevolucion]
  );
  if (existente) return { idChat: existente.ID_CHAT, nuevo: false };

  // Obtener producto principal de la devolución para el título "chat devolucion {producto}"
  let idProductoDevol = null;
  try {
    const [[sol]] = await db.query('SELECT ID_PRODUCTO FROM DEVOLUCIONES WHERE ID_DEVOLUCION = ?', [idDevolucion]);
    idProductoDevol = sol?.ID_PRODUCTO || null;
  } catch {}

  const [r] = await db.query(
    "INSERT INTO CHAT (TIPO, ID_CLIENTE, ID_VENDEDOR, ID_PRODUCTO, ID_DEVOLUCION) VALUES ('DEVOLUCION', ?, ?, ?, ?)",
    [idCliente, idVendedor, idProductoDevol, idDevolucion]
  );
  await mensajeSistema(
    r.insertId,
    `🔄 Espacio de acuerdo para la solicitud #${idDevolucion}. Coordina aquí la solución con la otra parte; si no llegan a un acuerdo, cualquiera puede escalarla al equipo JADDA.`
  );
  if (mensajeInicial) {
    await db.query(
      "INSERT INTO CHAT_MENSAJE (ID_CHAT, ID_AUTOR, ROL_AUTOR, MENSAJE) VALUES (?, ?, 'CLIENTE', ?)",
      [r.insertId, idCliente, censurar(String(mensajeInicial)).slice(0, MAX_MENSAJE)]
    );
  }
  return { idChat: r.insertId, nuevo: true };
}

module.exports.cerrarChatDeDevolucion = cerrarChatDeDevolucion;
module.exports.abrirChatDevolucion = abrirChatDevolucion;
