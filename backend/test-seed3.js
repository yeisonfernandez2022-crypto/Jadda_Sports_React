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
  
  // Find the PRODUCTOS INSERT block
  const prodIdx = cleanSeed.indexOf('INSERT IGNORE INTO PRODUCTOS');
  // Find next INSERT or end
  const nextInsert = cleanSeed.indexOf('INSERT IGNORE INTO', prodIdx + 1);
  const prodBlock = cleanSeed.substring(prodIdx, nextInsert > -1 ? nextInsert : cleanSeed.length);
  
  // Split into header + rows
  const lines = prodBlock.split('\n');
  const header = lines[0]; // INSERT IGNORE INTO PRODUCTOS ... VALUES
  const rows = lines.slice(1).filter(l => l.trim().length > 0);
  
  console.log('PRODUCTOS: header:', header.substring(0, 100));
  console.log('PRODUCTOS: total rows:', rows.length);
  
  // Binary search: try first half
  const half = Math.floor(rows.length / 2);
  
  for (const [label, subset] of [['FIRST HALF', rows.slice(0, half)], ['SECOND HALF', rows.slice(half)]]) {
    // Make last row end with ;
    const fixed = subset.map(r => r.trim());
    fixed[fixed.length - 1] = fixed[fixed.length - 1].replace(/,\s*$/, ';');
    const sql = header + '\n' + fixed.join('\n');
    try {
      await conn.query(sql);
      console.log(label + ': OK');
    } catch (err) {
      console.log(label + ': FAIL -', err.code, err.message.substring(0, 100));
      // Further binary search
      if (subset.length > 5) {
        const q = Math.floor(subset.length / 4);
        for (let j = 0; j < 4; j++) {
          const chunk = subset.slice(j * q, (j + 1) * q);
          const cfixed = chunk.map(r => r.trim());
          cfixed[cfixed.length - 1] = cfixed[cfixed.length - 1].replace(/,\s*$/, ';');
          const csql = header + '\n' + cfixed.join('\n');
          try {
            await conn.query(csql);
            console.log('  Chunk ' + j + ': OK');
          } catch (e2) {
            console.log('  Chunk ' + j + ': FAIL -', e2.code);
            // Find exact row
            for (let k = 0; k < chunk.length; k++) {
              try {
                const rowFixed = chunk[k].replace(/,\s*$/, ';');
                await conn.query(header + '\n' + rowFixed);
              } catch (e3) {
                console.log('    Row ' + (j * q + k) + ': FAIL -', chunk[k].substring(0, 120));
                // Check for special chars
                const row = chunk[k];
                for (let c = 0; c < row.length; c++) {
                  if (row.charCodeAt(c) > 127) {
                    console.log('      Special char at pos ' + c + ': 0x' + row.charCodeAt(c).toString(16) + ' ctx=[' + row.substring(Math.max(0, c-5), c+5) + ']');
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
