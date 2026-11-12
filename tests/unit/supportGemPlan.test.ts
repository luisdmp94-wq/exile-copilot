import { describe, expect, it } from "vitest";
import { adviseSupportPlan, loadGemData, type SupportPlanExplainer } from "../../server/advice/supportGemAdvisor.js";
import { ApiHttpError } from "../../server/errors.js";
import { findSkill, supportFamily } from "../../shared/supportGemAdvice.js";
import {
  SupportPlanResponseSchema,
  allocateSupports,
  rankPairsByRules,
  supportPairs,
  type SupportPlanRequest,
} from "../../shared/supportGemPlan.js";

const data = loadGemData();
const skill = (name: string) => {
  const found = findSkill(data, name);
  if (!found) throw new Error(`No existe ${name}`);
  return found;
};

// El caso real de Luis del 11-11-2026: capacidad Fue 0/2, Des 0/1, Int 4/5 y tres gemas de grado 1.
const LUIS: SupportPlanRequest = {
  skills: ["Descarga de caos", "Guerrero esqueleto", "Exhumar", "Contagio", "Tirador esqueleto", "Pirómano esqueleto", "Drenar esencia"],
  gems: 3,
  maxGrade: 1,
  capacity: { Fue: 2, Des: 1, Int: 1 },
  socketed: ["Lanzamiento rápido I", "Último aliento", "Ejército elemental"],
};

describe("supportPairs y allocateSupports", () => {
  it("solo forma parejas con atributos en los que queda hueco", () => {
    const pairs = supportPairs(data, { skills: [skill("Drenar esencia")], maxGrade: 1, capacity: { Fue: 0, Des: 1, Int: 0 } });
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs.every((pair) => pair.support.attribute === "Des")).toBe(true);
    expect(supportPairs(data, { skills: [skill("Contagio")], maxGrade: 1, capacity: { Fue: 0, Des: 0, Int: 0 } })).toEqual([]);
  });

  it("guarda las mejores de cada atributo: la de destreza no se pierde", () => {
    const pairs = supportPairs(data, { skills: [skill("Drenar esencia")], maxGrade: 1, capacity: { Fue: 1, Des: 1, Int: 1 } });
    expect(pairs.map((pair) => pair.support.name)).toContain("Aflicción veloz I");
    for (const attribute of ["Fue", "Des", "Int"]) {
      expect(pairs.filter((pair) => pair.support.attribute === attribute).length).toBeLessThanOrEqual(3);
    }
  });

  it("respeta el tope por atributo y no repite una gema", () => {
    const pairs = rankPairsByRules(
      supportPairs(data, { skills: LUIS.skills.map(skill), maxGrade: 1, capacity: LUIS.capacity, socketed: LUIS.socketed }),
    );
    const chosen = allocateSupports(pairs, 3, LUIS.capacity);
    expect(chosen).toHaveLength(3);
    const count = (attribute: string) => chosen.filter((pair) => pair.support.attribute === attribute).length;
    expect(count("Int")).toBeLessThanOrEqual(1);
    expect(count("Des")).toBeLessThanOrEqual(1);
    expect(count("Fue")).toBeLessThanOrEqual(2);
    expect(new Set(chosen.map((pair) => supportFamily(pair.support))).size).toBe(3);
    // Mientras se pueda, una gema por habilidad.
    expect(new Set(chosen.map((pair) => pair.skill.slug)).size).toBe(3);
  });

  it("reparte menos gemas si no caben más", () => {
    const pairs = rankPairsByRules(supportPairs(data, { skills: [skill("Contagio")], maxGrade: 1, capacity: { Fue: 0, Des: 1, Int: 0 } }));
    expect(allocateSupports(pairs, 3, { Fue: 0, Des: 1, Int: 0 })).toHaveLength(1);
  });
});

describe("adviseSupportPlan", () => {
  it("sin IA reparte con las reglas y nunca propone lo ya puesto", async () => {
    const answer = SupportPlanResponseSchema.parse(await adviseSupportPlan(data, LUIS, null));
    expect(answer.mode).toBe("rules");
    expect(answer.fallbackReason).toBeNull();
    expect(answer.assignments).toHaveLength(3);
    expect(answer.leftover).toBe(0);
    const names = answer.assignments.map((item) => item.support.name);
    for (const already of LUIS.socketed ?? []) expect(names).not.toContain(already);
    // El daño degenerativo de caos se lleva la gema que lo sube.
    expect(answer.assignments.some((item) => item.support.name === "Aflicción veloz I")).toBe(true);
    // Los esqueletos nunca reciben una gema que no sea de esbirros.
    expect(answer.assignments.some((item) => /esqueleto/.test(item.skill) && item.support.name === "Obscenidad I")).toBe(false);
  });

  it("la habilidad que el jugador nombra en la nota va primero", async () => {
    const answer = await adviseSupportPlan(data, { ...LUIS, note: "Drenar esencia es mi daño contra jefes" }, null);
    const drain = answer.assignments.find((item) => item.skill === "Drenar esencia");
    expect(drain?.support.name).toBe("Aflicción veloz I");
  });

  it("la IA solo redacta: el reparto es el mismo con o sin ella", async () => {
    const byRules = await adviseSupportPlan(data, LUIS, null);
    const seen: string[] = [];
    const explainer: SupportPlanExplainer = async ({ pairs }) => {
      seen.push(...pairs.map((pair) => `${pair.support.name} en ${pair.skill.name}`));
      return [
        { skill: pairs[0].skill.name, support: pairs[0].support.name, reason: "Sube el daño de lo que más usas, sin pegas." },
        // Pareja que el reparto no decidió: su motivo se ignora.
        { skill: "Guerrero esqueleto", support: "Obscenidad I", reason: "Añade daño de caos a los esqueletos." },
      ];
    };
    const answer = await adviseSupportPlan(data, LUIS, explainer);
    expect(answer.mode).toBe("ai");
    expect(answer.assignments.map((item) => `${item.support.name} en ${item.skill}`)).toEqual(
      byRules.assignments.map((item) => `${item.support.name} en ${item.skill}`),
    );
    expect(seen).toHaveLength(3);
    expect(answer.assignments[0].reason).toBe("Sube el daño de lo que más usas, sin pegas.");
    // Las que la IA no explicó conservan el motivo de las reglas.
    expect(answer.assignments[1].reason).toBe(byRules.assignments[1].reason);
  });

  it("si la IA falla o no explica ninguna pareja, quedan los motivos de las reglas", async () => {
    const broken: SupportPlanExplainer = async () => {
      throw new Error("sin conexión");
    };
    const nonsense: SupportPlanExplainer = async () => [{ skill: "Contagio", support: "Gema inventada", reason: "Porque sí, es muy buena." }];
    for (const explainer of [broken, nonsense]) {
      const answer = await adviseSupportPlan(data, LUIS, explainer);
      expect(answer.mode).toBe("rules");
      expect(answer.fallbackReason).toContain("reglas");
      expect(answer.assignments).toHaveLength(3);
    }
  });

  describe("con la build del Expediente", () => {
    const WARLOCK = { characterClass: "Bruja", archetype: "brujo de caos con esbirros" };

    it("un personaje de caos ya no recibe Brutalidad: la gema va a una habilidad de caos", async () => {
      const without = await adviseSupportPlan(data, LUIS, null);
      expect(without.assignments.some((item) => item.support.name === "Brutalidad I")).toBe(true);

      const withBuild = await adviseSupportPlan(data, { ...LUIS, build: WARLOCK }, null);
      expect(withBuild.assignments).toHaveLength(3);
      expect(withBuild.assignments.some((item) => item.support.name === "Brutalidad I")).toBe(false);
      for (const item of withBuild.assignments) {
        expect(["Contagio", "Drenar esencia", "Descarga de caos", "Tirador esqueleto"]).toContain(item.skill);
      }
    });

    it("lo marcado como core va primero y lo descartado no se propone", async () => {
      const answer = await adviseSupportPlan(
        data,
        { ...LUIS, gems: 1, build: { ...WARLOCK, core: ["Drenar esencia: mi daño contra jefes"], discarded: ["Aflicción veloz"] } },
        null,
      );
      expect(answer.assignments).toHaveLength(1);
      expect(answer.assignments[0].skill).toBe("Drenar esencia");
      expect(answer.assignments[0].support.name).not.toBe("Aflicción veloz I");
    });

    it("la build llega a la IA como dato para explicar", async () => {
      let received: unknown = null;
      const explainer: SupportPlanExplainer = async ({ build, pairs }) => {
        received = build;
        return pairs.map((pair) => ({ skill: pair.skill.name, support: pair.support.name, reason: "Encaja con tu brujo de caos." }));
      };
      const answer = await adviseSupportPlan(data, { ...LUIS, build: WARLOCK }, explainer);
      expect(received).toEqual(WARLOCK);
      expect(answer.mode).toBe("ai");
    });

    it("las asistencias ya puestas valen también con su nombre en inglés", async () => {
      const answer = await adviseSupportPlan(
        data,
        { skills: ["Chaos Bolt"], gems: 1, maxGrade: 1, capacity: { Fue: 0, Des: 0, Int: 1 }, socketed: ["Rapid Casting I", "Profanity I"] },
        null,
      );
      expect(answer.unknownSkills).toEqual([]);
      expect(answer.assignments[0].skill).toBe("Descarga de caos");
      expect(["Lanzamiento rápido I", "Obscenidad I"]).not.toContain(answer.assignments[0].support.name);
    });
  });

  it("avisa de las habilidades que no conoce y de las gemas que sobran", async () => {
    const answer = await adviseSupportPlan(
      data,
      { skills: ["Contagio", "Bola de pega"], gems: 3, maxGrade: 1, capacity: { Fue: 0, Des: 1, Int: 0 } },
      null,
    );
    expect(answer.unknownSkills).toEqual(["Bola de pega"]);
    expect(answer.assignments).toHaveLength(1);
    expect(answer.leftover).toBe(2);
  });

  it("rechaza la petición si no conoce ninguna habilidad", async () => {
    await expect(
      adviseSupportPlan(data, { skills: ["Bola de pega"], gems: 1, maxGrade: 1, capacity: { Fue: 1, Des: 1, Int: 1 } }, null),
    ).rejects.toBeInstanceOf(ApiHttpError);
  });
});
