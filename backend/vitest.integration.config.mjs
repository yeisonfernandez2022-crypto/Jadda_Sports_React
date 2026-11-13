import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['../tests/backend/integration/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
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
        // mismas exclusiones justificadas que la suite unitaria (scope del
        // umbral combinado: ver vitest.config.mjs)
        'utils/cloudinary.js',
        'utils/correo.js',
        'utils/reporteExcel.js',
        'utils/reportePdf.js',
        'utils/reporteVendedorExcel.js',
        'utils/reporteVendedorPdf.js',
        'utils/celdasExcel.js',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
    },
    setupFiles: ['../tests/backend/integration/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    // Los archivos COMPARTEN la misma BD de test (jadda_sports_test):
    // deben correr SIEMPRE en serie (en Vitest 4 poolOptions.singleFork
    // ya no aplica y los setups paralelos se disparan a deadlocks).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});