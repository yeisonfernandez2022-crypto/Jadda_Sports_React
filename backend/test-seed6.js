const mysql = require('mysql2/promise');
const fs = require('fs');

async function test() {
  const conn = await mysql.createConnection({
    host: 'database', user: 'root', password: 'tu_password_secreto',
    database: 'jadda_sports_db', multipleStatements: true, connectTimeout: 10000
  });
  
  const text = fs.readFileSync('/app/database/setup.js', 'utf8');
  const marker = 'const SEED_DATA = `';
  const start = text.indexOf(marker) + marker.length;
  const end = text.indexOf('`;', start);
  const seedData = text.substring(start, end);
  
  const cleanSeed = seedData.replace(/\r/g, '').split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  // Split into statements
  const stmts = [];
  let current = '';
  for (const line of cleanSeed.split('\n')) {
    current += line + '\n';
    if (current.trimEnd().endsWith(';')) {
      stmts.push(current.trim());
      current = '';
    }
  }
  
  const prodStmt = stmts[4];
  
  // Find where the DESCUENTOS INSERT ends and PRODUCTOS begins
  const descIdx = cleanSeed.indexOf('INSERT IGNORE INTO DESCUENTOS');
  const prodIdx = cleanSeed.indexOf('INSERT IGNORE INTO PRODUCTOS');
  
  // Extract just from DESCUENTOS to end of PRODUCTOS
  const chunk = cleanSeed.substring(descIdx);
  const afterProd = chunk.indexOf('INSERT IGNORE INTO PRODUCTO_VARIANTES');
  const descProd = chunk.substring(0, afterProd);
  
  // Execute this chunk (two statements together)
  try {
    await conn.query(descProd);
    console.log('DESCUENTOS + PRODUCTOS: OK');
  } catch (err) {
    console.log('DESCUENTOS + PRODUCTOS: FAIL -', err.code);
    
    // Try with SET NAMES before
    try {
      await conn.query('SET NAMES utf8mb4');
      await conn.query(prodStmt);
      console.log('With SET NAMES: OK');
    } catch (e2) {
      console.log('With SET NAMES: FAIL -', e2.code);
    }
    
    // Try with hex literal for special chars
    // Check for invisible chars in the product stmt
    const buf = Buffer.from(prodStmt, 'utf8');
    const nonAscii = [];
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] > 127) {
        // Check if it's valid UTF-8 continuation
        nonAscii.push({ pos: i, byte: buf[i] });
      }
    }
    console.log('Non-ASCII bytes count:', nonAscii.length);
    
    // Try with just the first 5 and last 5 rows
    const lines = prodStmt.split('\n');
    const header = lines[0];
    const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
    const small = [header, ...dataLines.slice(0, 5).map(l => l.replace(/,\s*$/, ';'))].join('\n');
    try {
      await conn.query(small);
      console.log('5 rows only: OK');
    } catch (e3) {
      console.log('5 rows only: FAIL -', e3.code);
      console.log('SQL:', small.substring(0, 300));
    }
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
