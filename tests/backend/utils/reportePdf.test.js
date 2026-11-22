/**
 * reportePdf — presentación del alcance en el PDF ejecutivo.
 *
 * `obtenerDatosReporte` se DESTRUCTURA en carga dentro de reportePdf → se muta
 * ANTES del require del SUT. `PDFDocument.prototype.text` se intercepta para
 * recoger los strings dibujados y se envuelve el constructor de pdfkit para
 * capturar `info.Title`, sin descomprimir el payload del PDF.
 */

const { vi, beforeEach, afterAll, test, expect } = globalThis;

const reporteDatos = require('../../../backend/utils/reporteDatos');

const PDFDocument = require('pdfkit');
const rutaPdfkit = require.resolve('pdfkit');
const opcionesDoc = [];
const PdfOriginal = PDFDocument;
function PdfEspia(opciones) {
  opcionesDoc.push(opciones);
  return new PdfOriginal(opciones);
}
PdfEspia.prototype = PdfOriginal.prototype;
require.cache[rutaPdfkit].exports = PdfEspia;

const textos = [];
const textOriginal = PDFDocument.prototype.text;
PDFDocument.prototype.text = function (texto, ...resto) {
  textos.push(String(texto));
  return textOriginal.call(this, texto, ...resto);
};

const datosBase = () => ({
  desde: '2026-06-01',
  hasta: '2026-06-03',
  alcance: { tipo: 'jadda', idVendedor: null, etiqueta: 'Solo JADDA', sufijo: 'jadda' },
  resumen: { totalOrdenes: 1, totalIngresos: 100000, totalUnidades: 2, ticketPromedio: 100000, totalUsuarios: 0 },
  ventas: [{ ID_VENTA: 1, ESTADO: 'PAGADA' }, { ID_VENTA: 2, ESTADO: 'CANCELADA' }],
  serie: [{ dia: '2026-06-01', ordenes: 1, ingresos: 100000, unidades: 2, nuevosUsuarios: 0 }],
  masVendidos: [],
  usuarios: [],
  vendedores: [],
});

let datos;
reporteDatos.obtenerDatosReporte = vi.fn(async () => datos);

const { generarReportePdf } = require('../../../backend/utils/reportePdf');

const NOTA_ENVIO =
  'Todo el catálogo usa el total del pedido (incluye envío). Solo JADDA o una tienda suman únicamente sus líneas y no incluyen envío.';

beforeEach(() => {
  datos = datosBase();
  textos.length = 0;
  opcionesDoc.length = 0;
});

afterAll(() => {
  PDFDocument.prototype.text = textOriginal;
  require.cache[rutaPdfkit].exports = PdfOriginal;
});

test('jadda: encabezado con alcance, nota de envío, sin tiendas y metadatos', async () => {
  const buffer = await generarReportePdf({ alcance: 'jadda' });

  expect(buffer.slice(0, 5).toString()).toBe('%PDF-');
  expect(textos.some((t) => t.includes('Del 2026-06-01 al 2026-06-03 · Solo JADDA'))).toBe(true);
  expect(textos).toContain(NOTA_ENVIO);
  expect(textos).toContain('Sin tiendas en este alcance');
  expect(opcionesDoc[0].info.Title).toBe('Reporte de ventas 2026-06-01 a 2026-06-03 — Solo JADDA');
});

test('todo: encabezado con todo el catálogo y vendedores listados sin mensaje de vacío', async () => {
  datos = {
    ...datosBase(),
    alcance: { tipo: 'todo', idVendedor: null, etiqueta: 'Todo el catálogo', sufijo: 'todo' },
    vendedores: [{ NOMBRE_EMPRESA: 'DeporteX', PRODUCTOS: 4, UNIDADES: 2, INGRESOS: 100000 }],
  };
  await generarReportePdf({});

  expect(textos.some((t) => t.includes('Del 2026-06-01 al 2026-06-03 · Todo el catálogo'))).toBe(true);
  expect(textos).toContain(NOTA_ENVIO);
  expect(textos).not.toContain('Sin tiendas en este alcance');
  expect(textos).toContain('DeporteX');
});

test('usuarios: el título del bloque aclara que no depende del alcance', async () => {
  await generarReportePdf({ alcance: 'jadda' });

  expect(textos).toContain('Los usuarios nuevos no dependen del alcance del reporte.');
});
