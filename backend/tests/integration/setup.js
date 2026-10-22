/**
 * Setup para tests de integración con MySQL real.
 * Usa docker-compose.test.yml de la raíz del proyecto.
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import path from 'node:path';

// Configuración de entorno para tests de integración
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3307';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'jadda_sports_test';
process.env.PORT = '5002';
process.env.SESSION_SECRET = 'test_session_secret_integration';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'test_pass';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.FACEBOOK_CLIENT_ID = 'test_fb_client_id';
process.env.FACEBOOK_CLIENT_SECRET = 'test_fb_client_secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'test123';
process.env.NEWSLETTER_INTERVAL_HORAS = '72';

// Rutas
// backend/tests/integration -> raíz del repo (donde vive docker-compose.test.yml)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const COMPOSE_FILE = path.join(PROJECT_ROOT, 'docker-compose.test.yml');

// Variables globales
let app = null;
let server = null;
let db = null;

/**
 * Verifica si el contenedor MySQL de test ya está corriendo
 */
function isTestMySQLRunning() {
  try {
    const result = execSync('docker ps --filter name=jadda_mysql_test --format "{{.Names}}"', {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    return result.trim() === 'jadda_mysql_test';
  } catch {
    return false;
  }
}

/**
 * Inicia el contenedor MySQL de test si no está corriendo
 */
async function startTestDatabase() {
  if (isTestMySQLRunning()) {
    console.log('✅ MySQL de test ya está corriendo');
    return;
  }

  console.log('🐳 Iniciando MySQL de test...');
  
  try {
    execSync(`docker compose -f "${COMPOSE_FILE}" down -v`, {
      cwd: PROJECT_ROOT,
      stdio: 'ignore',
    });
  } catch (e) {
    // Ignore
  }

  execSync(`docker compose -f "${COMPOSE_FILE}" up -d`, {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });

  console.log('⏳ Esperando a que MySQL esté listo...');
  let retries = 30;
  while (retries > 0) {
    try {
      execSync(
        'docker exec jadda_mysql_test mysqladmin ping -h localhost -u root -ptest_root_password --silent',
        { stdio: 'ignore' }
      );
      console.log('✅ MySQL de test listo');
      return;
    } catch (e) {
      retries--;
      if (retries === 0) {
        throw new Error('MySQL de test no arrancó a tiempo');
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Inicializa la BD con setup.js
 */
async function initializeTestDatabase() {
  console.log('🗄️ Inicializando esquema de BD de test...');
  
  // Limpiar cache de require para database/setup
  Object.keys(require.cache).forEach(key => {
    if (key.includes('database/setup') || key.includes('config/db')) {
      console.log(`🧹 Limpiando cache: ${key}`);
      delete require.cache[key];
    }
  });
  
  const testConfig = {
    DB_HOST: '127.0.0.1',
    DB_PORT: '3307',
    DB_USER: 'test_user',
    DB_PASSWORD: 'test_password',
    DB_NAME: 'jadda_sports_test',
  };
  console.log('📋 Config de test:', JSON.stringify(testConfig, null, 2));
  
  const setupDatabase = require('../../database/setup');
  // Pasar config de test para que use las credenciales correctas
  await setupDatabase(testConfig);
  console.log('✅ Setup de BD de test completado');
}

/**
 * Crea la app Express para tests
 */
async function createTestApp() {
  // Limpiar cache de módulos relacionados ANTES de requerirlos
  Object.keys(require.cache).forEach(key => {
    if (key.includes('server.js') || key.includes('config/passport') || key.includes('config/db') || key.includes('routes/')) {
      delete require.cache[key];
    }
  });

  // IMPORTANTE: Setear env vars ANTES de requerir config/db para que el pool use las credenciales de test
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '3307';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_password';
  process.env.DB_NAME = 'jadda_sports_test';

  const express = require('express');
  const cors = require('cors');
  const session = require('express-session');
  const MySQLStore = require('express-mysql-session')(session);
  const mysql = require('mysql2/promise');
  
  const app = express();
  
  // Crear pool de BD específico para tests
  const testPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    timezone: '-05:00',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 5000,
    acquireTimeout: 5000,
  });
  
  const testPromisePool = testPool;
  
  // Monkey-patch config/db para que use nuestro pool de test
  const dbModule = require('../../config/db');
  Object.assign(dbModule, testPromisePool);
  dbModule.verificarConexion = testPromisePool.verificarConexion;
  
  const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    connectTimeout: 5000,
  });
  
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false }
  }));
  
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));
  
  const passport = require('passport');
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Cargar TODAS las rutas (usarán el pool de test monkey-patched)
  app.use('/api/auth', require('../../routes/authRoutes'));
  app.use('/api/productos', require('../../routes/productoRoutes'));
  app.use('/api/carrito', require('../../routes/carritoRoutes'));
  app.use('/api/direcciones', require('../../routes/direccionRoutes'));
  app.use('/api/favoritos', require('../../routes/favoritosRoutes'));
  app.use('/api/historial', require('../../routes/historialRoutes'));
  app.use('/api/compras', require('../../routes/comprasRoutes'));
  app.use('/api/cupones', require('../../routes/cuponesRoutes'));
  app.use('/api/checkout', require('../../routes/checkoutRoutes'));
  app.use('/api/pqr', require('../../routes/pqrRoutes'));
  app.use('/api/retos', require('../../routes/retoRoutes'));
  app.use('/api/planes', require('../../routes/planRoutes'));
  app.use('/api/admin', require('../../routes/adminRoutes'));
  app.use('/api/usuarios/metodos-pago', require('../../routes/metodoPagoRoutes'));
  app.use('/api/contacto', require('../../routes/contactoRoutes'));
  app.use('/api/envio', require('../../routes/envioRoutes'));
  app.use('/api/newsletter', require('../../routes/newsletterRoutes'));
  app.use('/api/notificaciones', require('../../routes/notificacionRoutes'));
  app.use('/api/devoluciones', require('../../routes/devolucionRoutes'));
  app.use('/api/vendedor', require('../../routes/vendedorRoutes'));
  app.use('/api/chat', require('../../routes/chatRoutes'));
  
  // Error handler
  app.use((err, req, res, next) => {
    console.error('Test server error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  
  // Guardar pool para teardown
  app.testPool = testPool;
  
  return app;
}

/**
 * Setup global
 */
beforeAll(async () => {
  console.log('\n========== INTEGRATION TESTS SETUP ==========');
  
  await startTestDatabase();
  await initializeTestDatabase();
  
  app = await createTestApp();
  
  await new Promise(resolve => {
    server = app.listen(process.env.PORT, resolve);
  });
  
  // Obtener pool de BD del test server (ya es PromisePool)
  db = app.testPool;
  
  console.log(`🚀 Servidor de test escuchando en puerto ${process.env.PORT}`);
  console.log('========== SETUP COMPLETADO ==========\n');
}, 180000);

/**
 * Teardown global
 */
afterAll(async () => {
  console.log('\n========== INTEGRATION TESTS TEARDOWN ==========');
  
  if (server) {
    await new Promise(resolve => server.close(resolve));
    console.log('🛑 Servidor de test cerrado');
  }
  
  // Cerrar pool de test
  if (app?.testPool) {
    await app.testPool.end();
    console.log('🔌 Pool de test cerrado');
  }
  
  // NO paramos el contenedor MySQL aquí para permitir reuso entre runs
  // Se limpia manualmente o en CI al final
  console.log('🐳 MySQL de test dejado corriendo para siguiente ejecución');
  
  console.log('========== TEARDOWN COMPLETADO ==========\n');
}, 30000);

/**
 * Limpieza entre tests
 */
beforeEach(async () => {
  vi.clearAllMocks();
  
  if (db) {
    // NO truncar tablas de referencia/seed: ROLES, CATEGORIAS, PROVEEDORES, METODOS_PAGO, RETOS, PLANTILLAS_PLANES
    const tables = [
      'CHAT_MENSAJE', 'CHAT', 'DEVOLUCIONES_EVIDENCIAS', 'DEVOLUCIONES',
      'PLANES_USUARIO', 'RETO_EVIDENCIAS', 'RETOS_USUARIOS', 'RETOS',
      'NOTIFICACIONES', 'AVISOS_STOCK', 'USUARIOS_METODOS_PAGO',
      'PQR', 'RESENAS', 'CARRITO', 'HISTORIAL', 'FAVORITOS',
      'DETALLE_VENTAS', 'ENVIOS', 'VENTAS', 'MOVIMIENTOS_STOCK',
      'PRODUCTO_IMAGENES', 'PRODUCTO_CARACTERISTICAS', 'PRODUCTO_VARIANTES', 'PRODUCTOS',
      'DESCUENTOS',
      'VENDEDORES', 'SOLICITUDES_VENDEDOR',
      'DIRECCIONES', 'USUARIOS', 'sessions'
    ];
    
    try {
      await db.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const table of tables) {
        try { await db.query(`TRUNCATE TABLE ${table}`); } catch (e) { /* ignore */ }
      }
      await db.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      console.warn('Error truncando, re-inicializando BD...');
      await initializeTestDatabase();
    }
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

// Exportar para tests
export { app, server, db };

export async function getDbPool() {
  if (!db) {
    const { promisePool } = await import('../../config/db');
    db = promisePool;
  }
  return db;
}