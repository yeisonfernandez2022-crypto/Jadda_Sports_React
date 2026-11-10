// Verificación de tokens del login social móvil (Google).
// Google: id_token verificado con google-auth-library (firma + audiencia).
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');

// Cliente sin secretos: verifyIdToken recibe la audiencia por llamada.
// Las pruebas reemplazan _clienteGoogle para simular la biblioteca real.
const clienteGoogle = new OAuth2Client();
exports._clienteGoogle = clienteGoogle;

// Devuelve la audiencia de los id_tokens de Google de la app de móvil.
function audienciaGoogle() {
  return process.env.GOOGLE_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
}

// Verifica un id_token de Google. Lanza si la audiencia no corresponde a la
// app o si el correo no está verificado. Devuelve el perfil normalizado.
exports.verificarTokenGoogle = async (idToken) => {
  const audience = audienciaGoogle();
  if (!audience) {
    throw new Error('GOOGLE_CLIENT_ID no está configurado en el servidor');
  }
  const ticket = await exports._clienteGoogle.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (!payload) {
    throw new Error('Token de Google inválido');
  }
  if (payload.email_verified !== true) {
    throw new Error('Email de Google no verificado');
  }
  const nombre = payload.given_name || (payload.name || '').split(' ')[0] || 'Usuario';
  const apellido =
    payload.family_name || (payload.name || '').split(' ').slice(1).join(' ') || '';
  return {
    email: payload.email,
    nombre,
    apellido,
    foto: payload.picture || null,
  };
};

// Contraseña de reemplazo para cuentas sin confirmar que se toman por login
// social (y para cuentas OAuth nuevas): hash de bcrypt de bytes aleatorios —
// nadie la conoce y `bcrypt.compare` devuelve false de forma uniforme (401)
// en vez de reventar con salt inválido (500). Antes se guardaba un hex plano
// (o el literal 'google'), que no es un hash válido.
exports.contrasenaNoVerificable = () => bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
