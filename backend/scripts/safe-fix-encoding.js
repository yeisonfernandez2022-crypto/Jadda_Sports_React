#!/usr/bin/env node
/**
 * Safe encoding fix: only fixes double-encoding and known mojibake patterns.
 * Does NOT remove FFFD from strings (could break emojis).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '../..');

const FILES = [
  'backend/controllers/vendedorController.js',
  'backend/server.js',
  'frontend/src/pages/DevolucionEstado.tsx',
  'frontend/src/App.tsx',
  'frontend/src/css/adminDashboard.css',
  'movil/app/ser-vendedor.tsx',
  'movil/app/chat/[id].tsx',
];

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { console.log('SKIP: ' + rel); continue; }

  let text = fs.readFileSync(full, 'utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // Step 1: Fix double-encoding (C3 83 C2 XX → correct UTF-8)
  const hasDouble = /\u00C3[\u0080-\u00BF]/.test(text);
  if (hasDouble) {
    const bytes = Buffer.alloc(text.length);
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      bytes[i] = c < 256 ? c : 0x3F;
    }
    text = bytes.toString('utf8');
  }

  // Step 2: Fix known mojibake in data strings (safe replacements)
  // Única (was corrupted)
  text = text.replace(/\?\?nica/g, '\u00DAnica');
  text = text.replace(/\?\?snica/g, '\u00DAnica');
  // MÉTODO
  text = text.replace(/M\?\?TODOS/g, 'M\u00C9TODOS');
  text = text.replace(/M\?TODOS/g, 'M\u00C9TODOS');
  // RESEÑAS
  text = text.replace(/RESE\?\?AS/g, 'RESE\u00D1AS');
  text = text.replace(/RESE\?AS/g, 'RESE\u00D1AS');

  // Step 3: Fix em-dash in COMMENTS only (not strings)
  // Split by lines, fix comment lines
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only fix comment lines (// or /* or *)
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('/*')) {
      lines[i] = line.replace(/\?\?/g, '\u2014').replace(/\?/g, '\u2014');
    }
  }
  text = lines.join('\n');

  // Step 4: Fix count expression in comments
  text = text.replace(/44\?\?3/g, '44\u00D73');
  text = text.replace(/60\?\?3/g, '60\u00D73');

  // Write with BOM
  fs.writeFileSync(full, '\uFEFF' + text, 'utf8');

  // Syntax check for JS files
  if (rel.endsWith('.js') || rel.endsWith('.tsx')) {
    try {
      execSync('node --check "' + full + '"', { stdio: 'pipe' });
      console.log('OK: ' + rel);
    } catch (e) {
      const errMsg = e.stderr.toString().split('\n').find(l => l.includes('SyntaxError'));
      console.log('SYNTAX ERROR: ' + rel + ' - ' + (errMsg || 'unknown'));
    }
  } else {
    console.log('FIXED: ' + rel);
  }
}

// Regenerate schema.sql
try {
  delete require.cache[require.resolve(path.join(ROOT, 'backend/database/exportarSchema.js'))];
  require(path.join(ROOT, 'backend/database/exportarSchema.js'));
} catch (e) {
  console.log('Schema regen: ' + e.message);
}
