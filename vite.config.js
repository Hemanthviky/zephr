import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // shadcn-generated components import from '@/...'; point that at src/ so the
  // registry files drop in without rewriting every import by hand.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // The food database is a chunky static blob; keep it out of the entry chunk
    // so first paint isn't waiting on 140 food records.
    rollupOptions: {
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
          motion: ['framer-motion'],
          // Its own chunk so the two lazy charts in the Money tab share one
          // download, and so a deploy that only touches app code doesn't
          // invalidate 400KB of charting library in everyone's cache.
          recharts: ['recharts'],
        },
      },
    },
  },
})
