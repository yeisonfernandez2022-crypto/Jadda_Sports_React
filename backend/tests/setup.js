import { afterAll, beforeEach, vi } from 'vitest';

/*
 * Entorno de pruebas unitarias del backend.
 *
 * Los tests mockean el pool de MySQL (ver cada *.test.js), por lo que NO se
 * necesita una base de datos real ni Docker. Antes este archivo levantaba un
 * contenedor cuando CI=true, lo que rompía GitHub Actions.
 */
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.clearAllMocks();
});
