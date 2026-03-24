const mysql = require('mysql2');

// Creamos el pool de conexiones
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'TIENDA_DEPORTIVA', // <--- Nombre exacto en mayúsculas
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Convertimos a promesas para usar async/await en los controladores
const promisePool = pool.promise();

// --- PRUEBA DE CONEXIÓN REAL ---
promisePool.query("SELECT 1")
  .then(() => {
    console.log("✅ MySQL Conectado exitosamente a 'TIENDA_DEPORTIVA'");
  })
  .catch(err => {
    console.error("❌ Error: No se pudo conectar a la base de datos.");
    console.error("Detalle:", err.message);
  });

module.exports = promisePool;