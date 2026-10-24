import { describe, expect, it } from "vitest";
import { prioritiesForInput, type BuildCheckInput } from "../../src/lib/buildPriorities.js";
import { checkSummaryText } from "../../src/lib/checkSummary.js";

const ALL_SLOTS = ["weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2"] as const;
const lowRes: BuildCheckInput = {
  resistances: { fire: 52, cold: 75, lightning: 61, chaos: -24 },
  equippedSlots: ALL_SLOTS.filter((slot) => slot !== "ring2"),
};
const siteUrl = "https://exile-mentor.pages.dev";

describe("resumen para compartir", () => {
  it("repite lo que muestra la página, con personaje, etapa y dirección", () => {
    expect(
      checkSummaryText({
        identity: "Ranger · Ritualist · nivel 90",
        priorities: prioritiesForInput(lowRes, "es", "maps"),
        stage: "maps",
        lang: "es",
        siteUrl,
      }),
    ).toBe(
      [
        "Exile Mentor · Ranger · Ritualist · nivel 90 · en mapas",
        "1. [Urgente] Sube tus resistencias elementales al 75% — Fuego 52% · te faltan 23 puntos; Rayo 61% · te faltan 14 puntos",
        "2. [Importante] Rellena el hueco de equipo vacío — Vacío: Anillo 2",
        "3. [Importante] Saca la resistencia al caos de negativo — Caos −24% · te faltan 24 puntos para llegar a 0%",
        "Chequeo hecho con Exile Mentor: https://exile-mentor.pages.dev",
      ].join("\n"),
    );
  });

  it("en el modo manual no inventa un personaje, y sale en inglés", () => {
    const summary = checkSummaryText({
      identity: null,
      priorities: prioritiesForInput(lowRes, "en", "campaign"),
      stage: "campaign",
      lang: "en",
      siteUrl,
    });
    expect(summary.split("\n")[0]).toBe("Exile Mentor · in the campaign");
    expect(summary).toContain("[Minor] Keep raising your elemental resistances");
    expect(summary.endsWith("Checked with Exile Mentor: https://exile-mentor.pages.dev")).toBe(true);
  });

  it("si no hay nada urgente lo dice tal cual", () => {
    const fine: BuildCheckInput = {
      resistances: { fire: 75, cold: 75, lightning: 75, chaos: 0 },
      equippedSlots: [...ALL_SLOTS],
    };
    expect(
      checkSummaryText({ identity: null, priorities: [], stage: "maps", lang: "es", siteUrl }).split("\n")[1],
    ).toBe("No veo nada urgente en lo que compruebo: resistencias, caos y huecos de equipo están bien.");
    expect(prioritiesForInput(fine, "es", "maps")).toEqual([]);
  });
});
