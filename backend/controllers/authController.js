const db = require('../config/db');
const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');

/**
 * Función auxiliar para generar código de 6 dígitos y expiración formateada para MySQL.
 */
const generarSeguridad = () => {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date();
    expira.setMinutes(expira.getMinutes() + 15); 
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
        const sql = `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, TELEFONO, CONFIRMADO, TOKEN, TOKEN_EXPIRA) 
                     VALUES (?, ?, ?, ?, ?, CURDATE(), 4, ?, 0, ?, ?)`;
        
        const [result] = await db.query(sql, [nombre, apellido, email, usuarioNick, hashed, telefono, codigo, expira]);

        await db.query(
          `INSERT INTO DIRECCIONES (ID_USUARIO, DIRECCION, ES_PRINCIPAL) VALUES (?, ?, 1)`,
          [result.insertId, direccion]
        );
        
        // ENVÍO DE CORREO DE BIENVENIDA Y VERIFICACIÓN
        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔥 Bienvenido a JADDA SPORTS - Activa tu cuenta",
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                      
                      <tr>
                        <td style="background-color: #111827; padding: 30px 20px; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                            JADDA <span style="color: #e63946;">SPORTS</span>
                          </h1>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 40px 30px; text-align: center;">
                          <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 22px; font-weight: 700;">¡BIENVENIDO, ${nombre.toUpperCase()}!</h2>
                          <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                            Gracias por registrarte. Para completar la configuración de tu cuenta y empezar a comprar, por favor ingresa el siguiente código de verificación en la aplicación:
                          </p>

                          <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 30px auto;">
                            <tr>
                              <td style="background-color: #f9fafb; border: 2px dashed #e63946; border-radius: 8px; padding: 15px 40px;">
                                <span style="font-size: 32px; font-weight: 800; color: #e63946; letter-spacing: 6px; font-family: monospace;">
                                  ${codigo}
                                </span>
                              </td>
                            </tr>
                          </table>

                          <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.4;">
                            Este código expira en unos minutos.<br>Si no solicitaste este registro, puedes ignorar este correo con total seguridad.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px;">
                            © 2026 JADDA SPORTS. Todos los derechos reservados.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>`
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
        
        // 1. 🛡️ Blindaje de tipo de datos: Convertimos ambos a String antes de comparar
        if (!user.TOKEN || String(user.TOKEN) !== String(codigo)) {
            return res.status(400).json({ message: "Código incorrecto o ya utilizado." });
        }
        
        // 2. 🛡️ Comparación de fechas segura
        const fechaExpira = new Date(user.TOKEN_EXPIRA);
        if (new Date() > fechaExpira) {
            return res.status(400).json({ message: "El código ha expirado." });
        }

        // Si pasa los filtros, ahora sí se hace el UPDATE con seguridad
        await db.query("UPDATE USUARIOS SET CONFIRMADO = 1, TOKEN = NULL, TOKEN_EXPIRA = NULL WHERE EMAIL = ?", [email]);
        
        res.status(200).json({ message: "Cuenta activada con éxito" });
    } catch (err) {
        // 3. 🛡️ Monitoreo de errores en consola
        console.error("Error crítico en confirmarCuenta:", err);
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
        
        // ENVÍO DE CORREO DE RECUPERACIÓN
        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: "🔑 Recuperar Contraseña - JADDA SPORTS",
            html: `
            <!DOCTYPE html>
            <html lang="es">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 20px;">
                <tr>
                  <td align="center">
                    <table width="100%" style="max-width: 500px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
                      
                      <tr>
                        <td style="background-color: #111827; padding: 30px 20px; text-align: center;">
                          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">
                            JADDA <span style="color: #e63946;">SPORTS</span>
                          </h1>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding: 40px 30px; text-align: center;">
                          <h2 style="margin: 0 0 16px 0; color: #1f2937; font-size: 22px; font-weight: 700;">¿Olvidaste tu contraseña?</h2>
                          <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                            Recibimos una solicitud para restablecer las credenciales de tu cuenta. Usa el siguiente código de seguridad en la pantalla de recuperación para continuar:
                          </p>

                          <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin: 0 auto 30px auto;">
                            <tr>
                              <td style="background-color: #f9fafb; border: 2px dashed #e63946; border-radius: 8px; padding: 15px 40px;">
                                <span style="font-size: 32px; font-weight: 800; color: #e63946; letter-spacing: 6px; font-family: monospace;">
                                  ${codigo}
                                </span>
                              </td>
                            </tr>
                          </table>

                          <p style="margin: 0; color: #9ca3af; font-size: 13px; line-height: 1.4;">
                            Si tú no realizaste esta solicitud, puedes ignorar este correo de forma segura; tu contraseña actual seguirá funcionando perfectamente.
                          </p>
                        </td>
                      </tr>

                      <tr>
                        <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #f3f4f6;">
                          <p style="margin: 0; color: #6b7280; font-size: 12px;">
                            © 2026 JADDA SPORTS. Todos los derechos reservados.
                          </p>
                        </td>
                      </tr>

                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>`
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
    const id_usuario =
        req.user.ID_USUARIO ||
        req.user.id;

    try {
        const [results] =
            await db.query(
                `
                SELECT
                    ID_USUARIO,
                    NOMBRE_USUARIO,
                    APELLIDO_USUARIO,
                    EMAIL,
                    USUARIO,
                    TELEFONO,
                    TIPO_DOCUMENTO,
                    NUMERO_DOCUMENTO,
                    FOTO_URL,
                    FECHA_REGISTRO
                FROM USUARIOS
                WHERE ID_USUARIO = ?
                `,
                [id_usuario]
            );

        if (results.length === 0) {
            return res.status(404).json({
                ok: false,
                message:
                    "Usuario no encontrado",
            });
        }

        const usuario = results[0];

        res.status(200).json({
            ok: true,
            usuario: {
                ID_USUARIO:
                    usuario.ID_USUARIO,

                NOMBRE_USUARIO:
                    usuario.NOMBRE_USUARIO,

                APELLIDO_USUARIO:
                    usuario.APELLIDO_USUARIO,

                EMAIL:
                    usuario.EMAIL,

                USUARIO:
                    usuario.USUARIO,

                TELEFONO:
                    usuario.TELEFONO,

                TIPO_DOCUMENTO:
                    usuario.TIPO_DOCUMENTO || null,

                NUMERO_DOCUMENTO:
                    usuario.NUMERO_DOCUMENTO || null,

                FOTO_URL:
                    usuario.FOTO_URL || null,

                FECHA_REGISTRO:
                    usuario.FECHA_REGISTRO,
            },
        });
    } catch (err) {
        console.error(
            "Error al obtener perfil:",
            err
        );

        res.status(500).json({
            ok: false,
            message:
                "Error al conectar con la base de datos.",
        });
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

// --- ACTUALIZAR PERFIL ---
exports.actualizarPerfil = async (
  req,
  res
) => {
  const id_usuario =
    req.user.ID_USUARIO;

  const {
    nombre,
    apellido,
    usuario,
    telefono,
    tipo_documento,
    numero_documento,
    foto_url,
  } = req.body;

  try {
    await db.query(
      `
      UPDATE USUARIOS
      SET
        NOMBRE_USUARIO = ?,
        APELLIDO_USUARIO = ?,
        USUARIO = ?,
        TELEFONO = ?,
        TIPO_DOCUMENTO = ?,
        NUMERO_DOCUMENTO = ?,
        FOTO_URL = ?
      WHERE ID_USUARIO = ?
      `,
      [
        nombre,
        apellido,
        usuario,
        telefono,
        tipo_documento || null,
        numero_documento || null,
        foto_url || null,
        id_usuario,
      ]
    );

    res.json({
      ok: true,
      message:
        "Perfil actualizado correctamente",
    });
  } catch (error) {
    console.error(
      "Error actualizando perfil:",
      error
    );

    res.status(500).json({
      ok: false,
      message:
        "Error al actualizar perfil",
    });
  }
};
