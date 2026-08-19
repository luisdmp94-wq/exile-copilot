import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { config } from "./config.js";
import { createApiApp } from "./app.js";

/**
 * Servidor standalone: monta la API en /api y sirve el build estático del
 * frontend (dist/) si existe. En desarrollo el frontend se sirve con Vite
 * (proxy a /api), así que aquí basta con la API.
 */

const app = express();
app.use("/api", createApiApp({ dbPath: config.databasePath }));

const distDir = resolve(process.cwd(), "dist");
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA fallback: cualquier ruta no-API devuelve index.html
  app.use((_req, res, next) => {
    if (existsSync(resolve(distDir, "index.html"))) {
      res.sendFile(resolve(distDir, "index.html"));
    } else {
      next();
    }
  });
}

const server = app.listen(config.port, () => {
  console.log(`[exile-copilot] API escuchando en http://localhost:${config.port}/api (env: ${config.nodeEnv})`);
});

// Cierre limpio con señales (tsx watch, Ctrl+C)
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
