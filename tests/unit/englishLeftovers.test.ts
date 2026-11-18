import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { PatchVersionSchema } from "../../shared/domain.js";
import {
  PatchCompatibilityRegistrySchema,
  compatibilityForPatch,
  localizePatchCompatibility,
} from "../../shared/patchCompatibility.js";
import { displaySourceLabel, storeProfileValue } from "../../src/lib/format.js";
import { quoted } from "../../src/i18n/lang.js";

/**
 * Español que se colaba en la versión inglesa: datos del parche, procedencias
 * guardadas y valores por defecto. En español nada de esto cambia.
 */
const SPANISH_LETTERS = /[ñ¿¡áéíóú«»]/;

function setPageLang(lang: "es" | "en"): void {
  (globalThis as { document?: unknown }).document = { documentElement: { lang } };
}

function readJson(relative: string): unknown {
  return JSON.parse(readFileSync(new URL(`../../server/data/${relative}`, import.meta.url), "utf8"));
}

describe("datos del parche en inglés", () => {
  const registry = PatchCompatibilityRegistrySchema.parse(readJson("patchCompatibility.json"));

  it("cada parche tiene resumen, rótulos y notas en inglés", () => {
    for (const record of registry.patches) {
      const english = localizePatchCompatibility(record, "en");
      expect(english.summary, record.patchId).not.toBe(record.summary);
      expect(english.summary, record.patchId).not.toMatch(SPANISH_LETTERS);
      for (const feature of english.features) {
        expect(`${feature.label} ${feature.note}`, `${record.patchId} ${feature.id}`).not.toMatch(SPANISH_LETTERS);
      }
      // Lo único que cambia es el texto: estados y evidencias son los mismos.
      expect(english.features.map((feature) => feature.status)).toEqual(record.features.map((feature) => feature.status));
      expect(english.status).toBe(record.status);
    }
  });

  it("en español devuelve la misma cobertura, sin tocarla", () => {
    for (const record of registry.patches) {
      expect(localizePatchCompatibility(record, "es")).toBe(record);
    }
  });

  it("un parche sin revisar también se explica en inglés", () => {
    const unknown = localizePatchCompatibility(compatibilityForPatch(registry, "9.9"), "en");
    expect(unknown.summary).toContain("Patch 9.9");
    expect(unknown.features.map((feature) => `${feature.label} ${feature.note}`).join(" ")).not.toMatch(SPANISH_LETTERS);
  });

  it("cada parche tiene su fuente en inglés", () => {
    const patches = (readJson("patches.json") as unknown[]).map((entry) => PatchVersionSchema.parse(entry));
    for (const patch of patches) {
      expect(patch.sourceEn, patch.id).toBeTruthy();
      expect(patch.sourceEn, patch.id).not.toMatch(SPANISH_LETTERS);
      expect(patch.labelEn ?? patch.label, patch.id).not.toMatch(/anunciado/);
    }
  });
});

describe("textos guardados en español al enseñarlos en inglés", () => {
  afterEach(() => {
    delete (globalThis as { document?: unknown }).document;
  });

  it("traduce la procedencia del personaje de ejemplo y de lo importado", () => {
    setPageLang("en");
    expect(displaySourceLabel("Build de demostración")).toBe("Example build");
    expect(displaySourceLabel("Texto de objeto copiado desde el juego")).toBe("Item text copied from the game");
    expect(displaySourceLabel("Instantánea importada desde Path of Building 2 · v0.9")).toBe(
      "Snapshot imported from Path of Building 2 · v0.9",
    );
    expect(displaySourceLabel("poe.ninja")).toBe("poe.ninja");
  });

  it("en español la procedencia se queda tal cual", () => {
    setPageLang("es");
    expect(displaySourceLabel("Build de demostración")).toBe("Build de demostración");
  });

  it("el editor guarda la marca interna aunque se vea en inglés", () => {
    setPageLang("en");
    expect(storeProfileValue("New character")).toBe("Nuevo personaje");
    expect(storeProfileValue("Unknown")).toBe("Desconocida");
    expect(storeProfileValue("Likewow")).toBe("Likewow");
    setPageLang("es");
    expect(storeProfileValue("New character")).toBe("New character");
  });

  it("las comillas siguen al idioma", () => {
    expect(quoted("Contagion", "en")).toBe("“Contagion”");
    expect(quoted("Contagio", "es")).toBe("«Contagio»");
  });
});
