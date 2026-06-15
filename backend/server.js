const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();


require('./config/passport'); // Carga la estrategia de Google
const proveedoresRoutes = require('./routes/proveedores');

const authRoutes = require('./routes/authRoutes');
const productoRoutes = require('./routes/productoRoutes');
const carritoRoutes = require('./routes/carritoRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// -------------------------------------------------------------------------
// 🛠️ LOGGER DE PETICIONES (Muestra en consola cada clic o acción del front)
// -------------------------------------------------------------------------
app.use((req, res, next) => {
    const hora = new Date().toLocaleTimeString();
    if (req.method === 'POST' || req.method === 'PUT') {
        console.log(`   📦 Datos recibidos:`, JSON.stringify(req.body, null, 2));
    }
    next();
});

// -------------------
// 2. MIDDLEWARES GLOBALES
// -------------------
app.use(cors({
    origin: "http://localhost:5173", // URL de tu Frontend en React
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de sesión para Passport
app.use(session({
    secret: process.env.SESSION_SECRET || "jadda_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Cambiar a true si usas HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Prevención de Cache para rutas protegidas
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// -------------------
// 3. ARCHIVOS ESTÁTICOS
// -------------------
app.use(express.static(path.join(__dirname, "public")));

// -------------------
// 4. RUTAS (API)
// -------------------
app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/carrito', carritoRoutes);
app.use('/api/proveedores', proveedoresRoutes);

// Ruta para obtener el Client ID de Google OAuth en el frontend
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
// 🚀 6. LANZAMIENTO INTELIGENTE (Bienvenida limpia en reinicios)
// -------------------------------------------------------------------------
const fs = require('fs');
const pathRastreo = path.join(__dirname, 'reinicio.tmp');

app.listen(PORT, () => {
    // Si el archivo 'reinicio.tmp' NO existe, es porque es el primer arranque de Docker
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
        
        // Creamos el archivo vacío para que los próximos reinicios sepan que ya inició antes
        try { fs.writeFileSync(pathRastreo, 'iniciado'); } catch (e) {}
    } else {
        // Esto es lo único que verás en la terminal cada vez que guardes cambios con Ctrl + S 🛠️
        const hora = new Date().toLocaleTimeString();
        console.log(`\n🔄 [${hora}] ¡Backend actualizado con éxito y listo para la acción! ⚡\n`);
    }
});

// Cuando Docker se apague de verdad, borramos el archivo para el próximo "docker compose up"
process.on('SIGINT', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});
process.on('SIGTERM', () => {
    try { fs.unlinkSync(pathRastreo); } catch (e) {}
    process.exit();
});