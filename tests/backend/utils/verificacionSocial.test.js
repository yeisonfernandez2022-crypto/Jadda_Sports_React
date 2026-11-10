/*
 * Pruebas unitarias de la verificación social del login móvil
 * (utils/verificacionSocial.js).
 * google-auth-library está simulado: los casos cubren audiencia y
 * email_verified de Google.
 */

const social = require('../../../backend/utils/verificacionSocial');
const bcrypt = require('bcryptjs');

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

describe('utils/verificacionSocial — toma de cuenta sin confirmar', () => {
  test('la contraseña de reemplazo ES un hash de bcrypt de bytes aleatorios', () => {
    const una = social.contrasenaNoVerificable();
    const dos = social.contrasenaNoVerificable();
    // Hash bcrypt REAL: bcrypt.compare contra un literal ('google') o hex
    // plano revienta con salt inválido (500 en login) — con un hash de
    // bytes aleatorios compare devuelve false de forma uniforme.
    expect(una).toMatch(/^\$2[aby]\$/);
    expect(dos).not.toBe(una);
    // Nadie puede autenticarse con ella: contra cualquier contraseña da false
    // (sin lanzar) — incluidas las cadenas que antes eran el valor guardado.
    expect(bcrypt.compareSync('google', una)).toBe(false);
    expect(bcrypt.compareSync('', una)).toBe(false);
  });
});
