/*
 * Transporter de Nodemailer para envío de correos electrónicos.
 * Usa el servicio SMTP de Gmail con autenticación de "contraseña de aplicación"
 * (no la contraseña normal de Google — requiere 2FA activado en la cuenta).
 *
 * Variables de entorno requeridas:
 *   EMAIL_USER — dirección de Gmail (ej: jaddasports@gmail.com)
 *   EMAIL_PASS — contraseña de aplicación generada en Google Account > Seguridad
 */

const nodemailer = require("nodemailer");

const transporter = process.env.EMAIL_USER && process.env.EMAIL_PASS
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })
  : {
      sendMail: async (opts) => {
        console.warn('[MAIL] SMTP no configurado (EMAIL_USER/EMAIL_PASS ausentes). Correo NO enviado:', opts.subject || '(sin asunto)');
        return null;
      }
    };

module.exports = transporter;