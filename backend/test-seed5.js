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
  
  console.log('cleanSeed length:', cleanSeed.length);
  console.log('Has \\r:', cleanSeed.includes('\r'));
  
  // Find the full combined statement  
  try {
    await conn.query(cleanSeed);
    console.log('FULL SEED: OK');
  } catch (err) {
    console.log('FULL SEED: FAIL -', err.code);
    // Try to find what's going wrong - compare with individual stmts
    // Split into individual statements
    const stmts = [];
    let current = '';
    for (const line of cleanSeed.split('\n')) {
      current += line + '\n';
      if (current.trimEnd().endsWith(';')) {
        stmts.push(current.trim());
        current = '';
      }
    }
    
    // The failing one should be #4 (PRODUCTOS)
    for (let i = 0; i < stmts.length; i++) {
      try {
        await conn.query(stmts[i]);
        console.log('Stmt', i, ': OK (len=' + stmts[i].length + ')');
      } catch (e2) {
        console.log('Stmt', i, ': FAIL (len=' + stmts[i].length + ') -', e2.code);
      }
    }
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
