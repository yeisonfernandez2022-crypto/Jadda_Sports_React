import { http, HttpResponse, type RequestHandler } from 'msw';

export type { RequestHandler };

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

/**
 * Registro de peticiones y handlers por suite. Cada fábrica devuelve estado
 * NUEVO (llamar en beforeEach vía server.use) para aislar los tests, y su
 * `peticiones` permite asertar método/ruta/cuerpo sin espiar el fetch.
 */
export interface ApiAdmin {
  peticiones: Array<{ metodo: string; ruta: string; cuerpo?: unknown }>;
}

/** Catálogo de categorías del lote A (RF-027): GET/POST/PUT/DELETE con estado mutable. */
export function handlersCategoriasAdmin() {
  const db = [
    { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol ADMIN-TEST', DESCRIPCION: 'Todo el fútbol', TOTAL_PRODUCTOS: 0 },
    { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running ADMIN-TEST', DESCRIPCION: 'Carrera y entrenamiento', TOTAL_PRODUCTOS: 5 },
    { ID_CATEGORIA: 3, NOMBRE_CATEGORIA: 'Gimnasio ADMIN-TEST', DESCRIPCION: null, TOTAL_PRODUCTOS: 0 },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/productos/categorias', () => HttpResponse.json(db)),
    http.post('*/api/productos/categorias', async ({ request }) => {
      api.peticiones.push({ metodo: 'POST', ruta: '/api/productos/categorias', cuerpo: await request.json() });
      db.push({ ID_CATEGORIA: db.length + 1, NOMBRE_CATEGORIA: 'Padel ADMIN-TEST', DESCRIPCION: 'Nueva del test', TOTAL_PRODUCTOS: 0 });
      return HttpResponse.json({ ok: true, msg: 'Categoría creada ADMIN-TEST' });
    }),
    http.delete('*/api/productos/categorias/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'DELETE', ruta: `/api/productos/categorias/${String(params.id)}` });
      const idx = db.findIndex((c) => c.ID_CATEGORIA === Number(params.id));
      if (idx >= 0) db.splice(idx, 1);
      return HttpResponse.json({ ok: true, msg: 'Categoría eliminada ADMIN-TEST' });
    }),
  ];
  return { api, handlers };
}

/** Evidencias de retos del lote A: listar y revisar (aprobar/rechazar) con estado mutable. */
export function handlersRetosAdmin() {
  interface EvidenciaReto {
    ID_EVIDENCIA: number;
    ESTADO: string;
    USUARIO_NOMBRE: string;
    USUARIO_APELLIDO: string;
    USUARIO_EMAIL: string;
    RETO_TITULO: string;
    RETO_DESCRIPCION: string | null;
    PROGRESO: number;
    META_VALOR: number;
    META_TIPO: string;
    CANTIDAD: number;
    FECHA_SUBIDA: string;
    OBSERVACION: string | null;
    RUTA: string;
    RUTAS_EXTRA: string;
  }
  const db: EvidenciaReto[] = [
    {
      ID_EVIDENCIA: 11, ESTADO: 'pendiente', USUARIO_NOMBRE: 'Juan', USUARIO_APELLIDO: 'Pérez',
      USUARIO_EMAIL: 'juan@test.local', RETO_TITULO: 'Reto 100 km ADMIN-TEST', RETO_DESCRIPCION: 'Camina 100 km',
      PROGRESO: 3, META_VALOR: 5, META_TIPO: 'km', CANTIDAD: 1, FECHA_SUBIDA: '2026-11-10T10:00:00.000Z',
      OBSERVACION: null, RUTA: 'https://test.local/e1.jpg', RUTAS_EXTRA: '["https://test.local/e2.mp4"]',
    },
    {
      ID_EVIDENCIA: 12, ESTADO: 'aprobado', USUARIO_NOMBRE: 'María', USUARIO_APELLIDO: 'Gómez',
      USUARIO_EMAIL: 'maria@test.local', RETO_TITULO: 'Reto Gym ADMIN-TEST', RETO_DESCRIPCION: null,
      PROGRESO: 10, META_VALOR: 10, META_TIPO: 'sesiones', CANTIDAD: 2, FECHA_SUBIDA: '2026-11-11T10:00:00.000Z',
      OBSERVACION: null, RUTA: 'https://test.local/e3.jpg', RUTAS_EXTRA: '[]',
    },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/retos/admin/evidencias', () => HttpResponse.json(db)),
    http.post('*/api/retos/admin/evidencias/:id/:accion', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { observacion?: string } | null;
      api.peticiones.push({ metodo: 'POST', ruta: `/api/retos/admin/evidencias/${String(params.id)}/${String(params.accion)}`, cuerpo });
      const ev = db.find((e) => e.ID_EVIDENCIA === Number(params.id));
      if (ev) {
        ev.ESTADO = params.accion === 'aprobar' ? 'aprobado' : 'rechazado';
        if (cuerpo?.observacion) ev.OBSERVACION = cuerpo.observacion;
      }
      return HttpResponse.json({ ok: true, msg: 'Evidencia revisada ADMIN-TEST', completado: false });
    }),
  ];
  return { api, handlers };
}

/** Características de un producto del lote A: listar/agregar/eliminar con estado mutable. */
export function handlersCaracteristicasAdmin() {
  const db = [
    { ID_CARACTERISTICA: 21, NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero sintético' },
    { ID_CARACTERISTICA: 22, NOMBRE_ATRIBUTO: 'Suela', VALOR_ATRIBUTO: 'TPU' },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/productos/:id/caracteristicas', () => HttpResponse.json(db)),
    http.post('*/api/productos/:id/caracteristicas', async ({ request }) => {
      const cuerpo = (await request.json()) as { NOMBRE_ATRIBUTO: string; VALOR_ATRIBUTO: string };
      api.peticiones.push({ metodo: 'POST', ruta: '/api/productos/caracteristicas', cuerpo });
      db.push({ ID_CARACTERISTICA: db.length + 1, NOMBRE_ATRIBUTO: cuerpo.NOMBRE_ATRIBUTO, VALOR_ATRIBUTO: cuerpo.VALOR_ATRIBUTO });
      return HttpResponse.json({ ok: true, msg: 'Característica añadida ADMIN-TEST' });
    }),
    http.delete('*/api/caracteristicas/:idCaracteristica', ({ params }) => {
      api.peticiones.push({ metodo: 'DELETE', ruta: `/api/caracteristicas/${String(params.idCaracteristica)}` });
      const idx = db.findIndex((c) => c.ID_CARACTERISTICA === Number(params.idCaracteristica));
      if (idx >= 0) db.splice(idx, 1);
      return HttpResponse.json({ ok: true, msg: 'Característica eliminada ADMIN-TEST' });
    }),
  ];
  return { api, handlers };
}
