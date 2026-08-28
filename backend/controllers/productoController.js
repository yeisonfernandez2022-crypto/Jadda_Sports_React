const db = require('../config/db');
const transporter = require('../config/mailer');
const { plantillaCorreo } = require('../utils/correo');
const { registrarMovimientoStock } = require('../utils/movimientosStock');

const { crearNotificacion } = require('./notificacionController');

/**
 * Busca productos con búsqueda por palabras clave (prefix matching con LIKE 'word%').
 * - Si hay varias palabras, se combinan con AND (todas deben coincidir).
 * - LEFT JOIN a PRODUCTO_VARIANTES para sumar el stock total con COALESCE(SUM(...), 0).
 * - LEFT JOIN a PRODUCTO_IMAGENES con ORDEN = 1 para obtener la imagen principal.
 * - Agrupa por todos los campos de PRODUCTOS para que SUM(PV.STOCK) sea correcto.
 * - Retorna ID_VARIANTE_POR_DEFECTO con MIN(PV.ID_VARIANTE) para el selector de variantes.
 */
const obtenerProductos = async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `
SELECT
    PRODUCTOS.ID,
    PRODUCTOS.NOMBRE,
    PRODUCTOS.PRECIO,
    PRODUCTOS.MARCA,
    PRODUCTOS.DESCRIPCION,
    PRODUCTOS.ID_DESCUENTO,
    PRODUCTOS.ID_VENDEDOR,
    COALESCE(VENDEDORES.NOMBRE_EMPRESA, 'JADDA SPORTS') AS VENDEDOR_NOMBRE,
    PI.URL_IMAGEN AS IMAGEN,
    CATEGORIAS.NOMBRE_CATEGORIA AS CATEGORIA,
    PRODUCTOS.ID_CATEGORIA,
    COALESCE(SUM(PV.STOCK), 0) AS STOCK,
    MIN(PV.ID_VARIANTE) AS ID_VARIANTE_POR_DEFECTO,
    (SELECT ROUND(AVG(RESENAS.CALIFICACION), 1) FROM RESENAS WHERE RESENAS.ID_PRODUCTO = PRODUCTOS.ID) AS RATING,
    (SELECT COUNT(*) FROM RESENAS WHERE RESENAS.ID_PRODUCTO = PRODUCTOS.ID) AS RESENA_COUNT
FROM PRODUCTOS
LEFT JOIN CATEGORIAS
    ON PRODUCTOS.ID_CATEGORIA = CATEGORIAS.ID_CATEGORIA
LEFT JOIN VENDEDORES
    ON PRODUCTOS.ID_VENDEDOR = VENDEDORES.ID_VENDEDOR
LEFT JOIN PRODUCTO_IMAGENES PI
    ON PRODUCTOS.ID = PI.ID_PRODUCTO
    AND PI.ORDEN = 1
LEFT JOIN PRODUCTO_VARIANTES PV
    ON PRODUCTOS.ID = PV.ID_PRODUCTO
`;
        let params = [];
        // Solo se muestran productos de JADDA (NULL) o aprobados de vendedores
        const visible = "(PRODUCTOS.ESTADO_PUBLICACION IS NULL OR PRODUCTOS.ESTADO_PUBLICACION = 'APROBADO')";
        if (search && search.trim() !== "" && search !== "undefined") {
            const words = search.trim().split(/\s+/).filter(w => w.length > 0);
            const conditions = words.map(() =>
                `(PRODUCTOS.NOMBRE LIKE ? OR PRODUCTOS.MARCA LIKE ? OR PRODUCTOS.DESCRIPCION LIKE ? OR CATEGORIAS.NOMBRE_CATEGORIA LIKE ?)`
            );
            sql += ` WHERE ${visible} AND (${conditions.join(' AND ')}) `;
            words.forEach(w => {
                const term = `${w}%`;
                params.push(term, term, term, term);
            });
        } else {
            sql += ` WHERE ${visible} `;
        }

        sql += `
GROUP BY
    PRODUCTOS.ID,
    PRODUCTOS.NOMBRE,
    PRODUCTOS.PRECIO,
    PRODUCTOS.MARCA,
    PRODUCTOS.DESCRIPCION,
    PRODUCTOS.ID_DESCUENTO,
    PRODUCTOS.ID_VENDEDOR,
    VENDEDORES.NOMBRE_EMPRESA,
    PRODUCTOS.ID_CATEGORIA,
    PI.URL_IMAGEN,
    CATEGORIAS.NOMBRE_CATEGORIA
ORDER BY
    (SELECT COUNT(*) FROM HISTORIAL h WHERE h.ID_PRODUCTO = PRODUCTOS.ID) DESC,
    PRODUCTOS.ID ASC
`;
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener productos" });
    }
};


/**
 * Crea un nuevo producto con datos opcionales asociados.
 * - Inserta en PRODUCTOS (nombre y precio obligatorios).
 * - Opcional: inserta imagen en PRODUCTO_IMAGENES.
 * - Opcional: inserta una variante inicial en PRODUCTO_VARIANTES (color/atributo/stock).
 * - Opcional: inserta múltiples características en PRODUCTO_CARACTERISTICAS.
 * - Maneja tanto camelCase como snake_case en CARACTERISTICAS para flexibilidad.
 */
const crearProducto = async (req, res) => {
    const {
        NOMBRE,
        MARCA,
        PRECIO,
        DESCRIPCION,
        ID_CATEGORIA,
        ID_PROVEEDOR,
        ID_DESCUENTO,
        URL_IMAGEN,
        IMAGENES,
        VARIANTES,
        CARACTERISTICAS
    } = req.body;

    if (!NOMBRE || !PRECIO) {
        return res.status(400).json({ error: "Nombre y precio son obligatorios" });
    }

    try {
        const sqlProducto = `
            INSERT INTO PRODUCTOS
            (NOMBRE, PRECIO, ID_CATEGORIA, DESCRIPCION, MARCA, ID_PROVEEDOR, ID_DESCUENTO)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const [resultProducto] = await db.query(sqlProducto, [
            NOMBRE,
            Number(PRECIO),
            Number(ID_CATEGORIA) || 1,
            DESCRIPCION || "",
            MARCA || "Genérico",
            Number(ID_PROVEEDOR) || null,
            ID_DESCUENTO ? Number(ID_DESCUENTO) : null
        ]);
        const idNuevoProducto = resultProducto.insertId;

        // Insertar imágenes (array con ORDEN secuencial, o URL_IMAGEN individual por compatibilidad)
        const listaImagenes = Array.isArray(IMAGENES) && IMAGENES.length > 0
            ? IMAGENES.filter(Boolean)
            : (URL_IMAGEN ? [URL_IMAGEN] : []);
        for (let i = 0; i < listaImagenes.length; i++) {
            await db.query('INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, ?)', [idNuevoProducto, listaImagenes[i], i + 1]);
        }

        // Insertar variantes
        if (VARIANTES && Array.isArray(VARIANTES)) {
            for (const v of VARIANTES) {
                if (v.COLOR || v.NOMBRE_ATRIBUTO || v.ATRIBUTO) {
                    await db.query(
                        'INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)',
                        [idNuevoProducto, v.COLOR || "Único", v.NOMBRE_ATRIBUTO || "Talla", v.ATRIBUTO || "Único", Number(v.STOCK) || 0]
                    );
                }
            }
        }

        // Insertar características
        if (CARACTERISTICAS && CARACTERISTICAS.length > 0) {
            const sqlCarac = `INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)`;
            for (const item of CARACTERISTICAS) {
                const nomAtrib = item.NOMBRE_ATRIBUTO || item.nombre_atributo;
                const valAtrib = item.VALOR_ATRIBUTO || item.valor_atributo;
                if (nomAtrib && valAtrib) {
                    await db.query(sqlCarac, [idNuevoProducto, nomAtrib, valAtrib]);
                }
            }
        }

        res.status(201).json({ message: "Producto creado con éxito!", id: idNuevoProducto });

    } catch (err) {
        console.error("Error al crear producto:", err);
        res.status(500).json({ error: "Error interno al guardar el producto" });
    }
};


/**
 * Obtiene un producto completo con sus relaciones.
 * - Busca el producto por ID; si no existe retorna 404.
 * - Adjunta array de imágenes (PRODUCTO_IMAGENES ordenadas por ORDEN).
 * - Adjunta array de características (PRODUCTO_CARACTERISTICAS).
 * - Adjunta array de variantes (PRODUCTO_VARIANTES con ID_VARIANTE, COLOR, ATRIBUTO, STOCK).
 * - Combina todo en un solo objeto JSON de respuesta.
 */
const obtenerProductoPorId = async (req, res) => {
    const { id } = req.params;

    try {

        const [producto] = await db.query(
            `SELECT p.*, COALESCE(v.NOMBRE_EMPRESA, 'JADDA SPORTS') AS VENDEDOR_NOMBRE
             FROM PRODUCTOS p
             LEFT JOIN VENDEDORES v ON p.ID_VENDEDOR = v.ID_VENDEDOR
             WHERE p.ID = ? AND (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')`,
            [id]
        );

        if (!producto || producto.length === 0) {
            return res.status(404).json({
                error: "No existe"
            });
        }

        const [imagenes] = await db.query(
            `
            SELECT URL_IMAGEN AS url, ORDEN
            FROM PRODUCTO_IMAGENES
            WHERE ID_PRODUCTO = ?
            ORDER BY ORDEN ASC
            `,
            [id]
        );

        const [caracteristicas] = await db.query(
            `
            SELECT NOMBRE_ATRIBUTO, VALOR_ATRIBUTO
            FROM PRODUCTO_CARACTERISTICAS
            WHERE ID_PRODUCTO = ?
            `,
            [id]
        );

        const [variantes] = await db.query(
            `
            SELECT
                ID_VARIANTE,
                COLOR,
                NOMBRE_ATRIBUTO,
                ATRIBUTO,
                STOCK
            FROM PRODUCTO_VARIANTES
            WHERE ID_PRODUCTO = ?
            `,
            [id]
        );

        const data = {
            ...producto[0],
            IMAGENES: imagenes || [],
            CARACTERISTICAS: caracteristicas || [],
            VARIANTES: variantes || []
        };

        res.json(data);

    } catch (err) {
        console.error("Error en obtenerProductoPorId:", err);

        res.status(500).json({
            error: "Error al obtener producto"
        });
    }
};

/**
 * Obtiene productos relacionados (misma categoría) con orden aleatorio.
 * - Intenta traer hasta 4 productos de la misma categoría (ORDER BY RAND(), LIMIT 8).
 * - Si hay menos de 4, completa con productos de otras categorías (excluyendo los ya obtenidos).
 * - Cada producto incluye imagen principal (LEFT JOIN con ORDEN = 1).
 * - Ideal para la sección "Productos Relacionados" en la página de detalle.
 */
const obtenerRelacionados = async (req, res) => {
    const { id } = req.params;
    try {
        const [producto] = await db.query('SELECT ID_CATEGORIA, MARCA FROM PRODUCTOS WHERE ID = ?', [id]);
        if (!producto || producto.length === 0) return res.json([]);
        const cat = producto[0].ID_CATEGORIA;
        const marca = producto[0].MARCA;

        const [mismaCategoria] = await db.query(
            `SELECT p.ID, p.NOMBRE, p.PRECIO, p.ID_DESCUENTO, pi.URL_IMAGEN
             FROM PRODUCTOS p
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             WHERE p.ID_CATEGORIA = ? AND p.ID <> ?
               AND (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
             ORDER BY RAND()
             LIMIT 8`,
            [cat, id]
        );

        if (mismaCategoria.length >= 4) {
            return res.json(mismaCategoria.slice(0, 4));
        }

        const faltan = 4 - mismaCategoria.length;
        const idsUsados = [id, ...mismaCategoria.map(p => p.ID)];
        const [otrasCategorias] = await db.query(
            `SELECT p.ID, p.NOMBRE, p.PRECIO, p.ID_DESCUENTO, pi.URL_IMAGEN
             FROM PRODUCTOS p
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             WHERE p.ID NOT IN (?)
               AND (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
             ORDER BY RAND()
             LIMIT ?`,
            [idsUsados, faltan]
        );

        res.json([...mismaCategoria, ...otrasCategorias]);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar relacionados" });
    }
};

/**
 * Obtiene todas las características de un producto por su ID.
 * - SELECT simple desde PRODUCTO_CARACTERISTICAS filtrado por ID_PRODUCTO.
 */
const obtenerCaracteristicas = async (req, res) => {
    const { id } = req.params;
    try {
        const [caracteristicas] = await db.query('SELECT * FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', [id]);
        res.json(caracteristicas);
    } catch (err) {
        res.status(500).json({ error: "Error en servidor" });
    }
};

/**
 * Agrega una nueva característica a un producto existente.
 * - Inserta en PRODUCTO_CARACTERISTICAS con el ID del producto y los valores del body.
 * - Retorna el ID de la nueva característica creada.
 */
const agregarCaracteristica = async (req, res) => {
    const { id } = req.params;
    const { NOMBRE_ATRIBUTO, VALOR_ATRIBUTO } = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)', 
            [id, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO]
        );
        res.status(201).json({ 
            ID_CARACTERISTICA: result.insertId, 
            ID_PRODUCTO: id,
            NOMBRE_ATRIBUTO, 
            VALOR_ATRIBUTO 
        });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar" });
    }
};

/**
 * Elimina una característica por su ID.
 * - DELETE directo desde PRODUCTO_CARACTERISTICAS usando ID_CARACTERISTICA.
 */
const eliminarCaracteristica = async (req, res) => {
    const { idCaracteristica } = req.params; 
    try {
        await db.query('DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_CARACTERISTICA = ?', [idCaracteristica]);
        res.json({ message: "Característica eliminada" });
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar" });
    }
};

/**
 * Elimina un producto por su ID.
 * - DELETE en cascada: las tablas relacionadas (PRODUCTO_IMAGENES, PRODUCTO_VARIANTES,
 *   PRODUCTO_CARACTERISTICAS, CARRITO, DETALLE_VENTAS, RESENAS) se limpian gracias
 *   a las restricciones ON DELETE CASCADE definidas en la base de datos.
 */
const eliminarProducto = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM PRODUCTOS WHERE ID = ?', [id]);
        res.json({ message: "Producto eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "No se pudo eliminar el producto" });
    }
};

/**
 * Actualiza un producto completo y reemplaza sus relaciones.
 * - Actualiza campos base en PRODUCTOS (nombre, marca, precio, etc.).
 * - Si se envía URL_IMAGEN: elimina todas las imágenes existentes e inserta la nueva.
 * - Si se envía VARIANTES (array): elimina todas las variantes y las reinserta.
 *   Si no se envía el array, actualiza la primera variante existente o crea una nueva.
 * - Si se envía CARACTERISTICAS: elimina todas y las reinserta.
 * - El reemplazo completo evita tener que hacer diff de cambios uno por uno.
 */
const actualizarProducto = async (req, res) => {
    const { id } = req.params;

    const {
        NOMBRE,
        MARCA,
        PRECIO,
        DESCRIPCION,
        ID_CATEGORIA,
        ID_PROVEEDOR,
        ID_DESCUENTO,
        URL_IMAGEN,
        IMAGENES,
        COLOR,
        TIPO_ATRIBUTO,
        ATRIBUTO,
        STOCK,
        CARACTERISTICAS,
        VARIANTES
    } = req.body;

    try {
        const [result] = await db.query(
            `
            UPDATE PRODUCTOS
            SET
                NOMBRE = ?,
                MARCA = ?,
                PRECIO = ?,
                DESCRIPCION = ?,
                ID_CATEGORIA = ?,
                ID_PROVEEDOR = ?,
                ID_DESCUENTO = ?
            WHERE ID = ?
            `,
            [
                NOMBRE,
                MARCA,
                PRECIO,
                DESCRIPCION,
                ID_CATEGORIA,
                ID_PROVEEDOR,
                ID_DESCUENTO || null,
                id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Producto no encontrado" });
        }

        // Actualizar imágenes (reemplazar todo el array si llega IMAGENES,
        // o URL_IMAGEN individual por compatibilidad)
        const listaImagenes = Array.isArray(IMAGENES) && IMAGENES.length > 0
            ? IMAGENES.filter(Boolean)
            : (URL_IMAGEN ? [URL_IMAGEN] : []);
        if (listaImagenes.length > 0) {
            await db.query('DELETE FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ?', [id]);
            for (let i = 0; i < listaImagenes.length; i++) {
                await db.query('INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, ?)', [id, listaImagenes[i], i + 1]);
            }
        }

        // Reemplazar variantes si se envía el array
        if (VARIANTES && Array.isArray(VARIANTES)) {
            // Captura las variantes agotadas con suscriptores antes de borrarlas
            // (para notificar reposición cuando el stock vuelva a ser > 0)
            const [viejas] = await db.query(
                'SELECT ID_VARIANTE, STOCK FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?',
                [id]
            );
            const viejasAgotadas = viejas.filter(v => Number(v.STOCK) <= 0);
            const viejasConAvisos = new Set(viejasAgotadas.map(v => v.ID_VARIANTE));
            let totalAvisosViejas = 0;
            if (viejasConAvisos.size > 0) {
                const [rowsAvisos] = await db.query(
                    'SELECT COUNT(*) AS total FROM AVISOS_STOCK WHERE ENVIADO = 0 AND ID_VARIANTE IN (?)',
                    [[...viejasConAvisos]]
                );
                totalAvisosViejas = rowsAvisos[0].total;
            }

            await db.query('DELETE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?', [id]);
            const nuevasIds = [];
            for (const v of VARIANTES) {
                if (v.COLOR || v.NOMBRE_ATRIBUTO || v.ATRIBUTO) {
                    const [resNueva] = await db.query(
                        `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)`,
                        [id, v.COLOR || "Único", v.NOMBRE_ATRIBUTO || "Talla", v.ATRIBUTO || "Único", Number(v.STOCK) || 0]
                    );
                    nuevasIds.push({ id: resNueva.insertId, stock: Number(v.STOCK) || 0 });
                }
            }
            // Notifica reposición por posición (el panel admin mantiene el orden
            // de las variantes al editar un producto completo)
            if (totalAvisosViejas > 0) {
                for (let i = 0; i < Math.min(nuevasIds.length, viejas.length); i++) {
                    if (viejasConAvisos.has(viejas[i].ID_VARIANTE) && nuevasIds[i].stock > 0) {
                        notificarReposicion(nuevasIds[i].id);
                    }
                }
            }
        } else {
            // Fallback: variante individual (compatibilidad con crear producto)
            const [variantesExistentes] = await db.query('SELECT ID_VARIANTE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ? LIMIT 1', [id]);
            if (variantesExistentes.length > 0) {
                await db.query(
                    `UPDATE PRODUCTO_VARIANTES SET COLOR=?, NOMBRE_ATRIBUTO=?, ATRIBUTO=?, STOCK=? WHERE ID_VARIANTE=?`,
                    [COLOR || "Único", TIPO_ATRIBUTO || "Talla", ATRIBUTO || "Único", Number(STOCK) || 0, variantesExistentes[0].ID_VARIANTE]
                );
            } else if (COLOR || TIPO_ATRIBUTO) {
                await db.query(
                    `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)`,
                    [id, COLOR || "Único", TIPO_ATRIBUTO || "Talla", ATRIBUTO || "Único", Number(STOCK) || 0]
                );
            }
        }

        // Reemplazar características
        if (CARACTERISTICAS) {
            await db.query('DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', [id]);
            for (const item of CARACTERISTICAS) {
                const nomAtrib = item.NOMBRE_ATRIBUTO || item.nombre_atributo || item.propiedad;
                const valAtrib = item.VALOR_ATRIBUTO || item.valor_atributo || item.valor;
                if (nomAtrib && valAtrib) {
                    await db.query(
                        'INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)',
                        [id, nomAtrib, valAtrib]
                    );
                }
            }
        }

        res.json({ message: "Producto actualizado con éxito" });

    } catch (err) {
        console.error("Error actualizando producto:", err);
        res.status(500).json({ error: "Error al actualizar en la base de datos" });
    }
};

/**
 * Obtiene todas las reseñas de un producto con datos del usuario.
 * - JOIN con USUARIOS para incluir NOMBRE_USUARIO y FOTO_URL.
 * - Ordenadas por FECHA descendente (más recientes primero).
 */
const obtenerResenasPorProducto = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `SELECT r.*, u.NOMBRE_USUARIO, u.FOTO_URL
                       FROM RESENAS r
                       JOIN USUARIOS u ON r.ID_USUARIO = u.ID_USUARIO
                       WHERE r.ID_PRODUCTO = ?
                       ORDER BY r.FECHA DESC`;
        const [resenas] = await db.execute(query, [id]);
        res.json(resenas || []);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar las reseñas" });
    }
};

/**
 * Agrega una reseña de un usuario autenticado a un producto.
 * - Requiere que el usuario esté autenticado (req.user.ID_USUARIO).
 * - Inserta calificación y comentario en RESENAS vinculado al producto y usuario.
 */
const agregarResena = async (req, res) => {
    const { id } = req.params;
    const { comentario, calificacion } = req.body;
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });
    try {
        await db.query(
            'INSERT INTO RESENAS (ID_PRODUCTO, ID_USUARIO, CALIFICACION, COMENTARIO) VALUES (?, ?, ?, ?)',
            [id, idUsuario, calificacion, comentario]
        );
        res.status(201).json({ message: "Reseña agregada con éxito" });
    } catch (err) {
        console.error("Error al guardar reseña:", err);
        res.status(500).json({ error: "Error al guardar reseña" });
    }
};


/**
 * Obtiene todas las variantes de un producto.
 * - SELECT completo desde PRODUCTO_VARIANTES filtrado por ID_PRODUCTO.
 */
const obtenerVariantes = async (req,res)=>{
    const {id}=req.params;

    const [variantes] = await db.query(
        `
        SELECT *
        FROM PRODUCTO_VARIANTES
        WHERE ID_PRODUCTO = ?
        `,
        [id]
    );

    res.json(variantes);
}


/**
 * Agrega una nueva variante (talla/color) a un producto.
 * - Inserta en PRODUCTO_VARIANTES con color, nombre_atributo, atributo y stock.
 * - Retorna el ID_VARIANTE de la nueva variante creada.
 */
const agregarVariante = async (req,res)=>{

    const {id}=req.params;

    const {
        COLOR,
        NOMBRE_ATRIBUTO,
        ATRIBUTO,
        STOCK
    } = req.body;

    const [result] = await db.query(
        `
        INSERT INTO PRODUCTO_VARIANTES
        (
            ID_PRODUCTO,
            COLOR,
            NOMBRE_ATRIBUTO,
            ATRIBUTO,
            STOCK
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
            id,
            COLOR,
            NOMBRE_ATRIBUTO,
            ATRIBUTO,
            STOCK
        ]
    );

    // Si la variante nace con stock, avisa a quienes estaban esperándola
    if (Number(STOCK) > 0) {
        notificarReposicion(result.insertId);
        registrarMovimientoStock({
            idProducto: id,
            tipo: 'ENTRADA',
            cantidad: Number(STOCK),
        });
    }

    res.status(201).json({
        ID_VARIANTE: result.insertId
    });
}

/**
 * Actualiza los datos de una variante existente.
 * - Recibe color, nombre_atributo, atributo y stock desde el cuerpo.
 * - Actualiza por ID_VARIANTE.
 * - Si el stock pasa de 0 a > 0, notifica a los suscriptores de AVISOS_STOCK.
 */
const actualizarVariante = async (req,res)=>{

    const {idVariante}=req.params;

    const {
        COLOR,
        NOMBRE_ATRIBUTO,
        ATRIBUTO,
        STOCK
    } = req.body;

    try {
        const [viejas] = await db.query(
            'SELECT STOCK, ID_PRODUCTO FROM PRODUCTO_VARIANTES WHERE ID_VARIANTE = ?',
            [idVariante]
        );
        const stockAnterior = viejas.length > 0 ? Number(viejas[0].STOCK) : 0;
        const idProducto = viejas.length > 0 ? viejas[0].ID_PRODUCTO : null;

        await db.query(
            `
            UPDATE PRODUCTO_VARIANTES
            SET
            COLOR=?,
            NOMBRE_ATRIBUTO=?,
            ATRIBUTO=?,
            STOCK=?
            WHERE ID_VARIANTE=?
            `,
            [
                COLOR,
                NOMBRE_ATRIBUTO,
                ATRIBUTO,
                STOCK,
                idVariante
            ]
        );

        const stockNuevo = Number(STOCK) || 0;
        if (stockAnterior <= 0 && stockNuevo > 0) {
            notificarReposicion(idVariante);
        }

        // Registro detallado del cambio de inventario (RF-029)
        if (idProducto && stockNuevo !== stockAnterior) {
            registrarMovimientoStock({
                idProducto,
                tipo: stockNuevo > stockAnterior ? 'ENTRADA' : 'SALIDA',
                cantidad: Math.abs(stockNuevo - stockAnterior),
            });
        }

        res.json({
            message:"Variante actualizada"
        });
    } catch (err) {
        console.error("Error al actualizar variante:", err);
        res.status(500).json({ error: "Error al actualizar la variante" });
    }
}

/**
 * Elimina una variante específica por su ID.
 * - DELETE directo desde PRODUCTO_VARIANTES usando ID_VARIANTE.
 */
const eliminarVariante = async (req,res)=>{

    const {idVariante}=req.params;

    await db.query(
        `
        DELETE FROM PRODUCTO_VARIANTES
        WHERE ID_VARIANTE=?
        `,
        [idVariante]
    );

    res.json({
        message:"Variante eliminada"
    });
}


/**
 * Obtiene una característica específica por su ID.
 * - Retorna 404 si no se encuentra el registro.
 */
const obtenerCaracteristicaPorId = async (req, res) => {
    const { idCaracteristica } = req.params;

    try {
        const [rows] = await db.query(
            `
            SELECT *
            FROM PRODUCTO_CARACTERISTICAS
            WHERE ID_CARACTERISTICA = ?
            `,
            [idCaracteristica]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                error: "Característica no encontrada"
            });
        }

        res.json(rows[0]);

    } catch (err) {
        res.status(500).json({
            error: "Error en servidor"
        });
    }
};

/**
 * Actualiza los valores de una característica existente.
 * - Recibe NOMBRE_ATRIBUTO y VALOR_ATRIBUTO desde el body.
 * - Actualiza por ID_CARACTERISTICA.
 */
const actualizarCaracteristica = async (req, res) => {

    const { idCaracteristica } = req.params;
    const {
        NOMBRE_ATRIBUTO,
        VALOR_ATRIBUTO
    } = req.body;

    try {

        await db.query(
            `
            UPDATE PRODUCTO_CARACTERISTICAS
            SET
                NOMBRE_ATRIBUTO = ?,
                VALOR_ATRIBUTO = ?
            WHERE ID_CARACTERISTICA = ?
            `,
            [
                NOMBRE_ATRIBUTO,
                VALOR_ATRIBUTO,
                idCaracteristica
            ]
        );

        res.json({
            message: "Característica actualizada"
        });

    } catch (err) {

        res.status(500).json({
            error: "Error al actualizar"
        });

    }
};





/**
 * Obtiene todas las categorías activas ordenadas alfabéticamente.
 * - SELECT simple desde CATEGORIAS con ID_CATEGORIA y NOMBRE_CATEGORIA.
 */
const obtenerCategorias = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.ID_CATEGORIA, c.NOMBRE_CATEGORIA, c.DESCRIPCION,
              (SELECT COUNT(*) FROM PRODUCTOS p WHERE p.ID_CATEGORIA = c.ID_CATEGORIA) AS TOTAL_PRODUCTOS
       FROM CATEGORIAS c ORDER BY c.NOMBRE_CATEGORIA`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
};

/**
 * (Admin) Crea una categoría nueva (RF-027).
 * - Nombre único entre 3 y 100 caracteres; descripción opcional (máx 100).
 */
const crearCategoria = async (req, res) => {
  const { name, description } = req.body || {};
  if (!name || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 100) {
    return res.status(400).json({ ok: false, msg: "El nombre debe tener entre 3 y 100 caracteres" });
  }
  const nombre = name.trim();
  const descripcionTexto = description == null ? null : String(description).trim();
  if (descripcionTexto && descripcionTexto.length > 100) {
    return res.status(400).json({ ok: false, msg: "La descripción no puede superar 100 caracteres" });
  }
  try {
    const [existe] = await db.query('SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA = ?', [nombre]);
    if (existe.length > 0) return res.status(400).json({ ok: false, msg: "Ya existe una categoría con ese nombre" });
    const [result] = await db.query(
      'INSERT INTO CATEGORIAS (NOMBRE_CATEGORIA, DESCRIPCION) VALUES (?, ?)',
      [nombre, descripcionTexto]
    );
    res.status(201).json({ ok: true, msg: "Categoría creada", ID_CATEGORIA: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, msg: "Ya existe una categoría con ese nombre" });
    }
    console.error("Error al crear categoría:", err);
    res.status(500).json({ ok: false, msg: "Error al crear categoría" });
  }
};

/**
 * (Admin) Actualiza nombre/descripción de una categoría (RF-027).
 */
const actualizarCategoria = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body || {};
  if (!name || typeof name !== "string" || name.trim().length < 3 || name.trim().length > 100) {
    return res.status(400).json({ ok: false, msg: "El nombre debe tener entre 3 y 100 caracteres" });
  }
  const nombre = name.trim();
  const descripcionTexto = description == null ? null : String(description).trim();
  if (descripcionTexto && descripcionTexto.length > 100) {
    return res.status(400).json({ ok: false, msg: "La descripción no puede superar 100 caracteres" });
  }
  try {
    const [existe] = await db.query(
      'SELECT ID_CATEGORIA FROM CATEGORIAS WHERE NOMBRE_CATEGORIA = ? AND ID_CATEGORIA <> ?',
      [nombre, id]
    );
    if (existe.length > 0) return res.status(400).json({ ok: false, msg: "Ya existe otra categoría con ese nombre" });
    const [existeId] = await db.query('SELECT ID_CATEGORIA FROM CATEGORIAS WHERE ID_CATEGORIA = ?', [id]);
    if (existeId.length === 0) return res.status(404).json({ ok: false, msg: "Categoría no encontrada" });
    await db.query(
      'UPDATE CATEGORIAS SET NOMBRE_CATEGORIA = ?, DESCRIPCION = ? WHERE ID_CATEGORIA = ?',
      [nombre, descripcionTexto, id]
    );
    res.json({ ok: true, msg: "Categoría actualizada" });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ ok: false, msg: "Ya existe otra categoría con ese nombre" });
    }
    console.error("Error al actualizar categoría:", err);
    res.status(500).json({ ok: false, msg: "Error al actualizar categoría" });
  }
};

/**
 * (Admin) Elimina una categoría (RF-027). Bloqueada si tiene productos asociados.
 */
const eliminarCategoria = async (req, res) => {
  const { id } = req.params;
  try {
    const [productos] = await db.query('SELECT COUNT(*) AS total FROM PRODUCTOS WHERE ID_CATEGORIA = ?', [id]);
    if (productos[0].total > 0) {
      return res.status(400).json({
        ok: false,
        msg: `No se puede eliminar: hay ${productos[0].total} producto(s) en esta categoría`,
      });
    }
    const [result] = await db.query('DELETE FROM CATEGORIAS WHERE ID_CATEGORIA = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ ok: false, msg: "Categoría no encontrada" });
    res.json({ ok: true, msg: "Categoría eliminada" });
  } catch (err) {
    console.error("Error al eliminar categoría:", err);
    res.status(500).json({ ok: false, msg: "Error al eliminar categoría" });
  }
};

/**
 * (Usuario autenticado) Recomendaciones personalizadas (RF-038):
 * productos de las mismas categorías que el usuario ha comprado (ventas no
 * CANCELADAS), excluyendo los que ya compró, ordenados por frecuencia de compra
 * de su categoría. Si no hay datos (fallback), trae los más vendidos de la tienda.
 */
const obtenerRecomendados = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;
  if (!idUsuario) return res.status(401).json({ error: "No autenticado" });

  const BASE = `
SELECT
    p.ID, p.NOMBRE, p.PRECIO, p.MARCA, p.DESCRIPCION, p.ID_DESCUENTO,
    pi.URL_IMAGEN AS IMAGEN,
    c.NOMBRE_CATEGORIA AS CATEGORIA,
    COALESCE(SUM(pv.STOCK), 0) AS STOCK,
    MIN(pv.ID_VARIANTE) AS ID_VARIANTE_POR_DEFECTO,
    (SELECT ROUND(AVG(r.CALIFICACION), 1) FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID) AS RATING,
    (SELECT COUNT(*) FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID) AS RESENA_COUNT
FROM PRODUCTOS p
LEFT JOIN CATEGORIAS c ON p.ID_CATEGORIA = c.ID_CATEGORIA
LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
LEFT JOIN PRODUCTO_VARIANTES pv ON p.ID = pv.ID_PRODUCTO
`;

  try {
    let sql = `${BASE}
WHERE (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
AND p.ID_CATEGORIA IN (
    SELECT p2.ID_CATEGORIA FROM DETALLE_VENTAS dv
    JOIN VENTAS v ON dv.ID_VENTA = v.ID_VENTA AND v.ID_CLIENTE = ? AND v.ESTADO <> 'CANCELADA'
    JOIN PRODUCTOS p2 ON dv.ID_PRODUCTO = p2.ID
    WHERE p2.ID_CATEGORIA IS NOT NULL
)
AND p.ID NOT IN (
    SELECT dv2.ID_PRODUCTO FROM DETALLE_VENTAS dv2
    JOIN VENTAS v2 ON dv2.ID_VENTA = v2.ID_VENTA
    WHERE v2.ID_CLIENTE = ? AND v2.ESTADO <> 'CANCELADA'
)
GROUP BY p.ID, p.NOMBRE, p.PRECIO, p.MARCA, p.DESCRIPCION, p.ID_DESCUENTO,
         pi.URL_IMAGEN, c.NOMBRE_CATEGORIA
HAVING SUM(pv.STOCK) > 0
ORDER BY (
    SELECT COUNT(DISTINCT dv3.ID_VENTA) FROM DETALLE_VENTAS dv3
    JOIN VENTAS v3 ON dv3.ID_VENTA = v3.ID_VENTA AND v3.ID_CLIENTE = ? AND v3.ESTADO <> 'CANCELADA'
    JOIN PRODUCTOS p3 ON dv3.ID_PRODUCTO = p3.ID
    WHERE p3.ID_CATEGORIA = p.ID_CATEGORIA
) DESC, p.PRECIO DESC
LIMIT 8`;

    let [rows] = await db.query(sql, [idUsuario, idUsuario, idUsuario]);

    let origen = "categorias";
    if (rows.length === 0) {
      rows = (await db.query(
        `${BASE}
JOIN (SELECT ID_PRODUCTO, COUNT(*) AS cnt FROM DETALLE_VENTAS GROUP BY ID_PRODUCTO) pop ON pop.ID_PRODUCTO = p.ID
WHERE (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
AND p.ID NOT IN (
    SELECT dv2.ID_PRODUCTO FROM DETALLE_VENTAS dv2
    JOIN VENTAS v2 ON dv2.ID_VENTA = v2.ID_VENTA
    WHERE v2.ID_CLIENTE = ? AND v2.ESTADO <> 'CANCELADA'
)
GROUP BY p.ID, p.NOMBRE, p.PRECIO, p.MARCA, p.DESCRIPCION, p.ID_DESCUENTO,
         pi.URL_IMAGEN, c.NOMBRE_CATEGORIA
HAVING SUM(pv.STOCK) > 0
ORDER BY pop.cnt DESC, p.PRECIO DESC
LIMIT 8`,
        [idUsuario]
      ))[0];
      origen = "populares";
    }

    res.json({ origen, productos: rows });
  } catch (err) {
    console.error("Error al obtener recomendados:", err);
    res.status(500).json({ error: "Error al obtener recomendaciones" });
  }
};

/**
 * Obtiene la lista de vendedores para el filtro del catálogo (público).
 * - Siempre incluye JADDA SPORTS como primera opción (ID_VENDEDOR null).
 * - Devuelve VENDEDORES aprobados (ID_VENDEDOR, NOMBRE_EMPRESA).
 */
const obtenerVendedores = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ID_VENDEDOR, NOMBRE_EMPRESA FROM VENDEDORES ORDER BY NOMBRE_EMPRESA`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener vendedores" });
  }
};

/**
 * Obtiene los descuentos vigentes (con FECHA_FIN >= hoy).
 * - Filtra descuentos cuya fecha de fin no haya expirado.
 * - Ordenados alfabéticamente por descripción.
 * - Retorna ID_DESCUENTO, DESCRIPCION y PORCENTAJE.
 */
const obtenerDescuentos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE FROM DESCUENTOS WHERE FECHA_FIN >= CURDATE() ORDER BY DESCRIPCION');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener descuentos" });
  }
};

/**
 * Crea un descuento nuevo (admin): DESCRIPCION + PORCENTAJE + FECHA_FIN opcional
 * + MONTO_MINIMO opcional (compra mínima para que aplique).
 * FECHA_INICIO = hoy; FECHA_FIN solo se guarda si es >= hoy.
 */
const crearDescuento = async (req, res) => {
  try {
    const { DESCRIPCION, PORCENTAJE, FECHA_FIN, MONTO_MINIMO } = req.body || {};
    const nombre = String(DESCRIPCION || "").trim();
    const pct = Number(PORCENTAJE);

    if (!nombre || nombre.length < 3 || nombre.length > 100) {
      return res.status(400).json({ error: "El nombre del descuento debe tener entre 3 y 100 caracteres" });
    }
    if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
      return res.status(400).json({ error: "El porcentaje debe estar entre 1 y 100" });
    }
    let fechaFin = null;
    if (FECHA_FIN) {
      const fecha = String(FECHA_FIN).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return res.status(400).json({ error: "La fecha de expiración debe tener formato AAAA-MM-DD" });
      }
      if (fecha < new Date().toISOString().slice(0, 10)) {
        return res.status(400).json({ error: "La fecha de expiración no puede ser anterior a hoy" });
      }
      fechaFin = fecha;
    }
    let montoMinimo = null;
    if (MONTO_MINIMO !== undefined && MONTO_MINIMO !== null && MONTO_MINIMO !== "") {
      const mm = Number(MONTO_MINIMO);
      if (!Number.isFinite(mm) || mm < 0) {
        return res.status(400).json({ error: "El monto mínimo debe ser un número mayor o igual a 0" });
      }
      montoMinimo = Math.round(mm);
    }

    const [result] = await db.query(
      'INSERT INTO DESCUENTOS (DESCRIPCION, PORCENTAJE, FECHA_INICIO, FECHA_FIN, USADO, MONTO_MINIMO) VALUES (?, ?, CURDATE(), ?, 0, ?)',
      [nombre, pct, fechaFin, montoMinimo]
    );
    res.status(201).json({ ID_DESCUENTO: result.insertId, DESCRIPCION: nombre, PORCENTAJE: pct, MONTO_MINIMO: montoMinimo });
  } catch (err) {
    console.error("Error al crear descuento:", err);
    res.status(500).json({ error: "Error al crear el descuento" });
  }
};

/**
 * Notifica por email + campana in-app a todos los suscriptores de una variante
 * que vuelve a tener stock (RF-035). Nunca bloquea la operación del admin:
 * si algo falla, solo se registra en consola.
 */
async function notificarReposicion(idVariante) {
    try {
        const [avisos] = await db.query(
            `SELECT a.ID_AVISO, a.ID_USUARIO, u.EMAIL, u.NOMBRE_USUARIO,
                    p.ID AS ID_PRODUCTO, p.NOMBRE, pi.URL_IMAGEN
             FROM AVISOS_STOCK a
             JOIN USUARIOS u ON a.ID_USUARIO = u.ID_USUARIO
             JOIN PRODUCTO_VARIANTES pv ON a.ID_VARIANTE = pv.ID_VARIANTE
             JOIN PRODUCTOS p ON pv.ID_PRODUCTO = p.ID
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             WHERE a.ID_VARIANTE = ? AND a.ENVIADO = 0`,
            [idVariante]
        );
        if (!avisos.length) return;

        const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
        const enlace = `${frontend}/producto/${avisos[0].ID_PRODUCTO}`;

        for (const aviso of avisos) {
            if (aviso.EMAIL) {
                try {
                    await transporter.sendMail({
                        from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
                        to: aviso.EMAIL,
                        subject: `🔔 ¡${aviso.NOMBRE} volvió a estar disponible! - JADDA SPORTS`,
                        html: plantillaCorreo({
                            emoji: "🔔",
                            titulo: "¡Buenas noticias! 🎉",
                            subtitulo: "Aviso de disponibilidad",
                            saludo: `Hola ${aviso.NOMBRE_USUARIO || "deportista"},`,
                            contenido: `
                              <p style="margin:0 0 6px">El producto que estabas esperando ya volvió a estar disponible:</p>
                              <p style="display:inline-block;margin:6px 0 0;padding:8px 18px;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:10px;font-weight:800;font-size:15px">🛍️ ${aviso.NOMBRE}</p>
                              <p style="font-size:13px;color:#475569;margin:10px 0 0">Aprovecha antes de que se vuelva a agotar. Todavía estás a tiempo de asegurar el tuyo.</p>
                            `,
                            botonTexto: "Ver producto",
                            botonEnlace: enlace,
                            notas: ["📍 Recibirás una notificación también aquí en tu cuenta cuando lo visites."],
                        }),
                    });
                } catch (err) {
                    console.error("Error al enviar aviso de stock por email:", err);
                }
            }

            await crearNotificacion({
                idUsuario: aviso.ID_USUARIO,
                tipo: 'stock',
                titulo: '¡Volvimos a tenerlo!',
                mensaje: `${aviso.NOMBRE} ya está disponible de nuevo.`,
                ruta: `/producto/${aviso.ID_PRODUCTO}`,
            });
        }

        await db.query(
            'UPDATE AVISOS_STOCK SET ENVIADO = 1 WHERE ID_AVISO IN (?)',
            [avisos.map(a => a.ID_AVISO)]
        );
    } catch (err) {
        console.error("Error en notificarReposicion:", err);
    }
}

/**
 * (Usuario autenticado) Se suscribe a alertas de reposición de una variante.
 * INSERT IGNORE evita duplicados por usuario + variante.
 */
const suscribirAvisoStock = async (req, res) => {
    const { idVariante } = req.params;
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });
    try {
        await db.query(
            'INSERT IGNORE INTO AVISOS_STOCK (ID_VARIANTE, ID_USUARIO, ENVIADO) VALUES (?, ?, 0)',
            [idVariante, idUsuario]
        );
        res.json({ ok: true, message: "Te avisaremos cuando vuelva a estar disponible" });
    } catch (err) {
        console.error("Error al suscribir aviso de stock:", err);
        res.status(500).json({ error: "Error al suscribir el aviso" });
    }
};

/**
 * (Usuario autenticado) Consulta si ya está suscrito a la variante.
 */
const estadoSuscripcionAviso = async (req, res) => {
    const { idVariante } = req.params;
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });
    try {
        const [rows] = await db.query(
            'SELECT ID_AVISO FROM AVISOS_STOCK WHERE ID_VARIANTE = ? AND ID_USUARIO = ?',
            [idVariante, idUsuario]
        );
        res.json({ suscrito: rows.length > 0 });
    } catch (err) {
        res.status(500).json({ error: "Error al consultar la suscripción" });
    }
};

/**
 * (Usuario autenticado) Cancela su suscripción a la variante.
 */
const cancelarAvisoStock = async (req, res) => {
    const { idVariante } = req.params;
    const idUsuario = req.user?.ID_USUARIO;
    if (!idUsuario) return res.status(401).json({ error: "No autenticado" });
    try {
        await db.query(
            'DELETE FROM AVISOS_STOCK WHERE ID_VARIANTE = ? AND ID_USUARIO = ?',
            [idVariante, idUsuario]
        );
        res.json({ ok: true, message: "Ya no te avisaremos" });
    } catch (err) {
        res.status(500).json({ error: "Error al cancelar la suscripción" });
    }
};

module.exports = {
    obtenerProductos,
    obtenerCaracteristicaPorId,
    actualizarCaracteristica,
    crearProducto,
    obtenerProductoPorId,
    obtenerRelacionados,
    obtenerCaracteristicas,
    agregarCaracteristica,
    eliminarCaracteristica,
    eliminarProducto,
    actualizarProducto,
    obtenerResenasPorProducto,
    agregarResena,
    obtenerVariantes,
    agregarVariante,
    actualizarVariante,
    eliminarVariante,
    obtenerCategorias,
    crearCategoria,
    actualizarCategoria,
    eliminarCategoria,
    obtenerRecomendados,
    obtenerDescuentos,
    crearDescuento,
    obtenerVendedores,
    suscribirAvisoStock,
    estadoSuscripcionAviso,
    cancelarAvisoStock,
};