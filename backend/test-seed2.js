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
  
  // Strip \r and comments
  const cleanSeed = seedData.replace(/\r/g, '').split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  // Check for remaining \r
  const hasCR = cleanSeed.includes('\r');
  console.log('Has \\r after strip:', hasCR);
  
  // Try each statement individually
  const stmts = [];
  let current = '';
  for (const line of cleanSeed.split('\n')) {
    current += line + '\n';
    if (current.trimEnd().endsWith(';')) {
      stmts.push(current.trim());
      current = '';
    }
  }
  
  console.log('Total statements:', stmts.length);
  
  let ok = 0, fail = 0;
  for (let i = 0; i < stmts.length; i++) {
    try {
      await conn.query(stmts[i]);
      ok++;
    } catch (err) {
      fail++;
      if (fail <= 3) {
        console.log('FAIL #' + i + ':', err.code, stmts[i].substring(0, 80));
      }
    }
  }
  
  console.log('Results:', ok, 'ok,', fail, 'failed');
  await conn.end();
}
test().catch(e => console.error(e.message));
