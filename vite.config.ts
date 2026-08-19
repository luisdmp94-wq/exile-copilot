import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// Mounts the Express API inside the Vite dev server so `npm run dev`
// serves frontend and backend on the same port (7177 in standalone mode).
// The app instance is cached and only recreated when the module is reloaded.
function apiMiddleware(): Plugin {
  return {
    name: "exile-copilot-api",
    configureServer(server) {
      let cachedMod: unknown = null;
      let cachedApp: ((req: never, res: never, next: never) => void) | null =
        null;
      server.middlewares.use("/api", async (req, res, next) => {
        try {
          const mod = await server.ssrLoadModule("/server/app.ts");
          if (mod !== cachedMod || !cachedApp) {
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
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react(), apiMiddleware()],
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
