/*
 * Pool de conexiones a MySQL.
 * Se usa createPool en vez de createConnection para:
 *   1. Reutilizar conexiones (evita overhead de abrir/cerrar en cada petición).
 *   2. Manejar hasta 10 peticiones concurrentes sin saturar la BD.
 *   3. Queue automático cuando todas las conexiones están ocupadas.
 */

const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); 

const config = {
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'jadda_sports_db',
  charset: 'utf8mb4',
  timezone: '-05:00',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 100,
  connectTimeout: 5000,
  acquireTimeout: 5000
};

// Pool base (callback style) envuelto a Promise con .promise()
const pool = mysql.createPool(config);

/*
 * promisePool: versión async/await del pool.
 * Todas las consultas en los controladores usan este export.
 * Ej: const [rows] = await promisePool.query("SELECT ...");
 */
const promisePool = pool.promise();

// =========================================================================
// 🔄 MECANISMO DE REINTENTOS PARA DOCKER
// Evita la carrera de arranque: MySQL puede tardar en estar lista mientras
// el backend ya se está iniciando. Reintenta hasta 30 veces (90-120s) con
// backoff, suficiente para PC lento / datos móviles / healthcheck.
// Fail-fast en credenciales inválidas.
// =========================================================================
async function verificarConexion(reintentosMaximos = 30, retraso = 3000) {
  const pathRastreo = path.join(__dirname, '..', 'reinicio.tmp');
  const esPrimerArranque = !fs.existsSync(pathRastreo);
  const dbConectada = process.env.DB_NAME || 'jadda_sports_db';

  for (let i = 0; i < reintentosMaximos; i++) {
    try {
      await promisePool.query("SELECT 1");
      if (esPrimerArranque) {
        console.log(`✅ Base de datos MySQL '${dbConectada}' conectada (pool OK, intento ${i + 1})`);
      }
      return true;
    } catch (err) {
      const isAuth = err && (err.code === 'ER_ACCESS_DENIED_ERROR' || String(err.message).includes('Access denied'));
      if (isAuth) {
        console.error("\n=================================================================");
        console.error("❌ DB pool: Access denied — verifica DB_USER/DB_PASSWORD y MYSQL_ROOT_PASSWORD en docker-compose.yml");
        console.error("Detalle:", err.message);
        console.error("=================================================================\n");
        throw err;
      }
      if (i === reintentosMaximos - 1) {
        console.error("\n=================================================================");
        console.error(`❌ DB pool: No se pudo conectar tras ${reintentosMaximos} intentos.`);
        console.error("Detalle:", err.code || '', err.message);
        console.error("→ Verifica: docker ps / docker logs jadda_mysql / docker inspect jadda_mysql --format {{.State.Health.Status}}");
        console.error("=================================================================\n");
        throw err;
      }
      if (esPrimerArranque || i < 3) {
        console.log(`⏳ MySQL pool despertando... reintento ${i + 1}/${reintentosMaximos} en ${retraso / 1000}s (${err.code || err.message.substring(0, 60)})`);
      }
      await new Promise(resolve => setTimeout(resolve, retraso + Math.min(3000, i * 300)));
    }
  }
}

// No auto-ejecutar aquí: server.js hace await verificarConexion() antes de listen
// Mantener compat: si se importa sin await, lanzar en background
if (require.main === module) {
  verificarConexion().catch(() => process.exit(1));
} else {
  // background check sin bloquear import; errores solo log
  verificarConexion().catch(() => {});
}
promisePool.verificarConexion = verificarConexion;

/*
 * Exporta el promisePool para que todos los controladores
 * compartan la misma instancia de conexiones.
 * Cada módulo hace: const db = require('./config/db');
 */
module.exports = promisePool;