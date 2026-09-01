/**
 * reporteVendedorExcel.js — Reporte del vendedor en Excel (exceljs).
 * Casi idéntico al reporte del admin (reporteExcel.js) pero filtrado a
 * los renglones del vendedor. Hojas: Ventas / Resumen (fórmulas) /
 * Mas Vendidos / Graficas (barras vivas con fórmulas REPT + dataBar).
 * Las fórmulas del Resumen excluyen CANCELADA sobre la hoja Ventas.
 */
const ExcelJS = require('exceljs');
const { obtenerReporteVendedor } = require('./reporteVendedorDatos');

const AZUL = 'FF002244';
const GRIS = 'FFF1F5F9';
const MONEDA = '"$"#,##0';

function estiloHeader(hoja, fila, cols) {
  const row = hoja.getRow(fila);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 22;
  cols.forEach((c) => (hoja.getColumn(c).width = Math.max(hoja.getColumn(c).width || 0, 14)));
}

async function generarReporteVendedorExcel(idVendedor, query = {}) {
  const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 86400000);
  const desde = fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10);
  const hasta = fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10);

  const d = await obtenerReporteVendedor(idVendedor, desde, hasta);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JADDA SPORTS — Panel Vendedor';
  wb.created = new Date();

  // ================= HOJA: Ventas (detalle crudo, base de las fórmulas) =====
  const hv = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hv.columns = [
    { header: 'Pedido', key: 'pedido', width: 11 },
    { header: 'Fecha', key: 'fecha', width: 16 },
    { header: 'Estado', key: 'estado', width: 13 },
    { header: 'Cliente', key: 'cliente', width: 24 },
    { header: 'Producto', key: 'producto', width: 34 },
    { header: 'Variante', key: 'variante', width: 20 },
    { header: 'Cant.', key: 'cant', width: 8 },
    { header: 'Precio unit.', key: 'precio', width: 14 },
    { header: 'Subtotal COP', key: 'subtotal', width: 15 },
  ];
  estiloHeader(hv, 1, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  d.ventas.forEach((v, i) => {
    const fila = i + 2;
    hv.getRow(fila).values = [
      v.ID_VENTA,
      v.FECHA,
      v.ESTADO,
      v.CLIENTE,
      v.PRODUCTO,
      v.VARIANTE || '',
      v.CANTIDAD,
      v.PRECIO_UNITARIO,
      v.SUBTOTAL,
    ];
    const r = hv.getRow(fila);
    r.getCell(8).numFmt = MONEDA;
    r.getCell(9).numFmt = MONEDA;
    if (v.ESTADO === 'CANCELADA') {
      r.getCell(3).font = { color: { argb: 'FFDC2626' }, strike: true };
    }
  });
  const ultimaVenta = d.ventas.length + 1;

  // ================= HOJA: Resumen (TODO con fórmulas) ======================
  const hr = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  hr.columns = [
    { header: '', key: 'a', width: 4 },
    { header: 'A', key: 'b', width: 38 },
    { header: 'B', key: 'c', width: 24 },
  ];
  hr.mergeCells('B2:C2');
  hr.getCell('B2').value = `REPORTE DE VENTAS — ${d.vendedor.NOMBRE_EMPRESA}`;
  hr.getCell('B2').font = { bold: true, size: 14, color: { argb: AZUL } };
  hr.mergeCells('B3:C3');
  hr.getCell('B3').value = `${d.vendedor.NIT ? `NIT ${d.vendedor.NIT} · ` : ''}Rango: ${d.desde} al ${d.hasta} · Generado ${new Date().toLocaleString('es-CO')}`;
  hr.getCell('B3').font = { size: 9, color: { argb: 'FF64748B' } };

  // KPIs con fórmulas sobre Ventas (C=Estado, G=Cant, I=Subtotal)
  const kpis = [
    ['Pedidos con mis productos (no cancelados)', `=COUNTIFS(Ventas!C2:C${ultimaVenta},"<>CANCELADA")`, '#,##0'],
    ['Ingresos míos (COP)', `=SUMIFS(Ventas!I2:I${ultimaVenta},Ventas!C2:C${ultimaVenta},"<>CANCELADA")`, MONEDA],
    ['Ticket promedio', '=ROUND(C6/C5,0)', MONEDA],
    ['Unidades vendidas', `=SUMIFS(Ventas!G2:G${ultimaVenta},Ventas!C2:C${ultimaVenta},"<>CANCELADA")`, '#,##0'],
    ['Pedidos cancelados (con mis productos)', `=COUNTIF(Ventas!C2:C${ultimaVenta},"CANCELADA")`, '#,##0'],
    ['Productos distintos vendidos', String(d.resumen.productosVendidos), '#,##0'],
  ];
  let f = 5;
  kpis.forEach(([label, formula, fmt]) => {
    hr.getCell(`B${f}`).value = label;
    hr.getCell(`B${f}`).font = { bold: true, size: 10 };
    const c = hr.getCell(`C${f}`);
    // Si es fórmula (empieza con = o es ROUND/COUNTIFS/SUMIFS/SUMIF/COUNTIF) la pasamos como formula
    if (/^(COUNTIFS|SUMIFS|SUMIF|COUNTIF|ROUND|SUM|AVERAGE)/.test(formula.replace(/^=/, ''))) {
      c.value = { formula: formula.replace(/^=/, '') };
    } else {
      // número plano (productos distintos)
      c.value = Number(formula) || formula;
    }
    c.numFmt = fmt;
    c.alignment = { horizontal: 'right' };
    if (f % 2 === 1) {
      hr.getRow(f).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    }
    f++;
  });

  // Desglose por estado (también con fórmulas)
  f += 1;
  hr.getCell(`B${f}`).value = 'Pedidos por estado (con mis productos)';
  hr.getCell(`B${f}`).font = { bold: true, size: 11, color: { argb: AZUL } };
  f += 1;
  ['COMPLETADA', 'PENDIENTE', 'CONFIRMADA', 'ENVIADA', 'CANCELADA'].forEach((est) => {
    hr.getCell(`B${f}`).value = est;
    const c = hr.getCell(`C${f}`);
    c.value = { formula: `COUNTIF(Ventas!C2:C${ultimaVenta},"${est}")` };
    c.alignment = { horizontal: 'right' };
    f++;
  });

  // ================= HOJA: Más vendidos =====================================
  const hm = wb.addWorksheet('Mas Vendidos', { views: [{ state: 'frozen', ySplit: 1 }] });
  hm.columns = [
    { header: '#', key: 'pos', width: 6 },
    { header: 'Producto', key: 'nombre', width: 46 },
    { header: 'Unidades', key: 'unidades', width: 12 },
    { header: 'Ingresos COP', key: 'ingresos', width: 16 },
    { header: 'Stock actual', key: 'stock', width: 13 },
  ];
  estiloHeader(hm, 1, [1, 2, 3, 4, 5]);
  d.masVendidos.forEach((m, i) => {
    const r = hm.getRow(i + 2);
    r.values = [i + 1, m.PRODUCTO, m.unidades, m.ingresos, m.stock];
    r.getCell(4).numFmt = MONEDA;
  });
  const ultMV = d.masVendidos.length + 1;
  if (d.masVendidos.length > 0) {
    const filaTotMV = hm.getRow(ultMV + 1);
    filaTotMV.getCell(2).value = 'TOTAL';
    filaTotMV.getCell(2).font = { bold: true };
    filaTotMV.getCell(3).value = { formula: `SUM(C2:C${ultMV})` };
    filaTotMV.getCell(3).font = { bold: true };
    filaTotMV.getCell(4).value = { formula: `SUM(D2:D${ultMV})` };
    filaTotMV.getCell(4).numFmt = MONEDA;
    filaTotMV.getCell(4).font = { bold: true };
  }

  // ================= HOJA: Gráficas (barras vivas con fórmulas) =============
  const hg = wb.addWorksheet('Graficas', { views: [{ showGridLines: false }] });
  hg.columns = [
    { header: '', key: 'a', width: 3 },
    { header: 'B', key: 'b', width: 16 },
    { header: 'C', key: 'c', width: 14 },
    { header: 'D', key: 'd', width: 10 },
    { header: 'E', key: 'e', width: 52 },
  ];

  const tituloSeccion = (fila, texto) => {
    hg.getCell(`B${fila}`).value = texto;
    hg.getCell(`B${fila}`).font = { bold: true, size: 12, color: { argb: AZUL } };
  };

  // --- Sección 1: Ingresos por día (solo tus productos) ---
  let gf = 2;
  tituloSeccion(gf, `📈 Ingresos por día — tus productos — ${d.desde} al ${d.hasta}`);
  gf += 1;
  hg.getRow(gf).values = ['', 'Fecha', 'Ingresos', 'Pedidos', 'Gráfica'];
  estiloHeader(hg, gf, [2, 3, 4, 5]);
  gf += 1;
  if (d.serie.length === 0) {
    hg.getCell(`B${gf}`).value = 'Sin ventas en el rango';
    gf += 1;
  } else {
    const maxIng = Math.max(...d.serie.map((s) => s.ingresos), 1);
    d.serie.forEach((s) => {
      hg.getRow(gf).values = ['', s.dia.slice(5), s.ingresos, s.pedidos,
        { formula: `REPT("|",MAX(1,ROUND(C${gf}/${maxIng}*45,0)))` }];
      const r = hg.getRow(gf);
      r.getCell(3).numFmt = MONEDA;
      r.getCell(5).font = { bold: true, color: { argb: 'FFE63946' } };
      gf += 1;
    });
    // dataBar sobre la columna de ingresos
    hg.addConditionalFormatting({
      ref: `C4:C${gf - 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF002244' } }],
    });
    hg.getCell(`B${gf}`).value = 'Total';
    hg.getCell(`B${gf}`).font = { bold: true };
    hg.getCell(`C${gf}`).value = { formula: `SUM(C3:C${gf - 1})` };
    hg.getCell(`C${gf}`).numFmt = MONEDA;
    hg.getCell(`C${gf}`).font = { bold: true };
    hg.getCell(`D${gf}`).value = { formula: `SUM(D3:D${gf - 1})` };
    hg.getCell(`D${gf}`).font = { bold: true };
    gf += 2;
  }

  // --- Sección 2: Top más vendidos ---
  tituloSeccion(gf, '🏆 Tus productos más vendidos (unidades)');
  gf += 1;
  hg.getRow(gf).values = ['', '#', 'Producto', 'Unidades', 'Gráfica'];
  estiloHeader(hg, gf, [2, 3, 4, 5]);
  gf += 1;
  if (d.masVendidos.length === 0) {
    hg.getCell(`B${gf}`).value = 'Sin ventas de productos en el rango';
    gf += 1;
  } else {
    const top = d.masVendidos.slice(0, 15);
    const maxU = Math.max(...top.map((m) => m.unidades), 1);
    top.forEach((m, i) => {
      hg.getRow(gf).values = ['', i + 1, m.PRODUCTO, m.unidades,
        { formula: `REPT("▮",MAX(1,ROUND(D${gf}/${maxU}*40,0)))` }];
      hg.getRow(gf).getCell(4).alignment = { horizontal: 'center' };
      hg.getRow(gf).getCell(5).font = { bold: true, color: { argb: 'FF002244' } };
      gf += 1;
    });
    hg.addConditionalFormatting({
      ref: `D${gf - top.length}:D${gf - 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FFE63946' } }],
    });
    gf += 1;
  }

  hg.getCell(`B${gf}`).value = 'Las barras son fórmulas REPT + formato dataBar: se redibujan solas si cambias los datos. Solo cuentan tus productos (canceladas excluidas).';
  hg.getCell(`B${gf}`).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  return wb.xlsx.writeBuffer();
}

module.exports = { generarReporteVendedorExcel };
