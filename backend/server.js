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

// Auto-creaciÃ³n de tablas + datos de referencia al arrancar
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
const vendedorRoutes = require('./routes/vendedorRoutes');
const newsletterController = require('./controllers/newsletterController');

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------------------------------------------------------------
// ðŸ› ï¸ LOGGER DE PETICIONES â€” Muestra timestamp en consola para cada POST/PUT
// El bloque vacÃ­o queda como placeholder para futuro log detallado.
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

// CORS: permite el frontend en Vite (5173) y la app mÃ³vil en modo web de Expo (8081).
// Con `credentials: true` habilita cookies de sesiÃ³nè·¨ dominio.
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

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

/*
 * AlmacÃ©n de sesiones en MySQL (express-mysql-session).
 * Se usa MySQL en vez de memoria para que las sesiones sobrevivan
 * reinicios del contenedor y sean compartidas si hay mÃºltiples rÃ©plicas.
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

// Middleware de sesiÃ³n â€” inyecta req.session y lo persiste en MySQL
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
 * Previene cachÃ© del navegador en rutas protegidas.
 * Sin esto, el botÃ³n "AtrÃ¡s" podrÃ­a mostrar datos de sesiÃ³n antiguos.
 */
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// -------------------
// 3. ARCHIVOS ESTÃTICOS
// -------------------
app.use(express.static(path.join(__dirname, "public")));

// Fotos de perfil: se sirven desde el backend para que SIEMPRE estÃ©n al dÃ­a
// (Docker Desktop no propaga carpetas/archivos nuevos al contenedor de Vite
// al instante â†’ la foto se veÃ­a "daÃ±ada" hasta reiniciar el frontend).
app.use(
  "/images/perfiles",
  express.static(path.join(__dirname, "uploads", "perfiles"))
);

// Archivos por usuario (uploads/usuarios/{USUARIO}/perfil|retos/...):
// sirve SIEMPRE al dÃ­a, sin depender de la sincronÃ­a del mount de Vite.
app.use(
  "/images/usuarios",
  express.static(path.join(__dirname, "uploads", "usuarios"))
);

// Evidencias de devoluciones (uploads/devoluciones/): sirve SIEMPRE al dÃ­a,
// igual que perfiles/usuarios (Docker Desktop no propaga archivos nuevos a Vite).
app.use(
  "/images/devoluciones",
  express.static(path.join(__dirname, "uploads", "devoluciones"))
);

// ImÃ¡genes de productos (uploads/ = mount de frontend/public/images/productos):
// sirve SIEMPRE al dÃ­a â€” las subidas del panel no siempre llegan a Vite al instante.
app.use(
  "/images/productos",
  express.static(path.join(__dirname, "uploads"))
);

// -------------------
// 4. RUTAS (API) â€” 15 mÃ³dulos montados bajo /api
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
 * Expone el GOOGLE_CLIENT_ID al frontend para que el botÃ³n
 * "Iniciar sesiÃ³n con Google" pueda inicializar el SDK sin
 * hardcodear el ID en el cÃ³digo del cliente.
 */
app.get('/api/auth/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Ruta para servir el HTML principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "principal.html"));
});

// -------------------------------------------------------------------------
// ðŸš¨ 5. MANEJO DE ERRORES GLOBAL (Ultra detallado)
// -------------------------------------------------------------------------
app.use((err, req, res, next) => {
    const hora = new Date().toLocaleTimeString();
    console.error(`\n=================================================================`);
    console.error(`âŒ [${hora}] ERROR NO CONTROLADO EN EL SERVIDOR`);
    console.error(`ðŸ“Œ Ruta afectada: ${req.method} ${req.originalUrl}`);
    console.error(`ðŸ’¥ Detalles del fallo:`, err.message || err);
    console.error(`ðŸ—‚ï¸ Stack Trace:`, err.stack);
    console.error(`=================================================================\n`);
    
    res.status(500).json({ 
        error: "Error interno del servidor",
        mensaje: "Base de datos no disponible o error en la peticiÃ³n. Revisa la consola del backend." 
    });
});

// -------------------------------------------------------------------------
// ðŸš€ 6. LANZAMIENTO INTELIGENTE
// Usa reinicio.tmp como flag para distinguir primer arranque Docker vs
// reinicio por cambio de archivos (nodemon). En el primer arranque
// muestra el banner completo; en reinicios solo una lÃ­nea corta.
// -------------------------------------------------------------------------
const fs = require('fs');
const pathRastreo = path.join(__dirname, 'reinicio.tmp');

app.listen(PORT, () => {
    const esPrimerArranque = !fs.existsSync(pathRastreo);

    if (esPrimerArranque) {
        console.log(`\n=================================================================`);
        console.log(` ðŸ”¥ JADDA SPORTS - BACKEND ENCENDIDO ðŸ”¥ `);
        console.log(`=================================================================`);
        console.log(` ðŸš€ Servidor corriendo`);
        console.log(` ðŸ”— Modo Local:     http://localhost:${PORT}`);
        console.log(` ðŸ“ Directorio:     ${__dirname}`);
        console.log(` ðŸ›¡ï¸  CORS:           Permitiendo acceso a puerto 5173`);
        console.log(`=================================================================\n`);

        // Crea el flag para que los prÃ³ximos reinicios (nodemon) no repitan el banner
        try { fs.writeFileSync(pathRastreo, 'iniciado'); } catch (e) {}
    } else {
        // LÃ­nea Ãºnica cada vez que Ctrl+S guarda cambios (nodemon reinicia)
        const hora = new Date().toLocaleTimeString();
        console.log(`\nðŸ”„ [${hora}] Â¡Backend actualizado con Ã©xito y listo para la acciÃ³n! âš¡\n`);
    }

    // ðŸ“§ ENVÃO PERIÃ“DICO DE NEWSLETTER
    // Dispara el envÃ­o "de vez en cuando" (intervalo configurable, por defecto
    // cada 72 h) con ofertas reales + mensajes aleatorios. El primer envÃ­o no
    // es inmediato: espera un intervalo completo. Configurable con
    // NEWSLETTER_INTERVAL_HORAS en backend/.env
    try {
        const horas = Math.max(1, Number(process.env.NEWSLETTER_INTERVAL_HORAS) || 72);
        const ms = horas * 3600 * 1000;
        setInterval(() => {
            newsletterController
                .enviarNewsletterAhora()
                .then((r) => {
                    if (r.enviados > 0) {
                        console.log(`ðŸ“§ Newsletter automÃ¡tica completada: ${r.enviados}/${r.suscritos}`);
                    }
                })
                .catch((err) => console.error('âŒ Newsletter automÃ¡tica (programada):', err.message));
        }, ms);
        console.log(`ðŸ“§ Newsletter automÃ¡tica programada: cada ${horas} hora(s) (NEWSLETTER_INTERVAL_HORAS)`);
    } catch (e) {
        console.error('No se pudo programar la newsletter:', e.message);
    }
});

// Al detener Docker, borra el flag para que el prÃ³ximo "docker compose up"
// vuelva a mostrar el banner completo (y setup.js sepa que es primer arranque).
process.on('SIGINT', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});
process.on('SIGTERM', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});
