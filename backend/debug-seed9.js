const fs = require('fs');
const text = fs.readFileSync('/app/debug-setup.js', 'utf8');
const marker = 'const SEED_DATA = `';
const start = text.indexOf(marker) + marker.length;
const end = text.indexOf('`;', start);
const seedData = text.substring(start, end);

// Find lines containing -- inside string literals (not at start of line)
const lines = seedData.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.startsWith('--')) continue; // skip comment lines
  // Check for -- inside the line (not at position 0)
  const ddIdx = line.indexOf('--');
  if (ddIdx > 0) {
    console.log('Line ' + (i+1) + ' (pos ' + ddIdx + '): ' + line.substring(Math.max(0, ddIdx-20), ddIdx+20));
  }
}

// Also check for any backticks or special SQL chars in string values
console.log('\nChecking for problematic chars in data rows...');
const dataLines = seedData.split('\n').filter(l => {
  const t = l.trim();
  return t.startsWith('(') && !t.startsWith('INSERT');
});
for (let i = 0; i < dataLines.length; i++) {
  const line = dataLines[i];
  // Find content between single quotes
  const inString = [];
  let inQ = false;
  for (let c = 0; c < line.length; c++) {
    if (line[c] === "'" && (c === 0 || line[c-1] !== '\\')) inQ = !inQ;
    if (inQ && line.charCodeAt(c) > 127) {
      // Unicode in string - check for problematic sequences
    }
  }
  // Check for unbalanced quotes
  let qCount = 0;
  for (let c = 0; c < line.length; c++) {
    if (line[c] === "'" && (c === 0 || line[c-1] !== '\\')) qCount++;
  }
  if (qCount % 2 !== 0) {
    console.log('UNBALANCED quotes at data row ' + i + ': ' + line.substring(0, 100));
  }
}

// Check for \r still present
const cleanSeed = seedData.replace(/\r/g, '');
if (cleanSeed.includes('\r')) {
  console.log('\nWARNING: \\r still present after replace!');
} else {
  console.log('\nNo \\r remaining after replace - good');
}

// Split by statements and check PRODUCTOS INSERT
const stmts = [];
let current = '';
const cleanLines = cleanSeed.split('\n').filter(l => !l.trim().startsWith('--'));
for (const line of cleanLines) {
  current += line + '\n';
  if (current.trimEnd().endsWith(';')) {
    stmts.push(current.trim());
    current = '';
  }
}

// Find stmt 4 (PRODUCTOS)
for (let i = 0; i < stmts.length; i++) {
  if (stmts[i].includes('INSERT IGNORE INTO PRODUCTOS')) {
    console.log('\nPRODUCTOS stmt index:', i, 'length:', stmts[i].length);
    // Check for multi-line issues
    const sLines = stmts[i].split('\n');
    console.log('Lines:', sLines.length);
    // Check line 2 (first data row)
    console.log('Row 1:', sLines[1].substring(0, 80));
    // Check last line
    console.log('Last line:', sLines[sLines.length - 1].substring(0, 80));
    // Check second to last
    console.log('2nd-to-last:', sLines[sLines.length - 2].substring(0, 80));
    break;
  }
}
