/*
 * Pruebas unitarias de la verificación social del login móvil
 * (utils/verificacionSocial.js).
 * google-auth-library y fetch global están simulados: los casos cubren
 * audiencia/email_verified de Google y app_id/is_valid de debug_token.
 */

const social = require('./verificacionSocial');

// Captura de las llamadas verifyIdToken para que cada test defina el
// comportamiento de la biblioteca simulada. El cliente real de
// google-auth-library se reemplaza en cada test vía social._clienteGoogle
// (vi/describe/test/expect son globals de vitest: NO se hace require('vitest')).
let responderTicket = async () => ({ getPayload: () => null });
const clienteFingido = { verifyIdToken: (opciones) => responderTicket(opciones) };
const clienteReal = social._clienteGoogle;

beforeEach(() => {
  social._clienteGoogle = clienteFingido;
});

afterEach(() => {
  social._clienteGoogle = clienteReal;
});

describe('utils/verificacionSocial — Google', () => {
  test('payload válido con email verificado devuelve el perfil normalizado', async () => {
    responderTicket = () => ({
      getPayload: () => ({
        sub: '1234567890',
        email: 'pepe@example.com',
        email_verified: true,
        given_name: 'Pepe',
        family_name: 'Pérez',
        name: 'Pepe Pérez',
        picture: 'https://lh3.googleusercontent.com/foto.jpg',
      }),
    });
    const perfil = await social.verificarTokenGoogle('id_token_de_prueba');
    expect(perfil.email).toBe('pepe@example.com');
    expect(perfil.nombre).toBe('Pepe');
    expect(perfil.apellido).toBe('Pérez');
    expect(perfil.foto).toBe('https://lh3.googleusercontent.com/foto.jpg');
  });

  test('email sin verificar (email_verified distinto de true) es rechazado', async () => {
    responderTicket = () => ({
      getPayload: () => ({ email: 'pepe@example.com', email_verified: false }),
    });
    await expect(social.verificarTokenGoogle('id_token_de_prueba')).rejects.toThrow(
      /Email de Google no verificado/
    );
  });

  test('id_token inválido (la biblioteca rechaza la firma/audiencia) es rechazado', async () => {
    responderTicket = () => {
      throw new Error('Invalid token signature');
    };
    await expect(social.verificarTokenGoogle('basura')).rejects.toThrow(/Invalid token signature/);
  });

  test('sin GOOGLE_CLIENT_ID configurado en el servidor es rechazado con mensaje claro', async () => {
    const original = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = undefined;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
    try {
      await expect(social.verificarTokenGoogle('cualquier')).rejects.toThrow(
        /GOOGLE_CLIENT_ID no está configurado/
      );
    } finally {
      if (original !== undefined) process.env.GOOGLE_CLIENT_ID = original;
    }
  });
});

describe('utils/verificacionSocial — Facebook', () => {
  const configEnv = () => {
    process.env.FACEBOOK_CLIENT_ID = 'appjadda';
    process.env.FACEBOOK_CLIENT_SECRET = 'secreto';
  };

  test('token válido de esta app devuelve el perfil desde /me', async () => {
    configEnv();
    const llamadas = [];
    vi.stubGlobal(
      'fetch',
      async (url) => {
        llamadas.push(String(url));
        if (url.includes('debug_token')) {
          return {
            json: async () => ({ data: { is_valid: true, app_id: 'appjadda' } }),
          };
        }
        return {
          json: async () => ({
            id: 'uki',
            name: 'Ana Ruiz',
            email: 'ana@example.com',
            picture: { data: { url: 'https://graph.facebook.com/foto.jpg' } },
          }),
        };
      }
    );
    try {
      const perfil = await social.verificarTokenFacebook('fb_token');
      expect(llamadas.length).toBe(2); // debug_token ANTES de pedir el perfil
      expect(perfil.email).toBe('ana@example.com');
      expect(perfil.nombre).toBe('Ana');
      expect(perfil.apellido).toBe('Ruiz');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('debug_token con token inválido (is_valid=false) es rechazado y no consulta /me', async () => {
    configEnv();
    let consultoPerfil = false;
    vi.stubGlobal(
      'fetch',
      async (url) => {
        if (url.includes('debug_token')) {
          return { json: async () => ({ data: { is_valid: false } }) };
        }
        consultoPerfil = true;
        return { json: async () => ({}) };
      }
    );
    try {
      await expect(social.verificarTokenFacebook('fb_token')).rejects.toThrow(
        /Token de Facebook inválido/
      );
      expect(consultoPerfil).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('debug_token con app_id de OTRA aplicación es rechazado y no consulta /me', async () => {
    configEnv();
    let consultoPerfil = false;
    vi.stubGlobal(
      'fetch',
      async (url) => {
        if (url.includes('debug_token')) {
          return { json: async () => ({ data: { is_valid: true, app_id: 'otraapp' } }) };
        }
        consultoPerfil = true;
        return { json: async () => ({}) };
      }
    );
    try {
      await expect(social.verificarTokenFacebook('fb_token')).rejects.toThrow(
        /no pertenece a esta aplicación/
      );
      expect(consultoPerfil).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test('respondsin FACEBOOK_CLIENT_ID/SECRET el servidor rechaza antes de llamar a la red', async () => {
    delete process.env.FACEBOOK_CLIENT_ID;
    delete process.env.FACEBOOK_CLIENT_SECRET;
    await expect(social.verificarTokenFacebook('fb_token')).rejects.toThrow(
      /FACEBOOK_CLIENT_ID\/SECRET no están configurados/
    );
  });
});

describe('utils/verificacionSocial — toma de cuenta sin confirmar', () => {
  test('la contraseña de reemplazo NO es un hash de bcrypt válido y es aleatoria', () => {
    const una = social.contrasenaNoVerificable();
    const dos = social.contrasenaNoVerificable();
    expect(una).toMatch(/^[a-f0-9]{48}$/); // 24 bytes hex — sin prefijo $2 de bcrypt
    expect(dos).not.toBe(una);
  });
});
