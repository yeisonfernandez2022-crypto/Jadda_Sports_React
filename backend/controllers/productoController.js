const db = require('../config/db');

// 1. CORREGIDO: Ahora sí incluye el campo STOCK en el SELECT
const obtenerProductos = async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE, PRODUCTOS.PRECIO, PRODUCTOS.STOCK, PI.URL_IMAGEN AS IMAGEN, PRODUCTOS.MARCA, PRODUCTOS.DESCRIPCION, CATEGORIAS.NOMBRE_CATEGORIA AS CATEGORIA
                   FROM PRODUCTOS
                   LEFT JOIN CATEGORIAS ON PRODUCTOS.ID_CATEGORIA = CATEGORIAS.ID_CATEGORIA
                   LEFT JOIN PRODUCTO_IMAGENES PI ON PRODUCTOS.ID = PI.ID_PRODUCTO AND PI.ORDEN = 1`;
        let params = [];
        if (search && search.trim() !== "" && search !== "undefined") {
            const term = `%${search.trim()}%`;
            sql += ` WHERE PRODUCTOS.NOMBRE LIKE ? OR PRODUCTOS.MARCA LIKE ? OR PRODUCTOS.DESCRIPCION LIKE ? `;
            params = [term, term, term];
        }
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener productos" });
    }
};

// 2. NUEVA FUNCIÓN: crearProducto adaptada a tu base de datos real
const crearProducto = async (req, res) => {
    const nombre = req.body.NOMBRE || req.body.nombre;
    const precio = req.body.PRECIO || req.body.precio;
    const categoriaTexto = req.body.CATEGORIA || req.body.categoria; // Llega "Running", "Fútbol", etc.
    const stock = req.body.STOCK || req.body.stock;
    const descripcion = req.body.DESCRIPCION || req.body.descripcion;
    const url_imagen = req.body.URL_IMAGEN || req.body.url_imagen;
    const caracteristicas = req.body.CARACTERISTICAS || req.body.caracteristicas;
    const idProveedor = req.body.ID_PROVEEDOR || req.body.id_proveedor;

    if (!nombre || !precio || stock === undefined) {
        return res.status(400).json({ error: "Nombre, precio y stock son campos obligatorios" });
    }

    try {
        // A. Convertir el texto de la categoría al ID correspondiente de tu tabla CATEGORIAS
        let idCategoria = 1; // Por defecto Running
        if (categoriaTexto === "Fútbol") idCategoria = 2;
        if (categoriaTexto === "Gimnasio") idCategoria = 3;
        // Nota: Ajusta estos IDs si en tu tabla CATEGORIAS tienen números diferentes

        // B. Insertar producto base en la tabla PRODUCTOS
        const sqlProducto = `INSERT INTO PRODUCTOS (NOMBRE, PRECIO, ID_CATEGORIA, STOCK, DESCRIPCION, MARCA, ID_PROVEEDOR) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [resultProducto] = await db.query(sqlProducto, [
        nombre, precio, idCategoria, stock, descripcion, "JADDA", idProveedor
    ]);
        const idNuevoProducto = resultProducto.insertId;

        // C. Insertar la imagen en la tabla PRODUCTO_IMAGENES
        if (url_imagen) {
            const sqlImagen = `INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, 1)`;
            await db.query(sqlImagen, [idNuevoProducto, url_imagen]);
        }

        // D. Insertar las especificaciones en la tabla PRODUCTO_CARACTERISTICAS
        if (caracteristicas && caracteristicas.length > 0) {
            const sqlCarac = `INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)`;
            for (const item of caracteristicas) {
                // Soportamos que las propiedades vengan en mayúsculas o minúsculas del front
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

const obtenerProductoPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const [producto] = await db.query('SELECT * FROM PRODUCTOS WHERE ID = ?', [id]);
        if (!producto || producto.length === 0) return res.status(404).json({ error: "No existe" });

        const [imagenes] = await db.query(
            'SELECT URL_IMAGEN AS url, ORDEN FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ? ORDER BY ORDEN ASC', 
            [id]
        );

        const [caracteristicas] = await db.query(
            'SELECT NOMBRE_ATRIBUTO, VALOR_ATRIBUTO FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', 
            [id]
        );
        
        const data = { 
            ...producto[0], 
            IMAGENES: imagenes || [],
            CARACTERISTICAS: caracteristicas || [] 
        };
        
        res.json(data);
    } catch (err) {
        console.error("Error en obtenerProductoPorId:", err);
        res.status(500).json({ error: "Error al obtener producto" });
    }
};

const obtenerRelacionados = async (req, res) => {
    const { id } = req.params;
    try {
        const [producto] = await db.query('SELECT ID_CATEGORIA FROM PRODUCTOS WHERE ID = ?', [id]);
        if (!producto || producto.length === 0) return res.json([]);
        const [relacionados] = await db.query('SELECT p.ID, p.NOMBRE, p.PRECIO, pi.URL_IMAGEN FROM PRODUCTOS p LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO WHERE p.ID_CATEGORIA = ? AND p.ID <> ? LIMIT 4', [producto[0].ID_CATEGORIA, id]);
        res.json(relacionados);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar relacionados" });
    }
};

const obtenerCaracteristicas = async (req, res) => {
    const { id } = req.params;
    try {
        const [caracteristicas] = await db.query('SELECT * FROM PRODUCTO_CARACTERISTICAS WHERE ID_PRODUCTO = ?', [id]);
        res.json(caracteristicas);
    } catch (err) {
        res.status(500).json({ error: "Error en servidor" });
    }
};

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

const eliminarCaracteristica = async (req, res) => {
    const { idCaracteristica } = req.params; 
    try {
        await db.query('DELETE FROM PRODUCTO_CARACTERISTICAS WHERE ID_CARACTERISTICA = ?', [idCaracteristica]);
        res.json({ message: "Característica eliminada" });
    } catch (err) {
        res.status(500).json({ error: "Error al eliminar" });
    }
};

const eliminarProducto = async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM PRODUCTOS WHERE ID = ?', [id]);
        res.json({ message: "Producto eliminado correctamente" });
    } catch (err) {
        res.status(500).json({ error: "No se pudo eliminar el producto" });
    }
};

const actualizarProducto = async (req, res) => {
    const { id } = req.params;
    const { NOMBRE, PRECIO, DESCRIPCION } = req.body;
    try {
        const [result] = await db.query(
            'UPDATE PRODUCTOS SET NOMBRE = ?, PRECIO = ?, DESCRIPCION = ? WHERE ID = ?',
            [NOMBRE, PRECIO, DESCRIPCION, id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ error: "Producto no encontrado" });
        res.json({ message: "Producto actualizado con éxito" });
    } catch (err) {
        res.status(500).json({ error: "Error al actualizar en la base de datos" });
    }
};

const obtenerResenasPorProducto = async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'SELECT * FROM RESENAS WHERE ID_PRODUCTO = ?';
        const [resenas] = await db.execute(query, [id]);
        res.json(resenas || []); 
    } catch (err) {
        res.status(500).json({ error: "Error al cargar las reseñas" });
    }
};

const agregarResena = async (req, res) => {
    const { id } = req.params; 
    const { NOMBRE, COMENTARIO, CALIFICACION } = req.body;
    try {
        await db.query(
            'INSERT INTO RESENAS (ID_PRODUCTO, NOMBRE, COMENTARIO, CALIFICACION) VALUES (?, ?, ?, ?)',
            [id, NOMBRE, COMENTARIO, CALIFICACION]
        );
        res.status(201).json({ message: "Reseña agregada con éxito" });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar reseña" });
    }
};

module.exports = {
    obtenerProductos,
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
};