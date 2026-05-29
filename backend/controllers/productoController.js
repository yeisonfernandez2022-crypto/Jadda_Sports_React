const db = require('../config/db');

const obtenerProductos = async (req, res) => {
    const { search } = req.query;
    try {
        let sql = `SELECT PRODUCTOS.ID, PRODUCTOS.NOMBRE, PRODUCTOS.PRECIO, PI.URL_IMAGEN AS IMAGEN, PRODUCTOS.MARCA, PRODUCTOS.DESCRIPCION, CATEGORIAS.NOMBRE_CATEGORIA AS CATEGORIA
                   FROM PRODUCTOS
                   INNER JOIN CATEGORIAS ON PRODUCTOS.ID_CATEGORIA = CATEGORIAS.ID_CATEGORIA
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

const obtenerProductoPorId = async (req, res) => {
    const { id } = req.params;
    try {
        const [results] = await db.query('SELECT * FROM PRODUCTOS WHERE ID = ?', [id]);
        if (results.length === 0) return res.status(404).json({ error: "Producto no existe" });
        res.json(results[0]);
    } catch (err) {
        console.error("ERROR SQL:", err); // <-- ESTO es lo que debes ver en tu terminal
        res.status(500).json({ error: "Error en la consulta" });
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
        res.status(500).json({ error: "Error al obtener características" });
    }
};

const agregarCaracteristica = async (req, res) => {
    const { id } = req.params;
    const { NOMBRE_ATRIBUTO, VALOR_ATRIBUTO } = req.body;
    try {
        await db.query('INSERT INTO PRODUCTO_CARACTERISTICAS (ID_PRODUCTO, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO) VALUES (?, ?, ?)', [id, NOMBRE_ATRIBUTO, VALOR_ATRIBUTO]);
        res.status(201).json({ message: "Éxito" });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar" });
    }
};

const eliminarCaracteristica = async (req, res) => {
    const { idCaracteristica } = req.params; // Cambiamos de .id a .idCaracteristica
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
        console.error("Error al obtener reseñas:", err);
        res.status(500).json({ error: "Error al cargar las reseñas" });
    }
};

// --- FUNCIÓN FALTANTE ---
const agregarResena = async (req, res) => {
    const { id } = req.params; // ID_PRODUCTO
    const { NOMBRE, COMENTARIO, CALIFICACION } = req.body;
    try {
        await db.query(
            'INSERT INTO RESENAS (ID_PRODUCTO, NOMBRE, COMENTARIO, CALIFICACION) VALUES (?, ?, ?, ?)',
            [id, NOMBRE, COMENTARIO, CALIFICACION]
        );
        res.status(201).json({ message: "Reseña agregada con éxito" });
    } catch (err) {
        console.error("Error al agregar reseña:", err);
        res.status(500).json({ error: "Error al guardar reseña" });
    }
};
module.exports = {
    obtenerProductos,
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