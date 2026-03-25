const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'TIENDA_DEPORTIVA',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});


const promisePool = pool.promise();


promisePool.query("SELECT 1")
  .then(() => {
    console.log("✅ MySQL Conectado exitosamente a 'TIENDA_DEPORTIVA'");
  })
  .catch(err => {
    console.error("❌ Error: No se pudo conectar a la base de datos.");
    console.error("Detalle:", err.message);
  });

module.exports = promisePool;