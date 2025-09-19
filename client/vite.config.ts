import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: +(process.env.CLIENT_PORT || 5173),
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.INTERNAL_PORT || 3174}`,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      '/phpmyadmin': {
        target: "http://phpmyadmin:80",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/phpmyadmin/, '/'),
      }
    },
  },
})
