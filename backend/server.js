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

// Auto-creación de tablas + datos de referencia al arrancar
require('./database/setup');

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

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------------------------------------------------------------
// 🛠️ LOGGER DE PETICIONES — Muestra timestamp en consola para cada POST/PUT
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

// CORS: solo permite el frontend en Vite (puerto 5173).
// Con `credentials: true` habilita cookies de sesión跨 dominio.
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}));

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

/*
 * Almacén de sesiones en MySQL (express-mysql-session).
 * Se usa MySQL en vez de memoria para que las sesiones sobrevivan
 * reinicios del contenedor y sean compartidas si hay múltiples réplicas.
 * Las sesiones expiradas se limpian cada 15 min; caducan a las 24 h.
 */
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'database',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'tu_password_secreto',
  database: process.env.DB_NAME || 'jadda_sports_db',
  clearExpired: true,
  checkExpirationInterval: 900000,
  expiration: 86400000,
  connectTimeout: 5000,
});

// Middleware de sesión — inyecta req.session y lo persiste en MySQL
app.use(session({
    secret: process.env.SESSION_SECRET || "jadda_secret_key",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { secure: false }  // false porque se usa HTTP local, no HTTPS
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
// 🚨 5. MANEJO DE ERRORES GLOBAL (Ultra detallado)
// -------------------------------------------------------------------------
app.use((err, req, res, next) => {
    const hora = new Date().toLocaleTimeString();
    console.error(`\n=================================================================`);
    console.error(`❌ [${hora}] ERROR NO CONTROLADO EN EL SERVIDOR`);
    console.error(`📌 Ruta afectada: ${req.method} ${req.originalUrl}`);
    console.error(`💥 Detalles del fallo:`, err.message || err);
    console.error(`🗂️ Stack Trace:`, err.stack);
    console.error(`=================================================================\n`);
    
    res.status(500).json({ 
        error: "Error interno del servidor",
        mensaje: "Base de datos no disponible o error en la petición. Revisa la consola del backend." 
    });
});

// -------------------------------------------------------------------------
// 🚀 6. LANZAMIENTO INTELIGENTE
// Usa reinicio.tmp como flag para distinguir primer arranque Docker vs
// reinicio por cambio de archivos (nodemon). En el primer arranque
// muestra el banner completo; en reinicios solo una línea corta.
// -------------------------------------------------------------------------
const fs = require('fs');
const pathRastreo = path.join(__dirname, 'reinicio.tmp');

app.listen(PORT, () => {
    const esPrimerArranque = !fs.existsSync(pathRastreo);

    if (esPrimerArranque) {
        console.log(`\n=================================================================`);
        console.log(` 🔥 JADDA SPORTS - BACKEND ENCENDIDO 🔥 `);
        console.log(`=================================================================`);
        console.log(` 🚀 Servidor corriendo`);
        console.log(` 🔗 Modo Local:     http://localhost:${PORT}`);
        console.log(` 📁 Directorio:     ${__dirname}`);
        console.log(` 🛡️  CORS:           Permitiendo acceso a puerto 5173`);
        console.log(`=================================================================\n`);

        // Crea el flag para que los próximos reinicios (nodemon) no repitan el banner
        try { fs.writeFileSync(pathRastreo, 'iniciado'); } catch (e) {}
    } else {
        // Línea única cada vez que Ctrl+S guarda cambios (nodemon reinicia)
        const hora = new Date().toLocaleTimeString();
        console.log(`\n🔄 [${hora}] ¡Backend actualizado con éxito y listo para la acción! ⚡\n`);
    }
});

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