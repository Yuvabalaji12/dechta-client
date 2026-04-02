import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Dev proxy: /api/* requests forwarded to client backend on port 5001
    // This eliminates CORS issues in development entirely
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      }
    }
  }
})
