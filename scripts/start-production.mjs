// `npm start` es el camino público y debe activar cookies seguras, CSP y
// ocultación de errores aunque el proveedor no haya definido NODE_ENV.
process.env.NODE_ENV ??= "production";
await import("../dist-server/server/index.js");
