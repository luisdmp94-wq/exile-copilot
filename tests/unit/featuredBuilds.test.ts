import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FeaturedBuildCatalogSchema,
  FeaturedBuildsResponseSchema,
  localizeFeaturedBuild,
} from "../../shared/featuredBuilds.js";

const verifiedBuild = {
  id: "ritualista-veneno",
  game: "poe2" as const,
  title: "Ritualista de veneno",
  characterClass: "Cazadora",
  ascendancy: "Ritualista",
  mainSkills: ["Flecha de estallido venenoso"],
  league: "Runes of Aldur",
  patch: "0.5.4f",
  categories: ["mapping" as const, "budget" as const],
  budgetBand: "medium" as const,
  status: "verified" as const,
  verifiedAt: "2026-08-28T00:00:00.000Z",
  source: {
    label: "Guía pública",
    author: "Autor con permiso",
    url: "https://example.com/build",
    kind: "community-guide" as const,
  },
  summary: "Objetivo de referencia para las pruebas del catálogo.",
  whyFeatured: "Demuestra la separación entre selección y personaje.",
  caveats: ["La configuración depende del parche declarado."],
  desiredMods: ["vida máxima"],
};

describe("catálogo de builds destacadas", () => {
  it("exige PoE2, procedencia, revisión y un máximo de diez entradas", () => {
    expect(
      FeaturedBuildCatalogSchema.parse({
        game: "poe2",
        slots: 10,
        selectionAsOf: "2026-08-28",
        methodology: ["Revisión editorial reproducible."],
        entries: [verifiedBuild],
      }).entries,
    ).toHaveLength(1);

    expect(() =>
      FeaturedBuildCatalogSchema.parse({
        game: "poe2",
        slots: 10,
        selectionAsOf: "2026-08-28",
        methodology: ["Revisión editorial reproducible."],
        entries: Array.from({ length: 11 }, (_, index) => ({
          ...verifiedBuild,
          id: `build-${index}`,
        })),
      }),
    ).toThrow();
  });

  it("no acepta una respuesta que afirme más de diez builds", () => {
    expect(() =>
      FeaturedBuildsResponseSchema.parse({
        league: "Runes of Aldur",
        patch: "0.5.4f",
        slots: 10,
        selectionAsOf: "2026-08-28",
        methodology: ["Revisión editorial reproducible."],
        builds: Array.from({ length: 11 }, (_, index) => ({
          ...verifiedBuild,
          id: `build-${index}`,
        })),
        pendingReview: 0,
      }),
    ).toThrow();
  });
});

describe("las diez builds publicadas", () => {
  const catalog = FeaturedBuildCatalogSchema.parse(
    JSON.parse(readFileSync(new URL("../../server/data/featuredBuilds.json", import.meta.url), "utf8")),
  );

  it("son diez, de la misma liga y parche, verificadas y sin repetir", () => {
    expect(catalog.entries).toHaveLength(10);
    expect(new Set(catalog.entries.map((entry) => entry.id)).size).toBe(10);
    expect(new Set(catalog.entries.map((entry) => entry.ascendancy)).size).toBe(10);
    for (const entry of catalog.entries) {
      expect(entry.league).toBe("Forbidden Rites");
      expect(entry.patch).toBe("0.5.5");
      expect(entry.status).toBe("verified");
      expect(entry.verifiedAt).not.toBeNull();
    }
  });

  it("cada una enlaza una guía pública con autor", () => {
    for (const entry of catalog.entries) {
      expect(["maxroll.gg", "mobalytics.gg"]).toContain(new URL(entry.source.url).hostname);
      expect(entry.source.author.trim()).not.toBe("");
      expect(entry.source.kind).toBe("community-guide");
    }
  });

  it("todas tienen su versión en inglés, con los mismos avisos y habilidades", () => {
    for (const entry of catalog.entries) {
      expect(entry.en).toBeDefined();
      expect(entry.en?.caveats).toHaveLength(entry.caveats.length);
      expect(entry.en?.mainSkills).toHaveLength(entry.mainSkills.length);
      expect(entry.en?.desiredMods).toHaveLength(entry.desiredMods.length);
    }
  });

  it("en inglés se enseñan los textos en inglés; en español, los de siempre", () => {
    const first = catalog.entries[0];
    expect(localizeFeaturedBuild(first, "es").title).toBe(first.title);
    const english = localizeFeaturedBuild(first, "en");
    expect(english.title).toBe(first.en?.title);
    expect(english.mainSkills).toEqual(first.en?.mainSkills);
    // Lo que no cambia con el idioma sigue igual.
    expect(english.source).toEqual(first.source);
    expect(english.id).toBe(first.id);
  });

  it("las reglas de entrada están en los dos idiomas", () => {
    expect(catalog.methodologyEn).toHaveLength(catalog.methodology.length);
  });
});
