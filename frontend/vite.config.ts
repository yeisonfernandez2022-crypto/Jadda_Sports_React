import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Cada vez que uses '/api', Vite lo redirigirá a tu servidor de Node
      '/api': {
        target: 'http://localhost:3000', 
        changeOrigin: true,
        secure: false,
      }
    }
  }
})