// ============================================
// TOP-LEVEL MOCKS (must be at module top level)
// ============================================

import { vi } from 'vitest';

// Mock external services
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

vi.mock('passport', () => ({
  default: {
    initialize: vi.fn(),
    session: vi.fn(),
    authenticate: vi.fn(() => (req, res, next) => next()),
    serializeUser: vi.fn(),
    deserializeUser: vi.fn(),
    use: vi.fn(),
  },
  serializeUser: vi.fn(),
  deserializeUser: vi.fn(),
  authenticate: vi.fn(),
  initialize: vi.fn(),
  session: vi.fn(),
  use: vi.fn(),
}));

vi.mock('passport-google-oauth20', () => ({
  Strategy: vi.fn().mockImplementation(() => ({
    name: 'google',
    authenticate: vi.fn(),
  })),
}));

vi.mock('passport-facebook', () => ({
  Strategy: vi.fn().mockImplementation(() => ({
    name: 'facebook',
    authenticate: vi.fn(),
  })),
}));

vi.mock('../middlewares/rateLimiter.js', () => ({
  default: () => (req, res, next) => next(),
  crearRateLimiter: () => (req, res, next) => next(),
}));

vi.mock('../middlewares/authMiddleware.js', () => ({
  verificarSesion: (req, res, next) => {
    req.user = { ID_USUARIO: 1, ID_ROL: 1, EMAIL: 'test@test.com' };
    next();
  },
  esAdmin: (req, res, next) => {
    req.user = { ID_USUARIO: 1, ID_ROL: 1, EMAIL: 'test@test.com' };
    next();
  },
  esVendedor: (req, res, next) => {
    req.user = { ID_USUARIO: 2, ID_ROL: 6, EMAIL: 'vendor@test.com' };
    req.vendedor = { ID_VENDEDOR: 1, ID_USUARIO: 2 };
    next();
  },
  esAdminOVendedor: (req, res, next) => next(),
}));

vi.mock('../middlewares/esVendedor.js', () => ({
  default: (req, res, next) => {
    req.vendedor = { ID_VENDEDOR: 1, ID_USUARIO: 2 };
    next();
  },
}));

vi.mock('../utils/correo.js', () => ({
  imagenComoDataUri: vi.fn().mockResolvedValue(null),
  enviarCorreo: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/estadoPedido.js', () => ({
  notificarCambioEstado: vi.fn().mockResolvedValue(true),
}));

vi.mock('../utils/facturaPdf.js', () => ({
  generarFacturaPDF: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
}));

vi.mock('../utils/numeroPedido.js', () => ({
  generarNumeroPedido: vi.fn((id) => 10000000 + id),
}));

vi.mock('../utils/reglasCupones.js', () => ({
  montoMinimoSegunPorcentaje: vi.fn(() => 0),
  esCuponReto: vi.fn(() => false),
  textoCondiciones: vi.fn(() => ''),
}));

// ============================================
// TEST SETUP
// ============================================

import { beforeAll, afterAll, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { handlers, errorHandlers, emptyHandlers, slowHandlers } from './msw-handlers';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.VITE_API_URL = 'http://localhost:5000';

// MSW server setup
export const server = setupServer(...handlers);
export const errorServer = setupServer(...errorHandlers);
export const emptyServer = setupServer(...emptyHandlers);
export const slowServer = setupServer(...slowHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock scrollTo
window.scrollTo = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock fetch globally for MSW
global.fetch = vi.fn();