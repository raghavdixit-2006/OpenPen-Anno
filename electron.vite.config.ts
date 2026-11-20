import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * React Fast Refresh injects an inline preamble script in dev. Production keeps
 * the strict `script-src 'self'` policy from each HTML file; only the dev server
 * is relaxed, and only for inline scripts.
 */
function relaxCspForDev(): Plugin {
  return {
    name: 'openpen-anno:dev-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
    }
  }
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react(), tailwindcss(), relaxCspForDev()],
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/overlay/index.html'),
          toolbar: resolve(__dirname, 'src/renderer/toolbar/index.html'),
          popover: resolve(__dirname, 'src/renderer/popover/index.html'),
          text: resolve(__dirname, 'src/renderer/text/index.html')
        }
      }
    }
  }
})
