const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const transporter = require('../config/mailer'); 

exports.registro = async (req, res) => {
  const { nombre, apellido, email, password, telefono, direccion } = req.body;
  const usuarioNick = email.split('@')[0];
  const token = crypto.randomBytes(32).toString("hex");

  try {
    const hashed = await bcrypt.hash(password, 10);
    const sql = `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, TELEFONO, DIRECCION, CONFIRMADO, TOKEN) VALUES (?, ?, ?, ?, ?, CURDATE(), 2, ?, ?, 0, ?)`;
    
    await db.query(sql, [nombre, apellido, email, usuarioNick, hashed, telefono, direccion, token]);
    
    
    const link = `http://localhost:3000/api/auth/confirmar/${token}`;

    await transporter.sendMail({
    from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "🔥 Activa tu cuenta en JADDA SPORTS",
    html: `
        <div style="font-family: 'Arial', sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
                <div style="background: #000; color: #fff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; letter-spacing: 2px;">JADDA SPORTS</h1>
                    <span style="font-size: 12px; color: #e73737;">SPORT STORE</span>
                </div>
                <div style="padding: 30px; text-align: center;">
                    <h2 style="color: #333;">¡BIENVENIDO, ${nombre.toUpperCase()}!</h2>
                    <p style="color: #666; line-height: 1.6;">Estás a un solo paso de entrar a la mejor tienda deportiva. Para activar tu cuenta, haz clic en el botón de abajo:</p>
                    <div style="margin: 30px 0;">
                        <a href="${link}" style="background-color: #e73737; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">ACTIVAR MI CUENTA</a>
                    </div>
                    <p style="font-size: 12px; color: #999;">Si no creaste esta cuenta, puedes ignorar este correo.</p>
                </div>
                <div style="background: #f9f9f9; color: #777; padding: 15px; text-align: center; font-size: 12px;">
                    © 2026 JADDA SPORTS. Todos los derechos reservados.
                </div>
            </div>
        </div>
    `
});
    res.send("Revisa tu correo 📩");
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).send("Este correo ya está registrado.");
    res.status(500).send("Error servidor");
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
    
    
    if (results.length === 0) return res.status(401).json({ message: "Usuario no encontrado" });

    const user = results[0];
    if (user.CONFIRMADO === 0) return res.status(403).json({ message: "Debes verificar tu correo" });

    const match = await bcrypt.compare(password, user.CONTRASENA);
    if (!match) return res.status(401).json({ message: "Correo o contraseña incorrectos" });

    const token = jwt.sign(
      { id: user.ID_USUARIO }, 
      process.env.JWT_SECRET || "secreto", 
      { expiresIn: "2h" }
    );

    res.json({ token, nombre: user.NOMBRE_USUARIO });
  } catch (err) {
    res.status(500).json({ message: "Error en la base de datos" });
  }
};

exports.confirmarCuenta = async (req, res) => {
    const { token } = req.params;
    try {
        const [result] = await db.query(
            "UPDATE USUARIOS SET CONFIRMADO = 1, TOKEN = NULL WHERE TOKEN = ?", 
            [token]
        );
        
        if (result.affectedRows === 0) {
            return res.status(400).send("El enlace ha expirado o ya fue utilizado.");
        }

        
        res.redirect('http://localhost:5173/confirmado'); 
    } catch (err) {
        console.error(err);
        res.status(500).send("Error al confirmar la cuenta");
    }
};


exports.recuperarPassword = async (req, res) => {
    const { email } = req.body;
    console.log("Intentando recuperar contraseña para:", email);

    try {
        // Buscar usuario en Base de datos
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

        if (results.length === 0) {
            return res.status(404).json({ 
                ok: false, 
                message: "No encontramos ese correo en nuestra base de datos." 
            });
        }

        const usuario = results[0];

        // Generar token
        const token = crypto.randomBytes(32).toString("hex");

        // Guardar token en Base de datos
        await db.query("UPDATE USUARIOS SET TOKEN = ? WHERE ID_USUARIO = ?", [token, usuario.ID_USUARIO]);

        // enlace
        const link = `http://localhost:5173/reset-password/${token}`;

        
        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "Recuperar Contraseña - JADDA SPORTS",
            html: `
                <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
                    <h2>¿Olvidaste tu contraseña?</h2>
                    <p>Hola ${usuario.NOMBRE_USUARIO}, hemos recibido una solicitud para restablecer tu contraseña.</p>
                    <p>Haz clic en el siguiente botón para crear una nueva:</p>
                    <a href="${link}" style="background-color: #e73737; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">RESTABLECER CONTRASEÑA</a>
                    <p style="margin-top: 20px; font-size: 0.8em; color: #777;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
                </div>
            `
        });

        return res.status(200).json({ 
            ok: true, 
            message: "Enlace de recuperación enviado. Revisa tu correo." 
        });

    } catch (error) {
    console.log("---------------- ERROR EN BACKEND ----------------");
    console.error(error.message); 
    console.log("--------------------------------------------------");
    
    return res.status(500).json({ ok: false, message: error.message });
}
};

exports.actualizarPassword = async (req, res) => {
    const { token, password } = req.body;
    try {
        const [results] = await db.query("SELECT ID_USUARIO FROM USUARIOS WHERE TOKEN = ?", [token]);
        if (results.length === 0) return res.status(400).send("El enlace es inválido o ha expirado.");

        const hashed = await bcrypt.hash(password, 10);
        await db.query("UPDATE USUARIOS SET CONTRASENA = ?, TOKEN = NULL WHERE ID_USUARIO = ?", [hashed, results[0].ID_USUARIO]);
        res.send("Contraseña actualizada con éxito");
    } catch (error) {
        res.status(500).send("Error al actualizar la contraseña");
    }
};