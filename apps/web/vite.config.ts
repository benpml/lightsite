import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  envDir: path.resolve(__dirname, '../..'),
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/@tiptap') ||
            id.includes('node_modules/prosemirror-')
          ) {
            return 'vendor-editor-tiptap'
          }

          if (id.includes('node_modules/recharts')) {
            return 'vendor-recharts'
          }

          if (id.includes('node_modules/@base-ui')) {
            return 'vendor-base-ui'
          }

          if (
            id.includes('node_modules/radix-ui') ||
            id.includes('node_modules/@radix-ui')
          ) {
            return 'vendor-radix'
          }

          if (
            id.includes('node_modules/react-day-picker') ||
            id.includes('node_modules/embla-carousel') ||
            id.includes('node_modules/cmdk')
          ) {
            return 'vendor-ui-helpers'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3011',
    },
  },
})
