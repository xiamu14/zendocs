import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  optimizeDeps: {
    exclude: ['chokidar', 'fsevents'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
  plugins: [tanstackStart(), viteReact()],
})
