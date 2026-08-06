/**
 * Generador de facturas PDF (RF-021).
 * Usa pdfkit: PDF puro en Node, sin dependencias nativas.
 */

const PDFDocument = require("pdfkit");

const ROJO = "#e63946";
const OSCURO = "#111827";
const GRIS = "#6b7280";

// Dimensiones A4 (puntos) — doc.page no está disponible al inicio del Promise
const ANCHO_PAGINA = 595.28;
const ALTO_PAGINA = 841.89;
const MARGEN = 40;

const moneda = (n) => "$" + Number(n || 0).toLocaleString("es-CO");

/**
 * Construye el PDF de la factura de una venta.
 * @param {object} datos - { venta, usuario, items, metodoPago, envio }
 * @returns {Promise<Buffer>}
 */
function generarFacturaPdf({ venta, usuario, items, metodoPago, envio }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: MARGEN });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const ancho = ANCHO_PAGINA - MARGEN - MARGEN;

      // ---- Encabezado (franja oscura) ----
      doc.rect(0, 0, ANCHO_PAGINA, 100).fill(OSCURO);
      doc
        .fill("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(26)
        .text("JADDA SPORTS", MARGEN, 26)
        .font("Helvetica")
        .fontSize(10)
        .text("Tienda deportiva online — Colombia", MARGEN, 56)
        .fontSize(8)
        .text("Ventas: ventas@jaddasports.com · Bogotá D.C.", MARGEN, 72);

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .text("FACTURA", MARGEN + ancho - 150, 28, { width: 150, align: "right" })
        .font("Helvetica")
        .fontSize(9)
        .fill(GRIS)
        .text(`No. ${venta.ID_VENTA}`, MARGEN + ancho - 150, 56, { width: 150, align: "right" })
        .text(new Date(venta.FECHA_VENTA || new Date()).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }), MARGEN + ancho - 150, 70, { width: 150, align: "right" });

      // ---- Datos de la venta ----
      let y = 122;
      const colIzq = MARGEN;
      const colDer = MARGEN + ancho - 160;

      doc.font("Helvetica-Bold").fontSize(9).fill(OSCURO).text("FACTURADO A", colIzq, y);
      doc.font("Helvetica").fontSize(10).fill("#000");
      const cliente = `${usuario.NOMBRE_USUARIO || ""} ${usuario.APELLIDO_USUARIO || ""}`.trim();
      doc.text(cliente || "—", colIzq, y + 14).text(usuario.EMAIL || "", colIzq, y + 28);

      doc.font("Helvetica-Bold").fontSize(9).fill(OSCURO).text("INFORMACIÓN DE LA COMPRA", colDer, y);
      doc.font("Helvetica").fontSize(10).fill("#000");
      doc
        .text(`Referencia: ${venta.REFERENCIA_PAGO || "—"}`, colDer, y + 14)
        .text(`Método de pago: ${metodoPago || "—"}`, colDer, y + 28);

      y += 60;
      doc
        .strokeColor("#e5e7eb")
        .lineWidth(1)
        .moveTo(MARGEN, y)
        .lineTo(MARGEN + ancho, y)
        .stroke();

      // ---- Tabla de productos ----
      y += 14;
      doc
        .rect(MARGEN, y, ancho, 20)
        .fill("#f3f4f6");
      doc
        .fill(OSCURO)
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("PRODUCTO", MARGEN + 6, y + 6)
        .text("CANT.", MARGEN + 290, y + 6, { width: 40, align: "center" })
        .text("P. UNITARIO", MARGEN + 340, y + 6, { width: 80, align: "right" })
        .text("SUBTOTAL", MARGEN + ancho - 80, y + 6, { width: 74, align: "right" });
      y += 26;

      let sumaItems = 0;
      const filas = (items || []).map((item) => {
        const subtotal = Number(item.SUBTOTAL || 0);
        const precio = Number(item.PRECIO_UNITARIO || 0);
        sumaItems += subtotal;
        return { nombre: item.NOMBRE || "Producto", cantidad: Number(item.CANTIDAD || 0), precio, subtotal };
      });

      if (filas.length === 0) {
        doc.font("Helvetica").fontSize(9).fill(GRIS).text("Sin productos registrados.", MARGEN, y);
        y += 18;
      } else {
        filas.forEach((f, i) => {
          if (y > ALTO_PAGINA - 140) {
            doc.addPage();
            y = 50;
          }
          doc
            .font("Helvetica")
            .fontSize(9)
            .fill("#000")
            .text(f.nombre, MARGEN, y + 2, { width: 280 })
            .text(String(f.cantidad), MARGEN + 290, y + 2, { width: 40, align: "center" })
            .text(moneda(f.precio), MARGEN + 340, y + 2, { width: 80, align: "right" })
            .text(moneda(f.subtotal), MARGEN + ancho - 80, y + 2, { width: 74, align: "right" });
          y += 18;
          doc
            .strokeColor("#f3f4f6")
            .lineWidth(0.6)
            .moveTo(MARGEN, y - 9)
            .lineTo(MARGEN + ancho, y - 9)
            .stroke();
        });
      }

      // ---- Totales ----
      const costoEnvio = Number(envio?.COSTO_ENVIO || 0);
      const total = Number(venta.TOTAL || 0);
      const descuento = Math.max(0, sumaItems + costoEnvio - total);

      y += 8;
      const xTot = MARGEN + ancho - 240;
      const dibujarFilaTotal = (label, valor, bold, color) => {
        if (y > ALTO_PAGINA - 80) { doc.addPage(); y = 50; }
        doc
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(bold ? 12 : 9)
          .fill(color || "#000")
          .text(label, xTot, y + 2, { width: 140, align: "right" })
          .text(valor, xTot + 150, y + 2, { width: 90, align: "right" });
        y += bold ? 22 : 16;
      };

      dibujarFilaTotal("Subtotal", moneda(sumaItems), false);
      if (descuento > 0) dibujarFilaTotal("Descuento", "-" + moneda(descuento), false, ROJO);
      dibujarFilaTotal(costoEnvio > 0 ? "Envío" : "Envío (Gratis)", costoEnvio > 0 ? moneda(costoEnvio) : "$0", false);
      doc
        .strokeColor("#111827")
        .lineWidth(1)
        .moveTo(xTot, y - 8)
        .lineTo(xTot + 240, y - 8)
        .stroke();
      dibujarFilaTotal("TOTAL", moneda(total), true, ROJO);

      // ---- Datos de envío ----
      y += 6;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fill(OSCURO)
        .text("DATOS DE ENVÍO", MARGEN, y);
      y += 14;
      doc.font("Helvetica").fontSize(9).fill("#000");
      const dir = [
        envio?.DIRECCION_ENVIO,
        envio?.BARRIO,
        envio?.CIUDAD,
        envio?.DEPARTAMENTO,
      ].filter(Boolean).join(", ");
      doc.text(dir || "—", MARGEN, y, { width: ancho - 100 });
      y += 14;
      if (envio?.TELEFONO_CONTACTO) doc.text(`Teléfono: ${envio.TELEFONO_CONTACTO}`, MARGEN, y);

      // ---- Pie de página ----
      doc
        .rect(0, ALTO_PAGINA - 40, ANCHO_PAGINA, 40)
        .fill(OSCURO);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fill("#9ca3af")
        .text(
          `© ${new Date().getFullYear()} JADDA SPORTS · Gracias por tu compra · Factura generada el ${new Date().toLocaleString("es-CO")}`,
          MARGEN,
          ALTO_PAGINA - 26,
          { width: ancho, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generarFacturaPdf };
