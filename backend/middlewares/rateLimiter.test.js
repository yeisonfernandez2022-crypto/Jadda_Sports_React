/*
 * Pruebas unitarias del limitador (middlewares/rateLimiter.js).
 * Por defecto la factory se DESACTIVA bajo test (NODE_ENV=test); los casos
 * pasan `respetarDesactivado: false` para poder ejercitarla con req/res falsos.
 * Cada caso usa IPs distintas porque el Map de intentos es global al módulo.
 */

const rateLimit = require('./rateLimiter');

function reqFalso(ip, path) {
  return { ip, path, socket: { remoteAddress: ip } };
}

function resFalso() {
  const res = {
    statusCode: 0,
    cuerpo: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.cuerpo = payload;
      return this;
    },
  };
  return res;
}

function golpear(limite, ip, path) {
  const res = resFalso();
  let paso = false;
  limite(reqFalso(ip, path), res, () => { paso = true; });
  return { res, paso };
}

describe('rateLimiter — límite global por IP (fase 3)', () => {
  test('totalPorIp acumula TODAS las rutas del mismo IP y responde 429 al superar el tope', () => {
    const limite = rateLimit({
      ventanaMs: 60 * 1000,
      max: 3,
      totalPorIp: true,
      respetarDesactivado: false,
      mensaje: 'Demasiadas peticiones. Espera un momento e intenta de nuevo', // el del límite global de server.js
    });

    expect(golpear(limite, '10.9.0.1', '/api/productos').paso).toBe(true);
    expect(golpear(limite, '10.9.0.1', '/api/productos/categorias').paso).toBe(true);
    expect(golpear(limite, '10.9.0.1', '/api/auth/login').paso).toBe(true);

    const cuarta = golpear(limite, '10.9.0.1', '/api/productos');
    expect(cuarta.paso).toBe(false);
    expect(cuarta.res.statusCode).toBe(429);
    expect(cuarta.res.cuerpo).toEqual({ ok: false, msg: 'Demasiadas peticiones. Espera un momento e intenta de nuevo' });
  });

  test('totalPorIp: otro IP tiene su propio cubo', () => {
    const limite = rateLimit({ ventanaMs: 60 * 1000, max: 3, totalPorIp: true, respetarDesactivado: false });
    // 10.9.0.1 ya llegó a su tope en el caso anterior
    expect(golpear(limite, '10.9.0.2', '/api/productos').paso).toBe(true);
  });

  test('sin totalPorIp, cada ruta mantiene su contador propio (comportamiento previo intacto)', () => {
    const limite = rateLimit({ ventanaMs: 60 * 1000, max: 2, respetarDesactivado: false });
    expect(golpear(limite, '10.9.0.3', '/api/auth/login').paso).toBe(true);
    expect(golpear(limite, '10.9.0.3', '/api/auth/login').paso).toBe(true);
    expect(golpear(limite, '10.9.0.3', '/api/auth/login').paso).toBe(false);
    // Otra ruta del mismo IP NO comparte el contador
    expect(golpear(limite, '10.9.0.3', '/api/contacto').paso).toBe(true);
  });

  test('esExenta deja pasar sin contar (sonda /health, estáticos /images)', () => {
    const limite = rateLimit({
      ventanaMs: 60 * 1000,
      max: 1,
      totalPorIp: true,
      respetarDesactivado: false,
      esExenta: (req) => req.path === '/health' || String(req.path).startsWith('/images/'),
    });
    // Exentas: nunca cuentan aunque se repitan
    for (let i = 0; i < 5; i++) {
      expect(golpear(limite, '10.9.0.4', '/health').paso).toBe(true);
      expect(golpear(limite, '10.9.0.4', '/images/productos/Producto_01/img_1.jpg').paso).toBe(true);
    }
    // La única petición contable del IP aún está en su tope
    expect(golpear(limite, '10.9.0.4', '/api/productos').paso).toBe(true);
    // La segunda contable cae, y las exentas SIGUEN pasando en medio del 429
    const bloqueada = golpear(limite, '10.9.0.4', '/api/productos');
    expect(bloqueada.res.statusCode).toBe(429);
    expect(golpear(limite, '10.9.0.4', '/health').paso).toBe(true);
  });

  test('respetarDesactivado=true (default) mantiene el modo test desactivado', () => {
    const limite = rateLimit({ max: 0, respetarDesactivado: true });
    const r = golpear(limite, '10.9.0.5', '/api/productos');
    expect(r.paso).toBe(true);
    expect(r.res.statusCode).toBe(0); // nunca entró a status()
  });
});
