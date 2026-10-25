/**
 * P7 — Newsletter persistida en MySQL (tablas NEWSLETTER_SUSCRIPTOS y
 * NEWSLETTER_ENVIOS creadas por setup.js/MIGRACIONES). Se inyecta una BD
 * falsa con exports._useDb para probar cada flujo sin tirar contra MySQL.
 */
const SUT = require('../../controllers/newsletterController');

/**
 * BD falsa con enrutamiento por palabras clave de las consultas del
 * controller; cada método graba qué SQL/params se ejecutaron.
 */
const construirDb = (opciones = {}) => {
  const db = { operaciones: [] };
  db.query = vi.fn(async (sql) => {
    const s = sql.replace(/\s+/g, ' ');
    db.operaciones.push(s);
    if (s.includes('SELECT ACTIVO FROM NEWSLETTER_SUSCRIPTOS')) {
      return [opciones.existentes || []];
    }
    if (s.includes('SELECT EMAIL, FECHA_SUSCRIPCION FROM NEWSLETTER_SUSCRIPTOS')) {
      return [opciones.suscritos || []];
    }
    if (s.includes('SELECT ENVIADOS, FALLIDOS, TEMA, FECHA_ENVIO FROM NEWSLETTER_ENVIOS')) {
      return [opciones.ultimoLote ? [opciones.ultimoLote] : []];
    }
    if (s.includes('SELECT COALESCE(SUM(ENVIADOS)')) {
      return [[{ TOTAL: opciones.totalEnviados ?? 0 }]];
    }
    return [{}]; // INSERT / UPDATE normales
  });
  return db;
};

const resFalsa = () => {
  const res = {};
  res.status = (codigo) => { res.codigo = codigo; return res; };
  res.json = (cuerpo) => { res.cuerpo = cuerpo; return res; };
  return res;
};

describe('newsletter — suscripción en MySQL', () => {
  it('rechaza un correo mal formado sin tocar la BD', async () => {
    const db = construirDb();
    SUT._useDb(db);
    const res = resFalsa();
    await SUT.suscribirNewsletter({ body: { email: 'no-s-es-correo' } }, res);
    expect(res.codigo).toBe(400);
    expect(res.cuerpo.msg).toMatch(/Correo inválido/);
    expect(db.operaciones.length).toBe(0);
  });

  it('si ya está activo responde "Ya estás suscrito" y NO reintenta el insert', async () => {
    const db = construirDb({ existentes: [{ ACTIVO: 1 }] });
    SUT._useDb(db);
    const res = resFalsa();
    await SUT.suscribirNewsletter({ body: { email: 'alguien@jadda.test' } }, res);
    expect(res.codigo).toBe(200);
    expect(res.cuerpo.msg).toMatch(/Ya estás suscrito/);
    expect(db.operaciones.filter((o) => o.startsWith('INSERT')).length).toBe(0);
  });

  it('correo nuevo → INSERT con email normalizado y respuesta 201', async () => {
    const db = construirDb();
    SUT._useDb(db);
    let capturado = null;
    db.query = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.includes('SELECT ACTIVO FROM NEWSLETTER_SUSCRIPTOS')) return [[]];
      if (s.startsWith('INSERT INTO NEWSLETTER_SUSCRIPTOS')) capturado = params;
      return [{ affectedRows: 1 }];
    });
    const res = resFalsa();
    await SUT.suscribirNewsletter({ body: { email: '  NUEVO@Jadda.TEST ' } }, res);
    expect(res.codigo).toBe(201);
    expect(capturado).toEqual(['nuevo@jadda.test']);
  });

  it('reactiva un suscriptor dado de baja (INSERT ON DUPLICATE KEY UPDATE ACTIVO=1)', async () => {
    const db = construirDb({ existentes: [{ ACTIVO: 0 }] });
    SUT._useDb(db);
    let insertada = false;
    db.query = vi.fn(async (sql) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.includes('SELECT ACTIVO FROM NEWSLETTER_SUSCRIPTOS')) return [[{ ACTIVO: 0 }]];
      if (s.startsWith('INSERT INTO NEWSLETTER_SUSCRIPTOS')) insertada = true;
      return [{ affectedRows: 2 }];
    });
    const res = resFalsa();
    await SUT.suscribirNewsletter({ body: { email: 'reactivado@jadda.test' } }, res);
    expect(insertada).toBe(true);
    expect(res.codigo).toBe(201);
  });

  it('desuscribir hace UPDATE ACTIVO=0 (nunca DELETE: se conserva la historia)', async () => {
    const db = construirDb();
    SUT._useDb(db);
    let capturado = null;
    db.query = vi.fn(async (sql, params) => {
      const s = sql.replace(/\s+/g, ' ');
      db.operaciones.push(s);
      if (s.startsWith('UPDATE NEWSLETTER_SUSCRIPTOS')) capturado = params;
      return [{}];
    });
    const res = resFalsa();
    await SUT.desuscribirNewsletter({ body: { email: 'frecuente@jadda.test' } }, res);
    expect(res.codigo).toBe(200);
    expect(capturado).toEqual(['frecuente@jadda.test']);
    expect(db.operaciones.filter((o) => o.startsWith('DELETE')).length).toBe(0);
  });

  it('desuscribir sin email → 400', async () => {
    SUT._useDb(construirDb());
    const res = resFalsa();
    await SUT.desuscribirNewsletter({ body: {} }, res);
    expect(res.codigo).toBe(400);
  });
});

describe('newsletter — lista y estado desde NEWSLETTER_*', () => {
  it('obtenerSuscritos mapea filas a {email, fecha} y expone el estado del último lote', async () => {
    const db = construirDb({
      suscritos: [
        { EMAIL: 'a@jadda.test', FECHA_SUSCRIPCION: '2026-10-20 10:00:00' },
        { EMAIL: 'b@jadda.test', FECHA_SUSCRIPCION: '2026-10-21 11:30:00' },
      ],
      ultimoLote: { ENVIADOS: 12, FALLIDOS: 1, TEMA: '🔥 ¡Ofertas que no te puedes perder!', FECHA_ENVIO: '2026-10-25 09:00:00' },
      totalEnviados: 57,
    });
    SUT._useDb(db);
    const res = resFalsa();
    await SUT.obtenerSuscritos({}, res);
    expect(res.cuerpo.ok).toBe(true);
    expect(res.cuerpo.total).toBe(2);
    expect(res.cuerpo.lista).toEqual([
      { email: 'a@jadda.test', fecha: '2026-10-20 10:00:00' },
      { email: 'b@jadda.test', fecha: '2026-10-21 11:30:00' },
    ]);
    expect(res.cuerpo.estado.ultimoEnvio).toBe('2026-10-25 09:00:00');
    expect(res.cuerpo.estado.totalEnviados).toBe(57);
    expect(res.cuerpo.estado.fallidos).toBe(1);
    expect(res.cuerpo.estado.tema).toMatch(/Ofertas/);
  });

  it('sin lotes previos, el estado queda vacío sin romper', async () => {
    const db = construirDb({ suscritos: [] });
    SUT._useDb(db);
    const res = resFalsa();
    await SUT.obtenerSuscritos({}, res);
    expect(res.cuerpo.estado.ultimoEnvio).toBe(null);
    expect(res.cuerpo.estado.totalEnviados).toBe(0);
  });

  it('enviarNewsletterAhora sin suscritos sale temprano y NO registra lote', async () => {
    const db = construirDb({ suscritos: [] });
    SUT._useDb(db);
    const resultado = await SUT.enviarNewsletterAhora();
    expect(resultado.ok).toBe(true);
    expect(resultado.enviados).toBe(0);
    expect(db.operaciones.filter((o) => o.startsWith('INSERT INTO NEWSLETTER_ENVIOS')).length).toBe(0);
  });
});
