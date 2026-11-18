import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { config } from "./config.js";
import { closeApiApp, createApiApp } from "./app.js";
import { securityHeaders } from "./security.js";
import { assertPublicDeploymentConfig } from "./deploymentReadiness.js";
import { isAppRoute, isPrivateRoute } from "./appRoutes.js";

/**
 * Servidor standalone: monta la API en /api y sirve el build estático del
 * frontend (dist/) si existe. En desarrollo el frontend se sirve con Vite
 * (proxy a /api), así que aquí basta con la API.
 */

// Si el operador declara una publicación real, cualquier garantía incompleta
// detiene el proceso antes de abrir el puerto o crear nuevas sesiones.
assertPublicDeploymentConfig(config);

const app = express();
// No anunciar con qué está hecho el servidor.
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(securityHeaders(config));
const apiApp = createApiApp({ dbPath: config.databasePath });
app.use("/api", apiApp);

const distDir = resolve(process.cwd(), "dist");
if (existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      index: false,
      // Sin esto, /guias redirigía a /guias/ (existe la carpeta dist/guias).
      redirect: false,
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
  // Un archivo de /assets que no existe (de un despliegue anterior, por
  // ejemplo) es un 404 de verdad. Si devolviéramos index.html, el navegador lo
  // leería como JavaScript y la página entera se caería.
  app.use("/assets", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).type("text/plain").send("Not found");
  });
  // Guías por acto: versión ya escrita en HTML (scripts/prerender-guides.ts)
  // para que los buscadores lean el texto sin ejecutar JavaScript.
  app.use((req, res, next) => {
    const match = /^\/guias\/([a-z0-9-]+)\/?$/.exec(req.path);
    const page = match ? resolve(distDir, "guias", `${match[1]}.html`) : null;
    if (page === null || !existsSync(page)) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(page);
  });
  // La web para sus direcciones conocidas. Una dirección desconocida recibe
  // la misma página con estado 404 (ver server/appRoutes.ts).
  app.use((req, res, next) => {
    if (existsSync(resolve(distDir, "index.html"))) {
      res.setHeader("Cache-Control", "no-cache");
      if (isPrivateRoute(req.path)) res.setHeader("X-Robots-Tag", "noindex, nofollow");
      if (!isAppRoute(req.path)) res.status(404);
      res.sendFile(resolve(distDir, "index.html"));
    } else {
      next();
    }
  });
}

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[exile-copilot] servidor escuchando en ${config.host}:${config.port} ` +
      `(env: ${config.nodeEnv}; público: ${config.publicDeployment ? "sí" : "no"})`,
  );
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
