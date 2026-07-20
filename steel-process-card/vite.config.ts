import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    legacy({
      // Cover older Chromium-based enterprise browsers without supporting obsolete IE.
      targets: ['Chrome >= 64', 'Edge >= 79', 'Firefox >= 67', 'Safari >= 12', 'iOS >= 12'],
      modernPolyfills: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
})
