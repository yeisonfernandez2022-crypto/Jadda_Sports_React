// Verificación de tokens de login social (Google / Facebook, flujo móvil).
// Google: id_token verificado con google-auth-library (firma + audiencia).
// Facebook: token validado contra debug_token (is_valid + app_id de ESTA app)
// antes de pedir el perfil a /me.
const crypto = require('crypto');
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

// Valida el accessToken de Facebook con debug_token usando el token de la
// app (app_id|app_secret). Lanza si el token no es válido o no fue emitido
// para ESTA aplicación. Devuelve el perfil normalizado.
exports.verificarTokenFacebook = async (accessToken) => {
  const appId = process.env.FACEBOOK_CLIENT_ID;
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
  if (!appId || !appSecret) {
    throw new Error('FACEBOOK_CLIENT_ID/SECRET no están configurados en el servidor');
  }
  const appToken = `${appId}|${appSecret}`;
  const urlDebug = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
    accessToken
  )}&access_token=${encodeURIComponent(appToken)}`;
  const respDebug = await fetch(urlDebug);
  const jsonDebug = await respDebug.json();
  if (!jsonDebug || !jsonDebug.data || jsonDebug.data.is_valid !== true) {
    throw new Error('Token de Facebook inválido');
  }
  if (jsonDebug.data.app_id !== appId) {
    throw new Error('El token de Facebook no pertenece a esta aplicación');
  }

  const respPerfil = await fetch(
    `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture&access_token=${encodeURIComponent(
      accessToken
    )}`
  );
  const perfil = await respPerfil.json();
  if (perfil.error) {
    throw new Error('Token de Facebook inválido');
  }
  const parts = (perfil.name || '').split(' ');
  return {
    email: perfil.email,
    nombre: parts[0] || 'Usuario',
    apellido: parts.slice(1).join(' ') || '',
    foto: perfil.picture?.data?.url || null,
  };
};

// Contraseña de reemplazo para cuentas sin confirmar que se toman por login
// social: aleatoria y SIN formato de hash de bcrypt, de modo que quien antes
// registró esa cuenta ya no pueda entrar con su contraseña.
exports.contrasenaNoVerificable = () => crypto.randomBytes(24).toString('hex');
