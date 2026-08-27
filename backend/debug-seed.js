const fs = require('fs');
const text = fs.readFileSync('/app/debug-setup.js', 'utf8');
const marker = 'const SEED_DATA = `';
const start = text.indexOf(marker) + marker.length;
const end = text.indexOf('`;', start);
const seedData = text.substring(start, end);
const clean = seedData.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
const lines = clean.split('\n');
console.log('Total lines:', lines.length);
// Show lines around 44-52
for (let i = 43; i < Math.min(52, lines.length); i++) {
  console.log('L' + (i+1) + ':', JSON.stringify(lines[i]));
}
// Also check: what's between line 46 and 48?
console.log('---');
console.log('L46:', JSON.stringify(lines[45]));
console.log('L47:', JSON.stringify(lines[46]));
console.log('L48:', JSON.stringify(lines[47]));
