import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/sena/Jadda_Sports_React/outputs/planeacion_tecnica_proyecto_completado.xlsx'));
const s=wb.worksheets.getItem('Lista de Chequeo Técnico');
console.log('wrap',s.getRange('D8:F8').format.wrapText,'height px',s.getRange('A8:F8').format.rowHeightPx,'height',s.getRange('A8:F8').format.rowHeight);
console.log((await wb.inspect({kind:'computedStyle',sheetId:s.name,range:'D8:F9',maxChars:3000})).ndjson);
const img=await wb.render({sheetName:s.name,range:'A1:F26',scale:1,format:'png'});const b=new Uint8Array(await img.arrayBuffer());await (await import('node:fs/promises')).writeFile('C:/Users/sena/Jadda_Sports_React/outputs/planeacion_work/reimport.png',b);
console.log((await wb.inspect({kind:'drawing',sheetId:'Resumen y Métricas',maxChars:4000})).ndjson);
