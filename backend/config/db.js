const mysql = require('mysql2');
require('dotenv').config(); // Por si usas variables de entorno locales

const pool = mysql.createPool({
  // Si está en Docker usa 'database' (el nombre del servicio), si no, usa 'localhost'
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'root',
  // Si está en Docker usa la contraseña secreta, si estás local usa vacío ''
  password: process.env.DB_PASSWORD || '',
  // Usamos el nombre que le dimos en Docker, o tu nombre local si estás fuera
  database: process.env.DB_NAME || 'jadda_sports_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

promisePool.query("SELECT 1")
  .then(() => {
    // Dinámico para que muestre el nombre real de la BD conectada
    const dbConectada = process.env.DB_NAME || 'jadda_sports_db';
    console.log(`✅ MySQL Conectado exitosamente a '${dbConectada}' dentro del contenedor`);
  })
  .catch(err => {
    console.error("❌ Error: No se pudo conectar a la base de datos en Docker.");
    console.error("Detalle:", err.message);
  });

module.exports = promisePool;