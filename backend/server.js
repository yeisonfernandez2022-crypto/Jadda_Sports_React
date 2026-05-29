const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

// 1. IMPORTAR CONFIGURACIONES Y RUTAS
require('./config/passport'); // Carga la estrategia de Google

const authRoutes = require('./routes/authRoutes');
const productoRoutes = require('./routes/productoRoutes');
const carritoRoutes = require('./routes/carritoRoutes'); // <--- ¡Perfectamente importado!

const app = express();
const PORT = process.env.PORT || 5000;

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
// Dejamos una sola definición limpia por cada módulo:
app.use('/api/auth', authRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/carrito', carritoRoutes);

// Ruta para obtener el Client ID de Google OAuth en el frontend
app.get('/api/auth/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Ruta para servir el HTML principal (si manejas vistas locales)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "principal.html"));
});

// -------------------
// 5. MANEJO DE ERRORES
// -------------------
app.use((err, req, res, next) => {
    console.error("❌ Error no controlado:", err.stack);
    res.status(500).send("Base de datos no disponible. Intenta más tarde.");
});

// -------------------
// 6. LANZAMIENTO
// -------------------
app.listen(PORT, () => {
    console.log(`\n🚀 JADDA SPORTS BACKEND`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📂 Modo: Encendido\n`);
});