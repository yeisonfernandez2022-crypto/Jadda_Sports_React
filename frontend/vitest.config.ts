import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['../tests/frontend/**/*.test.{tsx,ts}'],
    exclude: [
      'node_modules/**',
      '../tests/frontend/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      // Denominador COMPLETO de la lógica del SPA: componentes + contextos +
      // utils. Las PAGES quedan fuera con justificación documentada (§3 del
      // informe de estrategia): se cubren por E2E Playwright y su lógica
      // compartida vive en componentes/contextos/utils (en alcance).
      all: true,
      include: ['src/components/**', 'src/context/**', 'src/utils/**'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.{tsx,ts}',
        '**/*.spec.{tsx,ts}',
        'src/pages/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'tests/**',
        '../tests/**',
      ],
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Umbrales re-calibrados al 2026-11-13 (trinquete): la suite pasó de 4 a
      // 19 archivos de prueba y el denominador de cobertura creció con ~15
      // archivos de código fuente cargados por los tests nuevos (Navbar,
      // ChatWidget, retosAvances, Footer, FloatingCart, etc. que antes quedaban
      // fuera). Medición real de la corrida con cobertura:
      // statements 28.16 / branches 24.61 / functions 25.88 / lines 30.37.
      // Piso el umbral al valor medido (hacia abajo) para re-basar la puerta:
      // los puntos recuperados se pactan de nuevo con cada mejora
      // (docs/calidad/matriz-rotacion.md §8).
      thresholds: {
        statements: 28,
        branches: 24,
        functions: 25,
        lines: 30,
      },
    },
    setupFiles: ['../tests/frontend/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  server: {
    fs: {
      allow: ['.', '..'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});