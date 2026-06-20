import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 1. Permite que accedas a http://localhost:5173 desde tu navegador
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true, // 3. Habilita el polling para detectar cambios en archivos dentro de Docker
      interval: 3000, // 4. Intervalo de polling (ajusta según tu preferencia)
       
    },
    proxy: {
      // Cada vez que uses '/api', Vite lo redirigirá a tu servidor de Node en Docker
      '/api': {
        target: 'http://backend:5000', // 2. Apunta al servicio 'backend' y al puerto de tu API (ej: 5000)
        changeOrigin: true,
        secure: false,
      }
    }
  }
})