import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/integration',
      exclude: [
        'node_modules/**',
        'dist/**',
        'coverage/**',
        '**/*.test.{js,ts}',
        '**/*.spec.{js,ts}',
        'server.js',
        'database/**',
        'config/**',
        'scripts/**',
      ],
    },
    setupFiles: ['./tests/integration/setup.js'],
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