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
    APELLIDO_USUARIO: 'Probe',
    USUARIO: 'admin',
    EMAIL: 'admin@jadda.test',
    TELEFONO: '3001234567',
    TIPO_DOCUMENTO: null,
    NUMERO_DOCUMENTO: null,
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

/** Perfil editable del panel Configuración: PUT perfil + contraseña + foto. */
export function handlersConfiguracionAdmin() {
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.put('*/api/auth/perfil', async ({ request }) => {
      api.peticiones.push({ metodo: 'PUT', ruta: '/api/auth/perfil', cuerpo: await request.json() });
      return HttpResponse.json({ ok: true, message: 'Perfil guardado ADMIN-TEST' });
    }),
    http.post('*/api/auth/cambiar-password', async ({ request }) => {
      api.peticiones.push({ metodo: 'POST', ruta: '/api/auth/cambiar-password', cuerpo: await request.json() });
      return HttpResponse.json({ ok: true, msg: 'Contraseña actualizada ADMIN-TEST' });
    }),
    http.post('*/api/auth/foto', async ({ request }) => {
      api.peticiones.push({ metodo: 'POST', ruta: '/api/auth/foto' });
      return HttpResponse.json({ ok: true, url: 'https://test.local/foto-nueva.png' });
    }),
  ];
  return { api, handlers };
}

/** Datos del panel de control (KPIs, hoy, pendientes, serie, listados). */
export function handlersDashboardAdmin() {
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/dashboard', ({ request }) => {
      api.peticiones.push({ metodo: 'GET', ruta: new URL(request.url).search });
      return HttpResponse.json({
        stats: {
          ingresos30: 1200000, ordenes30: 45, totalUsuarios: 310, totalProductos: 720,
          ticket30: 26666, unidades30: 150, totalIngresos: 9000000, totalOrdenes: 300,
        },
        hoy: { ingresosHoy: 50000, ordenesHoy: 3, pctVsAyer: 12.5 },
        pendientes: { evidenciasPend: 2, devolucionesPend: 1, stockBajo: 4, avisosPend: 0 },
        serie: [
          { dia: '01/11', ingresos: 300000, ordenes: 5 },
          { dia: '02/11', ingresos: 0, ordenes: 0 },
        ],
        masVendidos: [
          { ID: 5, NOMBRE: 'Balón Pro ADMIN-TEST', IMAGEN: null, unidades: 12, ingresos: 480000 },
        ],
        ordenesRecientes: [
          { ID_VENTA: 501, NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Martínez', ESTADO: 'COMPLETADA', TOTAL: 150000 },
        ],
        usuariosRecientes: [
          { ID_USUARIO: 9, NOMBRE_USUARIO: 'Nico', APELLIDO_USUARIO: 'Ruiz', EMAIL: 'nico@test.local', FECHA_REGISTRO: '2026-11-01T09:00:00.000Z' },
        ],
      });
    }),
  ];
  return { api, handlers };
}

/** Usuarios del panel (solo lectura): listado + detalle compuesto. */
export function handlersUsuariosAdmin() {
  const db = [
    {
      ID_USUARIO: 55, NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Martínez', EMAIL: 'ana@test.local',
      USUARIO: 'ana', ID_ROL: 2, NOMBRE_ROL: 'Cliente', FECHA_REGISTRO: '2026-11-01T10:00:00.000Z',
    },
    {
      ID_USUARIO: 1, NOMBRE_USUARIO: 'Admin', APELLIDO_USUARIO: 'Principal', EMAIL: 'admin@jadda.test',
      USUARIO: 'admin', ID_ROL: 1, NOMBRE_ROL: 'Administrador', FECHA_REGISTRO: '2026-10-01T10:00:00.000Z',
    },
  ];
  const detalle = {
    usuario: {
      ID_ROL: 2, NOMBRE_ROL: 'Cliente', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Martínez',
      USUARIO: 'ana', EMAIL: 'ana@test.local', TELEFONO: '3001112222', CONFIRMADO: 1,
      TIPO_DOCUMENTO: 'CC', NUMERO_DOCUMENTO: '1010', AUTH_PROVIDER: 'local',
      FECHA_REGISTRO: '2026-11-01T10:00:00.000Z', ULTIMA_CONEXION: null,
    },
    stats: { totalCompras: 5, totalFavoritos: 3, totalRetos: 1, totalGastado: 450000 },
    compras: [
      { ID_VENTA: 501, ESTADO: 'COMPLETADA', FECHA_VENTA: '2026-11-05', TOTAL_ARTICULOS: 2, METODO_PAGO: 'Wompi', ESTADO_ENVIO: 'EN TRANSITO', PRODUCTOS_NOMBRES: 'Guayos ADMIN-TEST', TOTAL: 150000 },
      { ID_VENTA: 502, ESTADO: 'CANCELADA', FECHA_VENTA: '2026-11-06', TOTAL_ARTICULOS: 1, METODO_PAGO: 'Nequi', PRODUCTOS_NOMBRES: 'Balón ADMIN-TEST', TOTAL: 80000 },
    ],
    retos: [
      { ID_RETO_USUARIO: 7, TITULO: 'Reto 100 km ADMIN-TEST', PROGRESO: 5, META_VALOR: 10, META_TIPO: 'km', COMPLETADO: 0, RECOMPENSA_PORCENTAJE: 5, EVIDENCIAS_PENDIENTES: 1, CUPON_GENERADO: null },
    ],
    direcciones: [
      { ID_DIRECCION: 31, ETIQUETA: 'Casa', ES_PRINCIPAL: 1, DIRECCION: 'Calle 10 #5-25', BARRIO: 'Laureles', CIUDAD: 'Medellín', DEPARTAMENTO: 'Antioquia', CODIGO_POSTAL: null, TELEFONO_CONTACTO: '3001112222' },
    ],
    metodos: [
      { ID: 41, NOMBRE_METODO: 'Nequi', ES_PRINCIPAL: 1, TITULAR: 'Ana Martínez', BANCO: '', TIPO: 'DIGITAL', TELEFONO: '3001112222', FECHA_CREADO: '2026-11-01' },
    ],
  };
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/usuarios', () => HttpResponse.json(db)),
    http.get('*/api/admin/usuarios/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'GET', ruta: `/api/admin/usuarios/${String(params.id)}` });
      return HttpResponse.json(detalle);
    }),
  ];
  return { api, handlers };
}

/** Solicitudes de vendedor: listar, procesar y productos por vendedor. */
export function handlersVendedoresAdmin() {
  interface SolicitudVendedor {
    ID_SOLICITUD: number;
    ID_USUARIO: number;
    NOMBRE_EMPRESA: string;
    NIT: string;
    NOMBRE_REPRESENTANTE: string;
    EMAIL_EMPRESA: string;
    TELEFONO: string;
    DEPARTAMENTO: string;
    CIUDAD: string;
    DIRECCION: string | null;
    CATEGORIAS: string | null;
    DESCRIPCION: string | null;
    ESTADO: string;
    OBSERVACION_ADMIN: string | null;
    FECHA_CREACION: string;
    FECHA_PROCESADA: string | null;
    SOLICITANTE_NOMBRE: string;
    SOLICITANTE_EMAIL: string;
    VENDEDOR_ID: number | null;
    VENDEDOR_ESTADO: string | null;
  }
  const db: SolicitudVendedor[] = [
    {
      ID_SOLICITUD: 31, ID_USUARIO: 60, NOMBRE_EMPRESA: 'Deportes Andes ADMIN-TEST', NIT: '900123',
      NOMBRE_REPRESENTANTE: 'Laura Gómez', EMAIL_EMPRESA: 'laura@andes.test', TELEFONO: '3005554444',
      DEPARTAMENTO: 'Antioquia', CIUDAD: 'Medellín', DIRECCION: 'Av 80 #45', CATEGORIAS: 'Fútbol',
      DESCRIPCION: 'Tienda de guayos', ESTADO: 'PENDIENTE', OBSERVACION_ADMIN: null,
      FECHA_CREACION: '2026-11-05T10:00:00.000Z', FECHA_PROCESADA: null,
      SOLICITANTE_NOMBRE: 'Laura Gómez', SOLICITANTE_EMAIL: 'laura@andes.test',
      VENDEDOR_ID: 66, VENDEDOR_ESTADO: null,
    },
    {
      ID_SOLICITUD: 32, ID_USUARIO: 61, NOMBRE_EMPRESA: 'Ciclistas Valle ADMIN-TEST', NIT: '900456',
      NOMBRE_REPRESENTANTE: 'Pedro Ruiz', EMAIL_EMPRESA: 'pedro@valle.test', TELEFONO: '3006667777',
      DEPARTAMENTO: 'Valle', CIUDAD: 'Cali', DIRECCION: null, CATEGORIAS: 'Ciclismo',
      DESCRIPCION: null, ESTADO: 'APROBADA', OBSERVACION_ADMIN: null,
      FECHA_CREACION: '2026-11-01T10:00:00.000Z', FECHA_PROCESADA: '2026-11-02T10:00:00.000Z',
      SOLICITANTE_NOMBRE: 'Pedro Ruiz', SOLICITANTE_EMAIL: 'pedro@valle.test',
      VENDEDOR_ID: 67, VENDEDOR_ESTADO: 'ACTIVO',
    },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/vendedor/admin', () => HttpResponse.json(db)),
    http.post('*/api/vendedor/admin/:id/procesar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { estado: string; observacion?: string };
      api.peticiones.push({ metodo: 'POST', ruta: `/api/vendedor/admin/${String(params.id)}/procesar`, cuerpo });
      const sol = db.find((s) => s.ID_SOLICITUD === Number(params.id));
      if (sol) {
        sol.ESTADO = cuerpo.estado;
        sol.OBSERVACION_ADMIN = cuerpo.observacion || null;
        sol.FECHA_PROCESADA = '2026-11-16T10:00:00.000Z';
      }
      return HttpResponse.json({ ok: true, msg: 'Solicitud procesada ADMIN-TEST' });
    }),
    http.get('*/api/admin/productos', () => HttpResponse.json([
      { ID: 9, NOMBRE: 'Camiseta Vendedor ADMIN-TEST', ID_VENDEDOR: 66, CATEGORIA: 'Fútbol', ESTADO_PUBLICACION: 'APROBADO', STOCK: 8, PRECIO: 99000, MARCA: 'JADDA', IMAGEN: null },
      { ID: 10, NOMBRE: 'Casco Otro ADMIN-TEST', ID_VENDEDOR: 67, CATEGORIA: 'Ciclismo', ESTADO_PUBLICACION: 'APROBADO', STOCK: 3, PRECIO: 250000, MARCA: 'JADDA', IMAGEN: null },
    ])),
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
