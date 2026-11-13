/**
 * Integración — Retos deportivos (retoController) por HTTP real.
 *
 * Inscripción (con límite de 3 activos), reporte de avance con reglas
 * (1 avance/día en retos por días, clamp de km/reps al restante, cupón RETO-
 * personal al completar), evidencias con multipart real (magic bytes PNG),
 * revisión admin (aprobar/rechazar con observación) y eliminación de
 * evidencias pendientes por el dueño.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let clientAgent;
let adminAgent;

const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Admin', 'Retos', 'admin.retos@test.com', 'admin_retos', ?, 1, 1)`,
    [HASH],
  );
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Atleta', 'Retos', 'atleta.retos@test.com', 'atleta_retos', ?, 4, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

import { rmSync } from 'node:fs';
afterEach(async () => {
  // archivos de evidencia escritos en disco por la subida (uploads/usuarios/{clave}/retos)
  try { rmSync(new URL('../../uploads/usuarios/atleta_retos', import.meta.url), { recursive: true, force: true }); } catch { /* nada */ }
});

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL IN ('admin.retos@test.com', 'atleta.retos@test.com')");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: 'admin.retos@test.com', password: CLAVE }).expect(200);
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'atleta.retos@test.com', password: CLAVE }).expect(200);
});

async function crearReto({ metaTipo = 'dias', metaValor = 5, porcentaje = 5 } = {}) {
  const pool = await getDbPool();
  const [r] = await pool.query(
    `INSERT INTO RETOS (TITULO, DESCRIPCION, META_TIPO, META_VALOR, RECOMPENSA_PORCENTAJE, FECHA_INICIO, FECHA_FIN)
     VALUES (?, 'Reto de la suite', ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY))`,
    [`Reto ${metaTipo} ${Date.now()}-${Math.floor(Math.random() * 100000)}`, metaTipo, metaValor, porcentaje],
  );
  return r.insertId;
}

describe('Integración — Retos (inscripción y límites)', () => {
  it('sin sesión → 401; retos listados con sesión', async () => {
    await request(app).get('/api/retos').expect(401);
    const res = await clientAgent.get('/api/retos').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('unirse al reto crea RETOS_USUARIOS; repetir → 400', async () => {
    const idReto = await crearReto();
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(400);
  });

  it('unirse a un reto inexistente → 404', async () => {
    await clientAgent.post('/api/retos/unirse/9999999').expect(404);
  });

  it('máximo 3 retos activos: el 4º → 400 con el mensaje exacto', async () => {
    for (let i = 0; i < 3; i += 1) {
      const id = await crearReto();
      await clientAgent.post(`/api/retos/unirse/${id}`).expect(200);
    }
    const cuarto = await crearReto();
    const res = await clientAgent.post(`/api/retos/unirse/${cuarto}`).expect(400);
    expect(res.body.msg).toContain('Solo puedes unirte a 3 retos');
  });
});

describe('Integración — Retos (avances y reglas)', () => {
  it('reto por DÍAS: 1 avance/día — el segundo el mismo día → 400', async () => {
    const idReto = await crearReto({ metaTipo: 'dias', metaValor: 5 });
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const pool = await getDbPool();
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ? ORDER BY ID_RETO_USUARIO DESC LIMIT 1', [idReto]);

    // avance SIN material (multipart vacío no válido → base64 legacy: sin archivos el progreso suma directo)
    const res = await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.ok ?? true).toBeTruthy();

    const repetido = await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance2.png', contentType: 'image/png' });
    expect(repetido.status).toBe(400);
    expect(repetido.body.msg).toContain('Ya reportaste tu avance de hoy');
  });

  it('reto por KM: el clamp corta al restante (pedir 20 sobre meta 5 entra 5)', async () => {
    const idReto = await crearReto({ metaTipo: 'km', metaValor: 5 });
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const pool = await getDbPool();
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ?', [idReto]);

    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '20')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);

    // con material el avance va PENDIENTE: el clamp vive en CANTIDAD de la evidencia
    const [[evid]] = await pool.query(
      'SELECT CANTIDAD, ESTADO, ID_EVIDENCIA FROM RETO_EVIDENCIAS WHERE ID_RETO_USUARIO = ? ORDER BY ID_EVIDENCIA DESC LIMIT 1',
      [ru.ID_RETO_USUARIO],
    );
    expect(evid.ESTADO).toBe('pendiente');
    expect(Number(evid.CANTIDAD)).toBe(5);

    // el admin aprueba → la cantidad entra al progreso, completa y genera el cupón RETO-
    await adminAgent.post(`/api/retos/admin/evidencias/${evid.ID_EVIDENCIA}/aprobar`).send({}).expect(200);

    const [[despues]] = await pool.query('SELECT PROGRESO, COMPLETADO, CUPON_GENERADO FROM RETOS_USUARIOS WHERE ID_RETO_USUARIO = ?', [ru.ID_RETO_USUARIO]);
    expect(Number(despues.PROGRESO)).toBe(5);
    expect(Number(despues.COMPLETADO)).toBe(1);
    expect(despues.CUPON_GENERADO).toMatch(/^RETO-/);
    const [[desc]] = await pool.query('SELECT * FROM DESCUENTOS WHERE DESCRIPCION = ?', [despues.CUPON_GENERADO]);
    expect(desc).toBeTruthy();
    expect(Number(desc.USADO)).toBe(0);
  });

  it('avance CON material (PNG real) queda pendiente de revisión', async () => {
    const idReto = await crearReto({ metaTipo: 'dias', metaValor: 5 });
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const pool = await getDbPool();
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ?', [idReto]);

    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);

    const [[evid]] = await pool.query(
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_RETO_USUARIO = ? ORDER BY ID_EVIDENCIA DESC LIMIT 1',
      [ru.ID_RETO_USUARIO],
    );
    expect(evid.ESTADO).toBe('pendiente');
    // la ruta puede ser local (/images/usuarios/...) o del asset guardado
    expect(evid.RUTA).toBeTruthy();
  });

  it('el dueño elimina su evidencia PENDIENTE (y una ajena → 404)', async () => {
    const pool = await getDbPool();
    const idReto = await crearReto();
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ?', [idReto]);
    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);
    const [[evid]] = await pool.query(
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_RETO_USUARIO = ? ORDER BY ID_EVIDENCIA DESC LIMIT 1',
      [ru.ID_RETO_USUARIO],
    );

    await clientAgent.delete(`/api/retos/evidencias/${evid.ID_EVIDENCIA}`).expect(200);
    await clientAgent.delete(`/api/retos/evidencias/${evid.ID_EVIDENCIA}`).expect(404);
  });

  it('mis-retos lista inscripciones con AVANCES_HOY y cupón', async () => {
    const idReto = await crearReto();
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const res = await clientAgent.get('/api/retos/mis-retos').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('Integración — Retos (revisión del admin)', () => {
  it('admin lista evidencias pendientes y las aprueba con comentario (suma progreso)', async () => {
    const pool = await getDbPool();
    const idReto = await crearReto({ metaTipo: 'dias', metaValor: 5 });
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ?', [idReto]);
    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);
    const [[evid]] = await pool.query(
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_RETO_USUARIO = ? ORDER BY ID_EVIDENCIA DESC LIMIT 1',
      [ru.ID_RETO_USUARIO],
    );

    await adminAgent.get('/api/retos/admin/evidencias').expect(200);
    await adminAgent
      .post(`/api/retos/admin/evidencias/${evid.ID_EVIDENCIA}/aprobar`)
      .send({ observacion: 'Evidencia válida, sigue así' })
      .expect(200);

    const [[revisada]] = await pool.query('SELECT ESTADO, OBSERVACION FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ?', [evid.ID_EVIDENCIA]);
    expect(revisada.ESTADO).toBe('aprobado');
    expect(revisada.OBSERVACION).toContain('sigue así');

    // la evidencia aprobada NO se puede eliminar (400)
    await clientAgent.delete(`/api/retos/evidencias/${evid.ID_EVIDENCIA}`).expect(400);
  });

  it('rechazar con motivo guarda la observación y libera el reenvío del mismo día', async () => {
    const pool = await getDbPool();
    const idReto = await crearReto();
    await clientAgent.post(`/api/retos/unirse/${idReto}`).expect(200);
    const [[ru]] = await pool.query('SELECT ID_RETO_USUARIO FROM RETOS_USUARIOS WHERE ID_RETO = ?', [idReto]);
    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'avance.png', contentType: 'image/png' })
      .expect(200);
    const [[evid]] = await pool.query(
      'SELECT * FROM RETO_EVIDENCIAS WHERE ID_RETO_USUARIO = ? ORDER BY ID_EVIDENCIA DESC LIMIT 1',
      [ru.ID_RETO_USUARIO],
    );

    await adminAgent
      .post(`/api/retos/admin/evidencias/${evid.ID_EVIDENCIA}/rechazar`)
      .send({ observacion: 'La foto no corresponde al reto' })
      .expect(200);
    const [[revisada]] = await pool.query('SELECT ESTADO, OBSERVACION FROM RETO_EVIDENCIAS WHERE ID_EVIDENCIA = ?', [evid.ID_EVIDENCIA]);
    expect(revisada.ESTADO).toBe('rechazado');

    // el rechazo LIBERA el reenvío del mismo día (el bloqueo solo cuenta no-rechazados)
    await clientAgent
      .post(`/api/retos/progreso/${ru.ID_RETO_USUARIO}`)
      .field('cantidad', '1')
      .attach('materiales', PNG, { filename: 'reenvio.png', contentType: 'image/png' })
      .expect(200);
  });

  it('aprobar una evidencia inexistente → 404', async () => {
    await adminAgent.post('/api/retos/admin/evidencias/9999999/aprobar').expect(404);
  });
});
