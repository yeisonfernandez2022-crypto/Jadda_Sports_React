/**
 * rateLimiter — casos residuales de la suite base (rateLimiter.test.js),
 * suite NUEVA (la base no se edita). Cubre: la factory SIN argumentos
 * (evalúa TODOS los defaults — pin: max por defecto = 10), la rama del
 * guard de desactivado con el módulo "encendido" (production), los
 * fallbacks de la clave del cubo (usuario SIN IDs, sin req.ip → socket,
 * sin socket → "desconocida"), la expiración de la ventana (reset del
 * contador) y la limpieza periódica del Map (callback del setInterval,
 * capturado ANTES del require para NO registrar handles reales en el
 * worker). El módulo congela sus constantes en el require → se requiere
 * con NODE_ENV=production y se restaura el entorno inmediatamente después.
 * Cada caso usa claves (IP/usuario/ruta) distintas: el Map de intentos es
 * global al módulo y persiste entre tests.
 */

const { vi, beforeEach, afterEach, describe, test, expect } = globalThis;

const NODE_ENV_BASE = process.env.NODE_ENV;
process.env.NODE_ENV = 'production'; // el módulo se "enciende" al requerirse
// capturar el setInterval de la limpieza → el worker no queda con handles
const setIntervalReal = globalThis.setInterval;
const limpiezas = [];
globalThis.setInterval = (fn, ms) => { limpiezas.push({ fn, ms }); return 0; };
const rateLimit = require('../../../backend/middlewares/rateLimiter');
globalThis.setInterval = setIntervalReal;
process.env.NODE_ENV = NODE_ENV_BASE;

function reqFalso(ip, path) {
  return { ip, path, socket: { remoteAddress: ip } };
}

function resFalso() {
  const res = {
    statusCode: 0,
    cuerpo: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.cuerpo = payload; return this; },
  };
  return res;
}

function golpearCon(req, limite) {
  const res = resFalso();
  let paso = false;
  limite(req, res, () => { paso = true; });
  return { res, paso };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rateLimiter — defaults y claves residuales', () => {
  test('factory sin argumentos: tope por defecto 10 (11º golpe → 429 con el mensaje genérico)', () => {
    // sin argumentos se evalúan los defaults: ventanaMs 15 min, max 10,
    // mensaje genérico, esExenta null y respetarDesactivado true
    const limite = rateLimit();
    for (let i = 0; i < 10; i++) {
      expect(golpearCon(reqFalso('10.50.0.1', '/api/limite'), limite).paso).toBe(true);
    }
    const undecimo = golpearCon(reqFalso('10.50.0.1', '/api/limite'), limite);
    expect(undecimo.paso).toBe(false);
    expect(undecimo.res.statusCode).toBe(429);
    expect(undecimo.res.cuerpo).toEqual({ ok: false, msg: 'Demasiados intentos. Intenta de nuevo más tarde' });
    // otra IP conserva su tope completo
    expect(golpearCon(reqFalso('10.50.0.2', '/api/limite'), limite).paso).toBe(true);
  });

  test('usuario SIN IDs cae a la clave por IP; sin req.ip usa el socket; sin nada es "desconocida"', () => {
    const limite = rateLimit({ ventanaMs: 60 * 1000, max: 1, respetarDesactivado: false });
    // user presente pero sin ID_USUARIO/id → NO usa la clave de usuario
    const sinIds = { path: '/x', user: { NOMBRE: 'n' }, ip: '10.60.0.1', socket: { remoteAddress: '10.60.0.1' } };
    expect(golpearCon(sinIds, limite).paso).toBe(true);
    expect(golpearCon(sinIds, limite).paso).toBe(false); // mismo cubo por IP → 429
    // sin req.ip pero CON socket → remoteAddress como clave
    expect(golpearCon({ path: '/y', socket: { remoteAddress: '10.60.0.2' } }, limite).paso).toBe(true);
    // socket sin remoteAddress → 'desconocida'
    expect(golpearCon({ path: '/z', socket: {} }, limite).paso).toBe(true);
    // sin ip ni socket → el mismo cubo 'desconocida'
    expect(golpearCon({ path: '/z' }, limite).paso).toBe(false);
  });

  test('la ventana vence: el contador del cubo reinicia y vuelve a pasar', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const limite = rateLimit({ ventanaMs: 60 * 1000, max: 1, respetarDesactivado: false });
    expect(golpearCon(reqFalso('10.70.0.1', '/w'), limite).paso).toBe(true);
    expect(golpearCon(reqFalso('10.70.0.1', '/w'), limite).paso).toBe(false); // dentro de la ventana
    vi.setSystemTime(new Date(Date.now() + 61 * 1000)); // venció la ventana
    expect(golpearCon(reqFalso('10.70.0.1', '/w'), limite).paso).toBe(true); // contador en 0 otra vez
    expect(golpearCon(reqFalso('10.70.0.1', '/w'), limite).paso).toBe(false);
  });

  test('la limpieza periódica borra las claves vencidas y conserva las vigentes', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const limite = rateLimit({ ventanaMs: 60 * 1000, max: 1, respetarDesactivado: false });
    expect(limpiezas.length).toBeGreaterThan(0);
    const limpieza = limpiezas[limpiezas.length - 1];
    expect(limpieza.ms).toBe(5 * 60 * 1000); // la limpieza corre cada 5 minutos
    expect(golpearCon(reqFalso('10.80.0.1', '/w'), limite).paso).toBe(true); // vence en t0+60s
    vi.setSystemTime(new Date(Date.now() + 61 * 1000)); // ahora esa clave está vencida
    limpieza.fn(); // la borra del Map
    expect(golpearCon(reqFalso('10.80.0.1', '/w'), limite).paso).toBe(true); // cubo fresco
    // una clave VIGENTE (creada recién) no se borra en la misma pasada
    expect(golpearCon(reqFalso('10.80.0.2', '/w'), limite).paso).toBe(true);
    limpieza.fn(); // su expiraEn aún está en el futuro → se conserva
    expect(golpearCon(reqFalso('10.80.0.2', '/w'), limite).paso).toBe(false); // sigue contando
  });
});
