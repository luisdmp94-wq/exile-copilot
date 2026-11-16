import { describe, expect, it } from "vitest";
import { adviseSupportGem, adviseSupportPlan, loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { findSkillAnyLang, loadEnglishGemLocale, toSpanishGemName } from "../../server/advice/gemLocale.js";

const data = loadGemData();
const locale = loadEnglishGemLocale();

describe("gemas en inglés", () => {
  it("encuentra una habilidad por su nombre en inglés", () => {
    expect(findSkillAnyLang(data, locale, "Essence Drain")?.name).toBe("Drenar esencia");
    expect(findSkillAnyLang(data, locale, "essence drain")?.name).toBe("Drenar esencia");
    expect(findSkillAnyLang(data, locale, "Drenar esencia")?.name).toBe("Drenar esencia");
  });

  it("una gema puesta escrita en inglés cuenta como puesta", () => {
    expect(toSpanishGemName(data, locale, "Swift Affliction I")).toBe("Aflicción veloz I");
    expect(toSpanishGemName(data, locale, "algo que no existe")).toBe("algo que no existe");
  });

  it("recomienda la misma gema en los dos idiomas, cada una con su nombre (caso de Luis del 16-11-2026)", async () => {
    const request = { maxGrade: 2, attributes: ["Int", "Des", "Fue"] as const };
    const spanish = await adviseSupportGem(
      data,
      { ...request, attributes: [...request.attributes], skill: "Drenar esencia", socketed: ["Aflicción veloz I"] },
      null,
      locale,
    );
    const english = await adviseSupportGem(
      data,
      { ...request, attributes: [...request.attributes], skill: "Essence Drain", socketed: ["Swift Affliction I"], lang: "en" },
      null,
      locale,
    );
    expect(spanish.recommended?.name).toBe("Agonía intensa");
    expect(english.recommended?.name).toBe("Intense Agony");
    expect(english.skill.name).toBe("Essence Drain");
    expect(english.recommended?.reason).toMatch(/Essence Drain/);
    expect(english.recommended?.reason).not.toMatch(/Drenar|encaja/);
    expect(english.alternatives.map((option) => option.name)).not.toContain("Swift Affliction I");
    expect(english.alternatives).toHaveLength(spanish.alternatives.length);
  });

  it("el reparto de varias gemas también sale en inglés", async () => {
    const plan = await adviseSupportPlan(
      data,
      { skills: ["Essence Drain", "Contagion"], gems: 2, maxGrade: 1, capacity: { Fue: 0, Des: 1, Int: 1 }, lang: "en" },
      null,
      locale,
    );
    expect(plan.unknownSkills).toEqual([]);
    expect(plan.assignments.map((entry) => entry.skill).every((name) => ["Essence Drain", "Contagion"].includes(name))).toBe(true);
    expect(plan.assignments.every((entry) => /[a-z]/i.test(entry.support.name) && !/[áéíóúñ]/.test(entry.support.name))).toBe(true);
  });

  it("una habilidad desconocida avisa en el idioma pedido", async () => {
    await expect(adviseSupportGem(data, { skill: "Nope", maxGrade: 1, attributes: ["Int"], lang: "en" }, null, locale)).rejects.toMatchObject({
      detail: expect.stringMatching(/I don't know that skill/),
    });
  });
});
