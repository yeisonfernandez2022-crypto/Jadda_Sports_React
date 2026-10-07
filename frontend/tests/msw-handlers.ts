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

  http.get('/api/auth/perfil', () => {
    return HttpResponse.json({
      ok: false,
    }, { status: 401 });
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

  // Chat
  http.get('/api/chat/no-leidos', () => {
    return HttpResponse.json({ total: 0 });
  }),

  http.get('/api/chat/conversaciones', () => {
    return HttpResponse.json([]);
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
];