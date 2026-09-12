import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El front corre en 5173 y delega /api al servidor de desarrollo (scripts/dev-server.ts),
// que monta exactamente los mismos handlers que la funcion de Vercel usa en produccion.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
