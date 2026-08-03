const db = require('../config/db');
const bcrypt = require('bcryptjs');
const transporter = require('../config/mailer');

// Genera un código de seguridad de 6 dígitos con expiración de 15 minutos para verificación de correo o recuperación de contraseña.
const generarSeguridad = () => {
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date();
    expira.setMinutes(expira.getMinutes() + 15); 
    return { codigo, expira };
};

// Control de reintentos de código por correo (en memoria, sin SQL)
const MAX_REINTENTOS = 3;
const VENTANA_MINUTOS = 30;
const intentosReenvio = new Map(); // email → { intentos, primerIntento }
const limpiarIntentos = (email) => intentosReenvio.delete(email);
const verificarIntento = (email) => {
    const ahora = Date.now();
    const registro = intentosReenvio.get(email);
    if (!registro) {
        intentosReenvio.set(email, { intentos: 1, primerIntento: ahora });
        return { permitido: true };
    }
    const minutosPasados = (ahora - registro.primerIntento) / 60000;
    if (minutosPasados > VENTANA_MINUTOS) {
        // Ventana expiró, reinicia
        intentosReenvio.set(email, { intentos: 1, primerIntento: ahora });
        return { permitido: true };
    }
    if (registro.intentos >= MAX_REINTENTOS) {
        const restante = Math.ceil(VENTANA_MINUTOS - minutosPasados);
        return { permitido: false, restante };
    }
    registro.intentos++;
    return { permitido: true };
};

// Plantilla HTML reutilizable para correos de verificación (registro y reenvío)
const plantillaVerificacion = (nombre, codigo, esReenvio) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:500px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <tr>
            <td style="background-color:#111827;padding:30px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                JADDA <span style="color:#e63946;">SPORTS</span>
              </h1>
              <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;letter-spacing:2px;">PREMIUM SPORT STORE</p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 30px;text-align:center;">
              <div style="width:64px;height:64px;background-color:#fef2f2;border-radius:50%;margin:0 auto 24px auto;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;">${esReenvio ? '🔄' : '🎉'}</span>
              </div>
              <h2 style="margin:0 0 8px 0;color:#1f2937;font-size:20px;font-weight:700;">${esReenvio ? '¡NUEVO CÓDIGO!' : '¡BIENVENIDO, ' + nombre.toUpperCase() + '!'}</h2>
              <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.6;">
                ${esReenvio
                  ? 'Recibimos tu solicitud para obtener un nuevo código de verificación. Úsalo en la aplicación para continuar con el proceso:'
                  : 'Gracias por registrarte en JADDA SPORTS. Para activar tu cuenta y empezar a comprar, ingresa el siguiente código de verificación en la aplicación:'}
              </p>

              <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="background-color:#f9fafb;border:2px dashed #e63946;border-radius:8px;padding:15px 40px;">
                    <span style="font-size:32px;font-weight:800;color:#e63946;letter-spacing:6px;font-family:monospace;">
                      ${codigo}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0;color:#9ca3af;font-size:13px;line-height:1.4;">
                ⏱ Este código expira en <strong>15 minutos</strong>.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.4;">
                ${esReenvio ? 'Si no solicitaste este código, ignora este correo.' : 'Si no creaste una cuenta en JADDA SPORTS, ignora este correo.'}
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;padding:24px 30px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;">
                ¿Tienes dudas? Escríbenos a <a href="mailto:${process.env.EMAIL_USER}" style="color:#e63946;text-decoration:none;font-weight:600;">${process.env.EMAIL_USER}</a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:12px;">
                © 2026 JADDA SPORTS · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Plantilla HTML para correos de recuperación de contraseña
const plantillaRecuperacion = (codigo) => `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:500px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
          
          <tr>
            <td style="background-color:#111827;padding:30px 20px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">
                JADDA <span style="color:#e63946;">SPORTS</span>
              </h1>
              <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;letter-spacing:2px;">PREMIUM SPORT STORE</p>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 30px;text-align:center;">
              <div style="width:64px;height:64px;background-color:#fef2f2;border-radius:50%;margin:0 auto 24px auto;display:flex;align-items:center;justify-content:center;">
                <span style="font-size:28px;">🔑</span>
              </div>
              <h2 style="margin:0 0 8px 0;color:#1f2937;font-size:20px;font-weight:700;">¿Olvidaste tu contraseña?</h2>
              <p style="margin:0 0 24px 0;color:#4b5563;font-size:15px;line-height:1.6;">
                Recibimos una solicitud para restablecer las credenciales de tu cuenta. Usa el siguiente código de seguridad en la pantalla de recuperación para continuar:
              </p>

              <table align="center" border="0" cellspacing="0" cellpadding="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td style="background-color:#f9fafb;border:2px dashed #e63946;border-radius:8px;padding:15px 40px;">
                    <span style="font-size:32px;font-weight:800;color:#e63946;letter-spacing:6px;font-family:monospace;">
                      ${codigo}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px 0;color:#9ca3af;font-size:13px;line-height:1.4;">
                ⏱ Este código expira en <strong>15 minutos</strong>.
              </p>
              <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.4;">
                Si no solicitaste este cambio, ignora este correo de forma segura; tu contraseña actual seguirá funcionando.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#f9fafb;padding:24px 30px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0 0 8px 0;color:#6b7280;font-size:12px;">
                ¿Tienes dudas? Escríbenos a <a href="mailto:${process.env.EMAIL_USER}" style="color:#e63946;text-decoration:none;font-weight:600;">${process.env.EMAIL_USER}</a>
              </p>
              <p style="margin:0;color:#6b7280;font-size:12px;">
                © 2026 JADDA SPORTS · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

// Valida el código de recuperación comparándolo con TOKEN y verificando que no haya expirado contra TOKEN_EXPIRA en la base de datos.
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

// Registra un nuevo usuario: hashea la contraseña con bcrypt, inserta con CONFIRMADO=0, crea una dirección principal por defecto y envía un correo de verificación con plantilla HTML.
// --- REGISTRO ---
exports.registro = async (req, res) => {
    const { nombre, apellido, email, password, telefono, direccion } = req.body;

    // Validación básica antes de tocar la BD
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ message: "Correo electrónico inválido" });
    }
    if (!nombre || !nombre.trim()) {
        return res.status(400).json({ message: "El nombre es obligatorio" });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
        return res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
    }

    const usuarioNick = email.split('@')[0];
    const { codigo, expira } = generarSeguridad();

    try {
        const hashed = await bcrypt.hash(password, 10);
        const sql = `INSERT INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, TELEFONO, CONFIRMADO, TOKEN, TOKEN_EXPIRA) 
                     VALUES (?, ?, ?, ?, ?, CURDATE(), 4, ?, 0, ?, ?)`;
        
        const [result] = await db.query(sql, [nombre, apellido, email, usuarioNick, hashed, telefono, codigo, expira]);

        const partes = direccion.split(',').map(s => s.trim());
        const dirTexto = partes[0] || direccion;
        const ciudadTexto = partes.length > 1 ? partes[1] : 'Sin especificar';
        const deptoTexto = partes.length > 2 ? partes[2] : 'Sin especificar';
        await db.query(
          `INSERT INTO DIRECCIONES (ID_USUARIO, DIRECCION, CIUDAD, DEPARTAMENTO, ES_PRINCIPAL) VALUES (?, ?, ?, ?, 1)`,
          [result.insertId, dirTexto, ciudadTexto, deptoTexto]
        );
        
        // Reinicia el control de reintentos para este email (nuevo registro, nuevo límite)
        limpiarIntentos(email);

        // ENVÍO DE CORREO DE BIENVENIDA Y VERIFICACIÓN — no bloquea el registro
        try {
            await transporter.sendMail({
                from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
                to: email,
                subject: "🔥 Bienvenido a JADDA SPORTS - Activa tu cuenta",
                html: plantillaVerificacion(nombre, codigo, false)
            });
        } catch (emailErr) {
            console.error("⚠️ No se pudo enviar el correo de verificación:", emailErr.message);
        }
        
        res.status(200).json({ message: "Revisa tu correo 📩" });
    } catch (err) {
        console.error("❌ Error en registro:", err);
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: "Este correo ya está registrado." });
        res.status(500).json({ message: "Error en el servidor" });
    }
};

// Activa la cuenta: compara el código contra TOKEN con conversión a String para evitar errores de tipo, verifica TOKEN_EXPIRA y establece CONFIRMADO=1 limpiando los campos de token.
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

// Genera un nuevo código de seguridad, actualiza TOKEN y TOKEN_EXPIRA en la base de datos y envía un correo con el nuevo código.
// --- REENVIAR CÓDIGO ---
exports.reenviarCodigo = async (req, res) => {
    const { email, tipo } = req.body; // tipo: 'verify' o 'recovery'
    const { permitido, restante } = verificarIntento(email);
    if (!permitido) {
        return res.status(429).json({
            message: `Has alcanzado el límite de reenvíos. Intenta de nuevo en ${restante} minuto(s).`
        });
    }
    const { codigo, expira } = generarSeguridad();
    try {
        const [rows] = await db.query("SELECT NOMBRE_USUARIO FROM USUARIOS WHERE EMAIL = ?", [email]);
        const nombre = rows.length > 0 ? rows[0].NOMBRE_USUARIO : "Cliente";

        await db.query("UPDATE USUARIOS SET TOKEN = ?, TOKEN_EXPIRA = ? WHERE EMAIL = ?", [codigo, expira, email]);

        const esRecovery = tipo === 'recovery';
        await transporter.sendMail({
            from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: esRecovery ? "🔄 Nuevo código de recuperación - JADDA SPORTS" : "🔄 Nuevo código de verificación - JADDA SPORTS",
            html: esRecovery ? plantillaRecuperacion(codigo) : plantillaVerificacion(nombre, codigo, true)
        });

        res.status(200).json({ message: "Nuevo código enviado" });
    } catch (error) {
        res.status(500).json({ message: "Error al reenviar" });
    }
};

// Genera un código de recuperación, lo almacena en TOKEN/TOKEN_EXPIRA y envía un correo con plantilla HTML estilizada para restablecer la contraseña.
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
            html: plantillaRecuperacion(codigo)
        });

        res.status(200).json({ message: "Código enviado correctamente." });
    } catch (error) {
        res.status(500).json({ message: "Error en el servidor." });
    }
};

// Valida el código de recuperación y su expiración, hashea la nueva contraseña con bcrypt, actualiza CONTRASENA y limpia TOKEN/TOKEN_EXPIRA.
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

        const mismaAnterior = await bcrypt.compare(password, user.CONTRASENA);
        if (mismaAnterior) {
            return res.status(400).json({ message: "La nueva contraseña no puede ser igual a la anterior." });
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

// Inicia sesión: busca al usuario por email, verifica CONFIRMADO=1, compara la contraseña con bcrypt, e invoca req.login() para crear la sesión de Passport.
// --- SOCIAL LOGIN (Google / Facebook desde app móvil) ---
exports.socialLogin = async (req, res) => {
  const { provider, accessToken } = req.body;

  if (!provider || !accessToken) {
    return res.status(400).json({ message: "Provider y accessToken son obligatorios" });
  }

  try {
    let email, nombre, apellido, foto;

    if (provider === "google") {
      const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${accessToken}`);
      const data = await resp.json();
      if (data.error) return res.status(401).json({ message: "Token de Google inválido" });
      email = data.email;
      nombre = data.given_name || data.name?.split(" ")[0] || "Usuario";
      apellido = data.family_name || data.name?.split(" ").slice(1).join(" ") || "";
      foto = data.picture || null;
    } else if (provider === "facebook") {
      const resp = await fetch(
        `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${accessToken}`
      );
      const data = await resp.json();
      if (data.error) return res.status(401).json({ message: "Token de Facebook inválido" });
      email = data.email;
      const parts = (data.name || "").split(" ");
      nombre = parts[0] || "Usuario";
      apellido = parts.slice(1).join(" ") || "";
      foto = data.picture?.data?.url || null;
    } else {
      return res.status(400).json({ message: "Provider no soportado" });
    }

    if (!email) {
      return res.status(400).json({ message: `No se pudo obtener el email desde ${provider}` });
    }

    const usuarioNick = email.split("@")[0];

    // Buscar o crear usuario
    const [rows] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);

    let user;
    if (rows.length === 0) {
      const insert = `INSERT INTO USUARIOS
        (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, FECHA_REGISTRO, ID_ROL, CONFIRMADO, FOTO_URL, AUTH_PROVIDER)
        VALUES (?, ?, ?, ?, ?, CURDATE(), 4, 1, ?, ?)`;
      const [result] = await db.query(insert, [nombre, apellido, email, usuarioNick, provider, foto, provider]);
      user = { ID_USUARIO: result.insertId, NOMBRE_USUARIO: nombre, EMAIL: email, FOTO_URL: foto };
    } else {
      user = rows[0];
      if (foto) {
        await db.query("UPDATE USUARIOS SET FOTO_URL = ?, AUTH_PROVIDER = ? WHERE EMAIL = ?", [foto, provider, email]);
      }
      user.NOMBRE_USUARIO = user.NOMBRE_USUARIO || nombre;
    }

    // Establecer sesión
    req.login(user, (err) => {
      if (err) return res.status(500).json({ message: "Error al iniciar sesión" });
      return res.json({
        message: "Login social exitoso",
        usuario: {
          ID_USUARIO: user.ID_USUARIO,
          NOMBRE_USUARIO: user.NOMBRE_USUARIO,
          foto_url: user.FOTO_URL || null,
          ID_ROL: user.ID_ROL
        },
      });
    });
  } catch (err) {
    console.error("Error en socialLogin:", err);
    res.status(500).json({ message: "Error al procesar login social" });
  }
};

// --- LOGIN CORREGIDO (CON SESIÓN DE PASSPORT) ---
exports.login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
    }

    try {
        const [results] = await db.query("SELECT * FROM USUARIOS WHERE EMAIL = ?", [email]);
        // Mensaje unificado para no revelar si el correo existe (anti-enumeración)
        if (results.length === 0) return res.status(401).json({ message: "Correo o contraseña incorrectos" });

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

            return res.status(200).json({ 
                message: "¡Login exitoso!",
                nombre: user.NOMBRE_USUARIO, 
                usuario: {
                    ID_USUARIO: user.ID_USUARIO,
                    NOMBRE_USUARIO: user.NOMBRE_USUARIO,
                    foto_url: user.FOTO_URL || null,
                    ID_ROL: user.ID_ROL
                }
            });
        });
    } catch (err) {
        console.error("Error en login:", err);
        res.status(500).json({ message: "Error en la base de datos." });
    }
};

// Obtiene los datos del perfil del usuario autenticado mediante SELECT desde la base de datos usando el ID extraído de la sesión (req.user).
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
                    FECHA_REGISTRO,
                    ID_ROL
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

                ID_ROL:
                    usuario.ID_ROL || null,
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

// Cierra la sesión del usuario: ejecuta req.logout() de Passport, destruye la sesión en el servidor y limpia la cookie connect.sid del navegador.
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

// Actualiza los datos del perfil del usuario autenticado: nombre, apellido, usuario, teléfono, tipo/número de documento y foto de perfil.
// --- SUBIR FOTO DE PERFIL (base64 desde el navegador) ---
exports.subirFotoPerfil = async (req, res) => {
  const fs = require("fs");
  const path = require("path");

  const { foto } = req.body || {};

  if (!foto || typeof foto !== "string") {
    return res.status(400).json({ ok: false, message: "No se envió ninguna foto" });
  }

  const match = /^data:(image\/(jpeg|png|webp|gif));base64,(.+)$/.exec(foto);
  if (!match) {
    return res.status(400).json({ ok: false, message: "Formato de imagen no válido (jpg, png, webp, gif)" });
  }

  try {
    const idUsuario = req.user.ID_USUARIO;
    const ext = match[1] === "image/jpeg" ? "jpg" : match[1].split("/")[1];
    const uploadDir = path.join(__dirname, "..", "uploads", "perfiles", `u${idUsuario}`);
    fs.mkdirSync(uploadDir, { recursive: true });

    const nombre = `perfil-${Date.now()}.${ext}`;
    const ruta = path.join(uploadDir, nombre);
    fs.writeFileSync(ruta, Buffer.from(match[3], "base64"));

    const url = `/images/perfiles/u${idUsuario}/${nombre}`;
    res.json({ ok: true, url });
  } catch (error) {
    console.error("Error subiendo foto de perfil:", error);
    res.status(500).json({ ok: false, message: "Error al guardar la foto" });
  }
};

// Actualiza los datos del perfil del usuario autenticado: nombre, apellido, usuario, teléfono, tipo/número de documento y foto de perfil.
// Solo actualiza los campos que vienen en el body (para no pisar los demás con NULL).
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
    const campos = [];
    const valores = [];
    const push = (col, val) => {
      campos.push(`${col} = ?`);
      valores.push(val === undefined ? null : val);
    };

    if (nombre !== undefined) push("NOMBRE_USUARIO", nombre);
    if (apellido !== undefined) push("APELLIDO_USUARIO", apellido);
    if (usuario !== undefined) push("USUARIO", usuario);
    if (telefono !== undefined) push("TELEFONO", telefono);
    if (tipo_documento !== undefined) push("TIPO_DOCUMENTO", tipo_documento || null);
    if (numero_documento !== undefined) push("NUMERO_DOCUMENTO", numero_documento || null);
    if (foto_url !== undefined) push("FOTO_URL", foto_url || null);

    if (campos.length === 0) {
      return res.json({ ok: true, message: "Sin cambios" });
    }

    valores.push(id_usuario);
    await db.query(
      `UPDATE USUARIOS
      SET
        ${campos.join(",\n        ")}
      WHERE ID_USUARIO = ?`,
      valores
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
