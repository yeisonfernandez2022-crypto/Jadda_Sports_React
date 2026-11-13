import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../tests/backend/**/*.test.{js,ts}'],
    exclude: [
      'node_modules/**',
      '../tests/backend/node_modules/**',
      '../tests/backend/integration/**',
    ],
    coverage: {
      provider: 'v8',
      // Denominador COMPLETO del dominio (all:true): los archivos no importados
      // entran con 0 y no maquillan el porcentaje. El umbral REAL se aplica en
      // scripts/cobertura-combinada.mjs sobre unitarias + integración (los
      // controladores se ejercitan de verdad en la suite de integración).
      all: true,
      include: ['controllers/**', 'utils/**', 'middlewares/**', 'routes/**'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
        'config/**',
        'database/**',
        'scripts/**',
        // --- Exclusiones justificadas (definición de cobertura del bootcamp:
        // "lógica de negocio; fuera el arranque, la configuración y los
        // adaptadores de BD o HTTP") ---
        'utils/cloudinary.js', // adaptador HTTP de Cloudinary (subida de medios)
        'utils/correo.js', // adaptador SMTP de correo (nodemailer/Brevo)
        'utils/reporteExcel.js', // generador de documento Excel de reportes (presentación)
        'utils/reportePdf.js', // generador de documento PDF de reportes (presentación)
        'utils/reporteVendedorExcel.js', // idem, reporte del vendedor
        'utils/reporteVendedorPdf.js', // idem, reporte del vendedor
        'utils/celdasExcel.js', // celdas del generador Excel (presentación)
        '../tests/**',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
    },
    setupFiles: ['../tests/backend/setup.js'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});