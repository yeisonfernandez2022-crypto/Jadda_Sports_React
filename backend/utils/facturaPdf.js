/**
 * Generador de facturas PDF (RF-021).
 * Usa pdfkit: PDF puro en Node, sin dependencias nativas.
 */

const PDFDocument = require("pdfkit");
const path = require("path");
const { resolverRutaImagenLocal } = require("./correo");

const ROJO = "#e63946";
const AZUL = "#002244";
const OSCURO = "#111827";
const GRIS = "#6b7280";

// Logo de la marca (copia local; el backend monta ./backend en /app)
const RUTA_LOGO = path.join(__dirname, "..", "assets", "LogoJadda.png");

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
      // margin: 0 — los textos se colocan con coordenadas absolutas (y fija);
      // con margen 40, pdfkit auto-creaba una página nueva cuando el pie se
      // dibujaba en ALTO_PAGINA - 26 (quedaba fuera de maxY) → pie en página 2.
      const doc = new PDFDocument({ size: "A4", margin: 0 });
      doc.info.Title = `Factura de compra ${venta.ID_VENTA} - JADDA SPORTS`;
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const ancho = ANCHO_PAGINA - MARGEN - MARGEN;

      // ---- Encabezado (franja azul marino, colores de la página) ----
      doc.rect(0, 0, ANCHO_PAGINA, 100).fill(AZUL);
      try {
        doc.image(RUTA_LOGO, 26, 15, { width: 104 });
      } catch (err) {
        // Si el logo no existe (deploy sin assets), se dibuja solo el texto
        doc
          .fill("#ffffff")
          .font("Helvetica-Bold")
          .fontSize(24)
          .text("JADDA SPORTS", MARGEN, 30);
      }
      doc
        .fill("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text("JADDA", 160, 22)
        .fill(ROJO)
        .text("SPORTS", 160 + doc.widthOfString("JADDA "), 22)
        .fill("#ffffff")
        .font("Helvetica-Oblique")
        .fontSize(13)
        .text("Lo mejor en deportes", 160, 52)
        .font("Helvetica")
        .fontSize(8)
        .fill("#cbd5e1")
        .text("Ventas: ventas@jaddasports.com · Bogotá D.C.", 160, 74);

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .text("FACTURA DE COMPRA", MARGEN + ancho - 150, 30, { width: 150, align: "right" })
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
        // Resolución robusta: si el archivo exacto no existe se busca por
        // extensión alterna o cualquier imagen de la carpeta del producto.
        const imgPath = resolverRutaImagenLocal(item.URL_IMAGEN);
        return { nombre: item.NOMBRE || "Producto", cantidad: Number(item.CANTIDAD || 0), precio, subtotal, imgPath };
      });

      if (filas.length === 0) {
        doc.font("Helvetica").fontSize(9).fill(GRIS).text("Sin productos registrados.", MARGEN, y);
        y += 18;
      } else {
        filas.forEach((f, i) => {
          if (y > ALTO_PAGINA - 200) {
            doc.addPage();
            y = 50;
          }
          // Miniatura del producto (34x34) cuando el archivo existe localmente
          const desplazamiento = f.imgPath ? 46 : 0;
          if (f.imgPath) {
            try {
              doc.image(f.imgPath, MARGEN + 3, y + 3, { width: 34, height: 34 });
            } catch (err) { /* imagen no críptica */ }
          }
          doc
            .font("Helvetica")
            .fontSize(9)
            .fill("#000")
            .text(f.nombre, MARGEN + desplazamiento, y + 16, { width: 280 - desplazamiento })
            .text(String(f.cantidad), MARGEN + 290, y + 16, { width: 40, align: "center" })
            .text(moneda(f.precio), MARGEN + 340, y + 16, { width: 80, align: "right" })
            .text(moneda(f.subtotal), MARGEN + ancho - 80, y + 16, { width: 74, align: "right" });
          y += 40;
          doc
            .strokeColor("#f3f4f6")
            .lineWidth(0.6)
            .moveTo(MARGEN, y - 8)
            .lineTo(MARGEN + ancho, y - 8)
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
        // Si no cabe el bloque completo (totales + envío + pie) se pasa de
        // página ENTERO, para que el pie nunca quede solo en otra página.
        if (y > ALTO_PAGINA - 200) { doc.addPage(); y = 50; }
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
        .moveTo(xTot, y - 2)
        .lineTo(xTot + 240, y - 2)
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
        envio?.CODIGO_POSTAL,
      ].filter(Boolean).join(", ");
      // La dirección se muestra SIEMPRE (con "—" si no hay registro)
      doc.text(`Dirección: ${dir || "—"}`, MARGEN, y, { width: ancho - 100 });
      y += 14;
      if (envio?.TELEFONO_CONTACTO) {
        doc.text(`Teléfono: ${envio.TELEFONO_CONTACTO}`, MARGEN, y);
        y += 14;
      }

      // ---- Pie de página ----
      // Se dibuja en la página donde termina el contenido. Solo se pasa a la
      // página siguiente si el contenido ocuparía físicamente el bloque del
      // pie (últimos 45pt de la hoja); en la práctica nunca ocurre porque los
      // totales ya cortan página desde 200pt antes del final.
      if (y > ALTO_PAGINA - 45) { doc.addPage(); y = 50; }
      doc
        .rect(0, ALTO_PAGINA - 40, ANCHO_PAGINA, 40)
        .fill(AZUL);
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
