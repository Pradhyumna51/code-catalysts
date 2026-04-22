import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    timeout: 20 * 60 * 1000,
    proxy: {
      '/upload': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 20 * 60 * 1000,
        proxyTimeout: 20 * 60 * 1000,
      },
    },
  },
})
