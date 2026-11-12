/**
 * Especificación OpenAPI 3.0.3 de la API JADDA SPORTS.
 *
 * Documentación viva: la UI (Swagger UI) se sirve en /api-docs y la spec
 * cruda en JSON en /api-docs.json (routes/docsRoutes.js). Este objeto es la
 * ÚNICA fuente: si agregas rutas, actualízalo también.
 *
 * Convenciones de la API real:
 *  - Sesión por cookie de sesión (express-session) con `connect.sid`:
 *    las rutas protegidas exigen sesión válida (401 sin ella).
 *  - Errores en JSON: { error?: string, msg?: string, message?: string,
 *    ok?: boolean } — los controllers mezclan `error` y `msg`.
 *  - Mensajes en español.
 */
'use strict';

const CRITICO = { description: 'Error interno del servidor' };
const SIN_SESION = { description: 'No autenticado (sin sesión válida)' };
const SIN_PERMISO = { description: 'Sin permiso para esta operación' };

/** Response de éxito genérico con schema opcional */
const OK = (descripcion, schema) => ({ description: descripcion, ...(schema ? { content: { 'application/json': { schema } } } : {}) });

/** Path item GET/POST/... compacto */
function ep(metodo, { tags, resumen, sesion = false, admin = false, vendedor = false, params = [], query = [], body = null, respuestas = {}, schema = null, desc = null }) {
  const item = { [metodo]: {} };
  const op = item[metodo];
  op.tags = tags;
  op.summary = resumen;
  if (desc) op.description = desc;
  if (sesion || admin || vendedor) op.security = [{ cookieAuth: [] }];
  if (params.length) {
    op.parameters = params.map((p) => ({ name: p, in: 'path', required: true, schema: { type: 'string' } }));
    if (op.parameters.length) op.parameters = op.parameters.concat(query.map((q) => ({ name: q.name, in: 'query', required: false, schema: q.schema || { type: 'string' }, description: q.desc || undefined })));
  } else if (query.length) {
    op.parameters = query.map((q) => ({ name: q.name, in: 'query', required: false, schema: q.schema || { type: 'string' }, description: q.desc || undefined }));
  }
  if (body) op.requestBody = { required: true, content: { 'application/json': { schema: body.schema, example: body.example } } };
  op.responses = {
    ...respuestas,
    ...(metodo !== 'get' && !respuestas['200'] ? {} : {}),
  };
  if (!Object.keys(op.responses).length) op.responses = { '200': OK('Respuesta de la operación', schema) };
  return item;
}

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'JADDA SPORTS — API',
    version: '1.1.0',
    description:
      'API REST de la plataforma de e-commerce de artículos deportivos JADDA SPORTS: catálogo, carrito, checkout con pasarela Wompi, pedidos con factura PDF, devoluciones, retos con cupones, chat de soporte, notificaciones, marketplace de vendedores y panel administrativo.\n\n' +
      '**Autenticación:** sesión por cookie `connect.sid` (express-session + Passport). ' +
      'Haz login en `POST /api/auth/login` y la cookie de la respuesta se usa en las peticiones siguientes. ' +
      'Los flujos web (SPA) y la app móvil comparten esta API. Rate limiting global 300 req/min por IP y límites específicos por ruta sensible.',
    contact: { name: 'JADDA SPORTS', url: 'https://jadda-frontend.onrender.com' },
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Desarrollo local (Docker)' },
    { url: 'https://jadda-backend.onrender.com', description: 'Producción (Render + TiDB Cloud)' },
  ],
  tags: [
    { name: 'Salud', description: 'Sondas de disponibilidad (liveness/readiness)' },
    { name: 'Auth', description: 'Registro, login, verificación OTP, perfil, foto, OAuth Google y sesión' },
    { name: 'Productos', description: 'Catálogo público, variantes, características, reseñas, categorías y descuentos' },
    { name: 'Carrito', description: 'Carrito de compras del cliente' },
    { name: 'Checkout', description: 'Procesamiento de la compra (venta + cupón + envío)' },
    { name: 'Pagos', description: 'Pasarela Wompi: sesión de pago, pull de estado y webhook' },
    { name: 'Compras', description: 'Pedidos del cliente: listado, detalle, factura PDF, cancelación y reembolsos' },
    { name: 'Devoluciones', description: 'Solicitudes de devolución/reembolso con evidencias' },
    { name: 'Retos', description: 'Retos deportivos, inscripciones, avances con evidencias y cupones RETO-' },
    { name: 'Planes', description: 'Planes de entrenamiento generados y progreso por días' },
    { name: 'Cupones', description: 'Validación de cupones en checkout y cupones personales de retos' },
    { name: 'Chat', description: 'Chat usuario↔vendedor↔admin y escalación de disputas' },
    { name: 'Direcciones', description: 'Direcciones de envío del cliente' },
    { name: 'Métodos de pago', description: 'Métodos de pago guardados del cliente' },
    { name: 'Favoritos', description: 'Productos favoritos' },
    { name: 'Historial', description: 'Productos recientemente vistos' },
    { name: 'Notificaciones', description: 'Campana de notificaciones in-app' },
    { name: 'Newsletter', description: 'Suscripción a la newsletter y envío admin' },
    { name: 'Contacto', description: 'Formularios de contacto y PQR' },
    { name: 'Envío', description: 'Tarifas y cálculo de costo de envío por departamento' },
    { name: 'Vendedor', description: 'Panel del vendedor: tienda, productos, ventas, reportes y devoluciones' },
    { name: 'Admin', description: 'Panel de administración: dashboard, órdenes, usuarios, productos, reportes y pendientes' },
    { name: 'Otros', description: 'Proveedores y demás utilidades' },
  ],
  paths: {},
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Sesión de express-session. Se obtiene con POST /api/auth/login (la respuesta Set-Cookie) y se reenvía en cada petición.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Mensaje del error (español)' },
          msg: { type: 'string', description: 'Mensaje alternativo usado por algunos controllers' },
          message: { type: 'string', description: 'Mensaje alternativo usado por auth' },
          ok: { type: 'boolean', description: 'false en respuestas de fallo de algunos endpoints' },
        },
      },
      Producto: {
        type: 'object',
        properties: {
          ID: { type: 'integer', example: 1 },
          NOMBRE: { type: 'string', example: 'Guayos profesionales de fútbol' },
          MARCA: { type: 'string', example: 'Adidas' },
          PRECIO: { type: 'number', example: 220000, description: 'Precio en COP' },
          DESCRIPCION: { type: 'string' },
          CATEGORIA: { type: 'string', example: 'Fútbol' },
          ID_CATEGORIA: { type: 'integer' },
          ID_DESCUENTO: { type: 'integer', nullable: true, description: 'Id de descuento activo si está en ofertas' },
          VENDEDOR_NOMBRE: { type: 'string', nullable: true, description: 'Empresa del vendedor (null = vendido por JADDA)' },
          IMAGEN: { type: 'string', description: 'URL de imagen principal (Cloudinary o /images/...)' },
          STOCK: { type: 'integer', description: 'Suma de stock de todas las variantes' },
          RATING: { type: 'number', nullable: true, description: 'Promedio de reseñas (1..5)' },
          RESENA_COUNT: { type: 'integer' },
          ID_VARIANTE_POR_DEFECTO: { type: 'integer', nullable: true },
        },
      },
      Variante: {
        type: 'object',
        properties: {
          ID_VARIANTE: { type: 'integer', example: 189531 },
          ID_PRODUCTO: { type: 'integer' },
          COLOR: { type: 'string', nullable: true, example: 'Blanco' },
          NOMBRE_ATRIBUTO: { type: 'string', nullable: true, example: 'Talla' },
          ATRIBUTO: { type: 'string', nullable: true, example: '42' },
          STOCK: { type: 'integer' },
        },
      },
      Carrito: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ID_CARRITO: { type: 'integer' },
                ID_PRODUCTO: { type: 'integer' },
                ID_VARIANTE: { type: 'integer', nullable: true },
                NOMBRE: { type: 'string' },
                CANTIDAD: { type: 'integer' },
                PRECIO: { type: 'number', description: 'Precio unitario vigente' },
                IMAGEN: { type: 'string', nullable: true },
                STOCK: { type: 'integer' },
              },
            },
          },
          subtotal: { type: 'number', description: 'Calculado en cliente y revalidado en servidor' },
        },
      },
      Venta: {
        type: 'object',
        properties: {
          ID_VENTA: { type: 'integer', example: 42 },
          ESTADO: { type: 'string', enum: ['PENDIENTE', 'PENDIENTE_PAGO', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA'], example: 'COMPLETADA' },
          TOTAL: { type: 'number', example: 449000 },
          COSTO_ENVIO: { type: 'number', nullable: true },
          REFERENCIA_PAGO: { type: 'string', nullable: true, description: 'Referencia Wompi (JADDA-...) o SIM_ para ventas sin pasarela' },
          FECHA_VENTA: { type: 'string', format: 'date-time' },
          METODO_PAGO: { type: 'string', nullable: true, description: 'Nombre del método de pago' },
          ESTADO_ENVIO: { type: 'string', nullable: true, enum: ['PENDIENTE', 'POR_EMPAQUETAR', 'EMPACADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'] },
          productos: { type: 'array', items: { $ref: '#/components/schemas/ItemVenta' } },
        },
      },
      ItemVenta: {
        type: 'object',
        properties: {
          NOMBRE: { type: 'string' },
          CANTIDAD: { type: 'integer' },
          SUBTOTAL: { type: 'number' },
          COLOR: { type: 'string', nullable: true },
          NOMBRE_ATRIBUTO: { type: 'string', nullable: true },
          ATRIBUTO: { type: 'string', nullable: true },
          IMAGEN: { type: 'string', nullable: true },
        },
      },
      Usuario: {
        type: 'object',
        properties: {
          ID_USUARIO: { type: 'integer' },
          NOMBRE_USUARIO: { type: 'string' },
          APELLIDO_USUARIO: { type: 'string' },
          EMAIL: { type: 'string', format: 'email' },
          USUARIO: { type: 'string', description: 'Nombre de usuario público (@handle)' },
          telefono: { type: 'string', nullable: true },
          ID_ROL: { type: 'integer', description: '1 admin · 4 cliente · 6 vendedor' },
          FOTO_URL: { type: 'string', nullable: true },
          DEBE_CAMBIAR_PASSWORD: { type: 'integer', description: '1 = debe cambiar contraseña temporal antes de comprar' },
        },
      },
      Notificacion: {
        type: 'object',
        properties: {
          ID_NOTIFICACION: { type: 'integer' },
          TITULO: { type: 'string' },
          MENSAJE: { type: 'string' },
          TIPO: { type: 'string', example: 'pedido' },
          RUTA: { type: 'string', nullable: true, description: 'Ruta de navegación sugerida (/perfil/compras, /chats...)' },
          LEIDA: { type: 'integer' },
          FECHA: { type: 'string', format: 'date-time' },
        },
      },
      ChatResumen: {
        type: 'object',
        properties: {
          ID_CHAT: { type: 'integer' },
          TIPO: { type: 'string', enum: ['SOPORTE', 'VENDEDOR', 'DEVOLUCION'] },
          ESTADO: { type: 'string', enum: ['ACTIVA', 'ESCALADA', 'CERRADA'] },
          NO_LEIDOS: { type: 'integer' },
          ULTIMO_MENSAJE: { type: 'string', nullable: true },
          EMPRESA: { type: 'string', nullable: true, description: 'Empresa del vendedor en chats de tipo VENDEDOR' },
        },
      },
    },
    responses: {
      NoAuth: { description: SIN_SESION.description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NoPermiso: { description: SIN_PERMISO.description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      NotFound: { description: 'Recurso no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
      BadRequest: { description: 'Datos inválidos (mensaje en español)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    },
  },
};

// ============================================================================
// PATHS
// ============================================================================
const P = spec.paths;

// ---- Salud -----------------------------------------------------------------
P['/health'] = ep('get', { tags: ['Salud'], resumen: 'Liveness del backend (sin BD)', respuestas: { '200': OK('Backend disponible') } });
P['/api/health'] = ep('get', { tags: ['Salud'], resumen: 'Readiness: verifica la BD', respuestas: { '200': OK('BD ok'), '503': OK('BD degradada') } });

// ---- Auth ------------------------------------------------------------------
P['/api/auth/registro'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Registro de cuenta (requiere verificación por código OTP)',
  body: {
    schema: {
      type: 'object',
      required: ['nombres', 'email', 'password', 'telefono'],
      properties: {
        nombres: { type: 'string', example: 'Juan Pérez' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', description: 'Mínimo 8 caracteres' },
        telefono: { type: 'string', description: '10 dígitos' },
        direccion: { type: 'string', nullable: true, description: '"dirección, ciudad, departamento" — crea la dirección principal' },
      },
    },
    example: { nombres: 'Juan Pérez', email: 'juan@example.com', password: 'MiClave123', telefono: '3001234567', direccion: 'Cra 1 #2-3, Bogotá, Cundinamarca' },
  },
  respuestas: {
    '201': OK('Cuenta creada — llega un código de 6 dígitos al correo', { type: 'object', properties: { ok: { type: 'boolean' }, msg: { type: 'string' } } }),
    '400': { $ref: '#/components/responses/BadRequest' },
    '409': OK('Correo ya registrado'),
    '429': OK('Demasiados intentos (rate limit 5/15 min)'),
  },
});
P['/api/auth/confirmar'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Verificación de la cuenta con el código OTP',
  body: { schema: { type: 'object', required: ['email', 'codigo'], properties: { email: { type: 'string', format: 'email' }, codigo: { type: 'string', example: '123456' } } }, example: { email: 'juan@example.com', codigo: '123456' } },
  respuestas: { '200': OK('Cuenta confirmada'), '400': { $ref: '#/components/responses/BadRequest' } },
});
P['/api/auth/login'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Iniciar sesión (crea la cookie de sesión)',
  body: { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', description: 'Correo o usuario' }, password: { type: 'string', format: 'password' } } }, example: { email: 'juan@example.com', password: 'MiClave123' } },
  respuestas: {
    '200': OK('Sesión iniciada — devuelve el usuario y Set-Cookie', { type: 'object', properties: { ok: { type: 'boolean' }, usuario: { $ref: '#/components/schemas/Usuario' } } }),
    '401': OK('Credenciales incorrectas (mensaje genérico anti-enumeración)'),
    '403': OK('Cuenta sin verificar (requiereVerificacion: true) o debe cambiar contraseña'),
  },
});
P['/api/auth/logout'] = ep('post', { tags: ['Auth'], resumen: 'Cerrar sesión (destruye la cookie)', respuestas: { '200': OK('Sesión cerrada') } });
P['/api/auth/perfil'] = ep('get', { tags: ['Auth'], resumen: 'Perfil del usuario en sesión', sesion: true, respuestas: { '200': OK('Perfil', { type: 'object', properties: { usuario: { $ref: '#/components/schemas/Usuario' } } }), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/auth/perfil'] = Object.assign(P['/api/auth/perfil'], {
  put: {
    tags: ['Auth'],
    summary: 'Actualizar datos del perfil (nombre, usuario, teléfono, foto_url)',
    description: 'Valida formato y duplicados de usuario/correo; acepta solo los campos presentes en el body.',
    security: [{ cookieAuth: [] }],
    requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { nombre: { type: 'string' }, apellido: { type: 'string' }, usuario: { type: 'string', description: '3-20 caracteres [a-zA-Z0-9._-]' }, telefono: { type: 'string', description: '7-10 dígitos' }, foto_url: { type: 'string', nullable: true, description: 'URL de Cloudinary o /images/... (allowlist)' } } } } } },
    responses: { '200': OK('Perfil actualizado'), '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/NoAuth' } },
  },
});
P['/api/auth/foto'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Subir foto de perfil (base64 ≤ 10 MB)',
  sesion: true,
  body: { schema: { type: 'object', required: ['foto'], properties: { foto: { type: 'string', description: 'Data URI data:image/...;base64,...' } } }, example: { foto: 'data:image/png;base64,iVBORw0KGgo...' } },
  respuestas: { '200': OK('URL de la foto en Cloudinary', { type: 'object', properties: { foto_url: { type: 'string' } } }), '400': OK('Archivo o formato inválido'), '401': { $ref: '#/components/responses/NoAuth' } },
});
P['/api/auth/recuperar-password'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Solicitar código de recuperación de contraseña',
  body: { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }, example: { email: 'juan@example.com' } },
  respuestas: { '200': OK('Si el correo existe se envió un código (respuesta genérica anti-enumeración)') },
});
P['/api/auth/verificar-codigo'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Validar el código de recuperación',
  body: { schema: { type: 'object', required: ['email', 'codigo'], properties: { email: { type: 'string' }, codigo: { type: 'string' } } }, example: { email: 'juan@example.com', codigo: '654321' } },
  respuestas: { '200': OK('Código válido'), '400': OK('Código inválido o vencido') },
});
P['/api/auth/update-password'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Actualizar la contraseña con el código validado',
  body: { schema: { type: 'object', required: ['email', 'codigo', 'password'], properties: { email: { type: 'string' }, codigo: { type: 'string' }, password: { type: 'string', format: 'password' } } }, example: { email: 'juan@example.com', codigo: '654321', password: 'NuevaClave123' } },
  respuestas: { '200': OK('Contraseña actualizada'), '400': { $ref: '#/components/responses/BadRequest' } },
});
P['/api/auth/cambiar-password'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Cambiar contraseña (con sesión)',
  sesion: true,
  body: { schema: { type: 'object', required: ['passwordActual', 'passwordNueva'], properties: { passwordActual: { type: 'string', format: 'password' }, passwordNueva: { type: 'string', format: 'password' } } }, example: { passwordActual: 'MiClave123', passwordNueva: 'NuevaClave123' } },
  respuestas: { '200': OK('Contraseña cambiada'), '400': OK('Contraseña actual incorrecta'), '401': { $ref: '#/components/responses/NoAuth' } },
});
P['/api/auth/cambiar-email'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Iniciar cambio de correo (verifica contraseña y envía OTP al correo nuevo)',
  sesion: true,
  body: { schema: { type: 'object', required: ['emailNuevo', 'password'], properties: { emailNuevo: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password' } } }, example: { emailNuevo: 'nuevo@example.com', password: 'MiClave123' } },
  respuestas: { '200': OK('Código enviado al correo nuevo'), '400': OK('Contraseña incorrecta'), '409': OK('Correo ya en uso') },
});
P['/api/auth/confirmar-cambio-email'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Confirmar cambio de correo con el código OTP',
  sesion: true,
  body: { schema: { type: 'object', required: ['emailNuevo', 'codigo'], properties: { emailNuevo: { type: 'string', format: 'email' }, codigo: { type: 'string' } } }, example: { emailNuevo: 'nuevo@example.com', codigo: '123456' } },
  respuestas: { '200': OK('Correo actualizado'), '400': OK('Código inválido o vencido') },
});
P['/api/auth/google'] = ep('get', { tags: ['Auth'], resumen: 'Iniciar OAuth de Google (redirige a Google)', respuestas: { '302': OK('Redirect al consentimiento de Google') } });
P['/api/auth/google/callback'] = ep('get', { tags: ['Auth'], resumen: 'Callback OAuth de Google (crea sesión y redirige al SPA)', respuestas: { '302': OK('Redirect al frontend con sesión creada'), '403': OK('State inválido o correo no verificado') } });
P['/api/auth/social-login'] = ep('post', {
  tags: ['Auth'],
  resumen: 'Login social para la app móvil (token de Google)',
  body: { schema: { type: 'object', required: ['idToken'], properties: { idToken: { type: 'string', description: 'Token de identidad de Google Sign-In móvil' } } }, example: { idToken: 'eyJhbGciOiJSUzI1NiIs...' } },
  respuestas: { '200': OK('Sesión creada + cookie', { type: 'object', properties: { usuario: { $ref: '#/components/schemas/Usuario' } } }), '401': OK('Token inválido') },
});

// ---- Productos -------------------------------------------------------------
P['/api/productos'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Catálogo público (ordenado por popularidad)',
  query: [{ name: 'search', desc: 'Búsqueda por prefijo de nombre/marca/categoría' }, { name: 'cat', desc: 'Id de categoría' }],
  respuestas: {
    '200': OK('Lista de productos con rating y stock', {
      type: 'array',
      items: { $ref: '#/components/schemas/Producto' },
    }),
  },
});
P['/api/productos/{id}'] = ep('get', { tags: ['Productos'], resumen: 'Detalle de producto', params: ['id'], respuestas: { '200': OK('Producto + imágenes + vendedor', { $ref: '#/components/schemas/Producto' }), '404': { $ref: '#/components/responses/NotFound' } } });
P['/api/productos/{id}/variantes'] = ep('get', { tags: ['Productos'], resumen: 'Variantes del producto (color/talla/peso...)', params: ['id'], respuestas: { '200': OK('Lista de variantes con stock', { type: 'array', items: { $ref: '#/components/schemas/Variante' } }) } });
P['/api/productos/{id}/resenas'] = ep('get', { tags: ['Productos'], resumen: 'Reseñas del producto', params: ['id'], respuestas: { '200': OK('Reseñas con autor y calificación 1..5', { type: 'array', items: { type: 'object', properties: { CALIFICACION: { type: 'integer' }, COMENTARIO: { type: 'string' }, AUTOR: { type: 'string' }, FECHA_RESENA: { type: 'string', format: 'date-time' } } } }) } });
P['/api/productos/{id}/resenas'] = Object.assign(P['/api/productos/{id}/resenas'], {
  post: {
    tags: ['Productos'],
    summary: 'Crear reseña (requiere sesión)',
    security: [{ cookieAuth: [] }],
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
    requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['calificacion'], properties: { calificacion: { type: 'integer', minimum: 1, maximum: 5 }, comentario: { type: 'string' } } }, example: { calificacion: 5, comentario: 'Excelente calidad' } } } },
    responses: { '201': OK('Reseña creada'), '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/NoAuth' }, '429': OK('Demasiadas reseñas (10/15 min)') },
  },
});
P['/api/productos/{id}/relacionados'] = ep('get', { tags: ['Productos'], resumen: 'Productos relacionados (misma categoría)', params: ['id'], respuestas: { '200': OK('Lista de productos', { type: 'array', items: { $ref: '#/components/schemas/Producto' } }) } });
P['/api/productos/{id}/caracteristicas'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Ficha técnica del producto',
  params: ['id'],
  respuestas: {
    '200': OK('Características', {
      type: 'array',
      items: { type: 'object', properties: { NOMBRE: { type: 'string' }, VALOR: { type: 'string' } } },
    }),
  },
});
P['/api/productos/categorias'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Categorías con conteo de productos',
  respuestas: {
    '200': OK('Categorías', {
      type: 'array',
      items: { type: 'object', properties: { ID_CATEGORIA: { type: 'integer' }, NOMBRE_CATEGORIA: { type: 'string' }, DESCRIPCION: { type: 'string' }, TOTAL_PRODUCTOS: { type: 'integer' } } },
    }),
  },
});
P['/api/productos/descuentos'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Descuentos vigentes (página de ofertas)',
  respuestas: {
    '200': OK('Descuentos activos con productos', {
      type: 'array',
      items: { type: 'object', properties: { ID_DESCUENTO: { type: 'integer' }, PORCENTAJE: { type: 'integer' }, FECHA_FIN: { type: 'string', format: 'date' }, productos: { type: 'array', items: { $ref: '#/components/schemas/Producto' } } } },
    }),
  },
});
P['/api/productos/recomendados'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Recomendados por señales (comprado×3, favorito×2, visto×1)',
  sesion: true,
  query: [{ name: 'limite', schema: { type: 'integer', default: 8 } }],
  respuestas: {
    '200': OK('Recomendaciones con origen', {
      type: 'object',
      properties: {
        origen: { type: 'string', enum: ['senales', 'populares'] },
        productos: { type: 'array', items: { $ref: '#/components/schemas/Producto' } },
      },
    }),
    '401': { $ref: '#/components/responses/NoAuth' },
  },
});
P['/api/productos/vendedores'] = ep('get', {
  tags: ['Productos'],
  resumen: 'Vendedores públicos del marketplace',
  respuestas: {
    '200': OK('Vendedores', {
      type: 'array',
      items: { type: 'object', properties: { ID_VENDEDOR: { type: 'integer' }, NOMBRE_EMPRESA: { type: 'string' }, CATEGORIAS: { type: 'string' } } },
    }),
  },
});
P['/api/productos/variantes/{idVariante}/suscribir'] = {
  post: { tags: ['Productos'], summary: 'Suscribirse al aviso de reposición de una variante agotada', security: [{ cookieAuth: [] }], parameters: [{ name: 'idVariante', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '201': OK('Aviso creado — te notificamos al volver stock'), '400': OK('Ya tienes un aviso o la variante tiene stock'), '401': { $ref: '#/components/responses/NoAuth' } } },
  delete: { tags: ['Productos'], summary: 'Cancelar el aviso de reposición', security: [{ cookieAuth: [] }], parameters: [{ name: 'idVariante', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Aviso cancelado'), '401': { $ref: '#/components/responses/NoAuth' } } },
};
P['/api/productos/imagenes'] = ep('post', { tags: ['Productos'], resumen: 'Subir imágenes de producto (base64 ≤ 25 MB, admin/vendedor)', admin: true, body: { schema: { type: 'object', required: ['imagenes'], properties: { imagenes: { type: 'array', items: { type: 'string', description: 'Data URIs' } }, idProducto: { type: 'integer', nullable: true } } }, example: { imagenes: ['data:image/png;base64,...'] } }, respuestas: { '201': OK('URLs subidas (Cloudinary o /images/...)'), '401': { $ref: '#/components/responses/NoAuth' }, '403': { $ref: '#/components/responses/NoPermiso' } } });

// CRUD admin/vendedor de productos (resumen compacto)
P['/api/productos'].post = { tags: ['Admin'], summary: 'Crear producto (admin)', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre', 'precio'], properties: { nombre: { type: 'string' }, marca: { type: 'string' }, precio: { type: 'number' }, idCategoria: { type: 'integer' }, descripcion: { type: 'string' }, imagenes: { type: 'array', items: { type: 'string' } }, variantes: { type: 'array', items: { type: 'object', properties: { color: { type: 'string' }, nombreAtributo: { type: 'string' }, atributo: { type: 'string' }, stock: { type: 'integer' } } } } } } } } }, responses: { '201': OK('Producto creado (JADDA, visible sin aprobación)'), '401': { $ref: '#/components/responses/NoAuth' }, '403': { $ref: '#/components/responses/NoPermiso' } } };
P['/api/productos/{id}'].put = { tags: ['Admin'], summary: 'Editar producto (admin)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Producto actualizado'), '401': { $ref: '#/components/responses/NoAuth' }, '403': { $ref: '#/components/responses/NoPermiso' }, '404': { $ref: '#/components/responses/NotFound' } } };
P['/api/productos/{id}'].delete = { tags: ['Admin'], summary: 'Eliminar producto (admin)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Producto eliminado'), '400': OK('El producto pertenece a un vendedor o tiene ventas'), '403': { $ref: '#/components/responses/NoPermiso' } } };
P['/api/productos/categorias'].post = { tags: ['Admin'], summary: 'Crear categoría (admin)', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre'], properties: { nombre: { type: 'string', description: '3-100 caracteres' }, descripcion: { type: 'string' } } }, example: { nombre: 'Natación', descripcion: 'Gafas, trajes y accesorios de natación' } } } }, responses: { '201': OK('Categoría creada'), '400': OK('Nombre duplicado o inválido'), '403': { $ref: '#/components/responses/NoPermiso' } } };
P['/api/productos/categorias/{id}'] = { put: { tags: ['Admin'], summary: 'Renombrar categoría (admin)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { nombre: { type: 'string' }, descripcion: { type: 'string' } } } } } }, responses: { '200': OK('Categoría actualizada'), '404': { $ref: '#/components/responses/NotFound' } } }, delete: { tags: ['Admin'], summary: 'Eliminar categoría (admin; bloqueada si tiene productos)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Categoría eliminada'), '400': OK('Tiene productos asignados') } } };

// ---- Carrito ---------------------------------------------------------------
P['/api/carrito'] = ep('get', { tags: ['Carrito'], resumen: 'Carrito del cliente', sesion: true, respuestas: { '200': OK('Items del carrito', { $ref: '#/components/schemas/Carrito' }), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/carrito/agregar'] = ep('post', {
  tags: ['Carrito'],
  resumen: 'Agregar producto al carrito',
  sesion: true,
  body: { schema: { type: 'object', required: ['id_producto'], properties: { id_producto: { type: 'integer' }, id_variante: { type: 'integer', nullable: true }, cantidad: { type: 'integer', default: 1 } } }, example: { id_producto: 1, id_variante: 189531, cantidad: 2 } },
  respuestas: { '201': OK('Agregado'), '400': OK('Stock insuficiente o datos inválidos'), '401': { $ref: '#/components/responses/NoAuth' }, '403': OK('Los vendedores no pueden comprar') },
});
P['/api/carrito/actualizar/{id_carrito}'] = ep('put', { tags: ['Carrito'], resumen: 'Cambiar cantidad de un item', sesion: true, params: ['id_carrito'], body: { schema: { type: 'object', required: ['cantidad'], properties: { cantidad: { type: 'integer' } } }, example: { cantidad: 3 } }, respuestas: { '200': OK('Cantidad actualizada'), '400': OK('Stock insuficiente'), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/carrito/eliminar/{id_carrito}'] = ep('delete', { tags: ['Carrito'], resumen: 'Eliminar item del carrito', sesion: true, params: ['id_carrito'], respuestas: { '200': OK('Item eliminado'), '401': { $ref: '#/components/responses/NoAuth' } } });

// ---- Cupones y checkout ----------------------------------------------------
P['/api/cupones/validar'] = ep('post', {
  tags: ['Cupones'],
  resumen: 'Validar un cupón (búsqueda exacta)',
  body: { schema: { type: 'object', required: ['codigo'], properties: { codigo: { type: 'string' }, subtotal: { type: 'number', description: 'Subtotal del carrito para verificar compra mínima' } } }, example: { codigo: 'JADDA10', subtotal: 450000 } },
  respuestas: { '200': OK('Cupón válido con porcentaje y mínimo', { type: 'object', properties: { descuento: { type: 'object', properties: { porcentaje: { type: 'integer' }, monto_minimo: { type: 'integer', nullable: true }, fecha_fin: { type: 'string' } } } } }), '400': OK('Cupón requiere compra mínima'), '404': OK('Cupón no existe o vencido'), '401': OK('Los cupones RETO- son personales: inicia sesión') },
});
P['/api/cupones/disponibles'] = ep('get', { tags: ['Cupones'], resumen: 'Cupones para el checkout (tienda + personales)', sesion: true, respuestas: { '200': OK('Tienda y personales', { type: 'object', properties: { tienda: { type: 'array', items: { type: 'object' } }, personales: { type: 'array', items: { type: 'object' } } } }), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/checkout/procesar'] = ep('post', {
  tags: ['Checkout'],
  resumen: 'Procesar la compra (transacción: venta + detalle + cupón + envío)',
  description:
    'El servidor recalcula el total desde la BD (nunca confía en el cliente), valida stock por variante con `SELECT ... FOR UPDATE`, aplica el cupón y calcula el envío. Con pasarela Wompi activa y `metodoPago: "wompi"` la venta nace `PENDIENTE_PAGO` con ventana de expiración; con tarjeta (credito/debito) nace `COMPLETADA`. Los vendedores no pueden comprar.',
  sesion: true,
  body: {
    schema: {
      type: 'object',
      required: ['metodoPago'],
      properties: {
        metodoPago: { type: 'string', enum: ['credito', 'debito', 'wompi'] },
        paymentData: { type: 'object', nullable: true, description: 'Datos del método de tarjeta (titular/últimos dígitos tokenizados; el CVV nunca se guarda)' },
        cuponCodigo: { type: 'string', nullable: true },
        nombre: { type: 'string' },
        correo: { type: 'string', format: 'email' },
        telefono: { type: 'string' },
        direccion: { type: 'string' },
        barrio: { type: 'string' },
        ciudad: { type: 'string' },
        departamento: { type: 'string' },
        codigoPostal: { type: 'string' },
        observaciones: { type: 'string' },
      },
    },
    example: { metodoPago: 'credito', cuponCodigo: null, nombre: 'Juan Pérez', correo: 'juan@example.com', telefono: '3001234567', direccion: 'Cra 1 #2-3', barrio: 'Centro', ciudad: 'Bogotá', departamento: 'Cundinamarca', codigoPostal: '110111', observaciones: '' },
  },
  respuestas: {
    '200': OK('Venta creada', { type: 'object', properties: { ok: { type: 'boolean' }, idVenta: { type: 'integer' }, urlCheckout: { type: 'string', nullable: true, description: 'URL del checkout de Wompi si el método es wompi' } } }),
    '400': OK('Stock insuficiente / cupón inválido / bajo mínimo'),
    '401': { $ref: '#/components/responses/NoAuth' },
    '403': OK('Vendedor o contraseña temporal'),
    '409': OK('Concurrencia de stock (otro cliente compró la última unidad)'),
  },
});

// ---- Pagos (Wompi) ---------------------------------------------------------
P['/api/pagos/config'] = ep('get', { tags: ['Pagos'], resumen: 'Configuración de la pasarela (gateway activo, modo pruebas)', respuestas: { '200': OK('Config', { type: 'object', properties: { gateway: { type: 'string', nullable: true, example: 'wompi' }, pruebas: { type: 'boolean' } } }) } });
P['/api/pagos/pagar'] = ep('post', {
  tags: ['Pagos'],
  resumen: 'Crear sesión de pago Wompi para una venta PENDIENTE_PAGO',
  sesion: true,
  body: { schema: { type: 'object', required: ['idVenta'], properties: { idVenta: { type: 'integer' } } }, example: { idVenta: 42 } },
  respuestas: { '200': OK('URL del checkout de Wompi (firma de integridad incluida)', { type: 'object', properties: { urlCheckout: { type: 'string' } } }), '400': OK('La venta ya está pagada o expiró'), '401': { $ref: '#/components/responses/NoAuth' } },
});
P['/api/pagos/estado/{idVenta}'] = ep('get', { tags: ['Pagos'], resumen: 'Pull del estado de pago (transacción Wompi + expiración)', sesion: true, params: ['idVenta'], respuestas: { '200': OK('Estado de la venta y transacción', { type: 'object', properties: { estado: { type: 'string', enum: ['PENDIENTE_PAGO', 'CONFIRMADA', 'CANCELADA'] }, transaccion: { type: 'object', nullable: true, properties: { status: { type: 'string', enum: ['APPROVED', 'PENDING', 'DECLINED', 'VOIDED', 'ERROR'] }, mensaje: { type: 'string', nullable: true } } } } }), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/pagos/webhook'] = ep('post', { tags: ['Pagos'], resumen: 'Webhook de eventos Wompi (server-to-server, firma checksum)', description: 'Valida el checksum con el secreto de eventos (timing-safe), re-consulta la transacción a la API de Wompi y confirma la venta. Los eventos con firma inválida se registran y responden 403.', respuestas: { '200': OK('Evento procesado (idempotente)'), '400': OK('Payload sin evento'), '403': OK('Firma inválida') } });

// ---- Compras ---------------------------------------------------------------
P['/api/compras'] = ep('get', { tags: ['Compras'], resumen: 'Compras del cliente (con estados y devoluciones activas)', sesion: true, respuestas: { '200': OK('Lista de ventas', { type: 'array', items: { $ref: '#/components/schemas/Venta' } }), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/compras/{id}'] = ep('get', { tags: ['Compras'], resumen: 'Detalle de la compra', sesion: true, params: ['id'], respuestas: { '200': OK('Venta con productos, envío y pago', { $ref: '#/components/schemas/Venta' }), '404': OK('No es tuya o no existe') } });
P['/api/compras/{id}/factura'] = ep('get', { tags: ['Compras'], resumen: 'Factura PDF de la compra', sesion: true, params: ['id'], respuestas: { '200': OK('application/pdf adjuntado (attachment)'), '404': { $ref: '#/components/responses/NotFound' } } });
P['/api/compras/{id}/cancelar'] = ep('post', {
  tags: ['Compras'],
  resumen: 'Cancelar el pedido (restaura stock; reembolso automático si el pago estaba confirmado y el envío no salió)',
  sesion: true,
  params: ['id'],
  respuestas: { '200': OK('Cancelada (incluye desglose del reembolso automático si aplica)', { type: 'object', properties: { reembolso: { type: 'object', nullable: true, properties: { automatico: { type: 'boolean' }, total: { type: 'number' }, costoEnvio: { type: 'number' } } } } }), '400': OK('El pedido ya salió del almacén o ya está cancelada') },
});
P['/api/compras/{id}/reembolso'] = ep('post', { tags: ['Compras'], resumen: 'Solicitar reembolso de una venta cancelada', sesion: true, params: ['id'], respuestas: { '200': OK('Reembolso solicitado (revisa en 7 días)'), '400': OK('Ya solicitaste un reembolso') } });
P['/api/compras/{id}/reembolso'] = Object.assign(P['/api/compras/{id}/reembolso'], { get: { tags: ['Compras'], summary: 'Ver el estado del reembolso', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Estado del reembolso'), '404': OK('Sin reembolso') } } });
P['/api/compras/{id}/direccion'] = ep('put', { tags: ['Compras'], resumen: 'Editar la dirección de envío (bloqueada si el pedido salió)', sesion: true, params: ['id'], body: { schema: { type: 'object', required: ['direccion'], properties: { direccion: { type: 'string' }, barrio: { type: 'string' }, ciudad: { type: 'string' }, departamento: { type: 'string' }, codigoPostal: { type: 'string' }, telefonoContacto: { type: 'string' }, observaciones: { type: 'string' } } }, example: { direccion: 'Cra 5 #10-20', ciudad: 'Bogotá', departamento: 'Cundinamarca' } }, respuestas: { '200': OK('Dirección actualizada'), '400': OK('El pedido ya salió del almacén o está cancelado') } });

// ---- Devoluciones ----------------------------------------------------------
P['/api/devoluciones'] = {
  post: { tags: ['Devoluciones'], summary: 'Solicitar devolución/reembolso de una venta ENTREGADA (plazo de 3 días)', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idVenta', 'tipo', 'motivo'], properties: { idVenta: { type: 'integer' }, tipo: { type: 'string', enum: ['REEMBOLSO', 'DEVOLUCION'] }, motivo: { type: 'string', description: '≤ 500 chars. REEMBOLSO solo con motivo defectuoso/no coincide; cambio de opinión = DEVOLUCION' }, descripcion: { type: 'string' }, productos: { type: 'array', items: { type: 'object', properties: { idProducto: { type: 'integer' }, cantidad: { type: 'integer' } } } } } }, example: { idVenta: 42, tipo: 'DEVOLUCION', motivo: 'No me quedó la talla', productos: [{ idProducto: 1, cantidad: 1 }] } } } }, responses: { '201': OK('Solicitud creada (chat con el vendedor si aplica)'), '400': OK('Fuera de plazo / en tránsito / motivo no permitido') } },
  get: { tags: ['Devoluciones'], summary: 'Mis solicitudes de devolución/reembolso', security: [{ cookieAuth: [] }], responses: { '200': OK('Lista con estado y evidencias') } },
};
P['/api/devoluciones/{id}/evidencias'] = ep('post', { tags: ['Devoluciones'], resumen: 'Adjuntar evidencias (multipart: fotos/videos ≤ 25 MB ×5) — vuelve a SOLICITADA y notifica', sesion: true, params: ['id'], respuestas: { '200': OK('Evidencias agregadas') } });
P['/api/devoluciones/evidencias/{idEvidencia}'] = ep('delete', { tags: ['Devoluciones'], resumen: 'Eliminar una evidencia pendiente', sesion: true, params: ['idEvidencia'], respuestas: { '200': OK('Eliminada'), '404': OK('Ajena o no existe') } });
P['/api/devoluciones/admin'] = ep('get', { tags: ['Admin'], resumen: 'Todas las devoluciones/reembolsos (admin)', admin: true, respuestas: { '200': OK('Con cliente, producto, método de pago y envío'), '403': { $ref: '#/components/responses/NoPermiso' } } });
P['/api/devoluciones/admin/{id}/procesar'] = ep('post', {
  tags: ['Admin'],
  resumen: 'Decidir una devolución (admin): devolver | reembolsar | mas_pruebas | rechazar',
  admin: true,
  params: ['id'],
  body: { schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['devolver', 'reembolsar', 'mas_pruebas', 'rechazar'] }, observacion: { type: 'string', nullable: true, description: 'Obligatoria para mas_pruebas y rechazar' } } }, example: { decision: 'reembolsar', observacion: '' } },
  respuestas: { '200': OK('Procesada (reingreso de stock en devolver; chat cerrado)'), '400': OK('Falta observación o ya procesada'), '403': OK('Producto de vendedor no escalado a JADDA') },
});

// ---- Retos -----------------------------------------------------------------
P['/api/retos'] = ep('get', { tags: ['Retos'], resumen: 'Retos disponibles + mis inscripciones', sesion: true, respuestas: { '200': OK('Retos con recompensa % y cupos (máx. 3 activos)'), '401': { $ref: '#/components/responses/NoAuth' } } });
P['/api/retos/unirse/{idReto}'] = ep('post', { tags: ['Retos'], resumen: 'Unirse a un reto (máx. 3 activos por usuario)', sesion: true, params: ['idReto'], respuestas: { '200': OK('Inscrito'), '400': OK('Límite de 3 retos a la vez o reto inactivo') } });
P['/api/retos/mis-retos'] = ep('get', { tags: ['Retos'], resumen: 'Mis retos con progreso, avances de hoy y cupón generado', sesion: true, respuestas: { '200': OK('Inscripciones con meta/progreso/cupón') } });
P['/api/retos/progreso/{idRetoUsuario}'] = {
  post: { tags: ['Retos'], summary: 'Reportar avance (multipart con evidencias ≤ 25 MB ×5, o sin material)', security: [{ cookieAuth: [] }], parameters: [{ name: 'idRetoUsuario', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { cantidad: { type: 'integer', description: 'Km/reps acumulables (se ajusta al restante)' } } } } } }, responses: { '200': OK('Avance registrado o en revisión ≤24h'), '400': OK('Ya reportaste hoy (retos por días/sesiones) o excede el restante') } },
  get: { tags: ['Retos'], summary: 'Ver mis avances enviados de una inscripción', security: [{ cookieAuth: [] }], parameters: [{ name: 'idRetoUsuario', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Evidencias con estado y observación del equipo') } },
};
P['/api/retos/evidencias/{idEvidencia}'] = ep('delete', { tags: ['Retos'], resumen: 'Eliminar avance pendiente propio (con sus archivos)', sesion: true, params: ['idEvidencia'], respuestas: { '200': OK('Eliminado'), '400': OK('Solo pendientes en revisión') } });
P['/api/retos/admin/evidencias'] = ep('get', { tags: ['Admin'], resumen: 'Evidencias de retos por revisar (admin)', admin: true, respuestas: { '200': OK('Con descripción del reto y usuario') } });
P['/api/retos/admin/evidencias/{id}/aprobar'] = ep('post', { tags: ['Admin'], resumen: 'Aprobar avance (suma progreso; genera cupón RETO- al completar meta)', admin: true, params: ['id'], body: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { observacion: { type: 'string', nullable: true } } } } } }, respuestas: { '200': OK('Aprobado (material conservado; el usuario ve el comentario)'), '400': OK('Doble cupón imposible') } });
P['/api/retos/admin/evidencias/{id}/rechazar'] = ep('post', { tags: ['Admin'], resumen: 'Rechazar avance con motivo opcional (el usuario puede reenviar el mismo día)', admin: true, params: ['id'], body: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { observacion: { type: 'string', nullable: true, description: '≤ 500 chars' } } } } } }, respuestas: { '200': OK('Rechazado con motivo visible para el usuario') } });

// ---- Planes ----------------------------------------------------------------
P['/api/planes'] = ep('get', { tags: ['Planes'], resumen: 'Mis planes de entrenamiento generados por compras', sesion: true, respuestas: { '200': OK('Planes con días completados') } });
P['/api/planes/generar/{idVenta}'] = ep('post', { tags: ['Planes'], resumen: 'Generar plan para una compra (si la categoría lo permite)', sesion: true, params: ['idVenta'], respuestas: { '200': OK('Plan generado (o ya existente)') } });
P['/api/planes/marcar-dia/{idPlan}'] = ep('post', { tags: ['Planes'], resumen: 'Marcar el día como completado', sesion: true, params: ['idPlan'], respuestas: { '200': OK('Día marcado (persistido en BD)') } });

// ---- Chat ------------------------------------------------------------------
P['/api/chat/iniciar'] = ep('post', { tags: ['Chat'], resumen: 'Iniciar chat (SOPORTE con JADDA, o VENDEDOR por producto; idempotente)', sesion: true, body: { schema: { type: 'object', properties: { tipo: { type: 'string', enum: ['SOPORTE', 'VENDEDOR'] }, idProducto: { type: 'integer', nullable: true, description: 'Para chats con el vendedor de un producto' }, mensaje: { type: 'string', nullable: true, description: 'Mensaje inicial (se filtran groserías)' } } }, example: { tipo: 'SOPORTE', mensaje: 'Hola, tengo una duda con mi pedido' } }, respuestas: { '200': OK('Chat existente o nuevo'), '400': OK('El admin no abre tickets de soporte / datos inválidos') } });
P['/api/chat/conversaciones'] = ep('get', { tags: ['Chat'], resumen: 'Conversaciones del rol (admin: todas; vendedor: las suyas; cliente: las suyas, sin DEVOLUCION)', sesion: true, respuestas: { '200': OK('Lista con último mensaje y no-leídos', { type: 'array', items: { $ref: '#/components/schemas/ChatResumen' } }) } });
P['/api/chat/no-leidos'] = ep('get', { tags: ['Chat'], resumen: 'Contador de chats sin leer (para el punto rojo del navbar)', sesion: true, respuestas: { '200': OK('{ noLeidos: N }') } });
P['/api/chat/{id}/mensajes'] = {
  get: { tags: ['Chat'], summary: 'Mensajes del chat (marca los del otro bando como leídos)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Mensajes con ROL_AUTOR (CLIENTE/VENDEDOR/ADMIN/SISTEMA)'), '403': OK('Sin acceso a este hilo (aislado por PARTE tras escalación)') } },
  post: { tags: ['Chat'], summary: 'Enviar mensaje (≤ 2000 chars, filtro de groserías, notifica a la contraparte)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mensaje'], properties: { mensaje: { type: 'string' } } }, example: { mensaje: '¿Cuándo llega mi pedido?' } } } }, responses: { '201': OK('Mensaje enviado'), '400': OK('Chat cerrado o mensaje vacío') } },
};
P['/api/chat/{id}/escalar'] = ep('post', { tags: ['Chat'], resumen: 'Escalar una disputa a JADDA (cierra el hilo de acuerdo y crea 2 hilos privados)', sesion: true, params: ['id'], respuestas: { '200': OK('Escalada (notif a admins y a cada parte)'), '400': OK('Solo chats de DEVOLUCION activas') } });

// ---- Direcciones / métodos de pago / favoritos / historial / notificaciones
P['/api/direcciones'] = {
  get: { tags: ['Direcciones'], summary: 'Mis direcciones de envío', security: [{ cookieAuth: [] }], responses: { '200': OK('Direcciones con principal marcada') } },
  post: { tags: ['Direcciones'], summary: 'Crear dirección', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['direccion', 'ciudad', 'departamento'], properties: { direccion: { type: 'string' }, barrio: { type: 'string' }, ciudad: { type: 'string' }, departamento: { type: 'string' }, codigoPostal: { type: 'string' }, telefonoContacto: { type: 'string' }, etiqueta: { type: 'string' }, esPrincipal: { type: 'integer' } } }, example: { direccion: 'Cra 1 #2-3', ciudad: 'Bogotá', departamento: 'Cundinamarca', esPrincipal: 1 } } } }, responses: { '201': OK('Dirección creada') } },
};
P['/api/direcciones/{id}'] = {
  put: { tags: ['Direcciones'], summary: 'Actualizar dirección', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Actualizada') } },
  delete: { tags: ['Direcciones'], summary: 'Eliminar dirección', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Eliminada') } },
};
P['/api/usuarios/metodos-pago'] = {
  get: { tags: ['Métodos de pago'], summary: 'Mis métodos de pago guardados', security: [{ cookieAuth: [] }], responses: { '200': OK('Métodos con principal') } },
  post: { tags: ['Métodos de pago'], summary: 'Guardar método de pago (débito/crédito; sin CVV)', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['idMetodo'], properties: { idMetodo: { type: 'integer', description: '2 débito · 3 crédito' }, titular: { type: 'string' }, ultimos4: { type: 'string' }, vencimiento: { type: 'string' } } }, example: { idMetodo: 3, titular: 'Juan Pérez', ultimos4: '4242' } } } }, responses: { '201': OK('Guardado (principal si es el primero)'), '400': OK('Método inválido') } },
};
P['/api/usuarios/metodos-pago/{id}'] = {
  delete: { tags: ['Métodos de pago'], summary: 'Eliminar método guardado', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Eliminado') } },
  put: { tags: ['Métodos de pago'], summary: 'Marcar como principal', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Principal actualizado') } },
};
P['/api/favoritos'] = {
  get: { tags: ['Favoritos'], summary: 'Mis favoritos', security: [{ cookieAuth: [] }], responses: { '200': OK('Productos favoritos') } },
  post: { tags: ['Favoritos'], summary: 'Agregar favorito', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_producto'], properties: { id_producto: { type: 'integer' } } }, example: { id_producto: 1 } } } }, responses: { '201': OK('Agregado'), '200': OK('Ya estaba') } },
};
P['/api/favoritos/{id}'] = ep('delete', { tags: ['Favoritos'], resumen: 'Eliminar favorito', sesion: true, params: ['id'], respuestas: { '200': OK('Eliminado') } });
P['/api/historial'] = {
  get: { tags: ['Historial'], summary: 'Productos recientemente vistos', security: [{ cookieAuth: [] }], responses: { '200': OK('Historial con stock/descuento') } },
  post: { tags: ['Historial'], summary: 'Registrar visita a un producto', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['id_producto'], properties: { id_producto: { type: 'integer' } } }, example: { id_producto: 1 } } } }, responses: { '201': OK('Registrado (idempotente por producto)') } },
  delete: { tags: ['Historial'], summary: 'Vaciar mi historial', security: [{ cookieAuth: [] }], responses: { '200': OK('Historial vacío') } },
};
P['/api/notificaciones'] = ep('get', { tags: ['Notificaciones'], resumen: 'Mis notificaciones (las globales + las propias)', sesion: true, query: [{ name: 'leidas', desc: '1 para ver solo leídas' }], respuestas: { '200': OK('Notificaciones', { type: 'array', items: { $ref: '#/components/schemas/Notificacion' } }) } });
P['/api/notificaciones/no-leidas'] = ep('get', { tags: ['Notificaciones'], resumen: 'Contador de no leídas (polling del timbre)', sesion: true, respuestas: { '200': OK('{ noLeidas: N }') } });
P['/api/notificaciones/{id}/leida'] = ep('post', { tags: ['Notificaciones'], resumen: 'Marcar una como leída', sesion: true, params: ['id'], respuestas: { '200': OK('Marcada (el contador baja)') } });
P['/api/notificaciones/leer-todas'] = ep('post', { tags: ['Notificaciones'], resumen: 'Marcar todas como leídas', sesion: true, respuestas: { '200': OK('Todas leídas') } });
P['/api/notificaciones/{id}'] = ep('delete', { tags: ['Notificaciones'], resumen: 'Eliminar notificación propia', sesion: true, params: ['id'], respuestas: { '200': OK('Eliminada') } });

// ---- Newsletter / contacto / soporte / envío / proveedores -----------------
P['/api/newsletter'] = ep('post', { tags: ['Newsletter'], resumen: 'Suscribirse a la newsletter (envía correo de bienvenida)', body: { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } }, example: { email: 'juan@example.com' } }, respuestas: { '201': OK('Suscrito'), '200': OK('Ya estabas suscrito') } });
P['/api/newsletter/desuscribir'] = {
  get: { tags: ['Newsletter'], summary: 'Página de confirmación de desuscripción (link del correo)', parameters: [{ name: 'email', in: 'query', required: true, schema: { type: 'string' } }], responses: { '200': OK('HTML de confirmación') } },
  post: { tags: ['Newsletter'], summary: 'Desuscribirse', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string' } } }, example: { email: 'juan@example.com' } } } }, responses: { '200': OK('Desuscrito') } },
};
P['/api/newsletter/suscritos'] = ep('get', { tags: ['Admin'], resumen: 'Suscritos y estado de envíos (admin)', admin: true, respuestas: { '200': OK('Lista + último envío') } });
P['/api/newsletter/enviar'] = ep('post', { tags: ['Admin'], resumen: 'Disparar el envío de la newsletter ahora (admin)', admin: true, respuestas: { '200': OK('Envío iniciado (errores SMTP no bloquean)') } });
P['/api/contacto'] = ep('post', { tags: ['Contacto'], resumen: 'Mensaje del formulario de contacto', body: { schema: { type: 'object', required: ['nombre', 'email', 'mensaje'], properties: { nombre: { type: 'string' }, email: { type: 'string', format: 'email' }, asunto: { type: 'string' }, mensaje: { type: 'string' } } }, example: { nombre: 'Juan', email: 'juan@example.com', asunto: 'Duda', mensaje: '¿Envían a Villavicencio?' } }, respuestas: { '201': OK('Mensaje recibido'), '429': OK('Límite 5/15 min') } });
P['/api/pqr'] = ep('post', { tags: ['Contacto'], resumen: 'Radicar una PQR (petición/queja/reclamo)', body: { schema: { type: 'object', required: ['nombre', 'email', 'tipo', 'descripcion'], properties: { nombre: { type: 'string' }, email: { type: 'string', format: 'email' }, tipo: { type: 'string', enum: ['Peticion', 'Queja', 'Reclamo'] }, descripcion: { type: 'string' } } }, example: { nombre: 'Juan', email: 'juan@example.com', tipo: 'Reclamo', descripcion: 'Mi pedido llegó incompleto' } }, respuestas: { '201': OK('PQR radicada') } });
P['/api/envio/tarifas'] = ep('get', { tags: ['Envío'], resumen: 'Tarifas de envío por departamento', respuestas: { '200': OK('Mapa departamento → costo') } });
P['/api/envio/calcular'] = ep('get', { tags: ['Envío'], resumen: 'Calcular envío (gratis ≥ $800.000)', query: [{ name: 'departamento', desc: 'Nombre del departamento' }, { name: 'subtotal', desc: 'Subtotal de la compra' }], respuestas: { '200': OK('Costo', { type: 'object', properties: { costo: { type: 'number', example: 9000 } } }) } });
P['/api/proveedores'] = ep('get', { tags: ['Otros'], resumen: 'Proveedores registrados', respuestas: { '200': OK('Lista de proveedores') } });

// ---- Vendedor --------------------------------------------------------------
P['/api/vendedor/solicitud'] = {
  post: { tags: ['Vendedor'], summary: 'Enviar solicitud para ser vendedor (empresa y NIT opcionales: vendedor informal)', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['representante', 'emailEmpresa', 'telefono', 'departamento', 'ciudad', 'direccion'], properties: { empresa: { type: 'string', nullable: true }, nit: { type: 'string', nullable: true }, representante: { type: 'string' }, emailEmpresa: { type: 'string', format: 'email' }, telefono: { type: 'string' }, departamento: { type: 'string' }, ciudad: { type: 'string' }, direccion: { type: 'string' }, categorias: { type: 'string' }, descripcion: { type: 'string' } } }, example: { empresa: 'Deportes del Llano', representante: 'Ana Gómez', emailEmpresa: 'ana@deportes.com', telefono: '3121234567', departamento: 'Meta', ciudad: 'Villavicencio', direccion: 'Cra 33 #38-25', categorias: 'Fútbol' } } } }, responses: { '201': OK('Solicitud enviada (revisión ≤ 48h)'), '400': OK('Ya tienes una solicitud en revisión'), '409': OK('NIT o correo de empresa ya registrados') } },
  get: { tags: ['Vendedor'], summary: 'Mi solicitud y estado', security: [{ cookieAuth: [] }], responses: { '200': OK('Estado de la solicitud + credenciales si aprobada') } },
};
P['/api/vendedor/mi-tienda'] = ep('get', { tags: ['Vendedor'], resumen: 'KPIs de mi tienda (productos, ventas, ingresos, stock bajo)', vendedor: true, respuestas: { '200': OK('Stats + últimas ventas + stock bajo'), '403': { $ref: '#/components/responses/NoPermiso' } } });
P['/api/vendedor/productos'] = {
  get: { tags: ['Vendedor'], summary: 'Mis productos (con estado de publicación)', security: [{ cookieAuth: [] }], responses: { '200': OK('Pendientes/aprobados/rechazados') } },
  post: { tags: ['Vendedor'], summary: 'Publicar producto (queda PENDIENTE de aprobación de JADDA)', security: [{ cookieAuth: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['nombre', 'precio'], properties: { nombre: { type: 'string' }, marca: { type: 'string' }, precio: { type: 'number' }, idCategoria: { type: 'integer' }, descripcion: { type: 'string' }, imagenes: { type: 'array', items: { type: 'string' } }, variantes: { type: 'array', items: { type: 'object' } } } } } } }, responses: { '201': OK('Creado PENDIENTE') } },
};
P['/api/vendedor/productos/{id}'] = {
  get: { tags: ['Vendedor'], summary: 'Detalle de mi producto', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Producto con imágenes/variantes/características'), '403': OK('No es tuyo') } },
  put: { tags: ['Vendedor'], summary: 'Editar producto (vuelve a PENDIENTE para re-aprobación)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Actualizado y re-enviado a revisión') } },
  delete: { tags: ['Vendedor'], summary: 'Eliminar producto propio (no APROBADO)', security: [{ cookieAuth: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': OK('Eliminado'), '400': OK('Un producto aprobado no se puede eliminar') } },
};
P['/api/vendedor/ventas'] = ep('get', { tags: ['Vendedor'], resumen: 'Ventas que incluyen mis productos', vendedor: true, respuestas: { '200': OK('Ventas con ítems propios y cliente') } });
P['/api/vendedor/ventas/{id}/envio'] = ep('put', { tags: ['Vendedor'], resumen: 'Actualizar el estado de envío de una venta propia', vendedor: true, params: ['id'], body: { schema: { type: 'object', required: ['estadoEnvio'], properties: { estadoEnvio: { type: 'string', enum: ['PENDIENTE', 'POR_EMPAQUETAR', 'EMPACADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'] } } }, example: { estadoEnvio: 'EN_CAMINO' } }, respuestas: { '200': OK('Estado actualizado (notifica al cliente; sinCambios si repetido)'), '403': OK('La venta no incluye productos tuyos') } });
P['/api/vendedor/ventas/{id}/estado'] = ep('put', { tags: ['Vendedor'], resumen: 'Cambiar el estado de la venta (con guardas de PENDIENTE_PAGO y CANCELADA)', vendedor: true, params: ['id'], body: { schema: { type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['PENDIENTE', 'PENDIENTE_PAGO', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA'] } } }, example: { estado: 'COMPLETADA' } }, respuestas: { '200': OK('Actualizado'), '400': OK('Transición inválida (no revivir canceladas ni confirmar sin pago)') } });
P['/api/vendedor/reportes'] = ep('get', { tags: ['Vendedor'], resumen: 'Reportes de mis ventas (ingresos, serie diaria, top productos)', vendedor: true, query: [{ name: 'desde' }, { name: 'hasta' }], respuestas: { '200': OK('KPIs + serie + top') } });
P['/api/vendedor/reportes/excel'] = ep('get', { tags: ['Vendedor'], resumen: 'Descargar reporte Excel con fórmulas', vendedor: true, query: [{ name: 'desde' }, { name: 'hasta' }], respuestas: { '200': OK('.xlsx adjuntado') } });
P['/api/vendedor/reportes/pdf'] = ep('get', { tags: ['Vendedor'], resumen: 'Descargar reporte PDF ejecutivo', vendedor: true, query: [{ name: 'desde' }, { name: 'hasta' }], respuestas: { '200': OK('.pdf adjuntado') } });
P['/api/vendedor/devoluciones'] = ep('get', { tags: ['Vendedor'], resumen: 'Devoluciones de mis productos', vendedor: true, respuestas: { '200': OK('Solicitudes con evidencias y chat') } });
P['/api/vendedor/devoluciones/{id}/procesar'] = ep('post', { tags: ['Vendedor'], resumen: 'Decidir devolución propia: devolver | reembolsar | mas_pruebas | rechazar', vendedor: true, params: ['id'], body: { schema: { type: 'object', required: ['decision'], properties: { decision: { type: 'string', enum: ['devolver', 'reembolsar', 'mas_pruebas', 'rechazar'] }, observacion: { type: 'string' } } }, example: { decision: 'devolver' } }, respuestas: { '200': OK('Procesada (reingreso de stock en devolver)'), '400': OK('Observación obligatoria al rechazar / ya procesada') } });
P['/api/vendedor/empresa'] = ep('put', { tags: ['Vendedor'], resumen: 'Actualizar datos de mi empresa (NIT y correo bloqueados)', vendedor: true, body: { schema: { type: 'object', properties: { telefono: { type: 'string' }, departamento: { type: 'string' }, ciudad: { type: 'string' }, direccion: { type: 'string' } } }, example: { telefono: '3121234567', ciudad: 'Villavicencio' } }, respuestas: { '200': OK('Empresa actualizada') } });
P['/api/vendedor/admin'] = ep('get', { tags: ['Admin'], resumen: 'Solicitudes de vendedores (admin)', admin: true, respuestas: { '200': OK('Con datos del solicitante') } });
P['/api/vendedor/admin/{id}/procesar'] = ep('post', { tags: ['Admin'], resumen: 'Aprobar (crea cuenta de vendedor con contraseña temporal) o rechazar (motivo obligatorio por correo)', admin: true, params: ['id'], body: { schema: { type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['APROBADA', 'RECHAZADA'] }, observacion: { type: 'string' } } }, example: { estado: 'APROBADA' } }, respuestas: { '200': OK('Procesada (credenciales por correo al aprobar)'), '400': OK('Ya procesada / falta motivo') } });

// ---- Admin -----------------------------------------------------------------
P['/api/admin/dashboard'] = ep('get', { tags: ['Admin'], resumen: 'Dashboard: KPIs, hoy vs ayer, serie diaria, top 5 y pendientes', admin: true, respuestas: { '200': OK('Resumen completo del panel'), '403': { $ref: '#/components/responses/NoPermiso' } } });
P['/api/admin/pendientes'] = ep('get', { tags: ['Admin'], resumen: 'Contadores de pendientes (evidencias, devoluciones, productos, vendedores)', admin: true, respuestas: { '200': OK('Badges de la sidebar') } });
P['/api/admin/compras'] = ep('get', { tags: ['Admin'], resumen: 'Todas las compras (ES_DE_VENDEDOR marca ventas con productos de vendedores)', admin: true, respuestas: { '200': OK('Ventas con detalle, envío y método'), '403': { $ref: '#/components/responses/NoPermiso' } } });
P['/api/admin/compras/{id}/estado'] = ep('put', { tags: ['Admin'], resumen: 'Cambiar estado de la venta (bloqueado en ventas de vendedores)', admin: true, params: ['id'], body: { schema: { type: 'object', required: ['estado'], properties: { estado: { type: 'string', enum: ['PENDIENTE', 'CONFIRMADA', 'COMPLETADA', 'CANCELADA'] } } }, example: { estado: 'COMPLETADA' } }, respuestas: { '200': OK('Estado cambiado (notifica al cliente)'), '403': OK('La venta incluye productos de un vendedor: la gestiona él') } });
P['/api/admin/compras/{id}/envio'] = ep('put', { tags: ['Admin'], resumen: 'Cambiar estado de envío (stepper del panel)', admin: true, params: ['id'], body: { schema: { type: 'object', required: ['estadoEnvio'], properties: { estadoEnvio: { type: 'string', enum: ['PENDIENTE', 'POR_EMPAQUETAR', 'EMPACADO', 'EN_CAMINO', 'ENTREGADO', 'CANCELADO'] } } }, example: { estadoEnvio: 'ENTREGADO' } }, respuestas: { '200': OK('Envío actualizado (FECHA_ENTREGA en ENTREGADO; cancelación pagada reembolsa)'), '403': OK('Venta de vendedor') } });
P['/api/admin/compras/{id}/factura'] = ep('get', { tags: ['Admin'], resumen: 'Factura PDF de una venta (admin)', admin: true, params: ['id'], respuestas: { '200': OK('application/pdf'), '404': OK('No existe') } });
P['/api/admin/compras/{id}'] = ep('delete', { tags: ['Admin'], resumen: 'Eliminar registro de compra CANCELADA (transacción)', admin: true, params: ['id'], respuestas: { '200': OK('Eliminada'), '400': OK('Solo se eliminan ventas CANCELADAS') } });
P['/api/admin/usuarios'] = ep('get', { tags: ['Admin'], resumen: 'Usuarios registrados', admin: true, respuestas: { '200': OK('Lista de usuarios con rol y fecha') } });
P['/api/admin/usuarios/{id}'] = ep('get', { tags: ['Admin'], resumen: 'Detalle del usuario: perfil, direcciones, métodos, compras, retos y tienda si es vendedor', admin: true, params: ['id'], respuestas: { '200': OK('Ficha completa'), '404': OK('No existe') } });
P['/api/admin/productos'] = ep('get', { tags: ['Admin'], resumen: 'Todos los productos (incluye pendientes/rechazados de vendedores)', admin: true, query: [{ name: 'estado', desc: 'Filtro por estado de publicación' }, { name: 'stockBajo', desc: '1 para filtrar stock ≤ 10' }], respuestas: { '200': OK('Con vendedor y estado') } });
P['/api/admin/productos/{id}/aprobar'] = ep('post', { tags: ['Admin'], resumen: 'Aprobar producto de vendedor (visible en tienda)', admin: true, params: ['id'], respuestas: { '200': OK('Aprobado (notifica al vendedor)'), '400': OK('Sin cambios') } });
P['/api/admin/productos/{id}/rechazar'] = ep('post', { tags: ['Admin'], resumen: 'Rechazar producto de vendedor (observación obligatoria)', admin: true, params: ['id'], body: { schema: { type: 'object', required: ['observacion'], properties: { observacion: { type: 'string' } } }, example: { observacion: 'Las fotos no corresponden al producto' } }, respuestas: { '200': OK('Rechazado con observación enviada al vendedor') } });
P['/api/admin/reportes/ventas'] = ep('get', { tags: ['Admin'], resumen: 'Reporte de ventas por rango (excluye canceladas)', admin: true, query: [{ name: 'desde', desc: 'YYYY-MM-DD (default: 30 días)' }, { name: 'hasta' }], respuestas: { '200': OK('KPIs + serie diaria', { type: 'object', properties: { totalOrdenes: { type: 'integer' }, totalIngresos: { type: 'number' }, ticketPromedio: { type: 'number' }, serie: { type: 'array', items: { type: 'object' } } } }) } });
P['/api/admin/reportes/excel'] = ep('get', { tags: ['Admin'], resumen: 'Descargar reporte Excel (5 hojas con fórmulas)', admin: true, query: [{ name: 'desde' }, { name: 'hasta' }], respuestas: { '200': OK('.xlsx adjuntado') } });
P['/api/admin/reportes/pdf'] = ep('get', { tags: ['Admin'], resumen: 'Descargar reporte PDF ejecutivo con gráficas', admin: true, query: [{ name: 'desde' }, { name: 'hasta' }], respuestas: { '200': OK('.pdf adjuntado') } });
P['/api/admin/analytics/mas-vendidos'] = ep('get', { tags: ['Admin'], resumen: 'Ranking de productos más vendidos por rango', admin: true, query: [{ name: 'desde' }, { name: 'hasta' }, { name: 'limite', schema: { type: 'integer', default: 10 } }], respuestas: { '200': OK('Top con unidades, ingresos y stock') } });

module.exports = spec;
