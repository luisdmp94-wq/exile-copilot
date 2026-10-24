import path from "path"
import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url))

// La web pública del chequeo de build: un sitio estático sin servidor ni API.
// Sale en dist-check/ con el chequeo como página principal (index.html).
function checkPageAsIndex(): Plugin {
  return {
    name: "exile-copilot-check-index",
    enforce: "post",
    generateBundle(_options, bundle) {
      const page = bundle["check.html"]
      if (page) page.fileName = "index.html"
    },
  }
}

export default defineConfig({
  base: "/",
  plugins: [react(), checkPageAsIndex()],
  // Solo favicon y cabeceras: la mascota y demás recursos de la app anterior no viajan.
  publicDir: "public-check",
  build: {
    outDir: "dist-check",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(CONFIG_DIR, "check.html"),
    },
  },
  server: {
    port: 7300,
  },
  preview: {
    port: 7300,
  },
  resolve: {
    alias: {
      "@": path.resolve(CONFIG_DIR, "./src"),
      "@shared": path.resolve(CONFIG_DIR, "./shared"),
    },
  },
})
