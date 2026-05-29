const db = require('../config/db');
const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');

/**
 * Función auxiliar para generar código de 6 dígitos y expiración formateada para MySQL.
 */
const generarSeguridad = () => {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const fechaExpira = new Date();
    fechaExpira.setMinutes(fechaExpira.getMinutes() + 15);
    const expira = fechaExpira.toISOString().slice(0, 19).replace('T', ' ');
    return { codigo, expira };
};

// --- VALIDAR CÓDIGO DE RECUPERACIÓN ---
exports.validarCodigoRecuperacion = async (req, res) => {
    const { email, codigo } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });

        const user = rows[0];

        if (!user.TOKEN || user.TOKEN !== codigo) {
            return res.status(400).json({ message: "Código incorrecto o ya utilizado." });
        }

        if (new Date() > new Date(user.TOKEN_EXPIRA)) {
            return res.status(400).json({ message: "El código ha expirado." });
        }

        res.status(200).json({ message: "Código válido." });
    } catch (err) {
        console.error("Error en validarCodigoRecuperacion:", err);
        res.status(500).json({ message: "Error al validar el código." });
    }
};

// --- REGISTRO ---
exports.registro = async (req, res) => {
    const { nombre, apellido, email, password, telefono, direccion } = req.body;
    const usuarioNick = email.split('@')[0];
    const { codigo, expira } = generarSeguridad();

    try {
        const hashed = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, TELEFONO, DIRECCION, CONFIRMADO, TOKEN, TOKEN_EXPIRA) 
                     VALUES (?, ?, ?, ?, ?, CURDATE(), 2, ?, ?, 0, ?, ?)`;
        
        await db.query(sql, [nombre, apellido, email, usuarioNick, hashed, telefono, direccion, codigo, expira]);
        
        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔥 Bienvenido a JADDA SPORTS - Activa tu cuenta",
            html: `
            <div style="background-color: #f4f4f4; padding: 40px; font-family: 'Segoe UI', sans-serif;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                    <div style="background-color: #e63946; padding: 30px; text-align: center;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; letter-spacing: 2px;">JADDA SPORTS</h1>
                    </div>
                    <div style="padding: 40px; text-align: center; color: #1d3557;">
                        <h2 style="margin-top: 0;">¡BIENVENIDO, ${nombre.toUpperCase()}!</h2>
                        <p style="font-size: 16px; line-height: 1.5;">Usa el siguiente código para activar tu cuenta:</p>
                        <div style="margin: 30px 0; background-color: #f8f9fa; border: 2px dashed #e63946; padding: 20px; border-radius: 10px;">
                            <span style="font-size: 40px; font-weight: bold; letter-spacing: 8px; color: #e63946;">${codigo}</span>
                        </div>
                    </div>
                </div>
            </div>`
        });
        
        res.status(200).json({ message: "Revisa tu correo 📩" });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Este correo ya está registrado." });
        res.status(500).json({ message: "Error en el servidor" });
    }
};

// --- CONFIRMAR CUENTA ---
exports.confirmarCuenta = async (req, res) => {
    const { email, codigo } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });

        const user = rows[0];
        if (user.CONFIRMADO === 1) return res.status(400).json({ message: "Esta cuenta ya está verificada." });
        
        if (!user.TOKEN || user.TOKEN !== codigo) {
            return res.status(400).json({ message: "Código incorrecto o ya utilizado." });
        }
        
        if (new Date() > new Date(user.TOKEN_EXPIRA)) {
            return res.status(400).json({ message: "El código ha expirado." });
        }

        await db.query("UPDATE USUARIOS SET CONFIRMADO = 1, TOKEN = NULL, TOKEN_EXPIRA = NULL WHERE EMAIL = ?", [email]);
        res.status(200).json({ message: "Cuenta activada con éxito" });
    } catch (err) {
        res.status(500).json({ message: "Error al confirmar cuenta." });
    }
};

// --- REENVIAR CÓDIGO ---
exports.reenviarCodigo = async (req, res) => {
    const { email } = req.body;
    const { codigo, expira } = generarSeguridad();
    try {
        const [rows] = await db.query("SELECT NOMBRE_USUARIO FROM USUARIOS WHERE EMAIL = ?", [email]);
        const nombre = rows.length > 0 ? rows[0].NOMBRE_USUARIO : "Cliente";

        await db.query("UPDATE USUARIOS SET TOKEN = ?, TOKEN_EXPIRA = ? WHERE EMAIL = ?", [codigo, expira, email]);

        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔄 Nuevo código - JADDA SPORTS",
            html: `<h3>Hola ${nombre}, tu nuevo código es: ${codigo}</h3>`
        });

        res.status(200).json({ message: "Nuevo código enviado" });
    } catch (error) {
        res.status(500).json({ message: "Error al reenviar" });
    }
};

// --- RECUPERAR CONTRASEÑA ---
exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;
    const { codigo, expira } = generarSeguridad();

    try {
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (results.length === 0) return res.status(404).json({ message: "Correo no encontrado." });

        await db.query("UPDATE USUARIOS SET TOKEN = ?, TOKEN_EXPIRA = ? WHERE EMAIL = ?", [codigo, expira, email]);

        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔑 Recuperar Contraseña - JADDA SPORTS",
            html: `<div style="font-family: sans-serif; text-align: center;">
                    <h2>Código para cambiar tu clave:</h2>
                    <h1 style="color: #e63946; letter-spacing: 5px;">${codigo}</h1>
                   </div>`
        });

        res.status(200).json({ message: "Código enviado correctamente." });
    } catch (error) {
        res.status(500).json({ message: "Error en el servidor." });
    }
};

// --- ACTUALIZAR CONTRASEÑA ---
exports.actualizarPassword = async (req, res) => {
    const { email, codigo, password } = req.body;

    try {
        const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).json({ message: "Usuario no encontrado." });

        const user = rows[0];

        if (!user.TOKEN || user.TOKEN !== codigo) {
            return res.status(400).json({ message: "Código incorrecto o ya utilizado." });
        }

        if (new Date() > new Date(user.TOKEN_EXPIRA)) {
            return res.status(400).json({ message: "El código ha expirado." });
        }

        const hashed = await bcrypt.hash(password, 10);

        await db.query(
            "UPDATE USUARIOS SET CONTRASENA = ?, TOKEN = NULL, TOKEN_EXPIRA = NULL WHERE EMAIL = ?", 
            [hashed, email]
        );

        res.status(200).json({ message: "Contraseña actualizada con éxito. El código ha sido invalidado." });
    } catch (error) {
        console.error("Error en actualizarPassword:", error);
        res.status(500).json({ message: "Error al actualizar la contraseña." });
    }
};

// --- LOGIN CORREGIDO (CON SESIÓN DE PASSPORT) ---
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (results.length === 0) return res.status(401).json({ message: "Usuario no encontrado" });

        const user = results[0];
        if (user.CONFIRMADO === 0) return res.status(403).json({ message: "Debes verificar tu correo" });

        const match = await bcrypt.compare(password, user.CONTRASENA);
        if (!match) return res.status(401).json({ message: "Correo o contraseña incorrectos" });

        // 🚀 ELIMINAMOS JWT Y SERIALIZAMOS NATIVAMENTE LA SESIÓN EN EXPRESS/PASSPORT
        req.login(user, (err) => {
            if (err) {
                console.error("Error al establecer la sesión:", err);
                return res.status(500).json({ message: "Error al inicializar la sesión." });
            }

            // Respondemos exactamente lo que tu Frontend (Login.tsx) mapea
            return res.status(200).json({ 
                message: "¡Login exitoso!",
                nombre: user.NOMBRE_USUARIO, 
                usuario: {
                    ID_USUARIO: user.ID_USUARIO,
                    NOMBRE_USUARIO: user.NOMBRE_USUARIO,
                    foto_url: user.FOTO_URL || null
                }
            });
        });
    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ message: "Error en la base de datos." });
    }
};

// --- OBTENER PERFIL DE USUARIO CORREGIDO (CON SESIÓN) ---
exports.obtenerPerfil = async (req, res) => {
    const id_usuario = req.user.ID_USUARIO || req.user.id; 

    try {
        const [results] = await db.query(
            "SELECT ID_USUARIO, NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, TELEFONO, DIRECCION, FOTO_URL FROM USUARIOS WHERE ID_USUARIO = ?", 
            [id_usuario]
        );

        if (results.length === 0) {
            return res.status(404).json({ ok: false, message: "Usuario no encontrado" });
        }

        // Estructura limpia para actualizar tu AuthContext reactivo
        res.status(200).json({ 
            ok: true, 
            usuario: {
                ID_USUARIO: results[0].ID_USUARIO,
                NOMBRE_USUARIO: results[0].NOMBRE_USUARIO,
                foto_url: results[0].FOTO_URL || null,
                // Opcionales para la vista de perfil:
                APELLIDO_USUARIO: results[0].APELLIDO_USUARIO,
                EMAIL: results[0].EMAIL,
                TELEFONO: results[0].TELEFONO,
                DIRECCION: results[0].DIRECCION
            } 
        });
    } catch (err) {
        console.error("Error al obtener perfil:", err);
        res.status(500).json({ ok: false, message: "Error al conectar con la base de datos." });
    }
};

exports.logout = (req, res) => {
    // 1. Passport logout: quita al usuario de la sesión de passport
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ ok: false, message: "Error al cerrar sesión" });
        }
        
        // 2. Destruye la sesión en el servidor
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ ok: false, message: "Error al destruir sesión" });
            }
            
            // 3. Borra la cookie del navegador
            res.clearCookie('connect.sid', { path: '/' });
            
            return res.status(200).json({ ok: true, message: "Sesión cerrada correctamente" });
        });
    });
};