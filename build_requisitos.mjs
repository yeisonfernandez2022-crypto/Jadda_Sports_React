import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile, Workbook } = await import(pathToFileURL('C:/Users/sena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);

const clean = s => s.replace(/`([^`]+)`/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
function parseCriteria(text) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) if (/^\s*\*\s+\*\*CA-[^*]+\*\*:?/.test(lines[i])) starts.push(i);
  return starts.map((start, n) => {
    const end = starts[n + 1] ?? lines.length;
    const block = lines.slice(start, end);
    const head = block[0].match(/\*\*(CA-[^*]+)\*\*:?\s*(.*)/);
    const scenario = head?.[1] ?? `CA-${n + 1}`;
    const title = clean(head?.[2] ?? '');
    const get = label => {
      const line = block.find(x => x.includes(`**${label}**`));
      if (!line) return '';
      return clean(line.slice(line.indexOf(`**${label}**`) + label.length + 4).replace(/[,;]\s*$/, ''));
    };
    const dado = get('Dado que');
    const cuando = get('cuando');
    const entonces = get('entonces');
    const fallback = clean(block.slice(1).join(' '));
    return { scenario, title, dado: dado || title || fallback, cuando: cuando || 'Al ejecutar el escenario descrito', entonces: entonces || fallback || title };
  });
}
const root = process.cwd();
const input = 'C:/Users/sena/Downloads/requisitos funcionales .xlsx';
const outputDir = path.join(root, 'outputs', 'requisitos-funcionales');
await fs.mkdir(outputDir, { recursive: true });
const rfDir = path.join(root, 'docs', 'RFs');
const huDir = path.join(root, 'docs', 'HUs');
const files = (await fs.readdir(rfDir)).filter(x => /^RF-\d+\.md$/i.test(x)).sort();
const read = async (dir, name) => fs.readFile(path.join(dir, name), 'utf8');
const field = (s, label) => {
  const re = new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|]+)\\|`, 'i');
  return s.match(re)?.[1]?.trim() ?? '';
};
const reqs = [];
for (const filename of files) {
  const rfText = await read(rfDir, filename);
  const id = filename.match(/RF-\d+/i)[0].toUpperCase();
  const title = rfText.match(/^###\s+RF-\d+\s+[—–-]\s*(.+)$/m)?.[1]?.trim() ?? field(rfText, 'Nombre');
  const description = rfText.match(/^\*\s+\*\*Descripción:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '';
  const linked = [];
  for (const huFile of (await fs.readdir(huDir)).filter(x => /^HU-\d+\.md$/i.test(x))) {
    const huText = await read(huDir, huFile);
    const associated = field(huText, 'RF asociados').replace(/[`*]/g, '').split(/[,;\s]+/).map(x => x.trim().toUpperCase()).filter(x => /^RF-\d+$/.test(x));
    if (associated.includes(id)) {
      const huId = huFile.match(/HU-\d+/i)[0].toUpperCase();
      const huTitle = huText.match(/^###\s+HU-\d+\s+[—–-]\s*(.+)$/m)?.[1]?.trim() ?? field(huText, 'Título');
      const story = huText.match(/^\*\s+\*\*Historia:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '';
      const criteria = parseCriteria(huText);
      linked.push({ id: huId, title: huTitle, story, criteria, text: huText });
    }
  }
  // Documentation has a one-to-one mapping in the current project; use the corresponding HU only as a fallback if RF asociados is absent.
  if (!linked.length) {
    const huId = id.replace('RF-', 'HU-');
    const huText = await read(huDir, `${huId}.md`).catch(() => '');
    if (huText) linked.push({ id: huId, title: huText.match(/^###\s+HU-\d+\s+[—–-]\s*(.+)$/m)?.[1]?.trim() ?? '', story: huText.match(/^\*\s+\*\*Historia:\*\*\s*(.+)$/m)?.[1]?.trim() ?? '', criteria: [...huText.matchAll(/^\s*\*\s+\*\*CA-[^*]+\*\*:?\s*(.*)$/gm)].map(m => m[1].trim()).filter(Boolean), text: huText });
  }
  if (id === 'RF-028' && linked.length) {
    linked[0].criteria.push({
      scenario: 'CA-028.4',
      title: 'Consultar productos',
      dado: 'accedo al módulo de gestión de productos del panel de administración',
      cuando: 'consulto la lista del catálogo',
      entonces: 'el sistema muestra los productos registrados con sus datos para que pueda revisarlos y gestionarlos.'
    });
  }
  reqs.push({ id, title, description, linked });
}

const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const workbook = Workbook.create();
const rfSheet = workbook.worksheets.add('RF');
const huSheet = workbook.worksheets.add('Registro de usuarios');

const linkTargets = new Map();
let destinationRow = 1;
for (const r of reqs) for (const hu of r.linked) {
  linkTargets.set(r.id, { row: destinationRow, hu });
  destinationRow += 3 + Math.max(1, hu.criteria.length) + 1;
}
const rfRows = reqs.map(r => [r.title, r.description, r.linked.map(h => `${h.id} — ${h.title}`).join('\n')]);
rfSheet.getRange('A1:C1').merge(); rfSheet.getRange('A1').values = [['JADDA SPORTS — MATRIZ DE REQUISITOS FUNCIONALES']];
rfSheet.getRange('A2:C2').merge(); rfSheet.getRange('A2').values = [['Proyecto de grado | Requisitos funcionales documentados: 61']];
rfSheet.getRange('A4:C4').values = [['NOMBRE DEL REQUISITO', 'DESCRIPCIÓN', 'HISTORIA DE USUARIO ASOCIADA']];
rfSheet.getRange(`A5:C${4 + reqs.length}`).values = rfRows;
rfSheet.getRange(`C5:C${4 + reqs.length}`).formulas = reqs.map(r => {
  const target = linkTargets.get(r.id);
  const label = target.hu.id + ' — ' + target.hu.title;
  return [`=HYPERLINK("#'Registro de usuarios'!A${target.row}","${label.replace(/"/g, '""')}")`];
});
rfSheet.getRange('A1:C1').format = { fill: '#0B2E4F', font: { name: 'Aptos', size: 16, bold: true, color: '#FFFFFF' }, horizontalAlignment: 'left', verticalAlignment: 'center' };
rfSheet.getRange('A2:C2').format = { fill: '#E8EFF5', font: { name: 'Aptos', size: 10, color: '#334155', italic: true } };
rfSheet.getRange('A4:C4').format = { fill: '#C62828', font: { name: 'Aptos', size: 10, bold: true, color: '#FFFFFF' }, wrapText: true, verticalAlignment: 'center' };
rfSheet.getRange(`A5:C${4 + reqs.length}`).format = { font: { name: 'Aptos', size: 10, color: '#1F2937' }, wrapText: true, verticalAlignment: 'top', borders: { preset: 'all', style: 'thin', color: '#D7DEE7' } };
rfSheet.getRange(`A5:A${4 + reqs.length}`).format.font = { name: 'Aptos', size: 10, bold: true, color: '#0B2E4F' };
rfSheet.getRange('A:A').format.columnWidth = 31; rfSheet.getRange('B:B').format.columnWidth = 88; rfSheet.getRange('C:C').format.columnWidth = 58;
rfSheet.getRange('1:1').format.rowHeight = 32; rfSheet.getRange('4:4').format.rowHeight = 30; rfSheet.getRange(`5:${4 + reqs.length}`).format.rowHeight = 66;
rfSheet.freezePanes.freezeRows(4); rfSheet.showGridLines = false;

const records = [];
for (const r of reqs) {
  for (const hu of r.linked) {
    records.push({ r, hu });
  }
}
let row = 1;
for (const { r, hu } of records) {
  const first = row;
  huSheet.getRange(`A${row}:D${row}`).merge();
  huSheet.getRange(`A${row}`).values = [[`${r.id} — ${r.title.toUpperCase()}  |  ${hu.id} — ${hu.title}`]];
  huSheet.getRange(`A${row}:D${row}`).format = { fill: '#0B2E4F', font: { name: 'Aptos', size: 12, bold: true, color: '#FFFFFF' }, verticalAlignment: 'center', wrapText: true };
  row++;
  huSheet.getRange(`A${row}:D${row}`).merge();
  huSheet.getRange(`A${row}`).values = [[`HISTORIA DE USUARIO: ${clean(hu.story)}`]];
  huSheet.getRange(`A${row}:D${row}`).format = { fill: '#E8EFF5', font: { name: 'Aptos', size: 10, color: '#1F2937' }, wrapText: true, verticalAlignment: 'center' };
  row++;
  huSheet.getRange(`A${row}:D${row}`).values = [['# Escenario', 'Dado que (contexto)', 'Cuando (evento)', 'Entonces (resultado esperado)']];
  huSheet.getRange(`A${row}:D${row}`).format = { fill: '#C62828', font: { name: 'Aptos', size: 10, bold: true, color: '#FFFFFF' }, wrapText: true, verticalAlignment: 'center' };
  row++;
  const criteria = hu.criteria.length ? hu.criteria : [{ scenario: 'Sin criterios', title: '', dado: '', cuando: '', entonces: 'La historia de usuario no incluye criterios de aceptación explícitos en la documentación.' }];
  const values = criteria.map((c, i) => [`${i + 1}. ${c.scenario}${c.title ? ` — ${c.title}` : ''}`, c.dado, c.cuando, c.entonces]);
  huSheet.getRange(`A${row}:D${row + values.length - 1}`).values = values;
  huSheet.getRange(`A${row}:D${row + values.length - 1}`).format = { font: { name: 'Aptos', size: 9, color: '#1F2937' }, wrapText: true, verticalAlignment: 'top', borders: { preset: 'all', style: 'thin', color: '#D7DEE7' } };
  huSheet.getRange(`A${row}:A${row + values.length - 1}`).format.font = { name: 'Aptos', size: 9, bold: true, color: '#0B2E4F' };
  row += values.length + 1;
}
huSheet.getRange('A:A').format.columnWidth = 38; huSheet.getRange('B:B').format.columnWidth = 52; huSheet.getRange('C:C').format.columnWidth = 46; huSheet.getRange('D:D').format.columnWidth = 62;
huSheet.getRange(`1:${row}`).format.rowHeight = 42; huSheet.freezePanes.freezeRows(0); huSheet.showGridLines = false;
await workbook.recalculate();
const out = await SpreadsheetFile.exportXlsx(workbook);
const outPath = path.join(outputDir, 'Matriz_RF_HU_Jadda_Sports.xlsx');
await out.save(outPath);
console.log(JSON.stringify({ output: outPath, requirements: reqs.length, mappedStories: records.length, criteria: records.reduce((n,x)=>n+x.hu.criteria.length,0), sheets: ['RF','Registro de usuarios'] }));







