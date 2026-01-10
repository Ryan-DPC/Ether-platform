import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from current directory
  const env = loadEnv(mode, process.cwd(), '')

  return {
    // Use relative paths for Electron (not absolute /assets/)
    base: './',
    // Tell Vite to look for .env files in the current directory (default)
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'https://vext-backend.onrender.com',
          changeOrigin: true,
          secure: false
        },
        '/socket.io': {
          target: env.VITE_WEBSOCKET_URL || 'https://vext-ws-server.onrender.com',
          ws: true,
          changeOrigin: true,
          secure: false
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor': ['vue', 'vue-router', 'pinia', 'axios'],
              'ui': ['@fortawesome/fontawesome-free']
            }
          }
        },
        chunkSizeWarningLimit: 1000
      }
    }
  }
})
