/*
 * Servidor principal de Jadda Sports (Backend)
 * Express + Passport.js con sesiones persistentes en MySQL.
 * Al iniciar, ejecuta setup.js para crear tablas y sembrar datos de referencia.
 */

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const passport = require('passport');
const path = require('path');
require('dotenv').config();

// Auto-creación de tablas + datos de referencia — se hace await en boot()
const setupDatabase = require('./database/setup');
const db = require('./config/db');
const { verificarSesion } = require('./middlewares/authMiddleware');

require('./config/passport'); // Carga la estrategia de Google
const proveedoresRoutes = require('./routes/proveedores');

const authRoutes = require('./routes/authRoutes');
const productoRoutes = require('./routes/productoRoutes');
const carritoRoutes = require('./routes/carritoRoutes');
const direccionRoutes = require('./routes/direccionRoutes');
const favoritosRoutes = require('./routes/favoritosRoutes');
const historialRoutes = require('./routes/historialRoutes');
const comprasRoutes = require('./routes/comprasRoutes');
const cuponesRoutes = require('./routes/cuponesRoutes');
const checkoutRoutes = require('./routes/checkoutRoutes');
const pqrRoutes = require('./routes/pqrRoutes');
const retoRoutes = require('./routes/retoRoutes');
const planRoutes = require('./routes/planRoutes');
const adminRoutes = require('./routes/adminRoutes');
const metodoPagoRoutes = require('./routes/metodoPagoRoutes');
const contactoRoutes = require('./routes/contactoRoutes');
const envioRoutes = require('./routes/envioRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const notificacionRoutes = require('./routes/notificacionRoutes');
const devolucionRoutes = require('./routes/devolucionRoutes');
const vendedorRoutes = require('./routes/vendedorRoutes');
const newsletterController = require('./controllers/newsletterController');

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------------------------------------------------------------
// LOGGER DE PETICIONES — Muestra timestamp en consola para cada POST/PUT
// El bloque vacío queda como placeholder para futuro log detallado.
// -------------------------------------------------------------------------
app.use((req, res, next) => {
    const hora = new Date().toLocaleTimeString();
    if (req.method === 'POST' || req.method === 'PUT') {
    }
    next();
});

// -------------------
// 2. MIDDLEWARES GLOBALES
// -------------------

// CORS: permite el frontend en Vite (5173) y la app móvil en modo web de Expo (8081).
// Con `credentials: true` habilita cookies de sesión跨 dominio.
app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.1.7:8081"
    ],
    credentials: true
}));

// Límites de tamaño de petición — global conservador, se amplía en rutas específicas
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

function crearSessionStore() {
  const store = new MySQLStore({
    host: process.env.DB_HOST || 'database',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'tu_password_secreto',
    database: process.env.DB_NAME || 'jadda_sports_db',
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    connectTimeout: 5000,
  });
  store.on('error', (err) => {
    console.error('⚠️  Session store error:', err.code || '', err.message);
  });
  return store;
}
const sessionStore = crearSessionStore();

// Middleware de sesión — inyecta req.session y lo persiste en MySQL
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET;
if (isProduction && !sessionSecret) {
  console.error('❌ Server: En producción se requiere SESSION_SECRET en variables de entorno');
  throw new Error('SESSION_SECRET requerido en producción');
}

app.use(session({
    secret: sessionSecret || "jadda_secret_key_dev_only",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { 
      secure: isProduction,  // true en producción (requiere HTTPS), false en desarrollo
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 horas
    }
}));

app.use(passport.initialize());
app.use(passport.session());

/*
 * Previene caché del navegador en rutas protegidas.
 * Sin esto, el botón "Atrás" podría mostrar datos de sesión antiguos.
 */
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// -------------------
// 3. ARCHIVOS ESTÁTICOS
// -------------------
app.use(express.static(path.join(__dirname, "public")));

// Fotos de perfil: se sirven desde el backend para que SIEMPRE están al día
// (Docker Desktop no propaga carpetas/archivos nuevos al contenedor de Vite
// al instante — la foto se veía "dañada" hasta reiniciar el frontend).
// Público (fotos de perfil visibles en perfiles, chat, reseñas).
app.use(
  "/images/perfiles",
  express.static(path.join(__dirname, "uploads", "perfiles"))
)

/*
 * Servido PRIVADO de archivos de usuario con VERIFICACIÓN DE PROPIEDAD.
 * (El express.static anterior solo pedía sesión: cualquiera autenticado con
 * la URL podía abrir evidencias ajenas.)
 *
 * Reglas por recurso:
 * - /images/usuarios/{clave}/perfil/**   → cualquier usuario autenticado
 *   (el avatar se ve en reseñas, chats y navbar de otros usuarios; la carpeta
 *   pública /images/perfiles sigue abierta).
 * - /images/usuarios/{clave}/retos/**    → SOLO el dueño (clave = USUARIO) o admin.
 * - /images/devoluciones/**              → dueño de la devolución, vendedor de
 *   un producto de esa venta, o admin (consulta DEVOLUCIONES_EVIDENCIAS por el
 *   nombre base del archivo; funciona con rutas locales y URLs Cloudinary).
 */
function servirArchivoPrivado(carpetaBase, tipo) {
  return [verificarSesion, async (req, res) => {
    try {
      const fsPriv = require('fs');
      const relPath = decodeURIComponent(req.path || "");
      if (relPath.includes('..') || !/^\/[^\0]/.test(relPath)) return res.status(400).send('Ruta inválida');

      const baseAbs = path.resolve(__dirname, 'uploads', carpetaBase);
      const abs = path.resolve(baseAbs, '.' + relPath);
      if (!abs.startsWith(baseAbs + path.sep)) return res.status(404).send('No encontrado');

      // AUTORIZACIÓN PRIMERO: un no-dueño recibe 403 (no revelamos si el
      // archivo existe con 404).
      const esAdmin = Number(req.user && req.user.ID_ROL) === 1;
      const claveCarpeta = (relPath.split('/')[1] || '').toLowerCase();
      const claveUsuario = String((req.user && req.user.USUARIO) || '').toLowerCase();
      let autorizado = false;

      if (tipo === 'usuarios') {
        const esPerfil = /^\/[^/]+\/perfil\//.test(relPath);
        autorizado = esAdmin || esPerfil || claveCarpeta === claveUsuario;
      } else if (tipo === 'devoluciones') {
        const nombreArchivo = path.basename(abs);
        const [filas] = await db.query(
          `SELECT d.ID_USUARIO AS ID_SOLICITANTE, v.ID_USUARIO AS ID_USUARIO_VENDEDOR
           FROM DEVOLUCIONES_EVIDENCIAS de
           JOIN DEVOLUCIONES d ON d.ID_DEVOLUCION = de.ID_DEVOLUCION
           LEFT JOIN VENTAS ve ON ve.ID_VENTA = d.ID_VENTA
           LEFT JOIN DETALLE_VENTAS dv ON dv.ID_VENTA = ve.ID_VENTA
           LEFT JOIN PRODUCTOS p ON p.ID = dv.ID_PRODUCTO
           LEFT JOIN VENDEDORES v ON v.ID_VENDEDOR = p.ID_VENDEDOR
           WHERE de.RUTA LIKE CONCAT('%/', ?)
           LIMIT 50`,
          [nombreArchivo]
        );
        for (const fila of filas) {
          if (fila.ID_SOLICITANTE === (req.user && req.user.ID_USUARIO)) autorizado = true;
          if (fila.ID_USUARIO_VENDEDOR === (req.user && req.user.ID_USUARIO)) autorizado = true;
        }
        // El propio usuario dueño de la carpeta también pasa aunque la fila de
        // BD no se resuelva (defensivo; los uploads suyos viven en su clave).
        if (!autorizado && claveCarpeta === claveUsuario) autorizado = true;
      } else {
        autorizado = esAdmin;
      }
      if (esAdmin) autorizado = true;
      if (!autorizado) return res.status(403).send('Prohibido');

      // Solo tras estar autorizado se revela la existencia del archivo
      if (!fsPriv.existsSync(abs) || fsPriv.statSync(abs).isDirectory()) return res.status(404).send('No encontrado');

      res.sendFile(abs);
    } catch (err) {
      console.error(' ⚠️ Error sirviendo archivo privado:', err.message);
      return res.status(500).send('Error interno');
    }
  }];
}

app.use("/images/usuarios", ...servirArchivoPrivado('usuarios', 'usuarios'));
app.use("/images/devoluciones", ...servirArchivoPrivado('devoluciones', 'devoluciones'));

// Imágenes de productos (uploads/ = mount de frontend/public/images/productos):
// sirve SIEMPRE al día — las subidas del panel no siempre llegan a Vite al instante.
// Público.
app.use(
  "/images/productos",
  express.static(path.join(__dirname, "uploads"))
);

// -------------------
// 4. RUTAS (API) — 15 módulos montados bajo /api
// -------------------

app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/direcciones', direccionRoutes);
app.use('/api/favoritos', favoritosRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/compras', comprasRoutes);
app.use('/api/cupones', cuponesRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/pqr', pqrRoutes);
app.use('/api/retos', retoRoutes);
app.use('/api/planes', planRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/usuarios/metodos-pago', metodoPagoRoutes);
app.use('/api/contacto', contactoRoutes);
app.use('/api/envio', envioRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/devoluciones', devolucionRoutes);
app.use('/api/vendedor', vendedorRoutes);
app.use('/api/chat', require('./routes/chatRoutes'));

/*
 * Expone el GOOGLE_CLIENT_ID al frontend para que el botón
 * "Iniciar sesión con Google" pueda inicializar el SDK sin
 * hardcodear el ID en el código del cliente.
 */
app.get('/api/auth/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Ruta para servir el HTML principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "principal.html"));
});

// -------------------------------------------------------------------------
// 5. MANEJO DE ERRORES GLOBAL (Ultra detallado)
// -------------------------------------------------------------------------
app.use((err, req, res, next) => {
    const hora = new Date().toLocaleTimeString();
    console.error(`\n=================================================================`);
    console.error(`[${hora}] ERROR NO CONTROLADO EN EL SERVIDOR`);
    console.error(`Ruta afectada: ${req.method} ${req.originalUrl}`);
    console.error(`Detalles del fallo:`, err.message || err);
    console.error(`Stack Trace:`, err.stack);
    console.error(`=================================================================\n`);
    
    res.status(500).json({ 
        error: "Error interno del servidor",
        mensaje: "Base de datos no disponible o error en la petición. Revisa la consola del backend." 
    });
});

// -------------------------------------------------------------------------
// 6. LANZAMIENTO INTELIGENTE — espera a MySQL antes de escuchar
// Usa reinicio.tmp como flag para distinguir primer arranque Docker vs
// reinicio por cambio de archivos (nodemon).
// -------------------------------------------------------------------------
const fs = require('fs');
const pathRastreo = path.join(__dirname, 'reinicio.tmp');

async function iniciarServidor() {
  const esPrimerArranque = !fs.existsSync(pathRastreo);
  console.log(`⏳ JADDA backend: esperando MySQL (DB_HOST=${process.env.DB_HOST||'database'})...`);
  // 1) Setup: crea tablas + seed + demo (30 reintentos, fail-fast en auth)
  try {
    await setupDatabase();
    console.log('✅ JADDA: Setup de BD OK');
  } catch (err) {
    if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('❌ Credenciales MySQL inválidas — corrige docker-compose.yml / .env y haz docker compose restart');
      process.exit(1);
    }
    console.error('⚠️  Setup falló pero se continúa para reintentar pool:', err.message);
  }
  // 2) Pool: verifica que el pool conecta (30 reintentos)
  try {
    if (typeof db.verificarConexion === 'function') {
      await db.verificarConexion(30, 3000);
    } else {
      // fallback si db es pool directo
      const pool = db;
      for (let i=0;i<5;i++){ try{ await pool.query('SELECT 1'); break; }catch{ await new Promise(r=>setTimeout(r,2000)); }}
    }
    console.log('✅ JADDA: Pool MySQL conectado');
  } catch (err) {
    console.error('❌ Pool no conecta tras reintentos:', err.message);
    // no salir, el pool seguirá reintentando en cada query
  }

  app.listen(PORT, () => {
    if (esPrimerArranque) {
        console.log(`\n=================================================================`);
        console.log(` 🏀 JADDA SPORTS - BACKEND ENCENDIDO 🏀 `);
        console.log(`=================================================================`);
        console.log(` 🚀 Servidor corriendo`);
        console.log(` 🌐 Modo Local:     http://localhost:${PORT}`);
        console.log(` 📁 Directorio:     ${__dirname}`);
        console.log(` 🛡️  CORS:           Permitiendo acceso a puerto 5173`);
        console.log(`=================================================================\n`);
        try { fs.writeFileSync(pathRastreo, 'iniciado'); } catch (e) {}
    } else {
        const hora = new Date().toLocaleTimeString();
        console.log(`\n🔄 [${hora}] ¡Backend actualizado con éxito y listo para la acción! ⚡\n`);
    }
    try {
        const horas = Math.max(1, Number(process.env.NEWSLETTER_INTERVAL_HORAS) || 72);
        const ms = horas * 3600 * 1000;
        setInterval(() => {
            newsletterController
                .enviarNewsletterAhora()
                .then((r) => {
                    if (r.enviados > 0) {
                        console.log(`📧 Newsletter automática completada: ${r.enviados}/${r.suscritos}`);
                    }
                })
                .catch((err) => console.error('📧 Newsletter automática (programada):', err.message));
        }, ms);
        console.log(`📧 Newsletter automática programada: cada ${horas} hora(s) (NEWSLETTER_INTERVAL_HORAS)`);
    } catch (e) {
        console.error('No se pudo programar la newsletter:', e.message);
    }
  });
}

iniciarServidor();

// Al detener Docker, borra el flag para que el próximo "docker compose up"
// vuelva a mostrar el banner completo (y setup.js sepa que es primer arranque).
process.on('SIGINT', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});
process.on('SIGTERM', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});
