const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

const files = [
  'backend/controllers/vendedorController.js',
  'backend/server.js',
  'frontend/src/pages/DevolucionEstado.tsx',
  'frontend/src/App.tsx',
  'frontend/src/css/adminDashboard.css',
];

for (const rel of files) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { console.log('SKIP: ' + rel); continue; }
  let text = fs.readFileSync(full, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  
  const ffffd = (text.match(/\uFFFD/g) || []).length;
  if (ffffd === 0) { console.log('OK: ' + rel); continue; }
  
  // Show contexts
  const contexts = [];
  const re = /.{0,15}\uFFFD.{0,15}/g;
  let m;
  while ((m = re.exec(text)) !== null && contexts.length < 5) {
    contexts.push(m[0].replace(/\n/g, '\\n'));
  }
  
  // Fix: just remove FFFD chars (they're artifacts)
  text = text.replace(/\uFFFD/g, '');
  fs.writeFileSync(full, '\uFEFF' + text, 'utf8');
  
  console.log('FIXED: ' + rel + ' (removed ' + ffffd + ' FFFD)');
  contexts.forEach(c => console.log('  [' + c + ']'));
}
