import { http, HttpResponse, type RequestHandler } from 'msw';

/**
 * Handlers MSW de los endpoints del panel administrativo.
 *
 * Archivo NUEVO de la rama testing/frontend-cobertura: los handlers globales
 * de `tests/frontend/msw-handlers.ts` no se tocan; cada suite de admin activa
 * estos con `server.use(...HANDLERS_ADMIN)` en su beforeEach.
 *
 * Los datos usan el prefijo ADMIN-TEST para trazabilidad en la BD de prueba.
 */

/** Perfil del administrador que entregan las suites admin (AuthProvider real). */
export const PERFIL_ADMIN = {
  ok: true,
  usuario: {
    ID_USUARIO: 1,
    NOMBRE_USUARIO: 'Admin Probe',
    EMAIL: 'admin@jadda.test',
    ID_ROL: 1,
    FOTO_URL: null,
    DEBE_CAMBIAR_PASSWORD: 0,
  },
};

/** Conteo de pendientes que devuelve /api/admin/pendientes en las suites admin. */
export const PENDIENTES_ADMIN = {
  evidencias: 2,
  devoluciones: 1,
  vendedores: 3,
  productos: 4,
  chats: 5,
};

/** Handlers base: sesión admin + datos que consume la barra lateral del panel. */
export const HANDLERS_ADMIN: RequestHandler[] = [
  http.get('*/api/auth/perfil', () => HttpResponse.json(PERFIL_ADMIN)),
  http.post('*/api/auth/logout', () => HttpResponse.json({ ok: true })),
  http.get('*/api/admin/pendientes', () => HttpResponse.json(PENDIENTES_ADMIN)),
  http.get('*/api/notificaciones', () => HttpResponse.json([])),
  http.get('*/api/notificaciones/no-leidas', () => HttpResponse.json({ total: 0 })),
];
