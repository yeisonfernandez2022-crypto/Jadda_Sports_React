const transporter = require('../config/mailer');

const plantillaContacto = (nombre, email, asunto, mensaje) => `
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
              <p style="margin:8px 0 0 0;color:#9ca3af;font-size:12px;letter-spacing:2px;">CONTACTO DESDE LA WEB</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="margin:0 0 8px 0;color:#1f2937;font-size:20px;font-weight:700;">📩 Nuevo mensaje de contacto</h2>
              <p style="margin:0 0 24px 0;color:#6b7280;font-size:14px;">Han recibido un mensaje a través del formulario de contacto.</p>
              <table width="100%" style="border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="padding:10px 0;color:#374151;font-weight:600;width:80px;vertical-align:top;">Nombre</td>
                  <td style="padding:10px 0;color:#1f2937;">${nombre}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#374151;font-weight:600;vertical-align:top;">Correo</td>
                  <td style="padding:10px 0;color:#1f2937;"><a href="mailto:${email}" style="color:#e63946;text-decoration:none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding:10px 0;color:#374151;font-weight:600;vertical-align:top;">Asunto</td>
                  <td style="padding:10px 0;color:#1f2937;font-weight:600;">${asunto}</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:16px 0 8px 0;color:#374151;font-weight:600;">Mensaje</td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:12px;background-color:#f9fafb;border-radius:8px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${mensaje}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f9fafb;padding:20px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#6b7280;font-size:12px;">© 2026 JADDA SPORTS · Todos los derechos reservados</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const enviarContacto = async (req, res) => {
  const { nombre, email, asunto, mensaje } = req.body;

  if (!nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio." });
  if (!email?.trim()) return res.status(400).json({ message: "El correo es obligatorio." });
  if (!asunto?.trim()) return res.status(400).json({ message: "El asunto es obligatorio." });
  if (!mensaje?.trim()) return res.status(400).json({ message: "El mensaje es obligatorio." });

  try {
    await transporter.sendMail({
      from: `"${nombre}" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `📩 ${asunto} - Contacto desde JADDA SPORTS`,
      html: plantillaContacto(nombre.trim(), email.trim(), asunto.trim(), mensaje.trim())
    });

    res.json({ message: "Mensaje enviado correctamente. Te responderemos pronto." });
  } catch (error) {
    console.error("Error al enviar contacto:", error);
    res.status(500).json({ message: "Error al enviar el mensaje. Intenta de nuevo." });
  }
};

module.exports = { enviarContacto };
