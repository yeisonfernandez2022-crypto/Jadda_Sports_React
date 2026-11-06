import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Carga opcional de tests/.env (credenciales/URLs del despliegue local).
// Los valores ya presentes en el entorno tienen prioridad (CI no lo usa).
try {
  for (const line of readFileSync(join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
// Parseo SIN regex superpuesta (Sonar S8786): clave = valor
    const eq = line.indexOf('=');
    const clave = line.slice(0, eq).trim();
    if (eq > 0 && /^[A-Z0-9_]+$/.test(clave) && process.env[clave] === undefined) {
      let valor = line.slice(eq + 1).trim();
      if (valor.length >= 2) { const c0 = valor[0]; if ((c0 === '"' || c0 === "'") && valor[valor.length - 1] === c0) valor = valor.slice(1, -1); }
      process.env[clave] = valor;
    }
  }
} catch {
  /* tests/.env no existe en este entorno (por ejemplo CI) */
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  use: {
    baseURL: process.env.WEB_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // El video exige el binario ffmpeg en el host (no existe en este PC y su
    // descarga falla); la corrida local no lo necesita.
    video: process.env.CI ? 'retain-on-failure' : 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'msedge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run preview',
    cwd: '../frontend',
    url: 'http://localhost:5173',
    // CI: el workflow ya arranca el preview ANTES ("Start frontend preview")
    // con VITE_PROXY_TARGET correcto para el proxy /api — Playwright debe
    // REUSARLO (con false el arranque propio muere: puerto 5173 ocupado).
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      VITE_API_URL: process.env.API_URL || 'http://localhost:5000',
    },
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});