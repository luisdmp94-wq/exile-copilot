import { describe, expect, it } from "vitest";
import { GUIDES, GUIDES_EN, findGuide, guidePageTitle } from "../../src/guides/index.js";
import { checkRewards } from "../../src/lib/rewardCheck.js";
import { checkForGuide } from "../../src/lib/guideCheck.js";

describe("guías en inglés", () => {
  it("tienen exactamente los mismos datos que las españolas: solo cambia el idioma", () => {
    expect(GUIDES_EN.map((guide) => guide.slug)).toEqual(GUIDES.map((guide) => guide.slug));
    GUIDES.forEach((spanish, index) => {
      const english = GUIDES_EN[index];
      expect(english.act).toBe(spanish.act);
      expect(english.checkedPatch).toBe(spanish.checkedPatch);
      expect(english.check.elemental).toBe(spanish.check.elemental);
      expect(english.check.focus?.element).toBe(spanish.check.focus?.element);
      // La ruta: mismas zonas en el mismo orden, misma importancia, misma prueba y mismas fuentes.
      expect(english.route?.length).toBe(spanish.route?.length);
      english.route?.forEach((step, stepIndex) => {
        const original = spanish.route![stepIndex];
        expect(step.priority).toBe(original.priority);
        expect(Boolean(step.optional)).toBe(Boolean(original.optional));
        expect(Boolean(step.skip)).toBe(Boolean(original.skip));
        expect(step.sourceIds).toEqual(original.sourceIds);
        expect(step.proof?.kind).toBe(original.proof?.kind);
        if (step.proof && original.proof && step.proof.kind !== "manual" && original.proof.kind !== "manual") {
          expect(step.proof).toEqual(original.proof);
        }
      });
      expect(english.essentials.map((tip) => tip.sourceIds)).toEqual(spanish.essentials.map((tip) => tip.sourceIds));
      expect(english.blocks.map((block) => block.id)).toEqual(spanish.blocks.map((block) => block.id));
      english.blocks.forEach((block, blockIndex) => {
        const original = spanish.blocks[blockIndex];
        expect(block.cards?.length).toBe(original.cards?.length);
        expect(block.tips.map((tip) => tip.sourceIds)).toEqual(original.tips.map((tip) => tip.sourceIds));
        expect(block.more?.map((tip) => tip.sourceIds)).toEqual(original.more?.map((tip) => tip.sourceIds));
      });
      expect(english.sources.map((source) => source.id)).toEqual(spanish.sources.map((source) => source.id));
    });
  });

  it("no se les ha colado texto en español", () => {
    const spanishWords = /\b(?:el|la|los|las|del|para|resistencia|jefe|zona|siempre|puntos de pasiva)\b|[ñ¿¡]/i;
    for (const guide of GUIDES_EN) {
      const visible = [
        guide.title,
        guide.summary,
        guide.description,
        guide.check.nextAct,
        guide.check.focus?.note ?? "",
        ...guide.essentials.map((tip) => tip.text),
        ...(guide.route ?? []).flatMap((step) => [step.zone, step.text, step.reward ?? "", step.skip ?? "", step.proof?.kind === "manual" ? step.proof.question : ""]),
        ...guide.blocks.flatMap((block) => [
          block.title,
          block.intro,
          ...(block.cards ?? []).flatMap((card) => [card.title, card.text]),
          ...[...block.tips, ...(block.more ?? [])].flatMap((tip) => [tip.lead ?? "", tip.text]),
        ]),
      ];
      for (const text of visible) expect(text, text).not.toMatch(spanishWords);
    }
  });

  it("cada idioma busca su guía y su título", () => {
    expect(findGuide("acto-2", "en").title).toMatch(/^Act 2/);
    expect(findGuide("acto-2").title).toMatch(/^Acto 2/);
    expect(guidePageTitle(findGuide("acto-1", "en"), "en")).toBe("PoE2 Act 1: survival guide · Exile Copilot");
  });

  it("las comprobaciones hablan en inglés", () => {
    const guide = findGuide("acto-1", "en");
    const lines = checkForGuide({ source: "items", resistances: { fire: 40, cold: 12, lightning: 35, chaos: 0 }, filledSlots: ["weapon"] }, guide.check, "en");
    expect(lines[0].text).toMatch(/^Cold resistance: 12%\. For act 2 you should have at least 30%/);
    expect(lines.find((line) => line.id === "slots")?.text).toMatch(/^You haven't pasted: helmet, body armour/);
    const rewards = checkRewards(
      guide,
      [],
      { items: [], expectedPieces: 9, currentAct: 1, sheetResistance: {}, sheetSpirit: null, weaponSetPoints: 4, answers: {} },
      "en",
    );
    expect(rewards.find((line) => line.zone === "Clearfell")?.text).toMatch(/^Paste your gear/);
    expect(rewards.find((line) => line.zone === "Hunting Grounds")?.text).toMatch(/^You have 4, and with the books up to here it would be 4\./);
  });
});
