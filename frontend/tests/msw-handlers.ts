import { http, HttpResponse } from 'msw';

export const handlers = [
  // Productos
  http.get('/api/productos', () => {
    return HttpResponse.json([
      {
        ID: 1,
        NOMBRE: 'Guayos Profesionales',
        MARCA: 'Adidas',
        PRECIO: 350000,
        IMAGEN: '/images/productos/Producto_01/img_1.jpg',
        STOCK: 10,
        ID_CATEGORIA: 1,
        ID_DESCUENTO: null,
        RATING: 4.5,
        RESENA_COUNT: 10,
        ID_VARIANTE_POR_DEFECTO: 1,
      },
      {
        ID: 2,
        NOMBRE: 'Balón Al Rihla',
        MARCA: 'Adidas',
        PRECIO: 280000,
        IMAGEN: '/images/productos/Producto_02/img_1.webp',
        STOCK: 5,
        ID_CATEGORIA: 1,
        ID_DESCUENTO: 1,
        DESCUENTO_PORCENTAJE: 15,
        RATING: 4.8,
        RESENA_COUNT: 25,
        ID_VARIANTE_POR_DEFECTO: 2,
      },
    ]);
  }),

  http.get('/api/productos/:id', ({ params }) => {
    const id = params.id;
    return HttpResponse.json({
      ID: parseInt(id),
      NOMBRE: 'Guayos Profesionales',
      MARCA: 'Adidas',
      PRECIO: 350000,
      IMAGEN: '/images/productos/Producto_01/img_1.jpg',
      STOCK: 10,
      ID_CATEGORIA: 1,
      ID_DESCUENTO: null,
      DESCRIPCION: 'Guayos profesionales de alta calidad',
      CARACTERISTICAS: [
        { NOMBRE: 'Material', VALOR: 'Cuero sintético' },
        { NOMBRE: 'Suela', VALOR: 'TPU' },
      ],
      VARIANTES: [
        { ID_VARIANTE: 1, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 5 },
        { ID_VARIANTE: 2, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '43', STOCK: 3 },
      ],
      RESENAS: [],
      RATING: 4.5,
      RESENA_COUNT: 10,
    });
  }),

  // Categorías
  http.get('/api/productos/categorias', () => {
    return HttpResponse.json([
      { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol', DESCRIPCION: 'Productos de fútbol', TOTAL_PRODUCTOS: 10 },
      { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running', DESCRIPCION: 'Productos de running', TOTAL_PRODUCTOS: 8 },
      { ID_CATEGORIA: 3, NOMBRE_CATEGORIA: 'Gimnasio', DESCRIPCION: 'Productos de gimnasio', TOTAL_PRODUCTOS: 12 },
    ]);
  }),

  // Descuentos
  http.get('/api/productos/descuentos', () => {
    return HttpResponse.json([
      { ID_DESCUENTO: 1, DESCRIPCION: 'JADDA10', PORCENTAJE: 10, FECHA_FIN: '2026-12-31', MONTO_MINIMO: 200000 },
      { ID_DESCUENTO: 2, DESCRIPCION: 'VERANO20', PORCENTAJE: 20, FECHA_FIN: '2026-08-31', MONTO_MINIMO: null },
    ]);
  }),

  // Variantes
  http.get('/api/productos/:id/variantes', () => {
    return HttpResponse.json([
      { ID_VARIANTE: 1, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 5 },
      { ID_VARIANTE: 2, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '43', STOCK: 3 },
    ]);
  }),

  // Carrito
  http.get('/api/carrito', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/carrito/agregar', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ID_CARRITO: 1,
      ID_PRODUCTO: body.id_producto,
      ID_VARIANTE: body.id_variante,
      CANTIDAD: body.cantidad,
    });
  }),

  http.put('/api/carrito/actualizar/:id', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ID_CARRITO: parseInt(params.id),
      CANTIDAD: body.cantidad,
    });
  }),

  http.delete('/api/carrito/eliminar/:id', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Cupones
  http.post('/api/cupones/validar', async ({ request }) => {
    const body = await request.json();
    if (body.codigo === 'JADDA10') {
      return HttpResponse.json({
        ok: true,
        descuento: { ID_DESCUENTO: 1, DESCRIPCION: 'JADDA10', PORCENTAJE: 10, MONTO_MINIMO: 200000 },
      });
    }
    return HttpResponse.json({ ok: false, error: 'Cupón no válido' }, { status: 404 });
  }),

  http.get('/api/cupones/disponibles', () => {
    return HttpResponse.json({
      tienda: [{ ID_DESCUENTO: 1, DESCRIPCION: 'JADDA10', PORCENTAJE: 10, MONTO_MINIMO: 200000 }],
      personales: [],
    });
  }),

  // Auth
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json();
    if (body.email === 'yeison' && body.password === 'Losquiero7') {
      return HttpResponse.json({
        ok: true,
        usuario: {
          ID_USUARIO: 1,
          NOMBRE_USUARIO: 'Yeison',
          EMAIL: 'yeison@test.com',
          USUARIO: 'yeison',
          ID_ROL: 1,
          foto_url: null,
        },
      });
    }
    if (body.email === 'prueba.vendedor@test.com' && body.password === 'Prueba123') {
      return HttpResponse.json({
        ok: true,
        usuario: {
          ID_USUARIO: 2,
          NOMBRE_USUARIO: 'Pepe',
          EMAIL: 'prueba.vendedor@test.com',
          USUARIO: 'pepe_vendedor',
          ID_ROL: 6,
          foto_url: null,
        },
      });
    }
    return HttpResponse.json({ ok: false, error: 'Credenciales inválidas' }, { status: 401 });
  }),

  http.post('/api/auth/registro', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ok: true,
      message: 'Usuario registrado correctamente. Revisa tu correo para verificar tu cuenta.',
    }, { status: 201 });
  }),

  http.post('/api/auth/confirmar', async ({ request }) => {
    const body = await request.json();
    if (body.codigo === '123456') {
      return HttpResponse.json({ ok: true, message: 'Cuenta verificada correctamente' });
    }
    return HttpResponse.json({ ok: false, error: 'Código inválido o expirado' }, { status: 400 });
  }),

  http.post('/api/auth/reenviar-codigo', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Código reenviado' });
  }),

  http.post('/api/auth/recuperar-password', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Código de recuperación enviado' });
  }),

  http.post('/api/auth/verificar-codigo', async ({ request }) => {
    const body = await request.json();
    if (body.codigo === '123456') {
      return HttpResponse.json({ ok: true });
    }
    return HttpResponse.json({ ok: false, error: 'Código inválido' }, { status: 400 });
  }),

  http.post('/api/auth/update-password', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Contraseña actualizada' });
  }),

  http.get('/api/auth/perfil', () => {
    return HttpResponse.json({ ok: false }, { status: 401 });
  }),

  // Admin
  http.get('/api/admin/compras', () => {
    return HttpResponse.json([
      {
        ID_VENTA: 1,
        NUMERO_PEDIDO: 12345678,
        ESTADO: 'COMPLETADA',
        ESTADO_ENVIO: 'ENTREGADO',
        FECHA_VENTA: '2026-01-15',
        TOTAL: 350000,
        CLIENTE: 'Yeison',
        METODO_PAGO: 'Nequi',
        ES_DE_VENDEDOR: false,
      },
    ]);
  }),

  http.get('/api/admin/pendientes', () => {
    return HttpResponse.json({
      devoluciones: 0,
      evidencias: 0,
      stockBajo: 0,
      avisos: 0,
      vendedores: 0,
      chats: 0,
    });
  }),

  http.put('/api/admin/compras/:id/envio', async ({ params, request }) => {
    return HttpResponse.json({ ok: true, message: 'Estado de envío actualizado' });
  }),

  http.put('/api/admin/compras/:id/estado', async ({ params, request }) => {
    return HttpResponse.json({ ok: true, message: 'Estado actualizado' });
  }),

  http.delete('/api/admin/compras/:id', () => {
    return HttpResponse.json({ ok: true, message: 'Compra eliminada' });
  }),

  http.get('/api/admin/productos', () => {
    return HttpResponse.json([
      { ID: 1, NOMBRE: 'Producto Admin', PRECIO: 100000, STOCK: 10, ID_VENDEDOR: null },
    ]);
  }),

  http.post('/api/admin/productos/:id/aprobar', () => {
    return HttpResponse.json({ ok: true, message: 'Producto aprobado' });
  }),

  http.post('/api/admin/productos/:id/rechazar', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Producto rechazado' });
  }),

  // Chat
  http.get('/api/chat/no-leidos', () => {
    return HttpResponse.json({ total: 0 });
  }),

  http.get('/api/chat/conversaciones', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/chat/iniciar', async ({ request }) => {
    return HttpResponse.json({ ok: true, chatId: 1 });
  }),

  http.post('/api/chat/:id/mensajes', async ({ request }) => {
    return HttpResponse.json({ ok: true, mensajeId: 1 });
  }),

  http.post('/api/chat/:id/escalar', () => {
    return HttpResponse.json({ ok: true, message: 'Chat escalado' });
  }),

  // Envío
  http.get('/api/envio/calcular', ({ request }) => {
    const url = new URL(request.url);
    const departamento = url.searchParams.get('departamento') || '';
    const subtotal = parseInt(url.searchParams.get('subtotal') || '0');
    if (subtotal >= 800000) return HttpResponse.json({ costo: 0 });
    return HttpResponse.json({ costo: 9000 });
  }),

  // Notificaciones
  http.get('/api/notificaciones', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/notificaciones/no-leidas', () => {
    return HttpResponse.json({ total: 0 });
  }),

  http.put('/api/notificaciones/:id/leer', () => {
    return HttpResponse.json({ ok: true });
  }),

  http.put('/api/notificaciones/leer-todas', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Favoritos
  http.get('/api/favoritos', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/favoritos', async ({ request }) => {
    return HttpResponse.json({ ok: true, favoritoId: 1 });
  }),

  http.delete('/api/favoritos/:id', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Historial
  http.get('/api/historial', () => {
    return HttpResponse.json([]);
  }),

  // Métodos de Pago
  http.get('/api/metodos-pago', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/metodos-pago', async ({ request }) => {
    return HttpResponse.json({ ok: true, metodoId: 1 });
  }),

  http.put('/api/metodos-pago/:id', async ({ request }) => {
    return HttpResponse.json({ ok: true });
  }),

  http.delete('/api/metodos-pago/:id', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Newsletter
  http.post('/api/newsletter', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Suscrito correctamente' });
  }),

  http.get('/api/newsletter/suscritos', () => {
    return HttpResponse.json([]);
  }),

  // Contacto
  http.post('/api/contacto', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'Mensaje enviado' });
  }),

  // PQR
  http.post('/api/pqr', async ({ request }) => {
    return HttpResponse.json({ ok: true, message: 'PQR enviado' });
  }),

  // Planes
  http.get('/api/planes', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/planes', async ({ request }) => {
    return HttpResponse.json({ ok: true, planId: 1 });
  }),

  http.put('/api/planes/:id/avanzar', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Retos
  http.get('/api/retos', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/retos/inscribir', async ({ request }) => {
    return HttpResponse.json({ ok: true, retoUsuarioId: 1 });
  }),

  http.post('/api/retos/avance', async ({ request }) => {
    return HttpResponse.json({ ok: true, evidenciaId: 1 });
  }),

  // Vendedor
  http.get('/api/vendedor/mi-tienda', () => {
    return HttpResponse.json({
      productosPublicados: 0,
      productosPendientes: 0,
      unidadesVendidas: 0,
      totalVentas: 0,
      totalIngresos: 0,
      ultimasVentas: [],
      stockBajo: [],
    });
  }),

  http.get('/api/vendedor/productos', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/vendedor/productos', async ({ request }) => {
    return HttpResponse.json({ ok: true, productoId: 1 });
  }),

  http.put('/api/vendedor/productos/:id', async ({ request }) => {
    return HttpResponse.json({ ok: true });
  }),

  http.delete('/api/vendedor/productos/:id', () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get('/api/vendedor/ventas', () => {
    return HttpResponse.json([]);
  }),

  http.put('/api/vendedor/ventas/:id/envio', () => {
    return HttpResponse.json({ ok: true });
  }),

  http.put('/api/vendedor/ventas/:id/estado', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Devoluciones
  http.post('/api/devoluciones', async ({ request }) => {
    return HttpResponse.json({ ok: true, devolucionId: 1 });
  }),

  http.get('/api/devoluciones', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/devoluciones/admin', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/devoluciones/admin/:id/procesar', async ({ request }) => {
    return HttpResponse.json({ ok: true });
  }),

  // Métodos de Pago
  http.get('/api/metodos-pago', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/metodos-pago', async ({ request }) => {
    return HttpResponse.json({ ok: true, metodoId: 1 });
  }),

  // Direcciones
  http.get('/api/direcciones', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/direcciones', async ({ request }) => {
    return HttpResponse.json({ ok: true, direccionId: 1 });
  }),

  http.put('/api/direcciones/:id', async ({ request }) => {
    return HttpResponse.json({ ok: true });
  }),

  http.delete('/api/direcciones/:id', () => {
    return HttpResponse.json({ ok: true });
  }),

  // Imágenes
  http.post('/api/productos/imagenes', async ({ request }) => {
    return HttpResponse.json({ ok: true, imagenes: [] });
  }),

  // Error handlers for testing error scenarios
  http.get('/api/error/500', () => {
    return HttpResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }),

  http.get('/api/error/404', () => {
    return HttpResponse.json({ error: 'No encontrado' }, { status: 404 });
  }),

  http.get('/api/error/401', () => {
    return HttpResponse.json({ error: 'No autorizado' }, { status: 401 });
  }),

  http.get('/api/error/403', () => {
    return HttpResponse.json({ error: 'Prohibido' }, { status: 403 });
  }),

  http.get('/api/error/422', () => {
    return HttpResponse.json({ error: 'Error de validación' }, { status: 422 });
  }),

  // Rate limiting simulation
  http.get('/api/rate-limit', () => {
    return HttpResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }),
];

// Handlers for error testing
export const errorHandlers = [
  http.get('/api/productos', () => {
    return HttpResponse.json({ error: 'Error interno' }, { status: 500 });
  }),

  http.post('/api/auth/login', async () => {
    return HttpResponse.json({ error: 'Error de conexión' }, { status: 500 });
  }),

  http.get('/api/carrito', () => {
    return HttpResponse.json({ error: 'No autorizado' }, { status: 401 });
  }),
];

// Handlers for empty states
export const emptyHandlers = [
  http.get('/api/productos', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/productos/categorias', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/admin/compras', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/chat/conversaciones', () => {
    return HttpResponse.json([]);
  }),

  http.get('/api/favoritos', () => {
    return HttpResponse.json([]);
  }),
];

// Handler to simulate slow network
export const slowHandlers = [
  http.get('/api/productos', async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return HttpResponse.json([
      { ID: 1, NOMBRE: 'Producto Lento', PRECIO: 100000, STOCK: 5 },
    ]);
  }),
];