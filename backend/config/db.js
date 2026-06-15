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
  queueLimit: 0
};

// Creamos el pool base usando tu configuración existente
const pool = mysql.createPool(config);
const promisePool = pool.promise();

// =========================================================================
// 🔄 MECANISMO DE REINTENTOS PARA DOCKER (Para evitar la carrera de arranque)
// =========================================================================
async function verificarConexion(reintentosMaximos = 5, retraso = 2000) {
  // Buscamos el mismo archivo temporal que maneja server.js para saber si es reinicio
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

// Exportamos exactamente el mismo promisePool que ya usan tus controladores
module.exports = promisePool;