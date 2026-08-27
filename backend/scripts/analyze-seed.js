const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../..');
const text = fs.readFileSync(path.join(ROOT, 'backend/database/setup.js'), 'utf8');

// Extract SEED_DATA string (it's a template literal)
const start = text.indexOf('const SEED_DATA = `') + 19;
const end = text.indexOf('`;', start);
const seedData = text.substring(start, end);

// Remove SQL comments
const clean = seedData.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');

// Split into individual INSERT statements by finding INSERT...; pattern
const stmts = [];
let current = '';
const lines = clean.split('\n');
for (const line of lines) {
  current += line + '\n';
  if (current.trim().endsWith(';')) {
    stmts.push(current.trim());
    current = '';
  }
}
if (current.trim()) stmts.push(current.trim());

console.log('Total statements:', stmts.length);
console.log('First statement preview:', stmts[0].substring(0, 100));
console.log('Last statement preview:', stmts[stmts.length - 1].substring(0, 100));

// Check for syntax issues in each statement
const bad = [];
for (let i = 0; i < stmts.length; i++) {
  const s = stmts[i];
  // Check for unmatched parentheses
  const open = (s.match(/\(/g) || []).length;
  const close = (s.match(/\)/g) || []).length;
  if (open !== close) {
    bad.push({ index: i, open, close, preview: s.substring(0, 80) });
  }
}
if (bad.length > 0) {
  console.log('\nBad statements (unmatched parens):');
  bad.forEach(b => console.log(`  #${b.index}: open=${b.open} close=${b.close} [${b.preview}]`));
} else {
  console.log('\nAll statements have balanced parentheses');
}
