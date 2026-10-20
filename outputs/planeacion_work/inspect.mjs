import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const p='C:/Users/sena/Downloads/planeacion_tecnica_proyecto.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(p));
for (const opts of [
 {kind:'workbook,sheet,table,drawing',maxChars:12000,tableMaxRows:20,tableMaxCols:16,tableMaxCellChars:120},
 {kind:'definedName',maxChars:3000}
]) { const a=await wb.inspect(opts); console.log(a.ndjson); }
for(let i=0;i<wb.worksheets.items.length;i++){
 const s=wb.worksheets.getItemAt(i); const used=s.getUsedRange(); console.log('\nSHEET',s.name,'used',used?.address);
 if(used) {const v=await wb.inspect({kind:'region',sheetId:s.name,range:used.address,maxChars:12000}); console.log(v.ndjson);}
 const img=await wb.render({sheetName:s.name,autoCrop:'all',scale:1,format:'png'}); await fs.writeFile(`outputs/planeacion_work/orig_${i}.png`,new Uint8Array(await img.arrayBuffer()));
}
