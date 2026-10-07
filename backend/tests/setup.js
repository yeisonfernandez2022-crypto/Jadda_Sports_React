import { beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'jadda_sports_test';
process.env.PORT = '5001';
process.env.SESSION_SECRET = 'test_session_secret';
process.env.EMAIL_USER = 'test@test.com';
process.env.EMAIL_PASS = 'test_pass';
process.env.GOOGLE_CLIENT_ID = 'test_google_client_id';
process.env.GOOGLE_CLIENT_SECRET = 'test_google_client_secret';
process.env.FACEBOOK_CLIENT_ID = 'test_fb_client_id';
process.env.FACEBOOK_CLIENT_SECRET = 'test_fb_client_secret';
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'test123';
process.env.NEWSLETTER_INTERVAL_HORAS = '72';

// Mock external services
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    verify: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock passport strategies
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

// Global test timeout
beforeAll(() => {
  // Increase timeout for DB operations
  vi.setConfig({ testTimeout: 30000 });
});

afterAll(() => {
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
});