/**
 * Genera el reporte de ventas en Excel (.xlsx) con FÓRMULAS reales:
 * el Resumen calcula con SUMIF/COUNTIFS/AVERAGE sobre la hoja "Ventas",
 * y los totales de Más Vendidos / Usuarios / Vendedores usan SUM().
 * Al abrirlo en Excel, los valores se recalculan solos.
 */
const ExcelJS = require('exceljs');
const { obtenerDatosReporte } = require('../utils/reporteDatos');

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

async function generarReporteExcel(query) {
  const d = await obtenerDatosReporte(query);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JADDA SPORTS — Panel Admin';
  wb.created = new Date();

  // ================= HOJA: Ventas (detalle crudo, base de las fórmulas) =====
  const hv = wb.addWorksheet('Ventas', { views: [{ state: 'frozen', ySplit: 1 }] });
  hv.columns = [
    { header: 'Pedido', key: 'pedido', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 13 },
    { header: 'Cliente', key: 'cliente', width: 26 },
    { header: 'Método de pago', key: 'metodo', width: 18 },
    { header: 'Estado', key: 'estado', width: 14 },
    { header: 'Artículos', key: 'articulos', width: 11 },
    { header: 'Total COP', key: 'total', width: 15 },
  ];
  estiloHeader(hv, 1, [1, 2, 3, 4, 5, 6, 7]);
  d.ventas.forEach((v, i) => {
    const fila = i + 2;
    hv.getRow(fila).values = [
      v.ID_VENTA,
      v.FECHA,
      v.CLIENTE,
      v.METODO,
      v.ESTADO,
      v.ARTICULOS,
      v.TOTAL,
    ];
    const r = hv.getRow(fila);
    r.getCell(7).numFmt = MONEDA;
    if (v.ESTADO === 'CANCELADA') {
      r.getCell(5).font = { color: { argb: 'FFDC2626' }, strike: true };
    }
  });
  const ultimaVenta = d.ventas.length + 1;

  // ================= HOJA: Resumen (TODO con fórmulas) ======================
  const hr = wb.addWorksheet('Resumen', { views: [{ showGridLines: false }] });
  hr.columns = [
    { header: '', key: 'a', width: 4 },
    { header: 'A', key: 'b', width: 34 },
    { header: 'B', key: 'c', width: 22 },
  ];
  hr.mergeCells('B2:C2');
  hr.getCell('B2').value = `REPORTE DE VENTAS JADDA SPORTS`;
  hr.getCell('B2').font = { bold: true, size: 15, color: { argb: AZUL } };
  hr.mergeCells('B3:C3');
  hr.getCell('B3').value = `Rango: ${d.desde} al ${d.hasta} · Generado ${new Date().toLocaleString('es-CO')}`;
  hr.getCell('B3').font = { size: 10, color: { argb: 'FF64748B' } };

  const kpis = [
    ['Órdenes válidas (no canceladas)', `=COUNTIFS(Ventas!E2:E${ultimaVenta},"<>CANCELADA")`, '#,##0'],
    ['Ingresos totales', `=SUMIF(Ventas!E2:E${ultimaVenta},"<>CANCELADA",Ventas!G2:G${ultimaVenta})`, MONEDA],
    ['Ticket promedio', '=ROUND(C6/C5,0)', MONEDA],
    ['Unidades vendidas', `=SUMIF(Ventas!E2:E${ultimaVenta},"<>CANCELADA",Ventas!F2:F${ultimaVenta})`, '#,##0'],
    ['Órdenes canceladas', `=COUNTIF(Ventas!E2:E${ultimaVenta},"CANCELADA")`, '#,##0'],
  ];
  let f = 5;
  kpis.forEach(([label, formula, fmt]) => {
    hr.getCell(`B${f}`).value = label;
    hr.getCell(`B${f}`).font = { bold: true, size: 11 };
    const c = hr.getCell(`C${f}`);
    c.value = { formula: formula.replace(/^=/, '') };
    c.numFmt = fmt;
    c.alignment = { horizontal: 'right' };
    if (f % 2 === 1) {
      hr.getRow(f).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    }
    f++;
  });

  // Desglose por estado (también con fórmulas)
  f += 1;
  hr.getCell(`B${f}`).value = 'Pedidos por estado';
  hr.getCell(`B${f}`).font = { bold: true, size: 12, color: { argb: AZUL } };
  f += 1;
  ['COMPLETADA', 'PENDIENTE', 'CONFIRMADA', 'ENVIADA', 'CANCELADA'].forEach((est) => {
    hr.getCell(`B${f}`).value = est;
    const c = hr.getCell(`C${f}`);
    c.value = { formula: `COUNTIF(Ventas!E2:E${ultimaVenta},"${est}")` };
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
    r.values = [i + 1, m.NOMBRE, m.unidades, m.ingresos, m.stock];
    r.getCell(4).numFmt = MONEDA;
  });
  const ultMV = d.masVendidos.length + 1;
  const filaTotMV = hm.getRow(ultMV + 1);
  filaTotMV.getCell(2).value = 'TOTAL';
  filaTotMV.getCell(2).font = { bold: true };
  filaTotMV.getCell(3).value = { formula: `SUM(C2:C${ultMV})` };
  filaTotMV.getCell(3).font = { bold: true };
  filaTotMV.getCell(4).value = { formula: `SUM(D2:D${ultMV})` };
  filaTotMV.getCell(4).numFmt = MONEDA;
  filaTotMV.getCell(4).font = { bold: true };

  // ================= HOJA: Usuarios =========================================
  const hu = wb.addWorksheet('Usuarios', { views: [{ state: 'frozen', ySplit: 1 }] });
  hu.columns = [
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Correo', key: 'email', width: 32 },
    { header: 'Rol', key: 'rol', width: 14 },
    { header: 'Fecha registro', key: 'registro', width: 15 },
    { header: 'Compras en rango', key: 'compras', width: 16 },
    { header: 'Gastado en rango', key: 'gastado', width: 17 },
  ];
  estiloHeader(hu, 1, [1, 2, 3, 4, 5, 6]);
  d.usuarios.forEach((u, i) => {
    const r = hu.getRow(i + 2);
    r.values = [u.NOMBRE.trim(), u.EMAIL, u.ROL, u.REGISTRO, u.COMPRAS, u.GASTADO];
    r.getCell(6).numFmt = MONEDA;
  });
  if (d.usuarios.length > 0) {
    const uUlt = d.usuarios.length + 1;
    const ft = hu.getRow(uUlt + 1);
    ft.getCell(1).value = `Total usuarios nuevos`;
    ft.getCell(1).font = { bold: true };
    ft.getCell(2).value = { formula: `COUNTA(B2:B${uUlt})` };
    ft.getCell(2).font = { bold: true };
    ft.getCell(5).value = { formula: `SUM(E2:E${uUlt})` };
    ft.getCell(5).alignment = { horizontal: 'center' };
    ft.getCell(5).font = { bold: true };
    ft.getCell(6).value = { formula: `SUM(F2:F${uUlt})` };
    ft.getCell(6).numFmt = MONEDA;
    ft.getCell(6).font = { bold: true };
  }

  // ================= HOJA: Vendedores =======================================
  const hd = wb.addWorksheet('Vendedores', { views: [{ state: 'frozen', ySplit: 1 }] });
  hd.columns = [
    { header: 'Empresa', key: 'empresa', width: 34 },
    { header: 'Correo', key: 'email', width: 30 },
    { header: 'Productos publicados', key: 'productos', width: 19 },
    { header: 'Unidades en rango', key: 'unidades', width: 17 },
    { header: 'Ingresos en rango', key: 'ingresos', width: 18 },
  ];
  estiloHeader(hd, 1, [1, 2, 3, 4, 5]);
  d.vendedores.forEach((x, i) => {
    const r = hd.getRow(i + 2);
    r.values = [x.NOMBRE_EMPRESA || '(sin nombre)', x.EMAIL, x.PRODUCTOS, x.UNIDADES, x.INGRESOS];
    r.getCell(5).numFmt = MONEDA;
  });
  if (d.vendedores.length > 0) {
    const vUlt = d.vendedores.length + 1;
    const fv = hd.getRow(vUlt + 1);
    fv.getCell(1).value = 'TOTAL';
    fv.getCell(1).font = { bold: true };
    fv.getCell(3).value = { formula: `SUM(C2:C${vUlt})` };
    fv.getCell(3).font = { bold: true };
    fv.getCell(4).value = { formula: `SUM(D2:D${vUlt})` };
    fv.getCell(4).font = { bold: true };
    fv.getCell(5).value = { formula: `SUM(E2:E${vUlt})` };
    fv.getCell(5).numFmt = MONEDA;
    fv.getCell(5).font = { bold: true };
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

  // --- Sección 1: Ingresos por día ---
  let gf = 2;
  tituloSeccion(gf, `📈 Ingresos por día — ${d.desde} al ${d.hasta}`);
  gf += 1;
  hg.getRow(gf).values = ['', 'Fecha', 'Ingresos', 'Órdenes', 'Gráfica'];
  estiloHeader(hg, gf, [2, 3, 4, 5]);
  gf += 1;
  if (d.serie.length === 0) {
    hg.getCell(`B${gf}`).value = 'Sin ventas en el rango';
    gf += 1;
  } else {
    const maxIng = Math.max(...d.serie.map((s) => s.ingresos), 1);
    d.serie.forEach((s) => {
      hg.getRow(gf).values = ['', s.dia.slice(5), s.ingresos, s.ordenes,
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
  tituloSeccion(gf, '🏆 Productos más vendidos (unidades)');
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
      hg.getRow(gf).values = ['', i + 1, m.NOMBRE, m.unidades,
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

  hg.getCell(`B${gf}`).value = 'Las barras son fórmulas REPT + formato dataBar: se redibujan solas si cambias los datos.';
  hg.getCell(`B${gf}`).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  return wb.xlsx.writeBuffer();
}

module.exports = { generarReporteExcel };
