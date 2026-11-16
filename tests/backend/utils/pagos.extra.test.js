/**
 * pagos.js (utils) — fns de RED que la suite base (tests/backend/utils/
 * pagos.test.js) no cubre: fetchWompi (reintentos ante caída de red),
 * obtenerTransaccionWompi (auth con llave pública, !ok → null, catch → null),
 * buscarTransaccionesPorReferencia (auth con llave PRIVADA, data no-array),
 * urlCheckoutWompi sin llaves (error PAGOS_CONFIG) y bordes residuales de
 * fechaSimulacionDeReferencia, vencimientoValido, validarPasarelaProduccion,
 * resolverRutaEvento y verificarEventosWompi. Suite NUEVA: la base no se edita.
 * El fetch global se stubbea; el env con vi.stubEnv (se restaura en afterEach).
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const respuestaJson = (cuerpo, ok = true) => ({
  ok,
  status: ok ? 200 : 500,
  json: async () => cuerpo,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WOMPI_PUBLIC_KEY', 'pub_test_key');
  vi.stubEnv('WOMPI_PRIVATE_KEY', 'prv_test_key');
  vi.stubEnv('WOMPI_INTEGRITY_KEY', 'int_test_key');
  vi.stubEnv('WOMPI_EVENTS_SECRET', 'sec_events');
  vi.stubEnv('PAYMENT_GATEWAY', 'wompi');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('obtenerTransaccionWompi (GET /v1/transactions/{id})', () => {
  test('auth con la llave PÚBLICA y devuelve json.data', async () => {
    const fetchFalso = vi.fn(async () => respuestaJson({ data: { id: 'tx-1', status: 'APPROVED' } }));
    vi.stubGlobal('fetch', fetchFalso);
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.obtenerTransaccionWompi('tx 1/raro');
    expect(r).toEqual({ id: 'tx-1', status: 'APPROVED' });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opciones] = fetchFalso.mock.calls[0];
    expect(url).toBe('https://sandbox.wompi.co/v1/transactions/tx%201%2Fraro');
    expect(opciones.headers.Authorization).toBe('Bearer pub_test_key');
  });

  test('producción (llave sin pub_test_) → base production.wompi.co', async () => {
    vi.stubEnv('WOMPI_PUBLIC_KEY', 'pub_prod_real');
    const fetchFalso = vi.fn(async () => respuestaJson({ data: null }));
    vi.stubGlobal('fetch', fetchFalso);
    const pagos = require('../../../backend/utils/pagos');
    await pagos.obtenerTransaccionWompi('tx-2');
    expect(fetchFalso.mock.calls[0][0]).toContain('https://production.wompi.co/v1/transactions/');
  });

  test('HTTP de error de la pasarela → null SIN reintentos (1 sola llamada)', async () => {
    const fetchFalso = vi.fn(async () => respuestaJson({}, false));
    vi.stubGlobal('fetch', fetchFalso);
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.obtenerTransaccionWompi('tx-3');
    expect(r).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });

  test('red caída → reintenta 3 veces (~1.2s entre intentos) y al final devuelve null', async () => {
    const fetchFalso = vi.fn(async () => { throw new Error('ECONNRESET'); });
    vi.stubGlobal('fetch', fetchFalso);
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.obtenerTransaccionWompi('tx-4');
    expect(r).toBeNull();
    expect(fetchFalso).toHaveBeenCalledTimes(3);
  }, 15000);
});

describe('buscarTransaccionesPorReferencia (GET /v1/transactions?reference=)', () => {
  test('auth con la llave PRIVADA y devuelve el array de data', async () => {
    const fetchFalso = vi.fn(async () => respuestaJson({ data: [{ id: 'tx-5' }] }));
    vi.stubGlobal('fetch', fetchFalso);
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.buscarTransaccionesPorReferencia('JADDA-15-x');
    expect(r).toEqual([{ id: 'tx-5' }]);
    expect(fetchFalso.mock.calls[0][0]).toContain('reference=JADDA-15-x');
    expect(fetchFalso.mock.calls[0][1].headers.Authorization).toBe('Bearer prv_test_key');
  });

  test('data NO es array → []', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaJson({ data: { raro: true } })));
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.buscarTransaccionesPorReferencia('JADDA-15-x');
    expect(r).toEqual([]);
  });

  test('HTTP de error → []', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuestaJson({}, false)));
    const pagos = require('../../../backend/utils/pagos');
    const r = await pagos.buscarTransaccionesPorReferencia('JADDA-15-x');
    expect(r).toEqual([]);
  });
});

describe('urlCheckoutWompi — configuración incompleta', () => {
  test('sin llaves → throw con codigo PAGOS_CONFIG (el controller lo traduce a 500 amable)', () => {
    vi.stubEnv('WOMPI_PUBLIC_KEY', '');
    vi.stubEnv('WOMPI_PRIVATE_KEY', '');
    vi.stubEnv('WOMPI_INTEGRITY_KEY', '');
    const pagos = require('../../../backend/utils/pagos');
    let error = null;
    try {
      pagos.urlCheckoutWompi({ referencia: 'JADDA-15-x', centavos: 12000000, correo: 'a@t.co' });
    } catch (e) {
      error = e;
    }
    expect(error).toBeTruthy();
    expect(error.codigo).toBe('PAGOS_CONFIG');
    expect(error.message).toContain('WOMPI_PUBLIC_KEY');
  });
});

describe('bordes residuales de helpers', () => {
  test('fechaSimulacionDeReferencia: marca minúscula de 1970 y marca FUTURA → null', () => {
    const pagos = require('../../../backend/utils/pagos');
    expect(pagos.fechaSimulacionDeReferencia(`SIMW-15-${(0).toString(36)}abcd`)).toBeNull(); // ms < mínimo 2023
    const futura = Date.now() + 60 * 60 * 1000; // > now + 300000 → descartada
    expect(pagos.fechaSimulacionDeReferencia(`SIMW-15-${futura.toString(36)}abcd`)).toBeNull();
  });

  test('vencimientoValido: mes 13 y año fuera de rango → false', () => {
    const pagos = require('../../../backend/utils/pagos');
    expect(pagos.vencimientoValido('13/30')).toBe(false);
    expect(pagos.vencimientoValido('12/1899')).toBe(false);
    expect(pagos.vencimientoValido('12/2199')).toBe(false);
  });

  test('validarPasarelaProduccion: NODE_ENV ausente → ok sin aviso (cero impacto)', () => {
    const pagos = require('../../../backend/utils/pagos');
    expect(pagos.validarPasarelaProduccion({ NODE_ENV: undefined })).toEqual({ ok: true });
  });

  test('resolverRutaEvento: ruta que atraviesa null → ""', () => {
    const pagos = require('../../../backend/utils/pagos');
    expect(pagos.resolverRutaEvento({ a: null }, 'a.b.c')).toBe('');
    expect(pagos.resolverRutaEvento(null, 'a.b')).toBe('');
  });

  test('verificarEventosWompi: sin checksum, sin timestamp o sin secreto de eventos → false', () => {
    const pagos = require('../../../backend/utils/pagos');
    const cuerpo = {
      data: { transaction: { id: 'tx-9', status: 'APPROVED', amount_in_cents: 1, reference: 'r' } },
      signature: { properties: ['transaction.id'], checksum: '', timestamp: 1 },
    };
    expect(pagos.verificarEventosWompi(cuerpo, 'chk')).toBe(false); // checksum ausente en ambos lados
    expect(pagos.verificarEventosWompi({ ...cuerpo, signature: { properties: ['transaction.id'], checksum: 'chk' } }, 'chk')).toBe(false); // timestamp undefined
    vi.stubEnv('WOMPI_EVENTS_SECRET', '');
    expect(pagos.verificarEventosWompi({ ...cuerpo, signature: { properties: ['transaction.id'], checksum: 'chk', timestamp: 1 } }, 'chk')).toBe(false); // secreto vacío
  });

  test('valores AUSENTES de las propiedades caen al cuerpo completo (fallback resolverRutaEvento)', () => {
    vi.stubEnv('WOMPI_EVENTS_SECRET', 'sec_events');
    const pagos = require('../../../backend/utils/pagos');
    const cuerpo = {
      // la propiedad "transaction.inexistente" no existe en data.transaction
      // ("" en data) → se resuelve contra el CUERPO completo, tampoco existe → ""
      data: { transaction: { id: 'tx-9' } },
      signature: { properties: ['transaction.inexistente'], checksum: 'chk', timestamp: 1 },
    };
    expect(pagos.verificarEventosWompi(cuerpo, 'chk')).toBe(false); // no lanza: falsy controlado
  });
});
