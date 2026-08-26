/**
 * reporteVendedorExcel.js — Reporte del vendedor en Excel (exceljs).
 * Hojas: Ventas (renglones propios, con estado) / Resumen (fórmulas) /
 *        Mas Vendidos (ranking con total) / Serie (ventas por día).
 * Las fórmulas del Resumen excluyen CANCELADA sobre la hoja Ventas.
 */
const ExcelJS = require('exceljs');
const { obtenerReporteVendedor } = require('./reporteVendedorDatos');

const HEADER_BG = 'FF002244';
const DINERO = '"$"#,##0';

async function generarReporteVendedorExcel(idVendedor, query = {}) {
  const { desde, hasta } = (() => {
    const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
    const hoy = new Date();
    const hace30 = new Date(hoy.getTime() - 30 * 86400000);
    return {
      desde: fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10),
      hasta: fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10),
    };
  })();

  const datos = await obtenerReporteVendedor(idVendedor, desde, hasta);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'JADDA SPORTS';
  wb.created = new Date();

  const estiloHeader = (ws, fila) => {
    const row = ws.getRow(fila);
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    row.height = 20;
  };

  // ===== HOJA VENTAS =====
  const wsV = wb.addWorksheet('Ventas');
  wsV.columns = [
    { header: 'Pedido', key: 'pedido', width: 10 },
    { header: 'Fecha', key: 'fecha', width: 18 },
    { header: 'Estado', key: 'estado', width: 13 },
    { header: 'Cliente', key: 'cliente', width: 22 },
    { header: 'Producto', key: 'producto', width: 34 },
    { header: 'Variante', key: 'variante', width: 20 },
    { header: 'Cant.', key: 'cant', width: 7 },
    { header: 'Precio unit.', key: 'precio', width: 14 },
    { header: 'Subtotal', key: 'subtotal', width: 15 },
  ];
  estiloHeader(wsV, 1);
  for (const v of datos.ventas) {
    wsV.addRow({ pedido: v.ID_VENTA, fecha: v.FECHA, estado: v.ESTADO, cliente: v.CLIENTE, producto: v.PRODUCTO, variante: v.VARIANTE || '', cant: v.CANTIDAD, precio: v.PRECIO_UNITARIO, subtotal: v.SUBTOTAL });
  }
  wsV.views = [{ state: 'frozen', ySplit: 1 }];
  wsV.getColumn('precio').numFmt = DINERO;
  wsV.getColumn('subtotal').numFmt = DINERO;

  const ultimaFilaVentas = Math.max(datos.ventas.length + 1, 2);

  // ===== HOJA RESUMEN (fórmulas) =====
  const wsR = wb.addWorksheet('Resumen');
  wsR.columns = [
    { header: 'Métrica', key: 'k', width: 32 },
    { header: 'Valor', key: 'v', width: 18 },
  ];
  estiloHeader(wsR, 1);
  const filasResumen = [
    ['Tienda', datos.vendedor.NOMBRE_EMPRESA],
    ['NIT', datos.vendedor.NIT || '—'],
    ['Periodo', `${desde} a ${hasta}`],
    ['Pedidos con mis productos (sin canceladas)', `COUNTIFS(Ventas!C2:C${ultimaFilaVentas},"<>CANCELADA")`],
    ['Ingresos míos', `SUMIFS(Ventas!I2:I${ultimaFilaVentas},Ventas!C2:C${ultimaFilaVentas},"<>CANCELADA")`],
    ['Unidades vendidas', `SUMIFS(Ventas!G2:G${ultimaFilaVentas},Ventas!C2:C${ultimaFilaVentas},"<>CANCELADA")`],
    ['Venta promedio por pedido', 'ROUND(B6/B5,0)'],
    ['Productos distintos vendidos', datos.resumen.productosVendidos],
  ];
  filasResumen.forEach(([k], i) => {
    const row = wsR.addRow({ k });
    if (i >= 3 && i <= 6) {
      row.getCell('v').value = { formula: filasResumen[i][1] };
    } else {
      row.getCell('v').value = filasResumen[i][1];
    }
    if (i === 4 || i === 6) row.getCell('v').numFmt = DINERO;
  });

  // ===== HOJA MAS VENDIDOS =====
  const wsM = wb.addWorksheet('Mas Vendidos');
  wsM.columns = [
    { header: '#', key: 'pos', width: 5 },
    { header: 'Producto', key: 'producto', width: 40 },
    { header: 'Unidades', key: 'unidades', width: 11 },
    { header: 'Ingresos', key: 'ingresos', width: 16 },
    { header: 'Stock actual', key: 'stock', width: 12 },
  ];
  estiloHeader(wsM, 1);
  datos.masVendidos.forEach((m, i) => {
    wsM.addRow({ pos: i + 1, producto: m.PRODUCTO, unidades: m.unidades, ingresos: m.ingresos, stock: m.stock });
  });
  wsM.getColumn('ingresos').numFmt = DINERO;
  const filaTotalM = datos.masVendidos.length + 2;
  wsM.addRow([]);
  const totM = wsM.addRow({ producto: 'TOTAL', unidades: { formula: `SUM(C2:C${filaTotalM - 1})` }, ingresos: { formula: `SUM(D2:D${filaTotalM - 1})` } });
  totM.font = { bold: true };
  totM.getCell('ingresos').numFmt = DINERO;
  totM.commit();

  // ===== HOJA SERIE =====
  const wsS = wb.addWorksheet('Serie');
  wsS.columns = [
    { header: 'Día', key: 'dia', width: 13 },
    { header: 'Pedidos', key: 'pedidos', width: 9 },
    { header: 'Ingresos', key: 'ingresos', width: 15 },
    { header: 'Gráfica', key: 'barra', width: 50 },
  ];
  estiloHeader(wsS, 1);
  const maxIngreso = Math.max(...datos.serie.map((s) => s.ingresos), 1);
  datos.serie.forEach((s) => {
    wsS.addRow({
      dia: s.dia,
      pedidos: s.pedidos,
      ingresos: s.ingresos,
      barra: '|'.repeat(Math.max(1, Math.round((s.ingresos / maxIngreso) * 45))),
    });
  });
  wsS.getColumn('ingresos').numFmt = DINERO;
  if (datos.serie.length > 0) {
    wsS.getColumn('barra').font = { color: { argb: 'FFE63946' } };
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { generarReporteVendedorExcel };
