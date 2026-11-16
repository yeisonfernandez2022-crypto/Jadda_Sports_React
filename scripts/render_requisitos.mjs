import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/sena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const root = process.cwd();
const archivo = path.join(root, 'docs', 'entregables-asesoria', 'anexos', 'Matriz_RF_HU_Jadda_Sports.xlsx');
const previewDir = path.join(os.tmpdir(), 'jadda-requisitos-funcionales');
await fs.mkdir(previewDir, { recursive: true });
const w = await SpreadsheetFile.importXlsx(await FileBlob.load(archivo));
for (const [sheetName, range, name] of [['RF', 'A1:C8', 'rf_preview.png'], ['Registro de usuarios', 'A1:D9', 'hu_preview.png']]) {
  const b = await w.render({ sheetName, range, scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, name), new Uint8Array(await b.arrayBuffer()));
}
