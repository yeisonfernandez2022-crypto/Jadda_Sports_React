import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Determine if we should use the test database
const USE_TEST_DB = process.env.USE_TEST_DB === 'true' || process.env.CI === 'true';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = USE_TEST_DB ? 'localhost' : 'localhost';
process.env.DB_PORT = USE_TEST_DB ? '3307' : '3306';
process.env.DB_USER = USE_TEST_DB ? 'root' : 'root';
process.env.DB_PASSWORD = USE_TEST_DB ? 'test_root_password' : 'test_password';
process.env.DB_NAME = USE_TEST_DB ? 'jadda_sports_test' : 'jadda_sports_test';
process.env.PORT = '5001';
process.env.SESSION_SECRET = 'test_session_secret';
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

let testDbStarted = false;
let projectRoot = process.cwd();

async function findProjectRoot() {
  let root = process.cwd();
  while (!existsSync(resolve(root, 'docker-compose.test.yml'))) {
    const parent = resolve(root, '..');
    if (parent === root) {
      throw new Error('No se encontró docker-compose.test.yml en el árbol de directorios');
    }
    root = resolve(root, '..');
  }
  return root;
}

async function startTestDatabase() {
  if (!USE_TEST_DB) return;
  
  console.log('🔄 Iniciando base de datos de prueba...');
  
  try {
    projectRoot = await findProjectRoot();
    console.log('📁 Raíz del proyecto:', projectRoot);

    // Start test database from project root
    execSync('docker-compose -f docker-compose.test.yml up -d', { 
      stdio: 'inherit',
      cwd: projectRoot,
      timeout: 120000
    });

    // Wait for database to be ready
    console.log('⏳ Esperando a que la base de datos esté lista...');
    let retries = 30;
    while (retries > 0) {
      try {
        execSync('docker-compose -f docker-compose.test.yml exec -T database-test mysqladmin ping -h 127.0.0.1 -u root -ptest_root_password --silent', {
          stdio: 'ignore',
          timeout: 5000
        });
        console.log('✅ Base de datos de prueba lista');
        break;
      } catch {
        retries--;
        if (retries === 0) throw new Error('Timeout esperando base de datos');
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    testDbStarted = true;
    console.log('✅ Base de datos de prueba iniciada en puerto 3307');
  } catch (error) {
    console.error('❌ Error iniciando base de datos de prueba:', error.message);
    throw error;
  }
}

async function stopTestDatabase() {
  if (!USE_TEST_DB || !testDbStarted) return;
  
  console.log('🛑 Deteniendo base de datos de prueba...');
  try {
    execSync('docker-compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
      cwd: projectRoot,
      timeout: 60000
    });
    console.log('✅ Base de datos de prueba detenida');
  } catch (error) {
    console.error('⚠️ Error deteniendo base de datos:', error.message);
  }
}

async function runMigrations() {
  if (!USE_TEST_DB) return;
  
  console.log('🔄 Ejecutando migraciones...');
  try {
    // Import setup.js which runs migrations on startup
    await import('../database/setup.js');
    console.log('✅ Migraciones ejecutadas');
  } catch (error) {
    console.error('⚠️ Error ejecutando migraciones:', error.message);
  }
}

// Global test timeout
beforeAll(async () => {
  vi.setConfig({ testTimeout: 60000 });
  
  if (USE_TEST_DB) {
    await startTestDatabase();
    await runMigrations();
  }
}, 120000);

afterAll(async () => {
  await stopTestDatabase();
  vi.clearAllMocks();
}, 60000);

beforeEach(() => {
  vi.clearAllMocks();
});