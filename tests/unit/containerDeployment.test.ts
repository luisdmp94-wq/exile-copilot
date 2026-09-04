import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const dockerfile = readFileSync(`${ROOT}/Dockerfile`, "utf8");
const dockerignore = readFileSync(`${ROOT}/.dockerignore`, "utf8");

describe("artefacto de contenedor público", () => {
  it("construye y ejecuta con Node 24 sin compilar en producción", () => {
    expect(dockerfile).toMatch(/^FROM node:24-bookworm-slim AS build$/m);
    expect(dockerfile).toMatch(/^FROM node:24-bookworm-slim AS runtime$/m);
    expect(dockerfile).toContain("RUN npm ci");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain("npm prune --omit=dev");
    expect(dockerfile).toContain('CMD ["node", "scripts/start-production.mjs"]');
    expect(dockerfile).not.toContain("tsx watch");
    expect(dockerfile).not.toContain("vite preview");
  });

  it("falla cerrado como publicación y conserva SQLite fuera de la imagen", () => {
    expect(dockerfile).toContain("PUBLIC_DEPLOYMENT=true");
    expect(dockerfile).toContain("SECURE_COOKIES=true");
    expect(dockerfile).toContain("DATABASE_PATH=/data/exile-copilot.db");
    expect(dockerfile).toContain('VOLUME ["/data"]');
    // TRUST_PROXY y el contacto de poe.ninja dependen del alojamiento real.
    // No darles un valor genérico obliga a que la barrera de arranque los valide.
    expect(dockerfile).not.toMatch(/^\s*TRUST_PROXY=/m);
    expect(dockerfile).not.toMatch(/^\s*POE_NINJA_USER_AGENT=/m);
  });

  it("ejecuta sin privilegios y expone un sondeo de disponibilidad", () => {
    expect(dockerfile).toMatch(/^USER node$/m);
    expect(dockerfile).toContain("/api/ready");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("--chown=node:node");
  });

  it("el contexto excluye secretos, bases, dependencias y artefactos locales", () => {
    for (const entry of [
      ".env",
      ".env.*",
      "node_modules",
      "dist",
      "dist-server",
      "*.db",
      "*.db-wal",
      "*.db-shm",
      "*.log",
    ]) {
      expect(dockerignore.split(/\r?\n/)).toContain(entry);
    }
    expect(dockerfile).not.toMatch(/COPY\s+\.env/i);
    expect(dockerfile).not.toContain("GROQ_API_KEY");
    expect(dockerfile).not.toContain("OPENAI_API_KEY");
  });
});
