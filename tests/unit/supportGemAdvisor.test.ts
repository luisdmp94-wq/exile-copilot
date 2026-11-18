import { describe, expect, it } from "vitest";
import {
  adviseSupportGem,
  adviseSupportPlan,
  loadGemData,
  reasonIsGrounded,
  type SupportPlanExplainer,
} from "../../server/advice/supportGemAdvisor.js";
import { ApiHttpError } from "../../server/errors.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import {
  SupportAdviceResponseSchema,
  findSkill,
  socketedKind,
  supportCandidates,
  type SupportAdviceRequest,
} from "../../shared/supportGemAdvice.js";

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
    const boneshatter = findSkill(data, "Destrozahuesos")!;
    expect(reasonIsGrounded("Un 25 % más de daño físico, pero cuesta el 120 % de maná.", boneshatter, brutality)).toBe(true);
    // Pero una habilidad que se deja activa reserva espíritu: no gasta maná.
    expect(reasonIsGrounded("Un 25 % más de daño físico, pero cuesta el 120 % de maná.", skeleton, brutality)).toBe(false);
    expect(reasonIsGrounded("Un 25 % más de daño físico, pero su coste sube al 120 %.", skeleton, brutality)).toBe(true);
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

describe("metahabilidades: llevan habilidades engarzadas, no solo asistencias", () => {
  const BLASPHEMY: SupportAdviceRequest = { skill: "blasfemia", maxGrade: 3, attributes: ["Int", "Fue", "Des"] };

  it("Blasfemia avisa de que lleva una maldición y lista las que hay", async () => {
    const answer = SupportAdviceResponseSchema.parse(await adviseSupportGem(data, BLASPHEMY, null));

    expect(answer.sockets?.kind).toBe("curse");
    expect(answer.sockets?.cost).toBe("Reserva 60 de espíritu por cada maldición engarzada");
    const names = answer.sockets?.options.map((option) => option.name) ?? [];
    expect(names).toEqual(expect.arrayContaining(["Desesperación", "Debilitar", "Vulnerabilidad", "Cadenas temporales"]));
    expect(names).not.toContain("Blasfemia");
    // Sin build no se señala ninguna: todas valen.
    expect(answer.sockets?.options.some((option) => option.fits)).toBe(false);
  });

  it("con una build de caos pone delante la maldición que baja la resistencia al caos", async () => {
    const answer = await adviseSupportGem(data, { ...BLASPHEMY, build: WARLOCK }, null);

    expect(answer.sockets?.options[0]).toMatchObject({ name: "Desesperación", fits: true });
    expect(answer.sockets?.options[0].description).toContain("resistencia al caos");
    expect(answer.sockets?.options.filter((option) => option.fits)).toHaveLength(1);
  });

  it("una habilidad normal no lleva ese aviso", async () => {
    const answer = await adviseSupportGem(data, SKELETONS, null);

    expect(answer.sockets).toBeNull();
  });

  it("cada metahabilidad de los datos dice qué lleva engarzado", () => {
    const meta = data.skills.filter((skill) => skill.tags.includes("Metahabilidad"));

    // Eran 10 hasta quitar las tres «Lanzar al…» que el juego fundió en una (parche 0.3.0).
    expect(meta.length).toBeGreaterThanOrEqual(7);
    // Si una actualización de datos trae una frase nueva, que salte aquí y no en la web.
    expect(meta.filter((skill) => socketedKind(skill) === "skill").map((skill) => skill.name)).toEqual([]);
    expect(socketedKind(findSkill(data, "Lanzar al infligir estado alterado elemental")!)).toBe("spell");
    expect(socketedKind(findSkill(data, "Arquero ilusorio")!)).toBe("ranged-attack");
    expect(socketedKind(findSkill(data, "Tótem de guerrero ancestral")!)).toBe("mace-skill");
    expect(socketedKind(findSkill(data, "Contagio")!)).toBeNull();
  });

  it("en inglés lo dice en inglés", async () => {
    const answer = await adviseSupportGem(data, { ...BLASPHEMY, skill: "Blasphemy", build: WARLOCK, lang: "en" }, null, loadEnglishGemLocale());

    expect(answer.skill.name).toBe("Blasphemy");
    expect(answer.sockets?.cost).toBe("Reserves 60 Spirit per socketed Curse");
    expect(answer.sockets?.options[0]).toMatchObject({ name: "Despair", fits: true });
  });

  it("a Blasfemia le recomienda lo que hace más fuerte la maldición, no daño en área", async () => {
    const answer = await adviseSupportGem(data, BLASPHEMY, null);
    const offered = [answer.recommended?.name, ...answer.alternatives.map((option) => option.name)];

    expect(answer.recommended?.name).toBe("Maldición mejorada");
    expect(answer.recommended?.reason).toContain("magnitudes aumentadas un 25%");
    // Blasfemia no hace daño ni usa energía, y como aura no tiene demora ni duración.
    const all = supportCandidates(data, { skill: findSkill(data, "Blasfemia")!, maxGrade: 5, attributes: ["Int", "Fue", "Des"] }).map(
      (candidate) => candidate.support.name,
    );
    for (const wrong of ["Área concentrada", "Extensión", "Energía ilimitada II", "Maleficio duradero", "Suelo maldito", "Refracción III"]) {
      expect(all).not.toContain(wrong);
    }
    expect(offered).not.toContain("Área concentrada");
    expect(all).toContain("Claridad II");
  });

  it("a una que lanza hechizos sola le vale lo hecho para metahabilidades", () => {
    const names = (skill: string) =>
      supportCandidates(data, { skill: findSkill(data, skill)!, maxGrade: 5, attributes: ["Int", "Fue", "Des"] }).map(
        (candidate) => candidate.support.name,
      );

    expect(names("Lanzar al infligir estado alterado elemental")).toEqual(expect.arrayContaining(["Energía ilimitada II", "Casualidad", "Claridad II"]));
    expect(names("Lanzar al infligir estado alterado elemental")).not.toContain("Maldición mejorada");
    expect(names("Lanzar al infligir estado alterado elemental")).not.toContain("Condensador de energía");
    expect(names("Lanzahechizos")).toContain("Condensador de energía");
    expect(names("Lanzar al infligir estado alterado elemental")).not.toContain("Área concentrada");
  });

  it("el reparto de varias gemas también lo avisa", async () => {
    const plan = await adviseSupportPlan(
      data,
      { skills: ["Blasfemia", "Contagio"], gems: 2, maxGrade: 2, capacity: { Fue: 1, Des: 1, Int: 2 } },
      null,
    );

    expect(plan.sockets).toEqual([{ skill: "Blasfemia", kind: "curse" }]);
  });
});
