const db = require('../config/db');

// 1. Agregar al carrito
const agregarAlCarrito = async (req, res) => {
    const { id_producto, cantidad } = req.body;
    const id_usuario = req.user.ID_USUARIO;

    if (!id_producto) {
        return res.status(400).json({ ok: false, msg: 'El ID del producto es obligatorio' });
    }

    try {
        const [existe] = await db.query(
            'SELECT * FROM CARRITO WHERE ID_USUARIO = ? AND ID_PRODUCTO = ?',
            [id_usuario, id_producto]
        );

        if (existe.length > 0) {
            const nuevaCantidad = existe[0].CANTIDAD + (cantidad || 1);
            await db.query(
                'UPDATE CARRITO SET CANTIDAD = ? WHERE ID_USUARIO = ? AND ID_PRODUCTO = ?',
                [nuevaCantidad, id_usuario, id_producto]
            );
            return res.json({ ok: true, msg: 'Cantidad actualizada en el carrito' });
        } else {
            await db.query(
                'INSERT INTO CARRITO (ID_USUARIO, ID_PRODUCTO, CANTIDAD) VALUES (?, ?, ?)',
                [id_usuario, id_producto, cantidad || 1]
            );
            return res.status(201).json({ ok: true, msg: 'Producto agregado al carrito' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error del servidor al agregar al carrito' });
    }
};

// 2. Obtener carrito
const obtenerCarrito = async (req, res) => {
  const idUsuario = req.user?.ID_USUARIO;

  try {
    const sql = `
      SELECT 
        c.ID_CARRITO, 
        c.CANTIDAD, 
        p.ID, 
        p.NOMBRE, 
        p.PRECIO, 
        COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
      FROM CARRITO c
      INNER JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
      LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
      WHERE c.ID_USUARIO = ?
    `;

    const [results] = await db.query(sql, [idUsuario]);
    res.json(results);
  } catch (err) {
    console.error("Error SQL:", err);
    res.status(500).json({ msg: "Error al obtener el carrito" });
  }
};

// 3. Eliminar del carrito
const eliminarDelCarrito = async (req, res) => {
    const { id_carrito } = req.params;
    const id_usuario = req.user.ID_USUARIO;

    try {
        const [resultado] = await db.query(
            'DELETE FROM CARRITO WHERE ID_CARRITO = ? AND ID_USUARIO = ?',
            [id_carrito, id_usuario]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ ok: false, msg: 'Item no encontrado' });
        }

        return res.json({ ok: true, msg: 'Producto eliminado' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ ok: false, msg: 'Error al eliminar' });
    }
};

// EXPORTACIÓN ÚNICA: Esto resuelve el ReferenceError
module.exports = {
    agregarAlCarrito,
    obtenerCarrito,
    eliminarDelCarrito
};