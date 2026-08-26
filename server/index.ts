import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { config } from "./config.js";
import { closeApiApp, createApiApp } from "./app.js";
import { securityHeaders } from "./security.js";

/**
 * Servidor standalone: monta la API en /api y sirve el build estático del
 * frontend (dist/) si existe. En desarrollo el frontend se sirve con Vite
 * (proxy a /api), así que aquí basta con la API.
 */

const app = express();
app.set("trust proxy", config.trustProxy);
app.use(securityHeaders(config));
const apiApp = createApiApp({ dbPath: config.databasePath });
app.use("/api", apiApp);

const distDir = resolve(process.cwd(), "dist");
if (existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.includes(`${resolve(distDir, "assets")}`)) {
          // Vite añade hash al nombre: estos archivos pueden cachearse para siempre.
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "no-cache");
        }
      },
    }),
  );
  // SPA fallback: cualquier ruta no-API devuelve index.html
  app.use((_req, res, next) => {
    if (existsSync(resolve(distDir, "index.html"))) {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(resolve(distDir, "index.html"));
    } else {
      next();
    }
  });
}

const server = app.listen(config.port, () => {
  console.log(`[exile-copilot] servidor escuchando en el puerto ${config.port} (env: ${config.nodeEnv})`);
});

// Cierre limpio con señales (orquestador, despliegue o Ctrl+C). Primero deja
// de aceptar tráfico, después libera SQLite. Una conexión atascada no puede
// impedir indefinidamente un despliegue ni una copia consistente.
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[exile-copilot] cierre solicitado (${signal}); drenando conexiones`);
    server.closeIdleConnections();
    const forceTimer = setTimeout(() => {
      console.warn("[exile-copilot] cierre forzado tras 10 s de drenaje");
      server.closeAllConnections();
    }, 10_000);
    forceTimer.unref();
    server.close((error) => {
      clearTimeout(forceTimer);
      closeApiApp(apiApp);
      if (error) {
        console.error("[exile-copilot] error al cerrar el servidor", error);
        process.exitCode = 1;
        return;
      }
      console.log("[exile-copilot] HTTP y SQLite cerrados correctamente");
      process.exitCode = 0;
    });
  });
}
