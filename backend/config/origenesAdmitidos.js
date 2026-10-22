/*
 * Orígenes web admitidos — fuente ÚNICA para CORS y para la defensa CSRF
 * (middlewares/proteccionOrigen.js).
 *
 * - Base de desarrollo: Vite (5173) y Expo web (8081), tal como se usaban
 *   antes de externalizar la lista (sin cambio de comportamiento).
 * - Producción: añadir los dominios reales por entorno con:
 *     CORS_ORIGINS="https://www.jaddasports.com,https://jaddasports.com"
 *   (comilla simple no; separados por coma, sin slash final — se normaliza).
 *
 * La app móvil nativa NO necesita CORS (no es un navegador); solo el modo web
 * de Expo sí, y su dominio es el de la base. Para probar Expo web desde otro
 * dispositivo en LAN, añade la IP del servidor con CORS_ORIGINS (no fija aquí).
 */

const ORIGENES_BASE = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
];

/** Devuelve la lista completa de orígenes admitidos (base + CORS_ORIGINS). */
function origenesAdmitidos() {
  const extra = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return [...ORIGENES_BASE, ...extra];
}

module.exports = { ORIGENES_BASE, origenesAdmitidos };
