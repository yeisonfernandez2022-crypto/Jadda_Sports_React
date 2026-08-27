const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const t = fs.readFileSync(path.join(ROOT, 'backend/database/setup.js'), 'utf8');

console.log('=== Product Names 45-60 ===');
for (let pid = 45; pid <= 60; pid++) {
  const re = new RegExp('\\(' + pid + ", '([^']+)'");
  const m = t.match(re);
  if (m) console.log(pid + ': ' + m[1]);
}

console.log('\n=== Key Spanish Words ===');
console.log('Unica count:', (t.match(/Única/g) || []).length);
console.log('METODO count:', (t.match(/MÉTODO/g) || []).length);
console.log('RESEÑAS count:', (t.match(/RESEÑAS/g) || []).length);
console.log('×3 count:', (t.match(/×3/g) || []).length);

console.log('\n=== Console.log Lines ===');
const logs = t.match(/console\.log\(`[^`]+`/g);
if (logs) logs.forEach(l => console.log(l.substring(0, 80)));

console.log('\n=== Encoding Check ===');
console.log('FFFD:', (t.match(/\uFFFD/g) || []).length);
console.log('Double-encode:', (t.match(/\u00C3[\u0080-\u00BF]/g) || []).length);

// Also verify syntax
const { execSync } = require('child_process');
try {
  execSync('node --check "' + path.join(ROOT, 'backend/database/setup.js') + '"', { stdio: 'pipe' });
  console.log('Syntax: OK');
} catch (e) {
  console.log('Syntax: ERROR');
  console.log(e.stderr.toString().split('\n').slice(-3).join('\n'));
}
