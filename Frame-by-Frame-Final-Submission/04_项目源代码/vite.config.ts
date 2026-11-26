import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages project sites are served from /<repo-name>/.
  // Local dev keeps "/" unless VITE_BASE is explicitly provided.
  base:
    process.env.VITE_BASE ??
    (process.env.GITHUB_ACTIONS === 'true' ? '/frame-by-frame/' : '/'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    open: false,
    // Local verification artifacts (browser profiles, logs) must never be watched.
    watch: { ignored: ['**/.deepworks/**', '**/dist/**'] },
  },
  preview: {
    port: 4173,
  },
})
