import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{tsx,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.{tsx,ts}',
        '**/*.spec.{tsx,ts}',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/pages/**/*.test.tsx',
        'src/components/**/*.test.tsx',
        'tests/**',
      ],
      thresholds: {
        statements: 33,
        branches: 32,
        functions: 28,
        lines: 37,
      },
    },
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});