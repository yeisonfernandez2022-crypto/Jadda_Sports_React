#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

const FILES = [
  'backend/database/setup.js',
  'backend/controllers/vendedorController.js',
  'backend/server.js',
  'frontend/src/pages/DevolucionEstado.tsx',
  'frontend/src/App.tsx',
  'frontend/src/css/adminDashboard.css',
  'movil/app/ser-vendedor.tsx',
];

for (const relPath of FILES) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log('SKIP: ' + relPath);
    continue;
  }

  let text = fs.readFileSync(fullPath, 'utf8');
  // Remove BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Check for double-encoding (C3 83 C2 XX pattern = double-encoded accented char)
  const hasDouble = /\u00C3[\u0080-\u00BF]/.test(text) || /\u00C3\u0083\u00C2/.test(text);
  if (!hasDouble) {
    console.log('OK: ' + relPath);
    continue;
  }

  // Fix: encode as latin1 bytes, decode as UTF-8
  // Characters > 255 (already-correct Unicode or broken emoji) → preserve or replace
  const bytes = Buffer.alloc(text.length);
  const highChars = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 256) {
      bytes[i] = c;
    } else {
      // Track high chars for emoji restoration
      highChars.push({ pos: i, code: c });
      bytes[i] = 0x3F; // placeholder
    }
  }
  let fixed = bytes.toString('utf8');

  // Fix remaining mojibake patterns
  fixed = fixed.replace(/\uFFFDsnica/g, '\u00DAnica');      // Única
  fixed = fixed.replace(/\uFFFDTODO/g, '\u00C9TODO');       // ÉTODO → TODO (accented)
  fixed = fixed.replace(/RESE\uFFFDAS/g, 'RESE\u00D1AS');  // RESEÑAS
  
  // Clean up remaining FFFD chars
  fixed = fixed.replace(/\uFFFD/g, '');

  // Fix corrupted emoji/console.log prefixes
  // Original emojis: ✅ ⚙️ ❌ 📦 etc → replace with clean markers
  fixed = fixed.replace(/`>\s*Setup:/g, '` > Setup:');
  fixed = fixed.replace(/`\?\s+Setup:/g, '` > Setup:');

  // Ensure UTF-8 BOM
  fs.writeFileSync(fullPath, '\uFEFF' + fixed, 'utf8');
  
  const remaining = (fixed.match(/\u00C3[\u0080-\u00BF]/g) || []).length;
  console.log('FIXED: ' + relPath + ' (remaining-double:' + remaining + ')');
}

// Regenerate schema.sql from fixed setup.js
try {
  delete require.cache[require.resolve(path.join(ROOT, 'backend/database/exportarSchema.js'))];
  require(path.join(ROOT, 'backend/database/exportarSchema.js'));
  console.log('REGENERATED: schema.sql');
} catch (e) {
  console.log('Schema regen error: ' + e.message);
}

// Verify setup.js syntax
try {
  require('child_process').execSync(
    'node --check "' + path.join(ROOT, 'backend/database/setup.js') + '"',
    { stdio: 'pipe' }
  );
  console.log('SYNTAX: setup.js OK');
} catch (e) {
  console.log('SYNTAX ERROR: setup.js');
  console.log(e.stderr.toString().split('\n').slice(-3).join('\n'));
}
