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
      thresholds: {
        statements: 33,
        branches: 32,
        functions: 28,
        lines: 37,
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