import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Set VITE_BASE to '/' for local dev or a custom domain.
// GitHub Actions sets it to '/<repo-name>/' automatically via the deploy workflow.
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  plugins: [react()],
  base,
  server: {
    port: 5173,
  },
})
