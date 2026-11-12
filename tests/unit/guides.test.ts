import { describe, expect, it } from "vitest";
import { GUIDES, findGuide, guideSlugFromPath } from "../../src/guides/index.js";

describe("guías por acto", () => {
  it.each(GUIDES.map((guide) => [guide.slug, guide] as const))(
    "%s: cada consejo cita fuentes que existen en su lista",
    (_slug, guide) => {
      const known = new Set(guide.sources.map((source) => source.id));
      const tips = [
        ...guide.essentials,
        ...(guide.route ?? []),
        ...guide.blocks.flatMap((block) => [...block.tips, ...(block.more ?? [])]),
      ];
      for (const tip of tips) {
        expect(tip.sourceIds.length, tip.text).toBeGreaterThan(0);
        for (const id of tip.sourceIds) expect(known.has(id), `${id} en «${tip.text}»`).toBe(true);
      }
    },
  );

  it.each(GUIDES.map((guide) => [guide.slug, guide] as const))(
    "%s: «Lo esencial» se queda en cuatro líneas",
    (_slug, guide) => {
      expect(guide.essentials.length).toBeLessThanOrEqual(4);
    },
  );

  it.each(GUIDES.map((guide) => [guide.slug, guide] as const))(
    "%s: la ruta dice qué importa y qué se puede saltar",
    (_slug, guide) => {
      for (const step of guide.route ?? []) {
        expect(["clave", "recomendable", "historia"], step.zone).toContain(step.priority);
        // Lo clave nombra su recompensa permanente; lo demás no presume de una.
        expect(Boolean(step.reward), step.zone).toBe(step.priority === "clave");
      }
    },
  );

  it("lee la guía de la dirección y descarta las desconocidas", () => {
    expect(guideSlugFromPath("/guias/acto-2")).toBe("acto-2");
    expect(guideSlugFromPath("/guias/acto-2/")).toBe("acto-2");
    expect(guideSlugFromPath("/guias/acto-9")).toBeNull();
    expect(guideSlugFromPath("/")).toBeNull();
    expect(findGuide("acto-9").slug).toBe("acto-1");
  });
});
