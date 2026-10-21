/*
 * Pruebas unitarias del registro de peticiones (middlewares/registroPeticiones.js).
 * El middleware es puro (req/res de mentira, sin montar Express). Solo se
 * captura console.log bindeando 'finish' a mano.
 */

const { EventEmitter } = require('events');
const { registrarPeticion, PATRON_ID } = require('./registroPeticiones');

function reqFalso({ method = 'GET', id, originalUrl = '/api/productos?limit=5', ip = '10.0.0.1' } = {}) {
  const headers = {};
  if (id !== undefined) headers['x-request-id'] = id;
  return { method, headers, originalUrl, ip };
}

function resFalso(statusCode = 200) {
  // res real emite 'finish' — el falso también para reproducirlo tras correr el middleware
  const res = new EventEmitter();
  res.statusCode = statusCode;
  res.cabeceras = {};
  res.setHeader = (k, v) => { res.cabeceras[String(k).toLowerCase()] = v; };
  return res;
}

function correr(req) {
  const res = resFalso();
  let nextLlamado = false;
  registrarPeticion(req, res, () => { nextLlamado = true; });
  return { req, res, nextLlamado };
}

function conLogCapturado(trabajo) {
  const lineas = [];
  const original = console.log;
  console.log = (...partes) => lineas.push(partes.join(' '));
  try {
    trabajo();
  } finally {
    console.log = original;
  }
  return lineas;
}

describe('registroPeticiones', () => {
  test('Sin cabecera x-request-id genera un id propio y lo devuelve en la respuesta', () => {
    const { req, res, nextLlamado } = correr(reqFalso());
    expect(nextLlamado).toBe(true);
    expect(req.id).toMatch(/^[a-f0-9]{12}$/);
    expect(res.cabeceras['x-request-id']).toBe(req.id);
  });

  test('Una cabecera válida del proxy se reutiliza tal cual', () => {
    const { req, res } = correr(reqFalso({ id: 'prueba-abc-123' }));
    expect(req.id).toBe('prueba-abc-123');
    expect(res.cabeceras['x-request-id']).toBe('prueba-abc-123');
  });

  test('Una cabecera inválida NO se refleja: se genera un id propio', () => {
    const { req, res } = correr(reqFalso({ id: '<script>alert(1)</script>' }));
    expect(req.id).not.toBe('<script>alert(1)</script>');
    expect(req.id).toMatch(PATRON_ID);
    expect(res.cabeceras['x-request-id']).toBe(req.id);
  });

  test('Al terminar emite UNA línea JSON con metodo, ruta sin query, status y duración', () => {
    const lineas = conLogCapturado(() => {
      const { res } = correr(reqFalso({ method: 'POST', originalUrl: '/api/checkout/procesar?cupon=JADDA10' }));
      res.statusCode = 200;
      res.emit('finish');
    });
    expect(lineas).toHaveLength(1);
    const registro = JSON.parse(lineas[0]);
    expect(registro.nivel).toBe('http');
    expect(registro.metodo).toBe('POST');
    expect(registro.ruta).toBe('/api/checkout/procesar'); // query fuera
    expect(registro.status).toBe(200);
    expect(typeof registro.ms).toBe('number');
    expect(typeof registro.req).toBe('string');
    expect(typeof registro.t).toBe('string');
  });

  test('El log no contiene datos personales (ni IP ni query ni cuerpo)', () => {
    const lineas = conLogCapturado(() => {
      const { res } = correr(reqFalso({ ip: '192.168.99.99', originalUrl: '/api/chats?chat=7' }));
      res.emit('finish');
    });
    const linea = lineas.join(' ');
    expect(linea).not.toContain('192.168.99.99');
    expect(linea).not.toContain('chat=7');
  });
});
