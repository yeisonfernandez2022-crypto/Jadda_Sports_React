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
// el backend ya se está iniciando. Reintenta hasta 5 veces con 2s de espera.
// =========================================================================
async function verificarConexion(reintentosMaximos = 5, retraso = 2000) {
  // Usa el mismo flag reinicio.tmp que server.js — así solo imprime en primer arranque
  const pathRastreo = path.join(__dirname, '..', 'reinicio.tmp');
  const esPrimerArranque = !fs.existsSync(pathRastreo);
  const dbConectada = process.env.DB_NAME || 'jadda_sports_db';
  
  for (let i = 0; i < reintentosMaximos; i++) {
    try {
      // Intentamos la consulta de prueba
      await promisePool.query("SELECT 1");
      
      // SÓLO si es el primer arranque de Docker, te avisa que quedó melo
      if (esPrimerArranque) {
        console.log(`✅ Base de datos MySQL '${dbConectada}' conectada`);
      }
      return; // Si conecta, salimos del bucle con éxito
    } catch (err) {
      // Si es el último intento y falló, mostramos el error crítico sin importar el arranque
      if (i === reintentosMaximos - 1) {
        console.error("\n=================================================================");
        console.error("❌ Error Definitivo: No se pudo conectar a la base de datos en Docker.");
        console.error("Detalle:", err.message);
        console.error("=================================================================\n");
        return;
      }
      
      // Solo avisamos de los reintentos si es el arranque inicial pesado de Docker
      if (esPrimerArranque) {
        console.log(`⚠️  MySQL está despertando... Reintentando conexión en ${retraso / 1000}s (Intento ${i + 1}/${reintentosMaximos})`);
      }
      
      // Pausa el código por los milisegundos del retraso antes de volver a intentar
      await new Promise(resolve => setTimeout(resolve, retraso));
    }
  }
}

// Lanzamos la verificación controlada
verificarConexion();

/*
 * Exporta el promisePool para que todos los controladores
 * compartan la misma instancia de conexiones.
 * Cada módulo hace: const db = require('./config/db');
 */
module.exports = promisePool;