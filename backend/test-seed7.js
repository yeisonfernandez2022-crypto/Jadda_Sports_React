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
  
  // Build the PRODUCTOS INSERT manually like setup.js does
  const lines = cleanSeed.split('\n');
  let inProd = false;
  let prodLines = [];
  for (const line of lines) {
    if (line.includes('INSERT IGNORE INTO PRODUCTOS')) inProd = true;
    if (inProd) {
      prodLines.push(line);
      if (line.includes(');') && !line.includes('),')) break;
    }
  }
  
  const prodSql = prodLines.join('\n');
  console.log('Product SQL length:', prodSql.length);
  
  // Check every character for hidden issues
  for (let i = 0; i < prodSql.length; i++) {
    const code = prodSql.charCodeAt(i);
    // Flag anything that's not ASCII printable, newline, or valid UTF-8 multi-byte
    if (code > 127 && code < 0xC0) continue; // continuation byte
    if (code >= 0x80 && code <= 0x10FFFF) continue; // valid unicode
    if (code === 0x0A || code === 0x0D || code === 0x09) continue; // LF CR TAB
    if (code >= 0x20 && code <= 0x7E) continue; // printable ASCII
    console.log('Weird char at pos ' + i + ': code=' + code + ' hex=0x' + code.toString(16) + ' ctx=[' + prodSql.substring(Math.max(0,i-10), i+10).replace(/\n/g, '\\n').replace(/\r/g, '\\r') + ']');
  }
  
  // Also check: does the statement end properly?
  console.log('Last 50 chars:', JSON.stringify(prodSql.slice(-50)));
  
  // Try: build it the way test-seed3 did (which worked)
  const header = prodLines[0];
  const dataLines = prodLines.slice(1).filter(l => l.trim().length > 0).map(l => l.trim());
  dataLines[dataLines.length - 1] = dataLines[dataLines.length - 1].replace(/,\s*$/, ';');
  const manualSql = header + '\n' + dataLines.join('\n');
  
  console.log('Manual SQL length:', manualSql.length);
  console.log('Same as original?', manualSql === prodSql);
  
  if (manualSql !== prodSql) {
    // Find first difference
    for (let i = 0; i < Math.max(manualSql.length, prodSql.length); i++) {
      if (manualSql[i] !== prodSql[i]) {
        console.log('First diff at pos', i);
        console.log('  manual:', JSON.stringify(manualSql.substring(Math.max(0,i-20), i+20)));
        console.log('  prod:  ', JSON.stringify(prodSql.substring(Math.max(0,i-20), i+20)));
        break;
      }
    }
  }
  
  try {
    await conn.query(manualSql);
    console.log('Manual build: OK');
  } catch (err) {
    console.log('Manual build: FAIL -', err.code);
  }
  
  await conn.end();
}
test().catch(e => console.error(e.message));
