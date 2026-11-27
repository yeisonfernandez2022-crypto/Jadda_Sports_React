#!/usr/bin/env node
/*
 * Auditoría reproducible de llaves foráneas (brecha ARQ-4).
 *
 * Compara el esquema real de la BD configurada por DB_* con el inventario
 * documentado de 45 FK reales + 8 referencias lógicas, y cuenta filas
 * huérfanas en cada referencia lógica. No escribe en la BD.
 *
 * Uso local:
 *   node scripts/auditar-fk.js
 * Uso dentro del contenedor del backend:
 *   docker cp scripts/auditar-fk.js jadda_backend:/app/scripts/auditar-fk.js
 *   docker exec jadda_backend node scripts/auditar-fk.js
 *
 * Salida: JSON por stdout; exit 1 si la conexión falla.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mysql = require('mysql2/promise');
const { construirOpcionesSsl } = require('../config/sslConfig');

const REFERENCIAS_LOGICAS = [
  { tabla: 'PRODUCTOS', columna: 'ID_PROVEEDOR', destino: 'PROVEEDORES', destinoColumna: 'ID_PROVEEDOR' },
  { tabla: 'PRODUCTOS', columna: 'ID_CATEGORIA', destino: 'CATEGORIAS', destinoColumna: 'ID_CATEGORIA' },
  { tabla: 'PRODUCTOS', columna: 'ID_DESCUENTO', destino: 'DESCUENTOS', destinoColumna: 'ID_DESCUENTO' },
  { tabla: 'PRODUCTOS', columna: 'ID_VENDEDOR', destino: 'VENDEDORES', destinoColumna: 'ID_VENDEDOR' },
  { tabla: 'VENTAS', columna: 'ID_CLIENTE', destino: 'USUARIOS', destinoColumna: 'ID_USUARIO' },
  { tabla: 'CHAT', columna: 'ID_DEVOLUCION', destino: 'DEVOLUCIONES', destinoColumna: 'ID_DEVOLUCION' },
  { tabla: 'CHAT_MENSAJE', columna: 'ID_AUTOR', destino: 'USUARIOS', destinoColumna: 'ID_USUARIO' },
  { tabla: 'PAGOS_EVENTOS', columna: 'ID_VENTA', destino: 'VENTAS', destinoColumna: 'ID_VENTA' },
];

function opcionesConexion() {
  const ssl = construirOpcionesSsl(process.env);
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'jadda_sports_db',
    ssl: ssl ? ssl.ssl : undefined,
    connectTimeout: 10000,
  };
}

async function main() {
  const conn = await mysql.createConnection(opcionesConexion());
  try {
    const [tablasDetalle] = await conn.query(
      `SELECT TABLE_NAME AS tabla
         FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
        ORDER BY TABLE_NAME`
    );
    const tablas = { total: tablasDetalle.length };
    const [[fks]] = await conn.query(
      `SELECT COUNT(*) AS total
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    const [detalleFk] = await conn.query(
      `SELECT TABLE_NAME AS tabla, COLUMN_NAME AS columna,
              REFERENCED_TABLE_SCHEMA AS destinoEsquema,
              REFERENCED_TABLE_NAME AS destino, REFERENCED_COLUMN_NAME AS destinoColumna
         FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
        ORDER BY TABLE_NAME, COLUMN_NAME`
    );

    const [tablasDestino] = await conn.query(
      `SELECT TABLE_SCHEMA AS esquema, TABLE_NAME AS tabla
         FROM information_schema.TABLES`
    );
    const destinosExistentes = new Set(tablasDestino.map((t) => `${t.esquema}.${t.tabla}`));
    const fkHaciaTablasAusentes = detalleFk.filter(
      (f) => !destinosExistentes.has(`${f.destinoEsquema}.${f.destino}`)
    );

    const referencias = [];
    for (const ref of REFERENCIAS_LOGICAS) {
      const sql = `SELECT COUNT(*) AS total
                     FROM \`${ref.tabla}\` hijo
                     LEFT JOIN \`${ref.destino}\` padre
                       ON padre.\`${ref.destinoColumna}\` = hijo.\`${ref.columna}\`
                    WHERE hijo.\`${ref.columna}\` IS NOT NULL
                      AND padre.\`${ref.destinoColumna}\` IS NULL`;
      const [[huerfanos]] = await conn.query(sql);
      referencias.push({ ...ref, huerfanos: huerfanos.total });
    }

    const salida = {
      motor: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      baseDatos: process.env.DB_NAME || 'jadda_sports_db',
      tablas: tablas.total,
      tablasDetalle: tablasDetalle.map((t) => t.tabla),
      fkReales: fks.total,
      referenciasLogicas: referencias.length,
      detalleFk,
      fkHaciaTablasAusentes,
      referencias,
      referenciasConHuerfanos: referencias.filter((r) => r.huerfanos > 0),
    };
    process.stdout.write(`${JSON.stringify(salida, null, 2)}\n`);
    // Exit 2 = hallazgo de integridad (FK colgante o referencia lógica con
    // huérfanos). El huérfano histórico de VENTAS.ID_CLIENTE se documenta en
    // ARQ-4; el código de salida permite que CI/distinguir el estado.
    process.exitCode =
      salida.fkHaciaTablasAusentes.length > 0 || salida.referenciasConHuerfanos.length > 0
        ? 2
        : 0;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`[auditar-fk] ${err.code || 'ERROR'}: ${err.message}`);
  process.exit(1);
});
