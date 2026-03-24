const express = require('express');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
require('dotenv').config();

// 1. IMPORTAR CONFIGURACIONES
// Es vital importar passport para que cargue la estrategia de Google
require('./config/passport'); 

const app = express();
const PORT = process.env.PORT || 3000;

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

// 4. RUTAS (API)
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/productoRoutes'));

// --- CORRECCIÓN AQUÍ ---
// Usamos 'app' porque estamos en server.js, no en un archivo de rutas aparte
app.get('/api/auth/google-client-id', (req, res) => {
    res.json({ clientId: process.env.GOOGLE_CLIENT_ID });
});

// Ruta para servir el HTML principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "html", "principal.html"));
});

// -------------------
// 5. MANEJO DE ERRORES (Opcional pero recomendado)
// -------------------
app.use((err, req, res, next) => {
    console.error("❌ Error no controlado:", err.stack);
    res.status(500).send("Algo salió mal en el servidor");
});

// -------------------
// 6. LANZAMIENTO
// -------------------
app.listen(PORT, () => {
    console.log(`\n🚀 JADDA SPORTS BACKEND`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log(`📂 Modo: Modularizado\n`);
});