import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // maplibre-gl ships a web worker whose pre-bundled dev-server version 404s under Vite's
  // dependency optimizer (it needs its sibling maplibre-gl-shared.mjs chunk alongside it, which
  // the optimizer doesn't preserve) — excluding it here makes Vite serve it unbundled instead,
  // which resolves correctly. Without this, no vector tiles ever load (the worker silently fails
  // to start, so tile requests are never issued).
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
})
