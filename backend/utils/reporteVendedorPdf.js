/**
 * reporteVendedorPdf.js — Reporte ejecutivo en PDF (pdfkit) para el vendedor.
 * Casi idéntico al reporte del admin (reportePdf.js) pero filtrado a SUS renglones:
 * portada con su empresa, KPIs, gráficas de barras (ingresos por día + pedidos
 * por estado) y tabla/ranking de productos más vendidos. Estilo azul marino
 * #002244 + rojo #e63946 igual que el admin.
 */
const PDFDocument = require('pdfkit');
const { obtenerReporteVendedor } = require('./reporteVendedorDatos');

const AZUL = '#002244';
const ROJO = '#e63946';
const ANCHO = 595.28;
const ALTO_PAGINA = 841.89;
const MARGEN = 40;

const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const corto = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1).replace('.0', '')}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};

/** Gráfica de barras VERTICALES dibujada con pdfkit (vectorial). */
function graficoBarrasVertical(doc, { titulo, datos, color = ROJO, ancho = ANCHO - MARGEN * 2, alto = 150, etiquetas = true }) {
  const x0 = MARGEN;
  const y0 = doc.y;
  const padSup = 22;
  const hPlot = alto - padSup - 18;

  doc.fontSize(9).font('Helvetica-Bold').fillColor(AZUL).text(titulo, x0, y0, { width: ancho });
  const yTop = y0 + padSup;
  const max = Math.max(...datos.map((d) => d.valor), 1);

  // ejes
  doc.save().moveTo(x0, yTop).lineTo(x0, yTop + hPlot).lineTo(x0 + ancho, yTop + hPlot)
    .lineWidth(1).strokeColor('#cbd5e1').stroke();
  // líneas guía horizontales (25/50/75%)
  [0.25, 0.5, 0.75].forEach((p) => {
    const gy = yTop + hPlot - hPlot * p;
    doc.save().moveTo(x0, gy).lineTo(x0 + ancho, gy).lineWidth(0.5).strokeColor('#f1f5f9').stroke().restore();
    doc.fontSize(6).fillColor('#cbd5e1').text(corto(max * p), x0 - 2, gy - 3, { width: 30, align: 'right', lineBreak: false });
  });

  const n = datos.length || 1;
  const paso = ancho / Math.max(n, 4);
  const bw = Math.min(paso * 0.62, 34);
  datos.forEach((d, i) => {
    const bx = x0 + i * paso + (paso - bw) / 2;
    const bh = Math.max((d.valor / max) * hPlot, 2);
    const by = yTop + hPlot - bh;
    doc.save().rect(bx, by, bw, bh).fill(color);
    if (etiquetas && i < 12) {
      doc.fontSize(6).fillColor(AZUL).font('Helvetica-Bold')
        .text(corto(d.valor), bx - 8, by - 9, { width: bw + 16, align: 'center', lineBreak: false })
        .font('Helvetica');
    }
    const cadaX = Math.ceil(n / (ancho > 400 ? 10 : 5));
    if ((i + 1) % cadaX === 0 || i === n - 1) {
      doc.fontSize(6).fillColor('#64748b').text(String(d.label), bx - 12, yTop + hPlot + 3, { width: bw + 24, align: 'center' });
    }
  });
  doc.y = yTop + hPlot + 16;
}

/** Barras HORIZONTALES (ranking), nombre a la izquierda + valor a la derecha. */
function graficoRankingHorizontal(doc, { titulo, datos, color = AZUL, maxFilas = 10 }) {
  doc.fontSize(9).font('Helvetica-Bold').fillColor(AZUL).text(titulo, MARGEN, doc.y, { width: ANCHO - MARGEN * 2 });
  let y = doc.y + 6;
  const filas = datos.slice(0, maxFilas);
  const max = Math.max(...filas.map((d) => d.valor), 1);
  const labelW = 170;
  const valW = 55;
  const barMax = ANCHO - MARGEN * 2 - labelW - valW - 8;
  filas.forEach((d) => {
    const bwid = Math.max((d.valor / max) * barMax, 3);
    doc.fontSize(7).fillColor('#334155').font('Helvetica')
      .text(String(d.label).slice(0, 42), MARGEN, y + 1.5, { width: labelW, ellipsis: true, lineBreak: false });
    doc.save().rect(MARGEN + labelW, y, barMax, 9).fill('#f1f5f9');
    doc.save().rect(MARGEN + labelW, y, bwid, 9).fill(color);
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(7)
      .text(corto(d.valor), MARGEN + labelW + barMax + 6, y + 1.5, { width: valW, align: 'left', lineBreak: false });
    doc.font('Helvetica');
    y += 15;
  });
  doc.y = y + 8;
}

function tabla(doc, headers, filas, anchos, opts = {}) {
  const x0 = MARGEN;
  let y = doc.y;
  const altoFila = 18;
  // header
  doc.rect(x0, y, ANCHO - MARGEN * 2, altoFila).fill(AZUL);
  doc.fillColor('#fff').fontSize(7.5).font('Helvetica-Bold');
  let cx = x0 + 6;
  headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), cx, y + 5.5, { width: anchos[i] - 12, align: i === 0 ? 'left' : 'left', ellipsis: true });
    cx += anchos[i];
  });
  y += altoFila;
  doc.font('Helvetica').fontSize(7.5).fillColor('#334155');
  filas.forEach((fila, idx) => {
    if (y > ALTO_PAGINA - 70) {
      doc.addPage();
      y = MARGEN;
    }
    if (idx % 2 === 1) {
      doc.rect(x0, y, ANCHO - MARGEN * 2, altoFila).fill('#f8fafc');
      doc.fillColor('#334155');
    }
    let cxx = x0 + 6;
    fila.forEach((celda, i) => {
      doc.text(String(celda ?? ''), cxx, y + 5, { width: anchos[i] - 12, height: altoFila - 4, ellipsis: true });
      cxx += anchos[i];
    });
    y += altoFila;
  });
  doc.x = MARGEN;
  doc.y = y + (opts.espacioDespues ?? 14);
}

async function generarReporteVendedorPdf(idVendedor, query = {}) {
  const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 86400000);
  const desde = fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10);
  const hasta = fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10);

  const d = await obtenerReporteVendedor(idVendedor, desde, hasta);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: MARGEN, info: { Title: `Reporte vendedor ${desde} a ${hasta} — ${d.vendedor.NOMBRE_EMPRESA}` } });

      // ---------- Encabezado ----------
      doc.rect(0, 0, ANCHO, 92).fill(AZUL);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(17);
      doc.text('JADDA', MARGEN, 24, { continued: true }).fillColor(ROJO).text(' SPORTS');
      doc.fillColor('#cbd5e1').font('Helvetica').fontSize(9);
      doc.text(`Reporte ejecutivo de ventas — ${d.vendedor.NOMBRE_EMPRESA}${d.vendedor.NIT ? ` · NIT ${d.vendedor.NIT}` : ''}`, MARGEN, 48);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
      doc.text(`Del ${d.desde} al ${d.hasta} · Solo tus productos`, MARGEN, 64);
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8');
      doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, ANCHO - MARGEN - 190, 30, { width: 190, align: 'right' });
      doc.y = 110;

      // ---------- Resumen ----------
      doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL).text('Resumen del período (solo tus productos)', MARGEN, doc.y);
      doc.moveDown(0.4);
      const kpis = [
        ['Pedidos', String(d.resumen.ordenes)],
        ['Ingresos', dinero(d.resumen.ingresos)],
        ['Ticket promedio', dinero(d.resumen.ticketPromedio)],
        ['Unidades', String(d.resumen.unidades)],
      ];
      const cw = (ANCHO - MARGEN * 2 - 3 * 10) / 4;
      let kx = MARGEN;
      kpis.forEach(([l, v]) => {
        const ky = doc.y;
        doc.roundedRect(kx, ky, cw, 52, 8).lineWidth(1).fillAndStroke("#ffffff", "#e2e8f0");
        doc.fillColor("#64748b").fontSize(7).text(l.toUpperCase(), kx + 8, ky + 9, { width: cw - 16 });
        doc.fillColor(AZUL).fontSize(11).font("Helvetica-Bold").text(v, kx + 8, ky + 24, { width: cw - 16 });
        doc.font("Helvetica");
        kx += cw + 10;
      });
      doc.y += 66;

      // Canceladas como nota
      const canceladas = d.ventas.filter((v) => v.ESTADO === 'CANCELADA').length;
      doc.fontSize(8).fillColor('#64748b');
      doc.text(`${canceladas} renglón(es) cancelado(s) en el rango (no suman ingresos). · ${d.resumen.productosVendidos} producto(s) distinto(s) vendido(s).`, MARGEN, doc.y);
      doc.y += 10;

      // ---------- GRÁFICA 1: Ingresos por día (barras verticales) ----------
      const serieGraf = d.serie.length
        ? d.serie.map((s) => ({ label: s.dia.slice(5).split('-').reverse().join('/'), valor: s.ingresos }))
        : [{ label: '-', valor: 0 }];
      graficoBarrasVertical(doc, { titulo: 'Ingresos por día — tus productos (COP)', datos: serieGraf, color: ROJO, alto: 165 });
      doc.y += 6;

      // ---------- GRÁFICA 2: Pedidos por estado (horizontal) ----------
      const estadosCount = {};
      d.ventas.forEach((v) => {
        estadosCount[v.ESTADO] = (estadosCount[v.ESTADO] || 0) + 1;
      });
      const coloresEstado = { COMPLETADA: '#16a34a', CONFIRMADA: '#0ea5e9', ENVIADA: '#6366f1', PENDIENTE: '#f59e0b', CANCELADA: '#dc2626' };
      let yEstados = doc.y;
      if (yEstados > ALTO_PAGINA - 200) { doc.addPage(); yEstados = MARGEN; }
      doc.fontSize(9).font('Helvetica-Bold').fillColor(AZUL).text('Tus renglones por estado del pedido', MARGEN, yEstados);
      let ye = yEstados + 16;
      const maxEst = Math.max(...Object.values(estadosCount), 1);
      if (Object.keys(estadosCount).length === 0) {
        doc.fontSize(7.5).fillColor('#94a3b8').text('Sin renglones en el rango.', MARGEN, ye);
        ye += 16;
      } else {
        Object.entries(estadosCount).forEach(([est, cant]) => {
          doc.fontSize(7).font('Helvetica').fillColor('#334155')
            .text(est, MARGEN, ye + 1.5, { width: 90, lineBreak: false });
          doc.save().rect(MARGEN + 95, ye, 260, 10).fill('#f1f5f9');
          doc.save().rect(MARGEN + 95, ye, Math.max((cant / maxEst) * 260, 4), 10).fill(coloresEstado[est] || AZUL);
          doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(7)
            .text(String(cant), MARGEN + 95 + 268, ye + 1.5, { lineBreak: false });
          doc.font('Helvetica');
          ye += 17;
        });
      }
      doc.y = ye + 8;

      // ---------- Más vendidos (gráfica + tabla en página nueva) ----------
      doc.addPage();
      graficoRankingHorizontal(doc, {
        titulo: 'Top 10 tus productos más vendidos (unidades)',
        datos: d.masVendidos.map((m) => ({ label: m.PRODUCTO, valor: m.unidades })),
        color: ROJO,
        maxFilas: 10,
      });
      if (doc.y > ALTO_PAGINA - 280) doc.addPage();

      doc.fontSize(11).font('Helvetica-Bold').fillColor(AZUL).text('Detalle de tus más vendidos', MARGEN, doc.y);
      doc.moveDown(0.4);
      tabla(
        doc,
        ['#', 'Producto', 'Uds', 'Ingresos', 'Stock'],
        d.masVendidos.slice(0, 15).map((m, i) => [i + 1, m.PRODUCTO, m.unidades, dinero(m.ingresos), m.stock === 0 ? 'Agotado' : m.stock]),
        [26, 300, 45, 90, 54]
      );

      doc.fontSize(7.5).fillColor('#94a3b8');
      doc.text('Nota: ingresos y unidades corresponden únicamente a los renglones de tus productos. Los pedidos cancelados no suman ingresos.', MARGEN, doc.y, { width: ANCHO - MARGEN * 2 });
      doc.y += 14;

      // ---------- Pie en cada página ----------
      const rango = doc.bufferedPageRange();
      for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(7).fillColor('#94a3b8');
        doc.text(`JADDA SPORTS · Reporte de vendedor — ${d.vendedor.NOMBRE_EMPRESA} · Generado automáticamente`, MARGEN, ALTO_PAGINA - 34, {
          width: ANCHO - MARGEN * 2,
          align: 'center',
        });
        doc.text(`${i + 1} / ${rango.count}`, MARGEN, ALTO_PAGINA - 22, { width: ANCHO - MARGEN * 2, align: 'center' });
      }

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarReporteVendedorPdf };
