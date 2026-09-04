import { describe, expect, it } from "vitest";
import {
  FeaturedBuildCatalogSchema,
  FeaturedBuildsResponseSchema,
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
