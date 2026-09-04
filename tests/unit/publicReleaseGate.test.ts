import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

function scripts(): Record<string, string> {
  const manifest = JSON.parse(
    readFileSync(resolve("package.json"), "utf8"),
  ) as PackageManifest;
  return manifest.scripts ?? {};
}

describe("barreras de publicación", () => {
  it("incluye lint en toda versión candidata antes de compilar", () => {
    const release = scripts()["verify:release"];

    expect(release).toBeDefined();
    expect(release?.indexOf("npm run lint")).toBe(0);
    expect(release?.indexOf("npm run build")).toBeGreaterThan(
      release?.indexOf("npm run lint") ?? -1,
    );
  });

  it("detiene la publicación pública antes de los recorridos si la configuración falla", () => {
    const publicGate = scripts()["verify:public"];

    expect(publicGate).toBe(
      "npm run readiness:deployment && tsx scripts/run-isolated-release.ts",
    );
  });

  it("los recorridos locales no heredan el modo público ya validado", () => {
    const release = scripts()["verify:release"] ?? "";
    const smokePaths = [...release.matchAll(/node (scripts\/[\w-]+\.mjs)/g)].map(
      (match) => match[1],
    );

    expect(smokePaths.length).toBeGreaterThan(0);
    for (const path of smokePaths) {
      expect(path).toBeDefined();
      const source = readFileSync(resolve(path as string), "utf8");
      expect(source, path).toContain('PUBLIC_DEPLOYMENT: "false"');
    }
  });

  it("combina configuración pública y evidencia exclusiva de PoE2 1.0", () => {
    expect(scripts()["verify:public:1.0"]).toBe(
      "npm run readiness:deployment && tsx scripts/run-isolated-release.ts --target 1.0",
    );
  });
});
