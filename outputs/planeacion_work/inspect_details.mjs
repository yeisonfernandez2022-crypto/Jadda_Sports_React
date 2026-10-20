import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/sena/Downloads/planeacion_tecnica_proyecto.xlsx'));
for(const name of ['Lista de Chequeo Técnico','Resumen y Métricas']) {
 const s=wb.worksheets.getItem(name); console.log('SHEET',name);
 console.log('values',JSON.stringify(s.getRange(name.startsWith('Lista')?'A1:F26':'A1:C9').values));
 console.log('formulas',JSON.stringify(s.getRange(name.startsWith('Lista')?'A1:F26':'A1:C9').formulas));
 console.log('validations',JSON.stringify(s.dataValidations.items?.map(v=>({range:v.range,rule:v.rule}))));
 console.log('charts',s.charts.items.map(c=>({name:c.name,type:c.type,title:c.title?.text,series:c.series.items.map(x=>({name:x.name,formula:x.formula,categoryFormula:x.categoryFormula}))})));
}
