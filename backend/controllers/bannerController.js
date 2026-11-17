/**
 * bannerController: CRUD de los banners del carrusel de la portada.
 * - Lectura pública (solo ACTIVOS, ordenados) para la tienda y el móvil.
 * - Creación/edición/eliminación listado completo SOLO administrador (la ruta
 *   ya exige esAdmin; aquí se sanea y valida el payload).
 */
const logger = require('../utils/logger.js');
const medidasImagen = require('../utils/medidasImagen');
const dbReal = require('../config/db');
// (P7/P10) Inyección de BD para tests unitarios
let db = dbReal;
const _useDb = (reemplazo) => { db = reemplazo; };
// Inyección del lector de medidas para tests (evita descargas/lecturas reales)
let medidor = medidasImagen;
const _useMedidas = (reemplazo) => { medidor = reemplazo; };

// --- Especificación visual del carrusel ---
// Los banners originales miden 1757×432 px (proporción 4.067:1). El carrusel
// recorta con object-fit: cover, así que lo que mantiene la portada pareja es
// la PROPORCIÓN (con una tolerancia pequeña por redondeos de exportación) y un
// ancho mínimo de calidad; el píxel exacto no es necesario.
const RELACION_OBJETIVO = 1757 / 432;
const TOLERANCIA_RELACION = 0.03; // ±3 %
const ANCHO_MINIMO = 1200;
const ALTO_SUGERIDO = Math.round(ANCHO_MINIMO / RELACION_OBJETIVO); // 295 px

/**
 * Verifica que la imagen exista, sea legible y cumpla la proporción/ancho del
 * carrusel. Devuelve [error, medidas]; error null = apta para el carrusel.
 */
const comprobarDimensionesBanner = async (imagen) => {
  const medidas = await medidor.obtenerMedidasImagen(imagen);
  if (!medidas) {
    return [
      `No se pudieron leer las dimensiones de la imagen. Verifica que la URL responda una imagen válida (jpg, png, webp o gif) con proporción ${ANCHO_MINIMO}×${ALTO_SUGERIDO} px (±3 %)`,
      null,
    ];
  }
  const relacion = medidas.ancho / medidas.alto;
  if (medidas.ancho < ANCHO_MINIMO) {
    return [
      `La imagen (${medidas.ancho}×${medidas.alto} px) es demasiado pequeña. El ancho mínimo es ${ANCHO_MINIMO} px — tamaño recomendado ${ANCHO_MINIMO}×${ALTO_SUGERIDO} px`,
      null,
    ];
  }
  if (Math.abs(relacion - RELACION_OBJETIVO) / RELACION_OBJETIVO > TOLERANCIA_RELACION) {
    return [
      `La imagen (${medidas.ancho}×${medidas.alto} px) no tiene la proporción del carrusel (4.07:1). Recorta o exporta a ${ANCHO_MINIMO}×${ALTO_SUGERIDO} px o superior respetando esa proporción`,
      null,
    ];
  }
  return [null, medidas];
};

/** Normaliza y valida el payload de un banner. Devuelve [error, datos]. */
const validarBanner = (body) => {
  const imagen = typeof body.IMAGEN === 'string' ? body.IMAGEN.trim() : '';
  if (!imagen) return ['La imagen del banner es obligatoria', null];
  if (imagen.length > 500) return ['La URL de la imagen no puede superar 500 caracteres', null];

  const textoAlt = typeof body.TEXTO_ALT === 'string' ? body.TEXTO_ALT.trim() : '';
  if (textoAlt.length > 200) return ['El texto alternativo no puede superar 200 caracteres', null];

  const orden = Number.parseInt(body.ORDEN, 10);
  if (!Number.isFinite(orden) || orden < 0 || orden > 9999) {
    return ['El orden debe ser un número entre 0 y 9999', null];
  }

  const activo = body.ACTIVO === undefined || body.ACTIVO === null || body.ACTIVO === '' ? 1 : (body.ACTIVO ? 1 : 0);
  return [null, { imagen, textoAlt, orden, activo }];
};

/** GET /api/banners — público: banners activos en orden de aparición. */
const listarPublicos = async (req, res) => {
  try {
    const [filas] = await db.query(
      'SELECT ID_BANNER, IMAGEN, TEXTO_ALT, ORDEN FROM BANNERS WHERE ACTIVO = 1 ORDER BY ORDEN, ID_BANNER'
    );
    res.json(filas);
  } catch (err) {
    logger.error('Error al listar banners públicos:', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar los banners' });
  }
};

/** GET /api/banners/admin — administración: TODOS (activos e inactivos). */
const listarTodos = async (req, res) => {
  try {
    const [filas] = await db.query(
      'SELECT ID_BANNER, IMAGEN, TEXTO_ALT, ORDEN, ACTIVO, FECHA_CREACION FROM BANNERS ORDER BY ORDEN, ID_BANNER'
    );
    res.json(filas);
  } catch (err) {
    logger.error('Error al listar banners (admin):', err);
    res.status(500).json({ ok: false, msg: 'Error al cargar los banners' });
  }
};

/** POST /api/banners — crea un banner (solo admin). */
const crearBanner = async (req, res) => {
  const [error, datos] = validarBanner(req.body || {});
  if (error) return res.status(400).json({ ok: false, msg: error });
  const [errorDimensiones] = await comprobarDimensionesBanner(datos.imagen);
  if (errorDimensiones) return res.status(400).json({ ok: false, msg: errorDimensiones });
  try {
    const [resultado] = await db.query(
      'INSERT INTO BANNERS (IMAGEN, TEXTO_ALT, ORDEN, ACTIVO) VALUES (?, ?, ?, ?)',
      [datos.imagen, datos.textoAlt, datos.orden, datos.activo]
    );
    res.status(201).json({ ok: true, msg: 'Banner creado', idBanner: resultado.insertId });
  } catch (err) {
    logger.error('Error al crear banner:', err);
    res.status(500).json({ ok: false, msg: 'Error al crear el banner' });
  }
};

/** PUT /api/banners/:id — edita un banner existente (solo admin). */
const editarBanner = async (req, res) => {
  const idBanner = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(idBanner) || idBanner <= 0) {
    return res.status(400).json({ ok: false, msg: 'ID de banner inválido' });
  }
  const [error, datos] = validarBanner(req.body || {});
  if (error) return res.status(400).json({ ok: false, msg: error });
  const [errorDimensiones] = await comprobarDimensionesBanner(datos.imagen);
  if (errorDimensiones) return res.status(400).json({ ok: false, msg: errorDimensiones });
  try {
    const [resultado] = await db.query(
      'UPDATE BANNERS SET IMAGEN = ?, TEXTO_ALT = ?, ORDEN = ?, ACTIVO = ? WHERE ID_BANNER = ?',
      [datos.imagen, datos.textoAlt, datos.orden, datos.activo, idBanner]
    );
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: 'Banner no encontrado' });
    }
    res.json({ ok: true, msg: 'Banner actualizado' });
  } catch (err) {
    logger.error('Error al editar banner:', err);
    res.status(500).json({ ok: false, msg: 'Error al editar el banner' });
  }
};

/** DELETE /api/banners/:id — elimina un banner (solo admin). */
const eliminarBanner = async (req, res) => {
  const idBanner = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(idBanner) || idBanner <= 0) {
    return res.status(400).json({ ok: false, msg: 'ID de banner inválido' });
  }
  try {
    const [resultado] = await db.query('DELETE FROM BANNERS WHERE ID_BANNER = ?', [idBanner]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: 'Banner no encontrado' });
    }
    res.json({ ok: true, msg: 'Banner eliminado' });
  } catch (err) {
    logger.error('Error al eliminar banner:', err);
    res.status(500).json({ ok: false, msg: 'Error al eliminar el banner' });
  }
};

module.exports = { listarPublicos, listarTodos, crearBanner, editarBanner, eliminarBanner, _useDb, _useMedidas };
