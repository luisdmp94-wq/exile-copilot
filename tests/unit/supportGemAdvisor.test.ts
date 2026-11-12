import { describe, expect, it } from "vitest";
import {
  adviseSupportGem,
  loadGemData,
  type SupportPicker,
} from "../../server/advice/supportGemAdvisor.js";
import { ApiHttpError } from "../../server/errors.js";
import { SupportAdviceResponseSchema, type SupportAdviceRequest } from "../../shared/supportGemAdvice.js";

const data = loadGemData();

const SKELETONS: SupportAdviceRequest = {
  skill: "guerrero esqueleto",
  maxGrade: 1,
  attributes: ["Int", "Fue", "Des"],
  note: "mis esqueletos mueren muy rápido",
};

describe("adviseSupportGem", () => {
  it("sin IA responde con las reglas y una explicación propia", async () => {
    const answer = SupportAdviceResponseSchema.parse(await adviseSupportGem(data, SKELETONS, null));
    expect(answer.mode).toBe("rules");
    expect(answer.fallbackReason).toBeNull();
    expect(answer.skill.name).toBe("Guerrero esqueleto");
    expect(answer.recommended?.name).toBe("Último aliento");
    expect(answer.recommended?.reason).toContain("Guerrero esqueleto");
    expect(answer.alternatives.map((option) => option.name)).toContain("Ejército elemental");
    expect(answer.source).toContain("poe2db");
  });

  it("con IA usa su elección y su motivo si señala una candidata de la lista", async () => {
    const seen: string[] = [];
    const picker: SupportPicker = async ({ candidates, note }) => {
      seen.push(...candidates.map((candidate) => candidate.name), note ?? "");
      return { name: "ejército elemental", reason: "Tus esqueletos aguantan mejor el fuego, el hielo y el rayo." };
    };
    const answer = await adviseSupportGem(data, SKELETONS, picker);
    expect(answer.mode).toBe("ai");
    expect(answer.recommended?.name).toBe("Ejército elemental");
    expect(answer.recommended?.reason).toBe("Tus esqueletos aguantan mejor el fuego, el hielo y el rayo.");
    expect(answer.alternatives.map((option) => option.name)).not.toContain("Ejército elemental");
    expect(seen).toContain("Último aliento");
    expect(seen).toContain("mis esqueletos mueren muy rápido");
  });

  it("si la IA propone una gema que las reglas no dejaron, se ignora y mandan las reglas", async () => {
    const picker: SupportPicker = async () => ({ name: "Obscenidad I", reason: "Añade daño de caos a los esqueletos." });
    const answer = await adviseSupportGem(data, SKELETONS, picker);
    expect(answer.mode).toBe("rules");
    expect(answer.recommended?.name).toBe("Último aliento");
    expect(answer.fallbackReason).toContain("reglas");
  });

  it("si la IA falla, responde igualmente con las reglas", async () => {
    const picker: SupportPicker = async () => {
      throw new Error("sin conexión");
    };
    const answer = await adviseSupportGem(data, SKELETONS, picker);
    expect(answer.mode).toBe("rules");
    expect(answer.recommended).not.toBeNull();
  });

  it("limpia el motivo de la IA: texto plano y corto", async () => {
    const picker: SupportPicker = async () => ({ name: "Último aliento", reason: `<b>Aguantan</b>   más. ${"x".repeat(900)}` });
    const answer = await adviseSupportGem(data, SKELETONS, picker);
    expect(answer.recommended?.reason.startsWith("bAguantan/b más.")).toBe(true);
    expect(answer.recommended?.reason.length).toBeLessThanOrEqual(400);
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
