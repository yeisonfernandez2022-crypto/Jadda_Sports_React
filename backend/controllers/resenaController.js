// Obtener reseñas de un producto
exports.obtenerResenas = async (req, res) => {
    const { id } = req.params;
    try {
        const [resenas] = await db.query(
            'SELECT r.*, u.NOMBRE FROM RESENAS r JOIN USUARIOS u ON r.ID_USUARIO = u.ID_USUARIO WHERE r.ID_PRODUCTO = ? ORDER BY r.FECHA DESC',
            [id]
        );
        res.json(resenas);
    } catch (err) {
        res.status(500).json({ error: "Error al cargar reseñas" });
    }
};

// Publicar una reseña
exports.agregarResena = async (req, res) => {
    const { id } = req.params;
    const { calificacion, comentario } = req.body;
    const idUsuario = req.user.ID_USUARIO; // Asumiendo que usas JWT auth

    try {
        await db.query(
            'INSERT INTO RESENAS (ID_PRODUCTO, ID_USUARIO, CALIFICACION, COMENTARIO) VALUES (?, ?, ?, ?)',
            [id, idUsuario, calificacion, comentario]
        );
        res.status(201).json({ message: "Reseña publicada" });
    } catch (err) {
        res.status(500).json({ error: "Error al guardar reseña" });
    }
};