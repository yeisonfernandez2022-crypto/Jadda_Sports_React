const db = require('../config/db');

// 1. CORREGIDO: Ahora sí incluye el campo STOCK en el SELECT
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
    PI.URL_IMAGEN AS IMAGEN,
    CATEGORIAS.NOMBRE_CATEGORIA AS CATEGORIA,
    COALESCE(SUM(PV.STOCK), 0) AS STOCK,
    MIN(PV.ID_VARIANTE) AS ID_VARIANTE_POR_DEFECTO
FROM PRODUCTOS
LEFT JOIN CATEGORIAS
    ON PRODUCTOS.ID_CATEGORIA = CATEGORIAS.ID_CATEGORIA
LEFT JOIN PRODUCTO_IMAGENES PI
    ON PRODUCTOS.ID = PI.ID_PRODUCTO
    AND PI.ORDEN = 1
LEFT JOIN PRODUCTO_VARIANTES PV
    ON PRODUCTOS.ID = PV.ID_PRODUCTO
`;
        let params = [];
        if (search && search.trim() !== "" && search !== "undefined") {
            const words = search.trim().split(/\s+/).filter(w => w.length > 0);
            const conditions = words.map(() =>
                `(PRODUCTOS.NOMBRE LIKE ? OR PRODUCTOS.MARCA LIKE ? OR PRODUCTOS.DESCRIPCION LIKE ?)`
            );
            sql += ` WHERE ${conditions.join(' AND ')} `;
            words.forEach(w => {
                const term = `${w}%`;
                params.push(term, term, term);
            });
        }

        sql += `
GROUP BY
    PRODUCTOS.ID,
    PRODUCTOS.NOMBRE,
    PRODUCTOS.PRECIO,
    PRODUCTOS.MARCA,
    PRODUCTOS.DESCRIPCION,
    PRODUCTOS.ID_DESCUENTO,
    PI.URL_IMAGEN,
    CATEGORIAS.NOMBRE_CATEGORIA
`;
        const [results] = await db.query(sql, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Error al obtener productos" });
    }
};


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
        COLOR,
        TIPO_ATRIBUTO,
        ATRIBUTO,
        STOCK,
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

        // Insertar imagen
        if (URL_IMAGEN) {
            const sqlImagen = `INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, 1)`;
            await db.query(sqlImagen, [idNuevoProducto, URL_IMAGEN]);
        }

        // Insertar variante
        if (COLOR || TIPO_ATRIBUTO) {
            const sqlVariante = `
                INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK)
                VALUES (?, ?, ?, ?, ?)
            `;
            await db.query(sqlVariante, [
                idNuevoProducto,
                COLOR || "Único",
                TIPO_ATRIBUTO || "Talla",
                ATRIBUTO || "Único",
                Number(STOCK) || 0
            ]);
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


const obtenerProductoPorId = async (req, res) => {
    const { id } = req.params;

    try {

        const [producto] = await db.query(
            'SELECT * FROM PRODUCTOS WHERE ID = ?',
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

const obtenerRelacionados = async (req, res) => {
    const { id } = req.params;
    try {
        const [producto] = await db.query('SELECT ID_CATEGORIA, MARCA FROM PRODUCTOS WHERE ID = ?', [id]);
        if (!producto || producto.length === 0) return res.json([]);
        const cat = producto[0].ID_CATEGORIA;
        const marca = producto[0].MARCA;

        const [mismaCategoria] = await db.query(
            `SELECT p.ID, p.NOMBRE, p.PRECIO, pi.URL_IMAGEN
             FROM PRODUCTOS p
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             WHERE p.ID_CATEGORIA = ? AND p.ID <> ?
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
            `SELECT p.ID, p.NOMBRE, p.PRECIO, pi.URL_IMAGEN
             FROM PRODUCTOS p
             LEFT JOIN PRODUCTO_IMAGENES pi ON p.ID = pi.ID_PRODUCTO AND pi.ORDEN = 1
             WHERE p.ID NOT IN (?)
             ORDER BY RAND()
             LIMIT ?`,
            [idsUsados, faltan]
        );

        res.json([...mismaCategoria, ...otrasCategorias]);
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

    const {
        NOMBRE,
        MARCA,
        PRECIO,
        DESCRIPCION,
        ID_CATEGORIA,
        ID_PROVEEDOR,
        ID_DESCUENTO,
        URL_IMAGEN,
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

        // Actualizar imagen (reemplazar)
        if (URL_IMAGEN) {
            await db.query('DELETE FROM PRODUCTO_IMAGENES WHERE ID_PRODUCTO = ?', [id]);
            await db.query('INSERT INTO PRODUCTO_IMAGENES (ID_PRODUCTO, URL_IMAGEN, ORDEN) VALUES (?, ?, 1)', [id, URL_IMAGEN]);
        }

        // Reemplazar variantes si se envía el array
        if (VARIANTES && Array.isArray(VARIANTES)) {
            await db.query('DELETE FROM PRODUCTO_VARIANTES WHERE ID_PRODUCTO = ?', [id]);
            for (const v of VARIANTES) {
                if (v.COLOR || v.NOMBRE_ATRIBUTO || v.ATRIBUTO) {
                    await db.query(
                        `INSERT INTO PRODUCTO_VARIANTES (ID_PRODUCTO, COLOR, NOMBRE_ATRIBUTO, ATRIBUTO, STOCK) VALUES (?, ?, ?, ?, ?)`,
                        [id, v.COLOR || "Único", v.NOMBRE_ATRIBUTO || "Talla", v.ATRIBUTO || "Único", Number(v.STOCK) || 0]
                    );
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

    res.status(201).json({
        ID_VARIANTE: result.insertId
    });
}

const actualizarVariante = async (req,res)=>{

    const {idVariante}=req.params;

    const {
        COLOR,
        NOMBRE_ATRIBUTO,
        ATRIBUTO,
        STOCK
    } = req.body;

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

    res.json({
        message:"Variante actualizada"
    });
}

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





const obtenerCategorias = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT ID_CATEGORIA, NOMBRE_CATEGORIA FROM CATEGORIAS ORDER BY NOMBRE_CATEGORIA');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener categorías" });
  }
};

const obtenerDescuentos = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT ID_DESCUENTO, DESCRIPCION, PORCENTAJE FROM DESCUENTOS WHERE FECHA_FIN >= CURDATE() ORDER BY DESCRIPCION');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener descuentos" });
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
    obtenerDescuentos,
};