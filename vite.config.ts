import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

// Mounts the Express API inside the Vite dev server so `npm run dev`
// serves frontend and backend on the same port (7177 in standalone mode).
// The app instance is cached and only recreated when the module is reloaded.
function apiMiddleware(): Plugin {
  interface ApiModule {
    createApiApp: () => (req: never, res: never, next: never) => void
    closeApiApp?: (app: unknown) => boolean
  }
  return {
    name: "exile-copilot-api",
    configureServer(server) {
      let cachedMod: ApiModule | null = null;
      let cachedApp: ((req: never, res: never, next: never) => void) | null =
        null;
      server.middlewares.use("/api", async (req, res, next) => {
        try {
          const mod = (await server.ssrLoadModule("/server/app.ts")) as ApiModule;
          if (mod !== cachedMod || !cachedApp) {
            if (cachedMod && cachedApp) cachedMod.closeApiApp?.(cachedApp)
            cachedMod = mod;
            cachedApp = mod.createApiApp();
          }
          const app = cachedApp;
          if (!app) {
            next(new Error("API no inicializada") as never);
            return;
          }
          // Strip the /api prefix already consumed by the middleware mount.
          app(req as never, res as never, next as never);
        } catch (err) {
          next(err as never);
        }
      });
      server.httpServer?.once("close", () => {
        if (cachedMod && cachedApp) cachedMod.closeApiApp?.(cachedApp)
      })
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react(), apiMiddleware()],
  build: {
    rollupOptions: {
      output: {
        // Dependencias estables en archivos propios: el navegador puede
        // conservarlas entre despliegues aunque cambie el código del producto.
        manualChunks(id) {
          const moduleId = id.replaceAll("\\", "/")
          if (!moduleId.includes("/node_modules/")) return undefined
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) {
            return "react-vendor"
          }
          if (moduleId.includes("/node_modules/@radix-ui/")) return "radix-vendor"
          if (moduleId.includes("/node_modules/lucide-react/")) return "icons-vendor"
          if (moduleId.includes("/node_modules/zod/")) return "schema-vendor"
          return undefined
        },
      },
    },
  },
  server: {
    port: 7100,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
