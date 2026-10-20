import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const source='C:/Users/sena/Downloads/planeacion_tecnica_proyecto.xlsx';
const output='C:/Users/sena/Jadda_Sports_React/outputs/planeacion_tecnica_proyecto_completado.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(source));
const checklist=wb.worksheets.getItem('Lista de Chequeo Técnico');
const summary=wb.worksheets.getItem('Resumen y Métricas');
const rows=[
 {row:8,status:'Completado',evidence:'docs/diagrams/arquitectura.md; README.md; docker-compose.yml',note:'Arquitectura web, API, móvil, MySQL y contenedores documentada.'},
 {row:9,status:'Completado',evidence:'docs/calidad/evaluacion-iso-25010.md; docs/calidad/informe-evaluacion-rnf.md',note:'Atributos priorizados y evaluados con evidencia y verificaciones; se registran brechas de capacidad y recursos.'},
 {row:10,status:'Pendiente',evidence:'backend/controllers/; backend/routes/; docs/Restricciones del Proyecto.md',note:'Hay separación modular en el código, pero no se encontró una guía explícita de aplicación de SOLID, DRY y KISS.'},
 {row:12,status:'Completado',evidence:'docs/plan de trabajo.md; README.md; backend/package.json; frontend/package.json; movil/package.json',note:'Stack y versiones fijados para web, backend, móvil, base de datos y contenedores.'},
 {row:13,status:'Completado',evidence:'docs/diagrams/base-de-datos.md; backend/database/schema.sql; backend/database/setup.js',note:'Modelo relacional documentado; esquema versionado y auto-configurado al iniciar.'},
 {row:14,status:'En Proceso',evidence:'backend/package.json; frontend/package.json; movil/package.json; docs/Restricciones del Proyecto.md',note:'Dependencias y servicios externos están identificados; no se encontró una matriz de revisión de licencias.'},
 {row:16,status:'En Proceso',evidence:'tests/smoke.mjs; docs/aceptacion/pruebas-aceptacion.md; package.json',note:'Hay pruebas E2E/API y aceptación formal; no se encontró una suite unitaria configurada.'},
 {row:17,status:'Completado',evidence:'frontend/package.json; frontend/tsconfig.json; docs/RNFs/RNF-008.md',note:'ESLint y compilación TypeScript/Vite forman parte de las herramientas de verificación.'},
 {row:18,status:'En Proceso',evidence:'tests/smoke.mjs; docs/aceptacion/pruebas-aceptacion.md; docs/calidad/plan-mejora-continua.md',note:'La suite smoke y TP-001..035 están definidos; falta establecer y medir una meta de cobertura automatizada.'},
 {row:20,status:'En Proceso',evidence:'.gitignore; docs/Restricciones del Proyecto.md',note:'Git y reglas de protección del repositorio están en uso; no se documentó una estrategia de ramificación.'},
 {row:21,status:'Completado',evidence:'docker-compose.yml; docs/implantacion/03-guia-despliegue.md; docs/Restricciones del Proyecto.md',note:'Desarrollo y entrega local en preview están documentados; producción formal está fuera del despliegue soportado.'},
 {row:22,status:'En Proceso',evidence:'docs/calidad/marco-calidad.md; docs/calidad/plan-mejora-continua.md; frontend/package.json',note:'Existe build gate manual (lint/TypeScript/build); la automatización CI está pendiente (MC-06).'},
 {row:24,status:'Completado',evidence:'backend/server.js; backend/routes/authRoutes.js; backend/middlewares/; backend/.env.example; docs/Restricciones del Proyecto.md',note:'Autenticación por sesión, autorización por roles, controles de acceso y plantilla de secretos documentados.'},
 {row:25,status:'Completado',evidence:'docs/calidad/evaluacion-iso-25010.md; docs/calidad/plan-mejora-continua.md',note:'Riesgos de recursos y concurrencia están identificados y asociados a acciones MC-11 y MC-12.'},
 {row:26,status:'Completado',evidence:'docs/implantacion/02-plan-migracion-respaldos.md; scripts/backup.ps1; scripts/restaurar-backup.ps1',note:'Hay procedimiento de respaldo y recuperación; la restauración en base temporal está verificada.'},
];
for(const item of rows){
 checklist.getRange(`C${item.row}:F${item.row}`).values=[[item.status,'Equipo de desarrollo JADDA',item.evidence,item.note]];
 checklist.getRange(`D${item.row}:F${item.row}`).format.wrapText=true;
 checklist.getRange(`D${item.row}:F${item.row}`).format.verticalAlignment='center';
 checklist.getRange(`A${item.row}:F${item.row}`).format.rowHeight=45;
}
summary.getRange('B5:B8').formulas=[
 ['=COUNTIF(\'Lista de Chequeo Técnico\'!$C$8:$C$26,A5)'],
 ['=COUNTIF(\'Lista de Chequeo Técnico\'!$C$8:$C$26,A6)'],
 ['=COUNTIF(\'Lista de Chequeo Técnico\'!$C$8:$C$26,A7)'],
 ['=COUNTIF(\'Lista de Chequeo Técnico\'!$C$8:$C$26,A8)'],
];
summary.getRange('C5:C8').formulas=[['=B5/$B$9'],['=B6/$B$9'],['=B7/$B$9'],['=B8/$B$9']];
summary.getRange('B9:C9').formulas=[['=SUM(B5:B8)','=SUM(C5:C8)']];
summary.getRange('C5:C9').format.numberFormat='0.0%';
const charts=summary.charts.items;
for(const ch of charts){ch.delete();}
const chart=summary.charts.add('bar',[summary.getRange('A4:A8'),summary.getRange('C4:C8')]);
chart.title='Porcentaje de criterios por estado';
chart.titleTextStyle.fontSize=12;
chart.titleTextStyle.typeface='Arial';
chart.hasLegend=false;
chart.xAxis={axisType:'textAxis',textStyle:{typeface:'Arial',fontSize:10}};
chart.yAxis={numberFormatCode:'0%',numberFormatSourceLinked:false,textStyle:{typeface:'Arial',fontSize:10},minimumScale:0,maximumScale:1};
chart.setPosition('E4','L18');
wb.recalculate();
const check=await wb.inspect({kind:'table',sheetId:'Resumen y Métricas',range:'A4:C9',include:'values,formulas',tableMaxRows:8,tableMaxCols:4});
console.log(check.ndjson);
const statuses=await wb.inspect({kind:'table',sheetId:'Lista de Chequeo Técnico',range:'A6:F26',include:'values',tableMaxRows:22,tableMaxCols:6,tableMaxCellChars:160});
console.log(statuses.ndjson);
const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'formula errors'});
console.log(errors.ndjson);
console.log('charts',JSON.stringify(summary.charts.items.map(c=>({type:c.type,title:c.title?.text,series:c.series.items.map(s=>({formula:s.formula,categoryFormula:s.categoryFormula}))}))));
for(const [name,file,range] of [['Lista de Chequeo Técnico','final_0.png','A1:F26'],['Resumen y Métricas','final_1.png','A1:L18']]){
 const img=await wb.render({sheetName:name,range,scale:1,format:'png'});
 await fs.writeFile(`C:/Users/sena/Jadda_Sports_React/outputs/planeacion_work/${file}`,new Uint8Array(await img.arrayBuffer()));
}
const xlsx=await SpreadsheetFile.exportXlsx(wb); await xlsx.save(output);
console.log('OUTPUT',output);


