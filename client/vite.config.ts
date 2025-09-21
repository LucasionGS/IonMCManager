import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make backend port available in frontend for direct file uploads
    'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(process.env.INTERNAL_PORT || '3174'),
  },
  server: {
    host: true,
    port: +(process.env.CLIENT_PORT || 5173),
    proxy: {
      // Specific proxy for file uploads to handle FormData properly
      '/api/servers/.*/mods': {
        target: `http://localhost:${process.env.INTERNAL_PORT || 3174}`,
        changeOrigin: true,
        secure: false,
        timeout: 60000, // 60 seconds for file uploads
        proxyTimeout: 60000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('File upload proxy error:', err);
          });
        },
      },
      // General API proxy
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
