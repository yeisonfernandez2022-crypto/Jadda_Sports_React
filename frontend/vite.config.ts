import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 1. Permite que accedas a http://localhost:5173 desde tu navegador
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
      ignored: ["**/node_modules/**"],
    },
    proxy: {
      // Cada vez que uses '/api', Vite lo redirigirá a tu servidor de Node en Docker
      '/api': {
        target: 'http://backend:5000', // 2. Apunta al servicio 'backend' y al puerto de tu API (ej: 5000)
        changeOrigin: true,
        secure: false,
      },
      // Fotos de perfil: el backend las sirve SIEMPRE al día (los archivos nuevos
      // no llegan al contenedor de Vite al instante → la foto salía "dañada").
      '/images/perfiles': {
        target: 'http://backend:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  preview: {
    // El preview (modo producción) también necesita el proxy: el link de
    // desuscripción del newsletter apunta a /api/newsletter/desuscribir.
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
        secure: false,
      },
      '/images/perfiles': {
        target: 'http://backend:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})