import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En Docker el backend responde como "backend"; fuera de Docker (CI, local)
// se puede apuntar a 127.0.0.1 con VITE_PROXY_TARGET.
const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://backend:5000'

// Dominios publicados por el reverse proxy (Caddy/nginx — semana S03).
// Sin esto, Vite/Preview responde 403 "Blocked request. This host is not
// allowed" cuando entra una petición con Host distinto de localhost.
const dominiosPublicados = [
  'www.jaddasports.com',
  'jaddasports.com',
  'api.jaddasports.com',
]

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 1. Permite que accedas a http://localhost:5173 desde tu navegador
    port: 5173,
    strictPort: true,
    allowedHosts: dominiosPublicados,
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ["**/node_modules/**"],
    },
    proxy: {
      // Cada vez que uses '/api', Vite lo redirigirá a tu servidor de Node en Docker
      '/api': {
        target: proxyTarget, // 2. Apunta al servicio 'backend' y al puerto de tu API (ej: 5000)
        changeOrigin: true,
        secure: false,
      },
      // Fotos de perfil: el backend las sirve SIEMPRE al día (los archivos nuevos
      // no llegan al contenedor de Vite al instante → la foto salía "dañada").
      '/images/perfiles': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      // Archivos por usuario (perfil, retos): igual que perfiles, sirve el backend.
      '/images/usuarios': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      // Evidencias de devoluciones: sirve el backend (igual que perfiles/usuarios).
      '/images/devoluciones': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      // Imágenes de productos (subidas del admin y vendedores): sirve el backend,
      // así las imágenes recién subidas se ven al instante.
      '/images/productos': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    // El preview (modo producción) también necesita el proxy: el link de
    // desuscripción del newsletter apunta a /api/newsletter/desuscribir.
    // Mismos hosts permitidos que `server` (el perfil prod entra con el Host
    // del dominio público, no localhost).
    allowedHosts: dominiosPublicados,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/images/perfiles': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/images/usuarios': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/images/devoluciones': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
      '/images/productos': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  }
})