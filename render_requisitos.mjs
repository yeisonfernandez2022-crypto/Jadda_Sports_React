import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL('C:/Users/sena/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const w=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/sena/Jadda_Sports_React/outputs/requisitos-funcionales/Matriz_RF_HU_Jadda_Sports.xlsx'));
for (const [sheetName,range,name] of [['RF','A1:C8','rf_preview.png'],['Registro de usuarios','A1:D9','hu_preview.png']]) { const b=await w.render({sheetName,range,scale:1,format:'png'}); await fs.writeFile(`C:/Users/sena/Jadda_Sports_React/outputs/requisitos-funcionales/${name}`,new Uint8Array(await b.arrayBuffer())); }
