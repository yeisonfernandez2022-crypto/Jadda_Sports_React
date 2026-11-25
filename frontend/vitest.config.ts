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
      // utils + panel admin + App (composición y guards de ruta, con suite
      // propia en tests/frontend/App.test.tsx). Las PAGES quedan fuera con
      // justificación documentada (§3 del informe de estrategia): se cubren
      // por E2E Playwright y su lógica compartida vive en
      // componentes/contextos/utils (en alcance).
      all: true,
      include: ['src/App.tsx', 'src/components/**', 'src/context/**', 'src/utils/**', 'src/admin/**'],
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
      // Umbrales re-calibrados al 2026-11-16 (trinquete): el panel admin
      // (src/admin/**) entró al denominador con la Task 7 del plan
      // docs/superpowers/plans/2026-11-16-cobertura-frontend.md. Los 15
      // paneles de admin se testearon con 105 tests (6 lotes) y el
      // denominador creció de ~2.850 a 3.977 statements. Medición real de la
      // corrida con cobertura:
      // statements 51.01 / branches 45.57 / functions 47.30 / lines 54.94.
      // Piso el umbral al valor medido (hacia abajo) para re-basar la puerta:
      // los puntos recuperados se pactan de nuevo con cada mejora
      // (docs/calidad/matriz-rotacion.md §8).
      thresholds: {
        statements: 51,
        branches: 45,
        functions: 47,
        lines: 54,
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