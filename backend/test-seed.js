const mysql = require('mysql2/promise');
const fs = require('fs');

async function test() {
  const conn = await mysql.createConnection({
    host: 'database', user: 'root', password: 'tu_password_secreto',
    database: 'jadda_sports_db', multipleStatements: true, connectTimeout: 5000
  });
  
  const text = fs.readFileSync('/app/database/setup.js', 'utf8');
  const start = text.indexOf('const SEED_DATA = `') + 19;
  const end = text.indexOf('`;', start);
  const seedData = text.substring(start, end);
  
  // Remove comments
  const clean = seedData.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  
  // Try executing
  try {
    await conn.query(clean);
    console.log('SUCCESS: full SEED_DATA executed via mysql2');
  } catch (err) {
    console.log('FAILED:', err.code, err.message.substring(0, 300));
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
