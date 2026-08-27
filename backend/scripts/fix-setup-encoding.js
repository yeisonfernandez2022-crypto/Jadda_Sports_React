#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');

let text = fs.readFileSync(path.join(ROOT, 'backend/database/setup.js'), 'utf8');
if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

// 1. Fix patterns where accented chars were corrupted
text = text.replace(/\?\?nica/g, '\u00DAnica');
text = text.replace(/M\?\?TODOS/g, 'M\u00C9TODOS');
text = text.replace(/RESE\?\?AS/g, 'RESE\u00D1AS');
text = text.replace(/44\?\?3/g, '44\u00D73');
text = text.replace(/60\?\?3/g, '60\u00D73');

// 5. Fix count expression: 44×3 + 60×3
text = text.replace(/44\u00D7/g, '44\u00D7');
text = text.replace(/60\u00D7/g, '60\u00D7');

// 6. Fix console.log emoji prefixes → clean text markers
// Patterns: `�?? Setup, `�??️ Setup, `�?️ Setup, "�?? Setup, "�?️ Setup
text = text.replace(/`[\uFFFD\uFE0F\?]+ /g, '`> ');
text = text.replace(/"[\uFFFD\uFE0F\?]+ /g, '"> ');
text = text.replace(/'[\uFFFD\uFE0F\?]+ /g, "'> ");

// 7. Fix remaining specific emoji patterns
text = text.replace(/\uFFFD\?\uFE0F  /g, '> ');
text = text.replace(/\uFFFD\?\?  /g, '> ');
text = text.replace(/\uFFFD\? /g, '> ');

// 8. Final cleanup: remove any remaining FFFD
const ffffd = (text.match(/\uFFFD/g) || []).length;
text = text.replace(/\uFFFD/g, '');

// 9. Verify no double-encoding remains
const hasDouble = /\u00C3[\u0080-\u00BF]/.test(text);

fs.writeFileSync(path.join(ROOT, 'backend/database/setup.js'), '\uFEFF' + text, 'utf8');
console.log('FFFD removed: ' + ffffd);
console.log('Has double-encoding: ' + hasDouble);
console.log('Remaining FFFD: ' + (text.match(/\uFFFD/g) || []).length);

// Syntax check
const { execSync } = require('child_process');
try {
  execSync('node --check "' + path.join(ROOT, 'backend/database/setup.js') + '"', { stdio: 'pipe' });
  console.log('SYNTAX: OK');
} catch (e) {
  const lines = e.stderr.toString().split('\n').filter(l => l.includes('SyntaxError') || l.includes('setup.js:'));
  console.log('SYNTAX ERROR:');
  lines.forEach(l => console.log('  ' + l));
}
