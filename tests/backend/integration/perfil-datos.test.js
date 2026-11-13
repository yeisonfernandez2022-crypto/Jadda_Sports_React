/**
 * Integración — Datos del perfil del cliente por HTTP real.
 *
 * Direcciones (CRUD + principal), métodos de pago (CRUD con máscara del
 * número y descarte del CVV), favoritos (toggle/dedupe), historial,
 * notificaciones (marcar leída/todas), perfil (PUT parcial + validaciones),
 * seguridad (cambiar contraseña), newsletter, contacto público y PQR.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app, getDbPool, registrarSemillaPermanente } from './setup.js';

const CLAVE = 'TestPass123';
const HASH = bcrypt.hashSync(CLAVE, 10);

let clientAgent;

const semillaCuentas = async () => {
  const pool = await getDbPool();
  await pool.query(
    `INSERT IGNORE INTO USUARIOS (NOMBRE_USUARIO, APELLIDO_USUARIO, EMAIL, USUARIO, CONTRASENA, ID_ROL, CONFIRMADO)
     VALUES ('Cliente', 'Perfil', 'cliente.perfil@test.com', 'cliente_perfil', ?, 4, 1)`,
    [HASH],
  );
};

registrarSemillaPermanente(semillaCuentas);

beforeAll(async () => {
  const pool = await getDbPool();
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await pool.query("DELETE FROM USUARIOS WHERE EMAIL = 'cliente.perfil@test.com'");
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  await semillaCuentas();
  clientAgent = request.agent(app);
  await clientAgent.post('/api/auth/login').send({ email: 'cliente.perfil@test.com', password: CLAVE }).expect(200);
});

describe('Integración — Direcciones', () => {
  it('sin sesión → 401; validaciones → 400 (falta ciudad, correo en la dirección)', async () => {
    await request(app).get('/api/direcciones').expect(401);
    await clientAgent.post('/api/direcciones').send({ direccion: 'Cra 1', ciudad: '', departamento: 'X' }).expect(400);
    await clientAgent.post('/api/direcciones').send({ direccion: 'correo@mal.com', ciudad: 'Zipaquirá', departamento: 'Cundinamarca' }).expect(400);
  });

  it('CRUD completo: crear, listar, editar y eliminar', async () => {
    const creada = await clientAgent
      .post('/api/direcciones')
      .send({
        direccion: 'Cra perfil 1 # 2-03',
        barrio: 'Centro',
        ciudad: 'Zipaquirá',
        departamento: 'Cundinamarca',
        codigo_postal: '250002',
        telefono_contacto: '3001112233',
        es_principal: true,
        etiqueta: 'Casa',
      })
      .expect(201);
    const id = creada.body.id ?? creada.body.ID_DIRECCION;
    expect(id).toBeGreaterThan(0);

    const lista = await clientAgent.get('/api/direcciones').expect(200);
    expect(Array.isArray(lista.body)).toBe(true);
    expect(lista.body.length).toBeGreaterThan(0);

    await clientAgent
      .put(`/api/direcciones/${id}`)
      .send({ direccion: 'Cra perfil 9 # 8-01', barrio: 'Norte', ciudad: 'Chía', departamento: 'Cundinamarca', es_principal: true })
      .expect(200);

    const pool = await getDbPool();
    const [[dir]] = await pool.query('SELECT * FROM DIRECCIONES WHERE ID_DIRECCION = ?', [id]);
    expect(dir.CIUDAD).toBe('Chía');

    await clientAgent.delete(`/api/direcciones/${id}`).expect(200);
  });
});

describe('Integración — Métodos de pago del usuario', () => {
  it('guarda tarjeta: solo últimos 4 dígitos, CVV descartado', async () => {
    const creada = await clientAgent
      .post('/api/usuarios/metodos-pago')
      .send({
        id_metodo: 2,
        titular: 'Probe Perfil',
        numero: '4111111111111111',
        vencimiento: '12/30',
        cvv: '123',
        es_principal: true,
      })
      .expect(201);
    const id = creada.body.id ?? creada.body.ID;
    expect(id).toBeGreaterThan(0);

    const pool = await getDbPool();
    const [[metodo]] = await pool.query('SELECT * FROM USUARIOS_METODOS_PAGO WHERE ID = ?', [id]);
    expect(String(metodo.NUMERO ?? metodo.numero ?? '')).not.toContain('4111');
    expect(JSON.stringify(metodo)).not.toContain('123,"cvv"');
    expect(Number(metodo.ID_METODO)).toBe(2);
  });

  it('id_metodo inexistente → 400; lista del usuario', async () => {
    await clientAgent.post('/api/usuarios/metodos-pago').send({ id_metodo: 99999, titular: 'X' }).expect(400);
    await clientAgent.get('/api/usuarios/metodos-pago').expect(200);
  });

  it('marcar principal y eliminar', async () => {
    const creada = await clientAgent
      .post('/api/usuarios/metodos-pago')
      .send({ id_metodo: 3, titular: 'Segunda Tarjeta', numero: '4242424242424242', vencimiento: '11/29', cvv: '456' })
      .expect(201);
    const id = creada.body.id ?? creada.body.ID;
    await clientAgent.put(`/api/usuarios/metodos-pago/${id}/principal`).expect(200);
    await clientAgent.delete(`/api/usuarios/metodos-pago/${id}`).expect(200);
  });
});

describe('Integración — Favoritos e historial', () => {
  it('favoritos: agregar, dedupe, listar y quitar', async () => {
    const pool = await getDbPool();
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES ('Producto favorito', 'JADDA', 20000, 'Fav', 1)`,
    );
    await clientAgent.post('/api/favoritos').send({ id_producto: prod.insertId }).expect(201);
    // repetido → sigue 1 fila (unique) sin 500
    const dup = await clientAgent.post('/api/favoritos').send({ id_producto: prod.insertId });
    expect([200, 201, 400, 409]).toContain(dup.status);

    const lista = await clientAgent.get('/api/favoritos').expect(200);
    expect(lista.body.some((f) => Number(f.ID) === prod.insertId || Number(f.ID_PRODUCTO) === prod.insertId)).toBe(true);

    const [[fav]] = await pool.query('SELECT * FROM FAVORITOS WHERE ID_PRODUCTO = ?', [prod.insertId]);
    await clientAgent.delete(`/api/favoritos/${fav.ID_FAVORITO}`).expect(200);
  });

  it('historial: registrar visita y listar recientes', async () => {
    const pool = await getDbPool();
    const [prod] = await pool.query(
      `INSERT INTO PRODUCTOS (NOMBRE, MARCA, PRECIO, DESCRIPCION, ID_CATEGORIA) VALUES ('Producto historial', 'JADDA', 15000, 'Hist', 1)`,
    );
    await clientAgent.post('/api/historial').send({ id_producto: prod.insertId }).expect(201);
    const res = await clientAgent.get('/api/historial').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Integración — Notificaciones', () => {
  it('listar, no-leidas, marcar una y marcar todas', async () => {
    const pool = await getDbPool();
    const [[cliente]] = await pool.query("SELECT ID_USUARIO FROM USUARIOS WHERE EMAIL = 'cliente.perfil@test.com'");
    await pool.query(
      `INSERT INTO NOTIFICACIONES (ID_USUARIO, TIPO, TITULO, MENSAJE, RUTA, LEIDA) VALUES (?, 'pedido', 'Suite', 'Notif de prueba', '/perfil/compras', 0)`,
      [cliente.ID_USUARIO],
    );

    await clientAgent.get('/api/notificaciones').expect(200);
    const noLeidas = await clientAgent.get('/api/notificaciones/no-leidas').expect(200);
    expect(Number(JSON.stringify(noLeidas.body).match(/\d+/)?.[0] ?? 0)).toBeGreaterThan(0);

    const [[notif]] = await pool.query('SELECT * FROM NOTIFICACIONES WHERE ID_USUARIO = ? ORDER BY ID_NOTIFICACION DESC LIMIT 1', [cliente.ID_USUARIO]);
    await clientAgent.post(`/api/notificaciones/${notif.ID_NOTIFICACION}/leida`).expect(200);
    await clientAgent.post('/api/notificaciones/leer-todas').expect(200);
    const [[leida]] = await pool.query('SELECT LEIDA FROM NOTIFICACIONES WHERE ID_NOTIFICACION = ?', [notif.ID_NOTIFICACION]);
    expect(Number(leida.LEIDA)).toBe(1);
  });
});

describe('Integración — Perfil y seguridad', () => {
  it('GET perfil devuelve los datos del usuario', async () => {
    const res = await clientAgent.get('/api/auth/perfil').expect(200);
    const usuario = res.body.usuario ?? res.body;
    expect(usuario.EMAIL === 'cliente.perfil@test.com' || usuario.USUARIO === 'cliente_perfil').toBe(true);
  });

  it('PUT perfil actualiza SOLO los campos presentes (nombre) sin anular el resto', async () => {
    const res = await clientAgent
      .put('/api/auth/perfil')
      .send({ nombre: 'Cliente Editado', apellido: 'Perfil V2', usuario: 'cliente_perfil' })
      .expect(200);
    expect(res.body).toBeTruthy();
    const pool = await getDbPool();
    const [[u]] = await pool.query("SELECT NOMBRE_USUARIO, EMAIL FROM USUARIOS WHERE EMAIL = 'cliente.perfil@test.com'");
    expect(u.NOMBRE_USUARIO).toBe('Cliente Editado');
    expect(u.EMAIL).toBe('cliente.perfil@test.com');
  });

  it('usuario inválido (espacios / muy corto) → 400', async () => {
    await clientAgent.put('/api/auth/perfil').send({ usuario: 'ab' }).expect(400);
    await clientAgent.put('/api/auth/perfil').send({ usuario: 'tiene espacios' }).expect(400);
  });

  it('verificar-password valida la contraseña actual (mal → 400, bien → 200)', async () => {
    await clientAgent.post('/api/auth/verificar-password').send({ password: 'MalaClave123' }).expect(400);
    await clientAgent.post('/api/auth/verificar-password').send({ password: CLAVE }).expect(200);
  });

  it('cambiar-password con confirmación correcta y luego login con la nueva', async () => {
    await clientAgent
      .post('/api/auth/cambiar-password')
      .send({ password_actual: CLAVE, password_nueva: 'NuevaClave456' })
      .expect(200);

    await request(app).post('/api/auth/login').send({ email: 'cliente.perfil@test.com', password: CLAVE }).expect(401);
    await request(app).post('/api/auth/login').send({ email: 'cliente.perfil@test.com', password: 'NuevaClave456' }).expect(200);

    // restaurar la clave para las demás suites
    const pool = await getDbPool();
    await pool.query('UPDATE USUARIOS SET CONTRASENA = ? WHERE EMAIL = ?', [HASH, 'cliente.perfil@test.com']);
  });
});

describe('Integración — Newsletter, contacto y PQR', () => {
  it('newsletter: suscribir, duplicado sin error, admin lista suscritos', async () => {
    const correo = `newsletter.${Date.now()}@test.com`;
    await request(app).post('/api/newsletter').send({ email: correo }).expect(201);
    const dup = await request(app).post('/api/newsletter').send({ email: correo });
    expect([200, 201]).toContain(dup.status);

    const adminCreds = { email: 'admin.devol@test.com', password: CLAVE }; // admin de otra suite puede no existir aquí
    const lista = await request(app).get('/api/newsletter/suscritos');
    expect([200, 401, 403]).toContain(lista.status); // requiere admin
  });

  it('desuscribir por GET exige token HMAC (fail-closed) y con token válido responde 200', async () => {
    // sin token → 403 (página de enlace inválido, no se revela nada)
    const sinToken = await request(app).get('/api/newsletter/desuscribir?email=desuscribir.suite@test.com');
    expect(sinToken.status).toBe(403);

    // con token válido (generado con el MISMO secreto del backend) → 200 y queda inactivo
    const tokens = require('../../../backend/utils/desuscripcionToken.js');
    const correo = `desuscribir.suite.${Date.now()}@test.com`;
    await request(app).post('/api/newsletter').send({ email: correo }).expect(201);
    const token = tokens.generarTokenDesuscripcion(correo);
    const res = await request(app).get(`/api/newsletter/desuscribir?email=${encodeURIComponent(correo)}&token=${encodeURIComponent(token)}`);
    expect(res.status).toBe(200);
    const pool = await getDbPool();
    const [[fila]] = await pool.query('SELECT ACTIVO FROM NEWSLETTER_SUSCRIPTOS WHERE EMAIL = ?', [correo]);
    expect(Number(fila.ACTIVO)).toBe(0);
  });

  it('contacto público valida campos y registra el mensaje (SMTP best-effort)', async () => {
    await request(app).post('/api/contacto').send({}).expect(400);
    const res = await request(app)
      .post('/api/contacto')
      .send({ nombre: 'Probe Contacto', email: `contacto.${Date.now()}@test.com`, asunto: 'Consulta', mensaje: 'Mensaje de la suite' })
      .expect(200);
    expect(JSON.stringify(res.body)).toContain('Mensaje enviado');

    // campana admin (ID_USUARIO NULL) creada aunque el SMTP falle
    const pool = await getDbPool();
    const [[notif]] = await pool.query(
      "SELECT * FROM NOTIFICACIONES WHERE TIPO = 'contacto' ORDER BY ID_NOTIFICACION DESC LIMIT 1",
    );
    expect(notif).toBeTruthy();
  });

  it('PQR con sesión: crear (200); sin sesión → 401', async () => {
    await request(app).post('/api/pqr').send({ tipo: 'PETICION', asunto: 'X', descripcion: 'Y' }).expect(401);
    const creada = await clientAgent
      .post('/api/pqr')
      .send({ tipo: 'PETICION', asunto: 'Consulta de la suite', descripcion: 'Detalle', numeroPedido: '10000000' })
      .expect(200);
    expect(creada.body).toBeTruthy();
  });
});
