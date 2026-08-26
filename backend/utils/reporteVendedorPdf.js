/**
 * reporteVendedorPdf.js — Reporte ejecutivo en PDF (pdfkit) para el vendedor:
 * portada con su empresa, KPIs, gráfica de barras de la serie diaria y
 * tabla de productos más vendidos. Todo filtrado a SUS renglones.
 */
const PDFDocument = require('pdfkit');
const { obtenerReporteVendedor } = require('./reporteVendedorDatos');

const AZUL = '#002244';
const ROJO = '#e63946';

const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
const corto = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${v}`;
};

async function generarReporteVendedorPdf(idVendedor, query = {}) {
  const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 30 * 86400000);
  const desde = fechaValida(query.desde) ? query.desde : hace30.toISOString().slice(0, 10);
  const hasta = fechaValida(query.hasta) ? query.hasta : hoy.toISOString().slice(0, 10);

  const datos = await obtenerReporteVendedor(idVendedor, desde, hasta);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Reporte vendedor ${desde} a ${hasta}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ===== PORTADA / ENCABEZADO =====
    doc.rect(0, 0, doc.page.width, 120).fill(AZUL);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('JADDA', 40, 35, { continued: true }).fillColor(ROJO).text(' SPORTS');
    doc.fillColor('#cbd5e1').font('Helvetica').fontSize(9)
      .text(`Reporte de ventas · ${datos.vendedor.NOMBRE_EMPRESA}${datos.vendedor.NIT ? ` · NIT ${datos.vendedor.NIT}` : ''}`, 40, 68);
    doc.text(`Periodo: ${desde} a ${hasta}`, 40, 84);
    let y = 150;

    // ===== KPI CARDS =====
    const kpis = [
      ['Ingresos míos', dinero(datos.resumen.ingresos)],
      ['Pedidos', String(datos.resumen.ordenes)],
      ['Unidades', String(datos.resumen.unidades)],
      ['Promedio/pedido', dinero(datos.resumen.ticketPromedio)],
    ];
    const cardW = (doc.page.width - 80 - 30) / 4;
    kpis.forEach(([label, valor], i) => {
      const x = 40 + i * (cardW + 10);
      doc.roundedRect(x, y, cardW, 62, 8).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fillColor('#64748b').font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x + 8, y + 12, { width: cardW - 16 });
      doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(13).text(valor, x + 8, y + 28, { width: cardW - 16 });
    });
    y += 90;

    // ===== SERIE DIARIA (barras) =====
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text('Ventas por día (solo tus productos)', 40, y);
    y += 8;
    if (datos.serie.length === 0) {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(9).text('Sin ventas en el rango seleccionado.', 40, y + 20);
      y += 50;
    } else {
      const maxIng = Math.max(...datos.serie.map((s) => s.ingresos), 1);
      const chartH = 130;
      const chartW = doc.page.width - 80;
      const pasoW = chartW / datos.serie.length;
      const barW = Math.min(pasoW * 0.6, 26);

      // líneas guía
      for (let g = 1; g <= 3; g++) {
        const gy = y + 14 + (chartH / 4) * g;
        doc.moveTo(40, gy).lineTo(40 + chartW, gy).strokeColor('#f1f5f9').lineWidth(1).stroke();
      }
      datos.serie.forEach((s, i) => {
        const h = Math.max((s.ingresos / maxIng) * chartH, 2);
        const x = 40 + i * pasoW + (pasoW - barW) / 2;
        doc.rect(x, y + 14 + chartH - h, barW, h).fill(ROJO);
        if (datos.serie.length <= 20) {
          doc.fillColor('#64748b').font('Helvetica').fontSize(6.5)
            .text(s.dia.slice(5), 40 + i * pasoW, y + 18 + chartH, { width: pasoW, align: 'center' });
        }
        doc.fillColor('#334155').font('Helvetica').fontSize(6)
          .text(corto(s.ingresos), 40 + i * pasoW, y + 10 + chartH - h, { width: pasoW, align: 'center' });
      });
      y += chartH + 34;
    }

    // ===== MÁS VENDIDOS =====
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12).text('Tus productos más vendidos', 40, y);
    y += 14;

    const colX = [40, 260, 380, 480];
    doc.rect(40, y, doc.page.width - 80, 20).fill('#f1f5f9');
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(8.5);
    doc.text('#', colX[0] + 5, y + 6);
    doc.text('Producto', colX[1], y + 6);
    doc.text('Unidades', colX[2], y + 6);
    doc.text('Ingresos', colX[3], y + 6);
    y += 26;

    if (datos.masVendidos.length === 0) {
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(9).text('Sin datos en el rango.', 40, y);
    } else {
      datos.masVendidos.forEach((m, i) => {
        if (y > doc.page.height - 70) { doc.addPage(); y = 50; }
        if (i % 2 === 1) doc.rect(40, y - 3, doc.page.width - 80, 17).fill('#f8fafc');
        doc.fillColor('#0f172a').font('Helvetica').fontSize(8.5);
        doc.text(String(i + 1), colX[0] + 5, y);
        doc.text(m.PRODUCTO.length > 38 ? m.PRODUCTO.slice(0, 36) + '…' : m.PRODUCTO, colX[1], y, { width: 110, ellipsis: true });
        doc.text(String(m.unidades), colX[2], y);
        doc.font('Helvetica-Bold').text(dinero(m.ingresos), colX[3], y);
        y += 17;
      });
    }

    // ===== PIE =====
    doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5)
      .text(
        `Generado por JADDA SPORTS el ${new Date().toLocaleString("es-CO")} · Los ingresos corresponden únicamente a los renglones de tus productos.`,
        40, doc.page.height - 45,
        { width: doc.page.width - 80, align: 'center' }
      );

    doc.end();
  });
}

module.exports = { generarReporteVendedorPdf };
