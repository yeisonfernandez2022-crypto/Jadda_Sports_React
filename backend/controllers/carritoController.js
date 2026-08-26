const db = require('../config/db');

/**
 * Agrega un producto (con variante específica) al carrito del usuario autenticado.
 * - Valida que la variante exista y tenga stock suficiente.
 * - Si el mismo producto + variante ya está en el carrito, incrementa la cantidad
 *   (validando que no exceda el stock disponible).
 * - Si no existe, inserta un nuevo registro en CARRITO.
 * - Requiere autenticación (req.user.ID_USUARIO).
 */
const agregarAlCarrito = async (req, res) => {
    const { id_producto, cantidad, id_variante } = req.body;
    const id_usuario = req.user.ID_USUARIO;

    // Los vendedores no pueden comprar en la tienda
    if (req.user.ID_ROL === 6) {
        return res.status(403).json({
            ok: false,
            msg: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras."
        });
    }

    if (!id_producto || !id_variante) {
        return res.status(400).json({
            ok: false,
            msg: "Producto y variante son obligatorios"
        });
    }

    try {
        // 1. VALIDAR VARIANTE Y STOCK
        const [variante] = await db.query(
            `SELECT * FROM PRODUCTO_VARIANTES 
             WHERE ID_VARIANTE = ? AND ID_PRODUCTO = ?`,
            [id_variante, id_producto]
        );

        if (variante.length === 0) {
            return res.status(404).json({
                ok: false,
                msg: "Variante no existe"
            });
        }

        if (variante[0].STOCK < cantidad) {
            return res.status(400).json({
                ok: false,
                msg: "Stock insuficiente"
            });
        }

        // 2. VER SI YA EXISTE EN CARRITO (MISMA VARIANTE)
        const [existe] = await db.query(
            `SELECT * FROM CARRITO 
             WHERE ID_USUARIO = ? 
             AND ID_PRODUCTO = ? 
             AND ID_VARIANTE = ?`,
            [id_usuario, id_producto, id_variante]
        );

        if (existe.length > 0) {
    const itemEnCarrito = existe[0];
    const nuevaCantidad = itemEnCarrito.CANTIDAD + cantidad;

    // VALIDAR STOCK TOTAL CONTRA LA VARIANTE
    if (nuevaCantidad > variante[0].STOCK) {
        return res.status(400).json({
            ok: false,
            msg: `Solo hay ${variante[0].STOCK} unidades disponibles.`
        });
    }

    await db.query(
        `UPDATE CARRITO SET CANTIDAD = ? WHERE ID_CARRITO = ?`,
        [nuevaCantidad, itemEnCarrito.ID_CARRITO]
    );
            return res.json({
                ok: true,
                msg: "Carrito actualizado"
            });
        }

        // 3. INSERT NUEVO ITEM
        await db.query(
            `INSERT INTO CARRITO 
            (ID_USUARIO, ID_PRODUCTO, ID_VARIANTE, CANTIDAD)
            VALUES (?, ?, ?, ?)`,
            [id_usuario, id_producto, id_variante, cantidad || 1]
        );

        return res.status(201).json({
            ok: true,
            msg: "Producto agregado al carrito"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            msg: "Error del servidor"
        });
    }
};

/**
 * Obtiene el carrito completo del usuario autenticado.
 * - JOIN con PRODUCTOS, PRODUCTO_VARIANTES y PRODUCTO_IMAGENES.
 * - Incluye: ID_CARRITO, CANTIDAD, NOMBRE, PRECIO, COLOR, ATRIBUTO, STOCK, IMAGEN.
 * - Agrupa todos los items del usuario en un solo resultado.
 */
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
    p.ID_DESCUENTO, 
    pv.COLOR, 
    pv.ATRIBUTO,
    pv.STOCK,
    COALESCE(pi.URL_IMAGEN, '') AS IMAGEN
  FROM CARRITO c
      INNER JOIN PRODUCTOS p ON c.ID_PRODUCTO = p.ID
      LEFT JOIN PRODUCTO_VARIANTES pv ON c.ID_VARIANTE = pv.ID_VARIANTE
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

/**
 * Elimina un item del carrito verificando que pertenezca al usuario.
 * - DELETE con verificación de ID_USUARIO para evitar que un usuario
 *   elimine items de otro.
 * - Retorna 404 si el item no existe o no pertenece al usuario.
 */
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

/**
 * Actualiza la cantidad de un item en el carrito con validación de stock.
 * - Obtiene el stock disponible de la variante (JOIN con PRODUCTO_VARIANTES).
 * - Si la nueva cantidad supera el stock, rechaza la actualización.
 * - Verifica que el item pertenezca al usuario autenticado.
 */
const actualizarCantidad = async (req, res) => {
    const { id_carrito } = req.params;
    const { cantidad } = req.body;
    const id_usuario = req.user.ID_USUARIO;

    try {
        // Validar stock primero
        const [item] = await db.query(
            `SELECT pv.STOCK FROM CARRITO c 
             JOIN PRODUCTO_VARIANTES pv ON c.ID_VARIANTE = pv.ID_VARIANTE 
             WHERE c.ID_CARRITO = ? AND c.ID_USUARIO = ?`,
            [id_carrito, id_usuario]
        );

        if (item.length === 0) return res.status(404).json({ ok: false, msg: "Item no encontrado" });
        if (cantidad > item[0].STOCK) return res.status(400).json({ ok: false, msg: "Stock insuficiente" });

        await db.query(
            'UPDATE CARRITO SET CANTIDAD = ? WHERE ID_CARRITO = ? AND ID_USUARIO = ?',
            [cantidad, id_carrito, id_usuario]
        );

        return res.json({ ok: true, msg: "Cantidad actualizada" });
    } catch (error) {
        return res.status(500).json({ ok: false, msg: "Error al actualizar" });
    }
};


module.exports = {
    agregarAlCarrito,
    obtenerCarrito,
    eliminarDelCarrito,
    actualizarCantidad
};