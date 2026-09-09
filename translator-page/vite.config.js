import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  /* deployed as its own Vercel project, so it lives at that domain's root */
  plugins: [react()],
})
