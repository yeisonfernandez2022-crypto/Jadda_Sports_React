/**
 * exportarSchema.js — Regenera backend/database/schema.sql a partir de
 * setup.js (fuente única de verdad del esquema y los seeds).
 *
 * Uso:  node backend/database/exportarSchema.js
 *
 * El archivo generado es importable en MySQL Workbench para crear una base
 * nueva (no ejecuta nada contra la BD; solo escribe el .sql).
 */
const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'setup.js');
const outPath = path.join(__dirname, 'schema.sql');
const src = fs.readFileSync(srcPath, 'utf8');

/** Extrae el contenido de un template literal: `const X = ` ... `;` */
function extraerLiteral(nombreVar) {
  const inicio = src.indexOf(`const ${nombreVar} = \``);
  if (inicio === -1) throw new Error(`No se encontró const ${nombreVar} en setup.js`);
  const comienzo = inicio + `const ${nombreVar} = \``.length;
  const fin = src.indexOf('\n`;', comienzo);
  if (fin === -1) throw new Error(`No se pudo cerrar el literal de ${nombreVar}`);
  return src.slice(comienzo, fin);
}

/** Extrae el CREATE TABLE IF NOT EXISTS ... de un createSql de MIGRACIONES. */
function extraerTablaDeMigracion(nombreTabla) {
  const inicio = src.indexOf(`CREATE TABLE IF NOT EXISTS ${nombreTabla} (`);
  if (inicio === -1) return null;
  const fin = src.indexOf('\n    )`', inicio);
  if (fin === -1) throw new Error(`No se pudo cerrar CREATE TABLE ${nombreTabla}`);
  return src.slice(inicio, fin + '\n    )'.length) + '\n';
}

const ddl = extraerLiteral('CREATE_TABLES_RAW');
const seeds = extraerLiteral('SEED_DATA');
let demo = '';
try { demo = extraerLiteral('DEMO_DATA'); } catch(e) { console.warn('DEMO_DATA no encontrado, se omite'); }

/*
 * Redacción del hash de contraseñas demo (Sonar: hash de contraseña en el
 * código). En setup.js el valor se interpola en RUNTIME (${HASH_DEMO}); al
 * exportar el .sql estático se deja un placeholder CLARAMENTE INVÁLIDO en su
 * lugar: las cuentas demo importadas desde este archivo no pueden iniciar
 * sesión hasta el primer arranque del backend (setup.js las rota a un hash
 * nuevo generado en runtime mediante resincronizarContrasenasDemo).
 */
if (demo) {
  demo = demo.split('${HASH_DEMO}').join('__CLAVE_DEMO_ROTADA_EN_EL_ARRANQUE__');
}

// Extraer todas las tablas de MIGRACIONES que no están ya en CREATE_TABLES_RAW
// Orden topológico: padres antes de hijos (VENDEDORES antes de CHAT que lo referencia)
const tablasMigracion = ['RETO_EVIDENCIAS','NOTIFICACIONES','AVISOS_STOCK','SOLICITUDES_VENDEDOR','VENDEDORES','DEVOLUCIONES','DEVOLUCIONES_EVIDENCIAS','CHAT','CHAT_MENSAJE'];
let migracionesDDL = '';
let tablasExtra = 0;
for(const t of tablasMigracion){
  // Evitar duplicar si ya está en CREATE_TABLES_RAW
  if(ddl.includes(`CREATE TABLE IF NOT EXISTS ${t} (`)) continue;
  const tbl = extraerTablaDeMigracion(t);
  if(tbl){
    // Asegurar que termina en ; (los createSql de MIGRACIONES no traen ; porque se ejecutan directos)
    let tblConPuntoComa = tbl.trimEnd();
    if(!tblConPuntoComa.endsWith(';')) tblConPuntoComa += ';';
    migracionesDDL += '\n' + tblConPuntoComa + '\n';
    tablasExtra++;
  }
}
const totalTablas = (ddl.match(/CREATE TABLE IF NOT EXISTS/g) || []).length + tablasExtra;

const header = `-- =====================================================================
-- JADDA SPORTS — schema.sql (GENERADO AUTOMÁTICAMENTE)
-- Fuente: backend/database/exportarSchema.js (lee setup.js, no edites a mano)
--
-- Importable en MySQL Workbench para crear la base desde cero
-- Incluye: estructura completa (${totalTablas} tablas) + datos de referencia (SEED_DATA)
--          + datos DEMO poblados (DEMO_DATA: usuarios, vendedores, ventas, devoluciones, etc.)
--          Listo para abrir en Workbench y generar el modelo relacional
--          (Database > Reverse Engineer).
--
-- Para BASES EXISTENTES no hace falta importar este archivo: al reiniciar el
-- backend (docker restart jadda_backend), setup.js aplica automáticamente
-- las migraciones idempotentes y el DEMO_DATA (INSERT IGNORE).
-- =====================================================================

`;

let contenido = header + 'SET FOREIGN_KEY_CHECKS=0;\n' + ddl + '\n' + migracionesDDL + '\n' + seeds + '\n';
if(demo) contenido += '\n-- =====================================================================\n-- DATOS DEMO POBLADOS (dashboard con ventas, reembolsos, chats, etc.)\n-- NOTA: las contraseñas de las cuentas demo llegan como placeholder\n-- INVÁLIDO (__CLAVE_DEMO_ROTADA_EN_EL_ARRANQUE__) — el primer arranque del\n-- backend (setup.js) las rota a un hash nuevo generado en runtime desde la\n-- variable DEMO_PASSWORD. Así ningún hash de contraseña real vive en este\n-- archivo (secreto committed = secreto filtrado).\n-- =====================================================================\n' + demo + '\n';
contenido += '\nSET FOREIGN_KEY_CHECKS=1;\n';

fs.writeFileSync(outPath, contenido);
console.log(`✅ schema.sql regenerado: ${outPath} (${fs.statSync(outPath).size} bytes) - ${totalTablas} tablas + SEED + DEMO`);
