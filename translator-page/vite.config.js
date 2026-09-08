import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  /* served under /translator/ on the unified Vercel deploy */
  base: '/translator/',
  plugins: [react()],
})
