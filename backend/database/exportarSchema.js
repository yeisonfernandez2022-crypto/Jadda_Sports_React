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
const devoluciones = extraerTablaDeMigracion('DEVOLUCIONES');
if (!devoluciones) throw new Error('No se encontró el CREATE TABLE de DEVOLUCIONES');

const header = `-- =====================================================================
-- JADDA SPORTS — schema.sql (GENERADO AUTOMÁTICAMENTE)
-- Fuente: backend/database/exportarSchema.js (lee setup.js, no edites a mano)
--
-- Importable en MySQL Workbench para crear la base desde cero
-- (incluye tablas + datos de referencia; no incluye usuarios reales).
--
-- Tablas: ${(ddl.match(/CREATE TABLE IF NOT EXISTS/g) || []).length + 1} (las de
-- CREATE_TABLES_RAW más DEVOLUCIONES, que en BD existentes la crea setup.js
-- vía MIGRACIONES al reiniciar el backend).
--
-- Para BASES EXISTENTES no hace falta importar este archivo: al reiniciar el
-- backend (docker restart jadda_backend), setup.js aplica automáticamente
-- las migraciones idempotentes (columnas nuevas, tablas nuevas, índices).
-- =====================================================================

`;

fs.writeFileSync(outPath, header + ddl + '\n' + devoluciones + '\n' + seeds + '\n');
console.log(`✅ schema.sql regenerado: ${outPath} (${fs.statSync(outPath).size} bytes)`);
