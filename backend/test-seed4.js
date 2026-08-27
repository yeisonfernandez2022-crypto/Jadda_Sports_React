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
  const nextInsert = cleanSeed.indexOf('\nINSERT IGNORE INTO', prodIdx + 1);
  const prodBlock = cleanSeed.substring(prodIdx, nextInsert > -1 ? nextInsert : cleanSeed.length);
  
  const lines = prodBlock.split('\n');
  const header = lines[0];
  const rows = lines.slice(1).filter(l => l.trim().length > 0).map(l => l.trim());
  
  // Try individual rows
  console.log('Testing individual rows...');
  const failures = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].replace(/,\s*$/, ';');
    try {
      await conn.query(header + '\n' + row);
    } catch (err) {
      failures.push({ index: i, row: row.substring(0, 150), error: err.code });
    }
  }
  
  if (failures.length === 0) {
    console.log('All individual rows OK!');
    // Try combining 10 at a time
    console.log('Trying combined blocks of 10...');
    for (let block = 0; block < rows.length; block += 10) {
      const chunk = rows.slice(block, block + 10);
      const last = chunk[chunk.length - 1].replace(/,\s*$/, ';');
      const sql = header + '\n' + chunk.slice(0, -1).join('\n') + '\n' + last;
      try {
        await conn.query(sql);
      } catch (err) {
        console.log('  Block ' + block + '-' + (block + chunk.length) + ': FAIL -', err.code);
      }
    }
    console.log('Done testing blocks');
  } else {
    console.log('Failures:', failures.length);
    failures.forEach(f => console.log('  Row', f.index, ':', f.error, f.row));
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
