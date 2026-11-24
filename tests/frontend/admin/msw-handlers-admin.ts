import { http, HttpResponse, type RequestHandler } from 'msw';
import type { Compra, Vendedor } from '../../../frontend/src/admin/DetalleUsuarioAdmin.tsx';

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

/** Detalle compuesto del usuario 7: comprador con dos compras (una con envío). */
export const USUARIO_DETALLE_ADMIN = {
  usuario: {
    ID_USUARIO: 7, ID_ROL: 2, NOMBRE_ROL: 'Cliente', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'Compradora',
    USUARIO: 'ana', EMAIL: 'ana@test.local', TELEFONO: '3001112222', CONFIRMADO: 1,
    TIPO_DOCUMENTO: 'CC', NUMERO_DOCUMENTO: '1010', AUTH_PROVIDER: 'local',
    FECHA_REGISTRO: '2026-11-01T10:00:00.000Z', ULTIMA_CONEXION: null,
    DEBE_CAMBIAR_PASSWORD: 0, ULTIMA_UBICACION: null, FOTO_URL: null,
  },
  stats: {
    totalCompras: 2, totalGastado: 230000, totalFavoritos: 3, totalRetos: 1,
    productosPublicados: 0, unidadesVendidas: 0, totalVentas: 0, totalIngresos: 0,
  },
  compras: ([
    {
      ID_VENTA: 9, ESTADO: 'COMPLETADA', FECHA_VENTA: '2026-11-05', TOTAL_ARTICULOS: 2,
      METODO_PAGO: 'Wompi', ESTADO_ENVIO: 'EN TRANSITO', PRODUCTOS_NOMBRES: 'Guayos ADMIN-TEST | Balón Andino',
      TOTAL: 150000, TOTAL_PEDIDO: 150000, REFERENCIA_PAGO: 'WOMPI-ADMIN-TEST',
      ENVIO_DIRECCION: 'Calle 10 #5-25', ENVIO_BARRIO: 'Laureles', ENVIO_CIUDAD: 'Cali',
      ENVIO_DEPARTAMENTO: 'Valle', ENVIO_CODIGO_POSTAL: '760001', ENVIO_TELEFONO: '3001112222',
      COSTO_ENVIO: 9000,
      items: [
        {
          ID_VENTA: 9, CANTIDAD: 2, PRECIO_UNITARIO: 50000, SUBTOTAL: 100000,
          NOMBRE: 'Guayos ADMIN-TEST', ID_VENDEDOR: 4, VENDEDOR_NOMBRE: 'DeporteX ADMIN-TEST',
          IMAGEN: null, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42',
        },
        {
          ID_VENTA: 9, CANTIDAD: 1, PRECIO_UNITARIO: 41000, SUBTOTAL: 41000,
          NOMBRE: 'Balón Andino', ID_VENDEDOR: 8, VENDEDOR_NOMBRE: 'Deportes Andinos',
          IMAGEN: null, COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Tamaño', ATRIBUTO: '5',
        },
      ],
    },
    {
      ID_VENTA: 502, ESTADO: 'CANCELADA', FECHA_VENTA: '2026-11-06', TOTAL_ARTICULOS: 1,
      METODO_PAGO: 'Nequi', PRODUCTOS_NOMBRES: 'Balón ADMIN-TEST', TOTAL: 80000, TOTAL_PEDIDO: 80000,
      ESTADO_ENVIO: null, ENVIO_DIRECCION: null, COSTO_ENVIO: 0, items: [],
    },
  ] as Compra[]),
  retos: [
    { ID_RETO_USUARIO: 7, TITULO: 'Reto 100 km ADMIN-TEST', PROGRESO: 5, META_VALOR: 10, META_TIPO: 'km', COMPLETADO: 0, RECOMPENSA_PORCENTAJE: 5, EVIDENCIAS_PENDIENTES: 1, CUPON_GENERADO: null },
  ],
  direcciones: [
    { ID_DIRECCION: 31, ETIQUETA: 'Casa', ES_PRINCIPAL: 1, DIRECCION: 'Calle 10 #5-25', BARRIO: 'Laureles', CIUDAD: 'Medellín', DEPARTAMENTO: 'Antioquia', CODIGO_POSTAL: null, TELEFONO_CONTACTO: '3001112222' },
  ],
  metodos: [
    { ID: 41, NOMBRE_METODO: 'Nequi', ES_PRINCIPAL: 1, TITULAR: 'Ana Compradora', BANCO: '', TIPO: 'DIGITAL', TELEFONO: '3001112222', FECHA_CREADO: '2026-11-01' },
  ],
  vendedor: null as Vendedor | null,
  ventas: [],
};

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
  const detalle = USUARIO_DETALLE_ADMIN;
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

/** Contrato del detalle de solicitud que devuelve GET /api/vendedor/admin/:id. */
export interface SolicitudVendedorDetalle {
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
  SOLICITANTE_USUARIO: string;
  SOLICITANTE_TELEFONO: string;
}

export interface VendedorDetalleAdmin {
  ID_VENDEDOR: number;
  ID_USUARIO: number;
  NOMBRE_EMPRESA: string;
  NIT: string;
  EMAIL_VENDEDOR: string;
  TELEFONO: string;
  DEPARTAMENTO: string;
  CIUDAD: string;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  ESTADO: string;
  FECHA_REGISTRO: string;
  VENDEDOR_NOMBRE: string;
  VENDEDOR_APELLIDO: string;
  VENDEDOR_EMAIL: string;
}

export interface ResumenVendedorAdmin {
  productosPublicados: number;
  unidadesVendidas: number;
  totalVentas: number;
  totalIngresos: number;
  ticketPromedio: number;
}

export interface ProductoVendedorAdmin {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  ESTADO_PUBLICACION: string;
  STOCK: number;
  IMAGEN: string | null;
  UNIDADES: number;
  INGRESOS: number;
  PEDIDOS: number;
}

export interface VentaRecienteAdmin {
  ID_VENTA: number;
  FECHA_VENTA: string;
  ESTADO: string;
  CLIENTE: string;
  CLIENTE_APELLIDO: string;
  IMPORTE: number;
}

export interface DetalleVendedorAdminFixture {
  solicitud: SolicitudVendedorDetalle;
  vendedor: VendedorDetalleAdmin | null;
  resumen: ResumenVendedorAdmin | null;
  productos: ProductoVendedorAdmin[];
  ventasRecientes: VentaRecienteAdmin[];
}

/** Detalle aprobado (ID 33) con tienda, catálogo y ventas para la ficha. */
export const DETALLE_VENDEDOR_APROBADO_ADMIN: DetalleVendedorAdminFixture = {
  solicitud: {
    ID_SOLICITUD: 33, ID_USUARIO: 62, NOMBRE_EMPRESA: 'Deportes Andinos ADMIN-TEST',
    NIT: '900789', NOMBRE_REPRESENTANTE: 'Laura Gómez', EMAIL_EMPRESA: 'laura@andes.test',
    TELEFONO: '3005554444', DEPARTAMENTO: 'Antioquia', CIUDAD: 'Medellín',
    DIRECCION: 'Av 80 #45', CATEGORIAS: 'Fútbol', DESCRIPCION: 'Tienda de guayos',
    ESTADO: 'APROBADA', OBSERVACION_ADMIN: null,
    FECHA_CREACION: '2026-10-20T10:00:00.000Z', FECHA_PROCESADA: '2026-10-21T10:00:00.000Z',
    SOLICITANTE_NOMBRE: 'Laura Gómez', SOLICITANTE_EMAIL: 'laura@andes.test',
    SOLICITANTE_USUARIO: 'laura', SOLICITANTE_TELEFONO: '3005554444',
  },
  vendedor: {
    ID_VENDEDOR: 66, ID_USUARIO: 62, NOMBRE_EMPRESA: 'Deportes Andinos ADMIN-TEST',
    NIT: '900789', EMAIL_VENDEDOR: 'laura@andes.test', TELEFONO: '3005554444',
    DEPARTAMENTO: 'Antioquia', CIUDAD: 'Medellín', DIRECCION: 'Av 80 #45',
    CATEGORIAS: 'Fútbol', ESTADO: 'ACTIVO', FECHA_REGISTRO: '2026-10-21T10:00:00.000Z',
    VENDEDOR_NOMBRE: 'Laura', VENDEDOR_APELLIDO: 'Gómez', VENDEDOR_EMAIL: 'laura@andes.test',
  },
  resumen: {
    productosPublicados: 3, unidadesVendidas: 7, totalVentas: 4,
    totalIngresos: 210000, ticketPromedio: 52500,
  },
  productos: [
    { ID: 9, NOMBRE: 'Guayos ADMIN-TEST', PRECIO: 70000, ESTADO_PUBLICACION: 'APROBADO', STOCK: 8, IMAGEN: null, UNIDADES: 5, INGRESOS: 150000, PEDIDOS: 3 },
    { ID: 10, NOMBRE: 'Camiseta Vendedor ADMIN-TEST', PRECIO: 30000, ESTADO_PUBLICACION: 'PENDIENTE', STOCK: 2, IMAGEN: null, UNIDADES: 2, INGRESOS: 60000, PEDIDOS: 1 },
  ],
  ventasRecientes: [
    { ID_VENTA: 88, FECHA_VENTA: '2026-11-10', ESTADO: 'COMPLETADA', CLIENTE: 'Cliente', CLIENTE_APELLIDO: 'Reciente', IMPORTE: 140000 },
  ],
};

/** Detalle pendiente (ID 34) sin tienda creada: solo datos del solicitante. */
export const DETALLE_VENDEDOR_PENDIENTE_ADMIN: DetalleVendedorAdminFixture = {
  solicitud: {
    ID_SOLICITUD: 34, ID_USUARIO: 63, NOMBRE_EMPRESA: 'Tienda Pendiente ADMIN-TEST',
    NIT: '900999', NOMBRE_REPRESENTANTE: 'Mario Pendiente', EMAIL_EMPRESA: 'mario@pendiente.test',
    TELEFONO: '3007778888', DEPARTAMENTO: 'Cundinamarca', CIUDAD: 'Bogotá',
    DIRECCION: null, CATEGORIAS: 'Running', DESCRIPCION: null,
    ESTADO: 'PENDIENTE', OBSERVACION_ADMIN: null,
    FECHA_CREACION: '2026-11-12T10:00:00.000Z', FECHA_PROCESADA: null,
    SOLICITANTE_NOMBRE: 'Mario Pendiente', SOLICITANTE_EMAIL: 'mario@pendiente.test',
    SOLICITANTE_USUARIO: 'mario', SOLICITANTE_TELEFONO: '3007778888',
  },
  vendedor: null,
  resumen: null,
  productos: [],
  ventasRecientes: [],
};

const clonarDetalle = (d: DetalleVendedorAdminFixture): DetalleVendedorAdminFixture =>
  JSON.parse(JSON.stringify(d)) as DetalleVendedorAdminFixture;

/** Solicitudes de vendedor: listar, procesar y detalle con productos/ventas. */
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
  const detalles: Record<number, DetalleVendedorAdminFixture> = {
    33: clonarDetalle(DETALLE_VENDEDOR_APROBADO_ADMIN),
    34: clonarDetalle(DETALLE_VENDEDOR_PENDIENTE_ADMIN),
  };
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/vendedor/admin', () => HttpResponse.json(db)),
    http.get('*/api/vendedor/admin/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'GET', ruta: `/api/vendedor/admin/${String(params.id)}` });
      const detalle = detalles[Number(params.id)];
      if (!detalle) {
        return HttpResponse.json({ ok: false, msg: 'Solicitud no encontrada' }, { status: 404 });
      }
      return HttpResponse.json(detalle);
    }),
    http.post('*/api/vendedor/admin/:id/procesar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { estado: string; observacion?: string };
      api.peticiones.push({ metodo: 'POST', ruta: `/api/vendedor/admin/${String(params.id)}/procesar`, cuerpo });
      const sol = db.find((s) => s.ID_SOLICITUD === Number(params.id));
      if (sol) {
        sol.ESTADO = cuerpo.estado;
        sol.OBSERVACION_ADMIN = cuerpo.observacion || null;
        sol.FECHA_PROCESADA = '2026-11-16T10:00:00.000Z';
      }
      const detalle = detalles[Number(params.id)];
      if (detalle) {
        detalle.solicitud.ESTADO = cuerpo.estado;
        detalle.solicitud.OBSERVACION_ADMIN = cuerpo.observacion || null;
        detalle.solicitud.FECHA_PROCESADA = '2026-11-16T10:00:00.000Z';
      }
      return HttpResponse.json({ ok: true, msg: 'Solicitud procesada ADMIN-TEST' });
    }),
    http.get('*/api/admin/productos', () => {
      api.peticiones.push({ metodo: 'GET', ruta: '/api/admin/productos' });
      return HttpResponse.json([
        { ID: 9, NOMBRE: 'Camiseta Vendedor ADMIN-TEST', ID_VENDEDOR: 66, CATEGORIA: 'Fútbol', ESTADO_PUBLICACION: 'APROBADO', STOCK: 8, PRECIO: 99000, MARCA: 'JADDA', IMAGEN: null },
        { ID: 10, NOMBRE: 'Casco Otro ADMIN-TEST', ID_VENDEDOR: 67, CATEGORIA: 'Ciclismo', ESTADO_PUBLICACION: 'APROBADO', STOCK: 3, PRECIO: 250000, MARCA: 'JADDA', IMAGEN: null },
      ]);
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

/** Devoluciones del panel (RF-033): listar y procesar las 4 decisiones con estado mutable. */
export function handlersDevolucionesAdmin() {
  interface Devolucion {
    ID_DEVOLUCION: number;
    ID_USUARIO: number;
    NOMBRE_USUARIO: string;
    EMAIL: string;
    USUARIO_LOGIN: string | null;
    TELEFONO: string | null;
    ID_VENTA: number;
    VENTA_TOTAL: number;
    FECHA_VENTA: string | null;
    METODO_PAGO: string | null;
    ENVIO_DIRECCION: string | null;
    ENVIO_CIUDAD: string | null;
    ENVIO_BARRIO: string | null;
    ENVIO_DEPARTAMENTO: string | null;
    PRODUCTO_NOMBRE: string;
    IMAGEN: string | null;
    CANTIDAD: number;
    MOTIVO: string | null;
    DESCRIPCION: string | null;
    TIPO: string | null;
    OBSERVACION: string | null;
    ESTADO: string;
    FECHA_CREACION: string;
    FECHA_PROCESADA: string | null;
    EVIDENCIAS: string | null;
    ID_VENDEDOR: number | null;
    ID_CHAT: number | null;
    PARTE_CHAT: string | null;
  }
  const base = {
    ID_USUARIO: 80, NOMBRE_USUARIO: 'Carla', EMAIL: 'carla@test.local', USUARIO_LOGIN: 'carla',
    TELEFONO: '3009998888', METODO_PAGO: 'Wompi', ENVIO_DIRECCION: 'Cra 45 #12-30',
    ENVIO_CIUDAD: 'Medellín', ENVIO_BARRIO: 'Belén', ENVIO_DEPARTAMENTO: 'Antioquia',
    FECHA_CREACION: '2026-11-12T10:00:00.000Z', DESCRIPCION: 'El producto llegó con el empaque dañado',
    EVIDENCIAS: 'https://test.local/d1.jpg|https://test.local/d2.jpg',
    ID_VENDEDOR: null, ID_CHAT: null, PARTE_CHAT: null,
  };
  const db: Devolucion[] = [
    {
      ...base, ID_DEVOLUCION: 81, ID_VENTA: 701, VENTA_TOTAL: 150000, FECHA_VENTA: '2026-11-05T10:00:00.000Z',
      PRODUCTO_NOMBRE: 'Guayos Dev ADMIN-TEST', IMAGEN: null, CANTIDAD: 1, MOTIVO: 'Talla incorrecta',
      TIPO: 'DEVOLUCION', OBSERVACION: null, ESTADO: 'SOLICITADA', FECHA_PROCESADA: null,
    },
    {
      ...base, ID_DEVOLUCION: 82, ID_VENTA: 702, VENTA_TOTAL: 90000, FECHA_VENTA: '2026-11-06T10:00:00.000Z',
      PRODUCTO_NOMBRE: 'Balón Dev ADMIN-TEST', IMAGEN: null, CANTIDAD: 2,
      MOTIVO: 'Reembolso por cancelación del pedido', TIPO: 'REEMBOLSO', OBSERVACION: null,
      ESTADO: 'SOLICITADA', FECHA_PROCESADA: null,
    },
    {
      ...base, ID_DEVOLUCION: 83, ID_VENTA: 703, VENTA_TOTAL: 60000, FECHA_VENTA: '2026-11-03T10:00:00.000Z',
      PRODUCTO_NOMBRE: 'Camiseta Dev ADMIN-TEST', IMAGEN: null, CANTIDAD: 1, MOTIVO: 'Defecto de confección',
      TIPO: 'DEVOLUCION', OBSERVACION: null, ESTADO: 'APROBADA', FECHA_PROCESADA: '2026-11-09T10:00:00.000Z',
    },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/devoluciones/admin', () => HttpResponse.json(db)),
    http.post('*/api/devoluciones/admin/:id/procesar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { decision: string; observacion?: string };
      api.peticiones.push({ metodo: 'POST', ruta: `/api/devoluciones/admin/${String(params.id)}/procesar`, cuerpo });
      const d = db.find((x) => x.ID_DEVOLUCION === Number(params.id));
      if (d) {
        d.ESTADO = cuerpo.decision === 'mas_pruebas' ? 'MAS_PRUEBAS' : cuerpo.decision === 'rechazar' ? 'RECHAZADA' : 'APROBADA';
        d.OBSERVACION = cuerpo.observacion || null;
        d.FECHA_PROCESADA = '2026-11-16T10:00:00.000Z';
      }
      return HttpResponse.json({ ok: true, msg: 'Devolución procesada ADMIN-TEST' });
    }),
  ];
  return { api, handlers };
}

/** Órdenes de compra del panel: listado, estado, envío y eliminación con estado mutable. */
export function handlersOrdenesAdmin() {
  interface ProductoOrden {
    ID: number; NOMBRE: string; IMAGEN: string | null; COLOR?: string;
    NOMBRE_ATRIBUTO?: string; ATRIBUTO?: string; CANTIDAD: number; SUBTOTAL: number;
  }
  interface OrdenAdmin {
    ID_VENTA: number; FECHA_VENTA: string; NOMBRE_USUARIO: string; APELLIDO_USUARIO: string; EMAIL: string;
    ESTADO: string; ESTADO_ENVIO: string | null; TOTAL: number; TOTAL_ARTICULOS: number; TOTAL_UNIDADES: number;
    METODO_PAGO: string | null; COSTO_ENVIO: number | null; DIRECCION_ENVIO: string | null; BARRIO: string | null;
    CIUDAD: string | null; DEPARTAMENTO: string | null; CODIGO_POSTAL: string | null; TELEFONO_CONTACTO: string | null;
    OBSERVACIONES: string | null; FECHA_ENVIO: string | null; ES_DE_VENDEDOR: number; VENDEDORES: string | null;
    productos: ProductoOrden[];
  }
  const db: OrdenAdmin[] = [
    {
      ID_VENTA: 701, FECHA_VENTA: '2026-11-10T10:00:00.000Z', NOMBRE_USUARIO: 'Carla', APELLIDO_USUARIO: 'Torres',
      EMAIL: 'carla@test.local', ESTADO: 'PENDIENTE', ESTADO_ENVIO: null, TOTAL: 150000, TOTAL_ARTICULOS: 2,
      TOTAL_UNIDADES: 3, METODO_PAGO: 'Wompi', COSTO_ENVIO: 0, DIRECCION_ENVIO: 'Cra 45 #12-30', BARRIO: 'Belén',
      CIUDAD: 'Medellín', DEPARTAMENTO: 'Antioquia', CODIGO_POSTAL: null, TELEFONO_CONTACTO: '3009998888',
      OBSERVACIONES: 'Entregar después de las 2pm', FECHA_ENVIO: null, ES_DE_VENDEDOR: 0, VENDEDORES: null,
      productos: [{ ID: 5, NOMBRE: 'Guayos Ord ADMIN-TEST', IMAGEN: null, CANTIDAD: 3, SUBTOTAL: 150000 }],
    },
    {
      ID_VENTA: 702, FECHA_VENTA: '2026-11-09T10:00:00.000Z', NOMBRE_USUARIO: 'Ana', APELLIDO_USUARIO: 'López',
      EMAIL: 'ana@test.local', ESTADO: 'CONFIRMADA', ESTADO_ENVIO: 'EMPACADO', TOTAL: 90000, TOTAL_ARTICULOS: 1,
      TOTAL_UNIDADES: 1, METODO_PAGO: 'Nequi', COSTO_ENVIO: 15000, DIRECCION_ENVIO: 'Calle 8 #23-11', BARRIO: 'Laureles',
      CIUDAD: 'Medellín', DEPARTAMENTO: 'Antioquia', CODIGO_POSTAL: '050010', TELEFONO_CONTACTO: '3007776666',
      OBSERVACIONES: null, FECHA_ENVIO: null, ES_DE_VENDEDOR: 0, VENDEDORES: null,
      productos: [{ ID: 9, NOMBRE: 'Balón Ord ADMIN-TEST', IMAGEN: null, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '5', CANTIDAD: 1, SUBTOTAL: 75000 }],
    },
    {
      ID_VENTA: 703, FECHA_VENTA: '2026-11-05T10:00:00.000Z', NOMBRE_USUARIO: 'Pedro', APELLIDO_USUARIO: 'Ruíz',
      EMAIL: 'pedro@test.local', ESTADO: 'COMPLETADA', ESTADO_ENVIO: 'ENTREGADO', TOTAL: 60000, TOTAL_ARTICULOS: 1,
      TOTAL_UNIDADES: 2, METODO_PAGO: 'Wompi', COSTO_ENVIO: 0, DIRECCION_ENVIO: 'Av 80 #45-67', BARRIO: null,
      CIUDAD: 'Cali', DEPARTAMENTO: 'Valle', CODIGO_POSTAL: null, TELEFONO_CONTACTO: null,
      OBSERVACIONES: null, FECHA_ENVIO: '2026-11-08T10:00:00.000Z', ES_DE_VENDEDOR: 0, VENDEDORES: null,
      productos: [{ ID: 12, NOMBRE: 'Raqueta Ord ADMIN-TEST', IMAGEN: null, CANTIDAD: 2, SUBTOTAL: 60000 }],
    },
    {
      ID_VENTA: 704, FECHA_VENTA: '2026-11-14T10:00:00.000Z', NOMBRE_USUARIO: 'Marta', APELLIDO_USUARIO: 'Díaz',
      EMAIL: 'marta@test.local', ESTADO: 'CANCELADA', ESTADO_ENVIO: 'PENDIENTE', TOTAL: 200000, TOTAL_ARTICULOS: 1,
      TOTAL_UNIDADES: 1, METODO_PAGO: 'Wompi', COSTO_ENVIO: 0, DIRECCION_ENVIO: 'Cra 70 #1-23', BARRIO: 'Robledo',
      CIUDAD: 'Medellín', DEPARTAMENTO: 'Antioquia', CODIGO_POSTAL: null, TELEFONO_CONTACTO: '3003332222',
      OBSERVACIONES: null, FECHA_ENVIO: null, ES_DE_VENDEDOR: 0, VENDEDORES: null,
      productos: [{ ID: 15, NOMBRE: 'Guante Ord ADMIN-TEST', IMAGEN: null, CANTIDAD: 1, SUBTOTAL: 200000 }],
    },
    {
      ID_VENTA: 705, FECHA_VENTA: '2026-11-13T10:00:00.000Z', NOMBRE_USUARIO: 'Luisa', APELLIDO_USUARIO: 'Molina',
      EMAIL: 'luisa@test.local', ESTADO: 'CANCELADA', ESTADO_ENVIO: 'CANCELADO', TOTAL: 45000, TOTAL_ARTICULOS: 1,
      TOTAL_UNIDADES: 1, METODO_PAGO: 'Nequi', COSTO_ENVIO: 0, DIRECCION_ENVIO: null, BARRIO: null,
      CIUDAD: null, DEPARTAMENTO: null, CODIGO_POSTAL: null, TELEFONO_CONTACTO: null,
      OBSERVACIONES: null, FECHA_ENVIO: null, ES_DE_VENDEDOR: 0, VENDEDORES: null,
      productos: [{ ID: 18, NOMBRE: 'Cinta Ord ADMIN-TEST', IMAGEN: null, CANTIDAD: 1, SUBTOTAL: 45000 }],
    },
    {
      ID_VENTA: 706, FECHA_VENTA: '2026-11-11T10:00:00.000Z', NOMBRE_USUARIO: 'Julián', APELLIDO_USUARIO: 'Vélez',
      EMAIL: 'julian@test.local', ESTADO: 'CONFIRMADA', ESTADO_ENVIO: 'EN_CAMINO', TOTAL: 320000, TOTAL_ARTICULOS: 2,
      TOTAL_UNIDADES: 2, METODO_PAGO: 'Wompi', COSTO_ENVIO: 15000, DIRECCION_ENVIO: 'Calle 30 #6-78', BARRIO: null,
      CIUDAD: 'Bogotá', DEPARTAMENTO: 'Cundinamarca', CODIGO_POSTAL: null, TELEFONO_CONTACTO: '3001110000',
      OBSERVACIONES: null, FECHA_ENVIO: null, ES_DE_VENDEDOR: 1, VENDEDORES: 'Deportes Andes ADMIN-TEST',
      productos: [{ ID: 21, NOMBRE: 'Casco Ord ADMIN-TEST', IMAGEN: null, CANTIDAD: 2, SUBTOTAL: 305000 }],
    },
  ];
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/compras', () => HttpResponse.json(db)),
    http.put('*/api/admin/compras/:id/estado', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { estado: string };
      api.peticiones.push({ metodo: 'PUT', ruta: `/api/admin/compras/${String(params.id)}/estado`, cuerpo });
      const o = db.find((x) => x.ID_VENTA === Number(params.id));
      if (o) o.ESTADO = cuerpo.estado;
      return HttpResponse.json({ ok: true, msg: 'Estado actualizado ADMIN-TEST' });
    }),
    http.put('*/api/admin/compras/:id/envio', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { estado_envio: string };
      api.peticiones.push({ metodo: 'PUT', ruta: `/api/admin/compras/${String(params.id)}/envio`, cuerpo });
      const o = db.find((x) => x.ID_VENTA === Number(params.id));
      if (o) o.ESTADO_ENVIO = cuerpo.estado_envio;
      return HttpResponse.json({ ok: true, msg: 'Envío actualizado ADMIN-TEST' });
    }),
    http.delete('*/api/admin/compras/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'DELETE', ruta: `/api/admin/compras/${String(params.id)}` });
      const idx = db.findIndex((x) => x.ID_VENTA === Number(params.id));
      if (idx >= 0) db.splice(idx, 1);
      return HttpResponse.json({ ok: true, msg: 'Registro eliminado ADMIN-TEST' });
    }),
  ];
  return { api, handlers };
}

/** Reportes del panel: ventas por rango, más vendidos y descargas Excel/PDF. */
export function handlersReportesAdmin() {
  const api: ApiAdmin = { peticiones: [] };
  const handlers: RequestHandler[] = [
    http.get('*/api/admin/reportes/ventas', ({ request }) => {
      const url = new URL(request.url);
      api.peticiones.push({
        metodo: 'GET',
        ruta: '/api/admin/reportes/ventas',
        cuerpo: { desde: url.searchParams.get('desde'), hasta: url.searchParams.get('hasta'), granularidad: url.searchParams.get('granularidad') },
      });
      return HttpResponse.json({
        desde: url.searchParams.get('desde') || '2026-11-01',
        hasta: url.searchParams.get('hasta') || '2026-11-16',
        totalOrdenes: 45, totalIngresos: 1200000, ticketPromedio: 26666, totalUnidades: 150, totalUsuarios: 12,
        serie: [
          { dia: '2026-11-01', ordenes: 5, ingresos: 300000, unidades: 12, nuevosUsuarios: 3 },
          { dia: '2026-11-02', ordenes: 3, ingresos: 180000, unidades: 7, nuevosUsuarios: 2 },
          { dia: '2026-11-03', ordenes: 2, ingresos: 90000, unidades: 4, nuevosUsuarios: 1 },
        ],
      });
    }),
    http.get('*/api/admin/analytics/mas-vendidos', () => HttpResponse.json([
      { ID: 5, NOMBRE: 'Balón MásV ADMIN-TEST', IMAGEN: null, unidades: 12, ingresos: 480000, stock: 0 },
      { ID: 9, NOMBRE: 'Guayos MásV ADMIN-TEST', IMAGEN: null, unidades: 8, ingresos: 320000, stock: 8 },
      { ID: 12, NOMBRE: 'Raqueta MásV ADMIN-TEST', IMAGEN: null, unidades: 4, ingresos: 160000, stock: 30 },
    ])),
    http.get('*/api/admin/reportes/excel', ({ request }) => {
      api.peticiones.push({ metodo: 'GET', ruta: `/api/admin/reportes/excel${new URL(request.url).search}` });
      return new HttpResponse('datos-excel-ADMIN-TEST', { headers: { 'Content-Type': 'application/vnd.ms-excel' } });
    }),
    http.get('*/api/admin/reportes/pdf', ({ request }) => {
      api.peticiones.push({ metodo: 'GET', ruta: `/api/admin/reportes/pdf${new URL(request.url).search}` });
      return new HttpResponse('datos-pdf-ADMIN-TEST', { headers: { 'Content-Type': 'application/pdf' } });
    }),
  ];
  return { api, handlers };
}

/**
 * Productos del panel: catálogo con revisión de pendientes, publicación como
 * JADDA, imágenes y ficha técnica. Compartida por las suites de
 * AdminProductos, EditarProductoAdmin y SubirImagenes.
 *
 * IMPORTANTE: los handlers genéricos `/api/productos/:id` van AL FINAL para
 * que `/api/productos/categorias` y `/api/productos/descuentos` no los tapen.
 */
export function handlersProductosAdmin() {
  interface ProductoLista {
    ID: number; NOMBRE: string; MARCA: string; CATEGORIA: string; URL_IMAGEN: string | null;
    ESTADO_PUBLICACION: string | null; ID_VENDEDOR: number | null; VENDEDOR_NOMBRE: string | null;
    PRECIO: number; STOCK: number;
  }
  interface VarianteEdicion { ID_VARIANTE: number; COLOR: string; NOMBRE_ATRIBUTO: string; ATRIBUTO: string; STOCK: number }
  interface ProductoEdicion {
    ID_PRODUCTO: number; NOMBRE: string; MARCA: string; PRECIO: number;
    ID_CATEGORIA: number; ID_PROVEEDOR: number; ID_DESCUENTO: number | null;
    DESCRIPCION: string; IMAGENES: { url: string }[]; VARIANTES: VarianteEdicion[];
  }
  const api: ApiAdmin = { peticiones: [] };

  // Catálogo del listado admin (12 productos → 2 páginas de 10).
  const catalogo: ProductoLista[] = [
    { ID: 1, NOMBRE: 'Sudadera Admin Prod ADMIN-TEST', MARCA: 'Jadda', CATEGORIA: 'Gimnasio ADMIN-TEST', URL_IMAGEN: null, ESTADO_PUBLICACION: null, ID_VENDEDOR: null, VENDEDOR_NOMBRE: null, PRECIO: 90000, STOCK: 30 },
    { ID: 2, NOMBRE: 'Balón Admin Prod ADMIN-TEST', MARCA: 'Adidas', CATEGORIA: 'Fútbol ADMIN-TEST', URL_IMAGEN: 'https://test.local/balon.png', ESTADO_PUBLICACION: 'APROBADO', ID_VENDEDOR: 4, VENDEDOR_NOMBRE: 'Deportes Andes ADMIN-TEST', PRECIO: 150000, STOCK: 5 },
    { ID: 3, NOMBRE: 'Guayos Admin Prod ADMIN-TEST', MARCA: 'Nike', CATEGORIA: 'Running ADMIN-TEST', URL_IMAGEN: null, ESTADO_PUBLICACION: 'PENDIENTE', ID_VENDEDOR: 5, VENDEDOR_NOMBRE: 'Tienda Norte ADMIN-TEST', PRECIO: 220000, STOCK: 12 },
    { ID: 4, NOMBRE: 'Camiseta Admin Prod ADMIN-TEST', MARCA: 'Puma', CATEGORIA: 'Running ADMIN-TEST', URL_IMAGEN: null, ESTADO_PUBLICACION: 'RECHAZADO', ID_VENDEDOR: 5, VENDEDOR_NOMBRE: 'Tienda Norte ADMIN-TEST', PRECIO: 75000, STOCK: 0 },
    ...Array.from({ length: 8 }, (_, i) => ({
      ID: 5 + i, NOMBRE: `Producto Gen ${5 + i} ADMIN-TEST`, MARCA: 'Genérica ADMIN-TEST', CATEGORIA: 'Fútbol ADMIN-TEST', URL_IMAGEN: null,
      ESTADO_PUBLICACION: null, ID_VENDEDOR: null, VENDEDOR_NOMBRE: null, PRECIO: 10000 * (5 + i), STOCK: 50,
    })),
  ];

  // Detalle del producto PENDIENTE (id 3) para el modal de revisión.
  const detalleRevision = {
    ID: 3, NOMBRE: 'Guayos Admin Prod ADMIN-TEST', MARCA: 'Nike', VENDEDOR_NOMBRE: 'Tienda Norte ADMIN-TEST',
    ESTADO_PUBLICACION: 'PENDIENTE', CATEGORIA: 'Running ADMIN-TEST', PRECIO: 220000, DESCUENTO_PORCENTAJE: 20,
    DESCRIPCION: 'Guayos de alta tracción para cancha sintética',
    IMAGENES: [{ url: 'https://test.local/p1.png' }, { url: 'https://test.local/p2.png' }],
    VARIANTES: [
      { COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '40', STOCK: 12 },
      { COLOR: '', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 0 },
    ],
    CARACTERISTICAS: [{ NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Sintético' }],
  };

  // Producto en edición (GET/PUT/DELETE /api/productos/5).
  const productoEdicion: ProductoEdicion = {
    ID_PRODUCTO: 5, NOMBRE: 'Guayos Editar ADMIN-TEST', MARCA: 'Nike', PRECIO: 120000,
    ID_CATEGORIA: 1, ID_PROVEEDOR: 10, ID_DESCUENTO: null,
    DESCRIPCION: 'Guayos de tracción mejorada',
    IMAGENES: [{ url: 'https://test.local/e1.png' }],
    VARIANTES: [
      { ID_VARIANTE: 31, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '40', STOCK: 4 },
      { ID_VARIANTE: 32, COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 0 },
    ],
  };
  const caracteristicasEdicion = [
    { ID_CARACTERISTICA: 41, NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero sintético' },
    { ID_CARACTERISTICA: 42, NOMBRE_ATRIBUTO: 'Color', VALOR_ATRIBUTO: 'Negro, Blanco' },
  ];

  const categorias = [
    { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol ADMIN-TEST' },
    { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running ADMIN-TEST' },
  ];
  const proveedores = [
    { ID_PROVEEDOR: 10, NOMBRE_PROVEEDOR: 'Proveedura Uno ADMIN-TEST' },
    { ID_PROVEEDOR: 11, NOMBRE_PROVEEDOR: 'Proveedura Dos ADMIN-TEST' },
  ];
  const descuentos: { ID_DESCUENTO: number; DESCRIPCION: string; PORCENTAJE: number; FECHA_FIN: string | null }[] = [
    { ID_DESCUENTO: 9, DESCRIPCION: 'Ofertura ADMIN-TEST', PORCENTAJE: 15, FECHA_FIN: null },
  ];

  const handlers: RequestHandler[] = [
    // Listado admin (con query stock_bajo/solo_jadda).
    http.get('*/api/admin/productos', ({ request }) => {
      const params = new URL(request.url).searchParams;
      api.peticiones.push({ metodo: 'GET', ruta: `/api/admin/productos${new URL(request.url).search}`, cuerpo: { stock_bajo: params.get('stock_bajo'), solo_jadda: params.get('solo_jadda') } });
      let lista = catalogo;
      if (params.get('stock_bajo') === 'true') lista = lista.filter((p) => p.STOCK <= 10);
      if (params.get('solo_jadda') === 'true') lista = lista.filter((p) => !p.ID_VENDEDOR);
      return HttpResponse.json(lista);
    }),
    // Detalle para el modal de revisión de productos de vendedor.
    http.get('*/api/admin/productos/:id', ({ params }) => HttpResponse.json({ ...detalleRevision, ID: Number(params.id) })),
    http.post('*/api/admin/productos/:id/aprobar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { observacion?: string };
      api.peticiones.push({ metodo: 'POST', ruta: `/api/admin/productos/${String(params.id)}/aprobar`, cuerpo });
      const p = catalogo.find((x) => x.ID === Number(params.id));
      if (p) p.ESTADO_PUBLICACION = 'APROBADO';
      return HttpResponse.json({ ok: true, msg: 'Producto aprobado ADMIN-TEST', sinCambios: false });
    }),
    http.post('*/api/admin/productos/:id/rechazar', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { observacion?: string };
      api.peticiones.push({ metodo: 'POST', ruta: `/api/admin/productos/${String(params.id)}/rechazar`, cuerpo });
      const p = catalogo.find((x) => x.ID === Number(params.id));
      if (p) { p.ESTADO_PUBLICACION = 'RECHAZADO'; }
      return HttpResponse.json({ ok: true, msg: 'Producto rechazado ADMIN-TEST', sinCambios: false });
    }),
    http.get('*/api/admin/pendientes', () => HttpResponse.json({ productos: 4, chats: 0 })),
    // Catálogos del PublicarForm y del panel de edición.
    http.get('*/api/productos/categorias', () => HttpResponse.json(categorias)),
    http.get('*/api/proveedores', () => HttpResponse.json(proveedores)),
    http.get('*/api/productos/descuentos', () => HttpResponse.json(descuentos)),
    http.post('*/api/productos/descuentos', async ({ request }) => {
      const cuerpo = (await request.json()) as { DESCRIPCION: string; PORCENTAJE: number; FECHA_FIN: string | null };
      api.peticiones.push({ metodo: 'POST', ruta: '/api/productos/descuentos', cuerpo });
      const nuevo = {
        ID_DESCUENTO: Math.max(...descuentos.map((d) => d.ID_DESCUENTO)) + 1,
        DESCRIPCION: cuerpo.DESCRIPCION, PORCENTAJE: cuerpo.PORCENTAJE, FECHA_FIN: cuerpo.FECHA_FIN ?? null,
      };
      descuentos.push(nuevo);
      return HttpResponse.json(nuevo);
    }),
    // Subida de imágenes: dataURLs del cliente → URL del "servidor".
    http.post('*/api/productos/imagenes', async ({ request }) => {
      const cuerpo = (await request.json()) as { imagenes: { nombre: string; data: string }[]; idProducto?: number };
      api.peticiones.push({ metodo: 'POST', ruta: '/api/productos/imagenes', cuerpo });
      return HttpResponse.json({ urls: cuerpo.imagenes.map((_, i) => `https://test.local/upload-${i + 1}-ADMIN-TEST.png`) });
    }),
    // Publicar como JADDA.
    http.post('*/api/productos', async ({ request }) => {
      const cuerpo = (await request.json()) as {
        NOMBRE: string; MARCA: string; PRECIO: number; DESCRIPCION: string;
        ID_CATEGORIA: number; ID_PROVEEDOR: number; ID_DESCUENTO: number | null;
        IMAGENES: string[]; VARIANTES: { COLOR: string; NOMBRE_ATRIBUTO: string; ATRIBUTO: string; STOCK: number }[];
        CARACTERISTICAS: { NOMBRE_ATRIBUTO: string; VALOR_ATRIBUTO: string }[];
      };
      api.peticiones.push({ metodo: 'POST', ruta: '/api/productos', cuerpo });
      return HttpResponse.json({ ok: true, msg: 'Producto publicado ADMIN-TEST' });
    }),
    // Ficha técnica del producto en edición.
    http.get('*/api/productos/:id/caracteristicas', () => HttpResponse.json(caracteristicasEdicion)),
    // Genéricos de /api/productos/:id — AL FINAL (ver nota del doc).
    http.get('*/api/productos/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'GET', ruta: `/api/productos/${String(params.id)}` });
      return HttpResponse.json({ ...productoEdicion, IMAGENES: productoEdicion.IMAGENES.map((i) => ({ ...i })) });
    }),
    http.put('*/api/productos/:id', async ({ request, params }) => {
      const cuerpo = (await request.json()) as {
        NOMBRE?: string; MARCA?: string; PRECIO?: number; DESCRIPCION?: string;
        ID_CATEGORIA?: number; ID_PROVEEDOR?: number; ID_DESCUENTO?: number | null;
        IMAGENES?: string[]; VARIANTES?: VarianteEdicion[];
        CARACTERISTICAS?: { NOMBRE_ATRIBUTO: string; VALOR_ATRIBUTO: string }[];
      };
      api.peticiones.push({ metodo: 'PUT', ruta: `/api/productos/${String(params.id)}`, cuerpo });
      productoEdicion.NOMBRE = cuerpo.NOMBRE ?? productoEdicion.NOMBRE;
      productoEdicion.MARCA = cuerpo.MARCA ?? productoEdicion.MARCA;
      productoEdicion.PRECIO = cuerpo.PRECIO ?? productoEdicion.PRECIO;
      productoEdicion.DESCRIPCION = cuerpo.DESCRIPCION ?? productoEdicion.DESCRIPCION;
      if (cuerpo.VARIANTES) productoEdicion.VARIANTES = cuerpo.VARIANTES;
      return HttpResponse.json({ ok: true, msg: 'Producto actualizado ADMIN-TEST' });
    }),
    http.delete('*/api/productos/:id', ({ params }) => {
      api.peticiones.push({ metodo: 'DELETE', ruta: `/api/productos/${String(params.id)}` });
      const idx = catalogo.findIndex((x) => x.ID === Number(params.id));
      if (idx >= 0) catalogo.splice(idx, 1);
      return HttpResponse.json({ ok: true, msg: 'Producto eliminado ADMIN-TEST' });
    }),
  ];
  return { api, handlers };
}
