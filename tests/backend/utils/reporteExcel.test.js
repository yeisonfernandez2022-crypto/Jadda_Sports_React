/**
 * reporteExcel — presentación del alcance en el libro (.xlsx).
 *
 * `obtenerDatosReporte` se DESTRUCTURA en carga dentro de reporteExcel, así que
 * la mutación del módulo ocurre ANTES del require del SUT. Los asserts cargan
 * el buffer real con ExcelJS para verificar encabezados, moneda, fórmulas y
 * notas de alcance.
 */

const { vi, beforeEach, test, expect } = globalThis;

const ExcelJS = require('exceljs');
const reporteDatos = require('../../../backend/utils/reporteDatos');

const datosJadda = () => ({
  desde: '2026-06-01',
  hasta: '2026-06-03',
  alcance: { tipo: 'jadda', idVendedor: null, etiqueta: 'Solo JADDA', sufijo: 'jadda' },
  ventas: [
    {
      ID_VENTA: 1,
      FECHA: '2026-06-01',
      CLIENTE: 'Ana Perez',
      METODO: 'Wompi',
      ESTADO: 'PAGADA',
      ARTICULOS: 2,
      IMPORTE: 100000,
      TOTAL: 150000,
    },
    {
      ID_VENTA: 2,
      FECHA: '2026-06-02',
      CLIENTE: '(sin cuenta)',
      METODO: '—',
      ESTADO: 'CANCELADA',
      ARTICULOS: 0,
      IMPORTE: 0,
      TOTAL: 0,
    },
  ],
  resumen: { totalOrdenes: 1, totalIngresos: 100000, totalUnidades: 2, ticketPromedio: 100000, totalUsuarios: 0 },
  serie: [{ dia: '2026-06-01', ordenes: 1, ingresos: 100000, unidades: 2, nuevosUsuarios: 0 }],
  masVendidos: [{ NOMBRE: 'Guayos', unidades: 2, ingresos: 100000, stock: 5 }],
  usuarios: [{ NOMBRE: 'Ana Perez', EMAIL: 'ana@test.com', ROL: 'Cliente', REGISTRO: '2026-06-01', COMPRAS: 1, GASTADO: 150000 }],
  vendedores: [],
});

let datos;
reporteDatos.obtenerDatosReporte = vi.fn(async () => datos);

const { generarReporteExcel } = require('../../../backend/utils/reporteExcel');

const cargar = async (query = {}) => {
  const buffer = await generarReporteExcel(query);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
};

const textosDe = (hoja) => {
  const textos = [];
  hoja.eachRow((fila) => fila.eachCell((celda) => {
    if (typeof celda.value === 'string') textos.push(celda.value);
  }));
  return textos;
};

beforeEach(() => {
  datos = datosJadda();
});

test('Ventas: importe del alcance en G y total del pedido en H, ambos en moneda', async () => {
  const wb = await cargar({ alcance: 'jadda' });
  const hoja = wb.getWorksheet('Ventas');

  expect(hoja.getCell('G1').value).toBe('Importe del alcance COP');
  expect(hoja.getCell('H1').value).toBe('Total pedido COP');
  expect(hoja.getCell('G2').value).toBe(100000);
  expect(hoja.getCell('H2').value).toBe(150000);
  expect(hoja.getCell('G2').numFmt).toContain('$');
  expect(hoja.getCell('H2').numFmt).toContain('$');
});

test('Resumen: el alcance va en B3, la nota de envío en B4 y las fórmulas siguen apuntando a Ventas!G', async () => {
  const wb = await cargar({ alcance: 'jadda' });
  const hoja = wb.getWorksheet('Resumen');

  expect(hoja.getCell('B3').value).toContain('Alcance: Solo JADDA');
  expect(hoja.getCell('B4').value).toBe(
    'Todo el catálogo usa el total del pedido (incluye envío). Solo JADDA o una tienda suman únicamente sus líneas y no incluyen envío.'
  );
  expect(hoja.getCell('C6').value.formula).toContain('Ventas!G');
});

test('metadatos del libro incluyen alcance y rango', async () => {
  const wb = await cargar({ alcance: 'jadda' });

  expect(wb.title).toBe('Reporte de ventas — Solo JADDA');
  expect(wb.description).toContain('2026-06-01');
  expect(wb.description).toContain('2026-06-03');
});

test('Vendedores: el alcance Solo JADDA explica por qué no hay tiendas', async () => {
  const wb = await cargar({ alcance: 'jadda' });
  const hoja = wb.getWorksheet('Vendedores');

  expect(hoja.getCell('A2').value).toContain('El alcance Solo JADDA no incluye tiendas de vendedores');
});

test('Usuarios: nota que aclara que los registros nuevos no dependen del alcance', async () => {
  const wb = await cargar({ alcance: 'jadda' });
  const hoja = wb.getWorksheet('Usuarios');

  expect(textosDe(hoja)).toContain('Registros nuevos del rango; no depende del alcance');
});

test('tienda: el libro muestra la tienda filtrada y no la nota de JADDA', async () => {
  datos = {
    ...datosJadda(),
    alcance: { tipo: 'tienda', idVendedor: 7, etiqueta: 'Tienda: DeporteX', sufijo: 'tienda-7' },
    vendedores: [{ NOMBRE_EMPRESA: 'DeporteX', EMAIL: 'dx@test.com', PRODUCTOS: 4, UNIDADES: 2, INGRESOS: 100000 }],
  };
  const wb = await cargar({ alcance: 'tienda', tienda: '7' });
  const hoja = wb.getWorksheet('Vendedores');

  expect(hoja.getCell('A2').value).toBe('DeporteX');
  expect(textosDe(hoja).join(' ')).not.toContain('El alcance Solo JADDA no incluye tiendas');
  expect(wb.title).toBe('Reporte de ventas — Tienda: DeporteX');
});
