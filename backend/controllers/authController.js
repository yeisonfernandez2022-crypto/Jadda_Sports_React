const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');

// Función auxiliar para generar código de 6 dígitos y expiración
const generarSeguridad = () => {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date();
    expira.setMinutes(expira.getMinutes() + 15); // Vence en 15 min
    return { codigo, expira };
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
            subject: "🔥 Código de activación - JADDA SPORTS",
            html: `
                <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
                    <h2>¡BIENVENIDO, ${nombre.toUpperCase()}!</h2>
                    <p>Tu código de activación es:</p>
                    <h1 style="color: #e73737; letter-spacing: 5px;">${codigo}</h1>
                    <p>Este código vencerá en 15 minutos.</p>
                </div>
            `
        });
        res.status(200).send("Revisa tu correo, hemos enviado un código de 6 dígitos 📩");
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).send("Este correo ya está registrado.");
        res.status(500).send("Error servidor");
    }
};

// --- CONFIRMAR CUENTA (REGISTRO) ---
exports.confirmarCuenta = async (req, res) => {
    const { email, codigo } = req.body;
    try {
        const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).send("Usuario no encontrado.");

        const user = rows[0];
        if (user.CONFIRMADO === 1) return res.status(400).send("Esta cuenta ya está verificada.");
        if (user.TOKEN !== codigo) return res.status(400).send("Código incorrecto.");
        if (new Date() > new Date(user.TOKEN_EXPIRA)) return res.status(400).send("Código expirado.");

        await db.query("UPDATE USUARIOS SET CONFIRMADO = 1, TOKEN = NULL, TOKEN_EXPIRA = NULL WHERE EMAIL = ?", [email]);
        res.status(200).send("Cuenta activada con éxito");
    } catch (err) {
        res.status(500).send("Error al confirmar cuenta");
    }
};

// --- REENVIAR CÓDIGO ---
exports.reenviarCodigo = async (req, res) => {
    const { email } = req.body;
    const { codigo, expira } = generarSeguridad();
    try {
        const [rows] = await db.query("SELECT NOMBRE_USUARIO, CONFIRMADO FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).send("Correo no encontrado.");
        if (rows[0].CONFIRMADO === 1) return res.status(400).send("La cuenta ya está confirmada.");

        await db.query("UPDATE USUARIOS SET TOKEN = ?, TOKEN_EXPIRA = ? WHERE EMAIL = ?", [codigo, expira, email]);

        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔄 Nuevo código de activación - JADDA SPORTS",
            html: `<div style="text-align: center;"><h2>Nuevo código: ${codigo}</h2></div>`
        });
        res.status(200).send("Nuevo código enviado");
    } catch (error) {
        res.status(500).send("Error al reenviar");
    }
};

// --- RECUPERAR CONTRASEÑA (PASO 1: ENVIAR MAIL) ---
exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;
    const { codigo, expira } = generarSeguridad();

    try {
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (results.length === 0) return res.status(404).send("Correo no encontrado.");

        await db.query("UPDATE USUARIOS SET TOKEN = ?, TOKEN_EXPIRA = ? WHERE EMAIL = ?", [codigo, expira, email]);

        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔑 Recuperar Contraseña - JADDA SPORTS",
            html: `
                <div style="font-family: sans-serif; text-align: center; padding: 20px;">
                    <h2>RESTABLECER CONTRASEÑA</h2>
                    <p>Usa este código para cambiar tu clave:</p>
                    <h1 style="color: #e73737; letter-spacing: 5px;">${codigo}</h1>
                    <p>Válido por 15 minutos.</p>
                </div>
            `
        });

        res.status(200).send("Código enviado correctamente.");
    } catch (error) {
        res.status(500).send("Error en el servidor");
    }
};

// --- ACTUALIZAR CONTRASEÑA (PASO 2: GUARDAR NUEVA CLAVE) ---
exports.actualizarPassword = async (req, res) => {
    const { email, codigo, password } = req.body;

    try {
        const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (rows.length === 0) return res.status(404).send("Usuario no encontrado.");

        const user = rows[0];

        if (user.TOKEN !== codigo) return res.status(400).send("Código incorrecto.");
        if (new Date() > new Date(user.TOKEN_EXPIRA)) return res.status(400).send("El código ha expirado.");

        const hashed = await bcrypt.hash(password, 10);

        await db.query(
            "UPDATE USUARIOS SET CONTRASENA = ?, TOKEN = NULL, TOKEN_EXPIRA = NULL WHERE EMAIL = ?", 
            [hashed, email]
        );

        res.status(200).send("Contraseña actualizada con éxito");
    } catch (error) {
        res.status(500).send("Error al actualizar la contraseña");
    }
};

// --- LOGIN ---
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        if (results.length === 0) return res.status(401).json({ message: "Usuario no encontrado" });

        const user = results[0];
        if (user.CONFIRMADO === 0) return res.status(403).json({ message: "Debes verificar tu correo" });

        const match = await bcrypt.compare(password, user.CONTRASENA);
        if (!match) return res.status(401).json({ message: "Correo o contraseña incorrectos" });

        const token = jwt.sign({ id: user.ID_USUARIO }, process.env.JWT_SECRET || "secreto", { expiresIn: "2h" });
        res.status(200).json({ token, nombre: user.NOMBRE_USUARIO });
    } catch (err) {
        res.status(500).json({ message: "Error en la base de datos" });
    }
};