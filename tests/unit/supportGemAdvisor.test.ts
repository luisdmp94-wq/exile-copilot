import { describe, expect, it } from "vitest";
import {
  adviseSupportGem,
  loadGemData,
  reasonIsGrounded,
  type SupportPlanExplainer,
} from "../../server/advice/supportGemAdvisor.js";
import { ApiHttpError } from "../../server/errors.js";
import { SupportAdviceResponseSchema, findSkill, type SupportAdviceRequest } from "../../shared/supportGemAdvice.js";

const data = loadGemData();

const SKELETONS: SupportAdviceRequest = {
  skill: "guerrero esqueleto",
  maxGrade: 1,
  attributes: ["Int", "Fue", "Des"],
  note: "mis esqueletos mueren muy rápido",
};

const WARLOCK = { characterClass: "Bruja", archetype: "brujo de caos con esbirros" };

describe("adviseSupportGem", () => {
  it("sin IA elige con las reglas y da una explicación propia", async () => {
    const answer = SupportAdviceResponseSchema.parse(await adviseSupportGem(data, SKELETONS, null));
    expect(answer.mode).toBe("rules");
    expect(answer.fallbackReason).toBeNull();
    expect(answer.skill.name).toBe("Guerrero esqueleto");
    expect(answer.recommended?.name).toBe("Último aliento");
    expect(answer.recommended?.reason).toContain("Guerrero esqueleto");
    expect(answer.alternatives.map((option) => option.name)).toContain("Ejército elemental");
    expect(answer.source).toContain("poe2db");
  });

  it("la IA solo redacta: la gema elegida es la misma con o sin ella", async () => {
    const byRules = await adviseSupportGem(data, SKELETONS, null);
    const seen: string[] = [];
    const explainer: SupportPlanExplainer = async ({ pairs, note }) => {
      seen.push(...pairs.map((pair) => pair.support.name), note ?? "");
      return [{ skill: pairs[0].skill.name, support: pairs[0].support.name, reason: "Tus esqueletos siguen peleando 4 segundos más." }];
    };
    const answer = await adviseSupportGem(data, SKELETONS, explainer);
    expect(answer.mode).toBe("ai");
    expect(answer.recommended?.name).toBe(byRules.recommended?.name);
    expect(answer.recommended?.reason).toBe("Tus esqueletos siguen peleando 4 segundos más.");
    expect(seen).toEqual(["Último aliento", "mis esqueletos mueren muy rápido"]);
  });

  it("si la IA explica otra gema o falla, queda el motivo de las reglas", async () => {
    const other: SupportPlanExplainer = async () => [
      { skill: "Guerrero esqueleto", support: "Obscenidad I", reason: "Añade daño de caos a los esqueletos." },
    ];
    const broken: SupportPlanExplainer = async () => {
      throw new Error("sin conexión");
    };
    for (const explainer of [other, broken]) {
      const answer = await adviseSupportGem(data, SKELETONS, explainer);
      expect(answer.mode).toBe("rules");
      expect(answer.recommended?.name).toBe("Último aliento");
      expect(answer.fallbackReason).toContain("reglas");
    }
  });

  it("descarta un motivo de la IA que inventa una pega (caso real del 13-11-2026)", async () => {
    // Último aliento no encarece la habilidad; la IA escribió que sí.
    const invented: SupportPlanExplainer = async ({ pairs }) => [
      {
        skill: pairs[0].skill.name,
        support: pairs[0].support.name,
        reason: "Los guerreros esqueleto seguirán luchando 4 s tras morir, pero la gema aumenta el coste de maná.",
      },
    ];
    const answer = await adviseSupportGem(data, SKELETONS, invented);
    expect(answer.recommended?.name).toBe("Último aliento");
    expect(answer.mode).toBe("rules");
    expect(answer.recommended?.reason).not.toContain("coste");
  });

  it("reasonIsGrounded: números y costes tienen que salir de los datos", () => {
    const skeleton = findSkill(data, "Guerrero esqueleto")!;
    const lastGasp = data.supports.find((support) => support.name === "Último aliento")!;
    const swift = data.supports.find((support) => support.name === "Aflicción veloz I")!;
    const brutality = data.supports.find((support) => support.name === "Brutalidad I")!;
    expect(reasonIsGrounded("Siguen peleando 4 segundos después de caer.", skeleton, lastGasp)).toBe(true);
    expect(reasonIsGrounded("Siguen peleando 10 segundos después de caer.", skeleton, lastGasp)).toBe(false);
    expect(reasonIsGrounded("Aguantan más, pero cuesta más maná.", skeleton, lastGasp)).toBe(false);
    expect(reasonIsGrounded("Un 30 % más de daño degenerativo y un 20 % menos de duración.", skeleton, swift)).toBe(true);
    // Brutalidad sí encarece: hablar de coste está respaldado.
    expect(reasonIsGrounded("Un 25 % más de daño físico, pero cuesta el 120 % de maná.", skeleton, brutality)).toBe(true);
  });

  it("limpia el motivo de la IA: texto plano y corto", async () => {
    const explainer: SupportPlanExplainer = async ({ pairs }) => [
      { skill: pairs[0].skill.name, support: pairs[0].support.name, reason: `<b>Aguantan</b>   más. ${"x".repeat(900)}` },
    ];
    const answer = await adviseSupportGem(data, SKELETONS, explainer);
    expect(answer.recommended?.reason.startsWith("bAguantan/b más.")).toBe(true);
    expect(answer.recommended?.reason.length).toBeLessThanOrEqual(400);
  });

  it("un hechizo que se lanza sin parar no recibe una gema que le pone enfriamiento ni una condicionada", async () => {
    const answer = await adviseSupportGem(data, { skill: "Descarga de caos", maxGrade: 1, attributes: ["Int"], build: WARLOCK }, null);
    expect(["Reloj de arena", "Cénit I"]).not.toContain(answer.recommended?.name);
    expect(answer.alternatives.map((option) => option.name)).toContain("Lanzamiento rápido I");
  });

  it("la nota del jugador cambia la elección cuando cuenta un problema", async () => {
    const base: SupportAdviceRequest = { skill: "Descarga de caos", maxGrade: 1, attributes: ["Int", "Fue", "Des"], build: WARLOCK };
    const mana = await adviseSupportGem(data, { ...base, note: "me quedo sin maná enseguida" }, null);
    expect(["Eficiencia I", "Sobrecarga arcana"]).toContain(mana.recommended?.name);
    const slow = await adviseSupportGem(data, { ...base, note: "tarda mucho en lanzarse" }, null);
    expect(slow.recommended?.name).toBe("Lanzamiento rápido I");
  });

  it("lo descartado en la build no se propone", async () => {
    const answer = await adviseSupportGem(data, { ...SKELETONS, build: { discarded: ["Último aliento"] } }, null);
    expect(answer.recommended?.name).not.toBe("Último aliento");
    expect(answer.alternatives.map((option) => option.name)).not.toContain("Último aliento");
  });

  it("dice que no hay ninguna cuando nada cumple las condiciones", async () => {
    const answer = await adviseSupportGem(data, { skill: "Guerrero esqueleto", maxGrade: 1, attributes: ["Des"] }, null);
    expect(answer.recommended).toBeNull();
    expect(answer.alternatives).toEqual([]);
  });

  it("rechaza una habilidad que no existe", async () => {
    await expect(adviseSupportGem(data, { skill: "Bola de pega", maxGrade: 1, attributes: ["Int"] }, null)).rejects.toBeInstanceOf(
      ApiHttpError,
    );
  });
});
