import { describe, expect, it } from "vitest";
import { CharacterProfileSchema } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { skillWeaponFit, weaponInText } from "../../shared/skillChoice.js";
import { loadEnglishGemLocale } from "../../server/advice/gemLocale.js";
import { loadGemData } from "../../server/advice/supportGemAdvisor.js";
import { isSkillChoiceQuestion } from "../../server/mentor/gameQuestions.js";
import {
  answerOwnBuildQuestion,
  answerSkillBrowseQuestion,
  answerSkillChoiceTopic,
  answerSkillFitQuestion,
  answerWhyCombineQuestion,
  carriedWeapon,
  isSkillBrowseQuestion,
  isSkillFitQuestion,
  skillChoices,
} from "../../server/mentor/skillChoiceQuestions.js";

const gems = { data: loadGemData(), locale: loadEnglishGemLocale() };

interface Setup {
  name: string;
  level?: number;
}

function character(
  setups: Setup[],
  items: Array<{ slot: string; baseType: string }> = [],
  extra: Record<string, unknown> = {},
) {
  return CharacterProfileSchema.parse({
    id: "prueba",
    name: "Personaje de prueba",
    characterClass: "Guerrero",
    level: 14,
    levelSource: "observed",
    league: "Runes of Aldur",
    patch: "0.5.5",
    importedAt: "2026-11-27T00:00:00.000Z",
    items: items.map((item, index) => ({
      id: `i${index}`,
      name: item.baseType,
      baseType: item.baseType,
      slot: item.slot,
      rarity: "magic",
      itemLevel: 10,
      modifiers: [],
      sources: [],
    })),
    skills: setups.map((setup, index) => ({
      id: `s${index}`,
      label: setup.name,
      mainSkill: setup.name,
      supports: [],
      ...(setup.level !== undefined ? { level: setup.level } : {}),
    })),
    ...extra,
  });
}

const warrior = character(
  [{ name: "Embate rodante", level: 5 }, { name: "Terremoto", level: 3 }],
  [{ slot: "weapon", baseType: "Mazo de guerra" }, { slot: "body", baseType: "Cota de malla" }],
);
const ranger = character(
  [{ name: "Flecha de rayo", level: 7 }, { name: "Pararrayos", level: 5 }, { name: "Heraldo de trueno", level: 4 }],
  [{ slot: "weapon", baseType: "Arco corto" }, { slot: "offhand", baseType: "Carcaj de flechas anchas" }],
);
const sorceress = character([{ name: "Chispa", level: 8 }], [{ slot: "weapon", baseType: "Báculo de ceniza" }]);

const bullets = (answer: string | null) =>
  (answer ?? "").split("\n").filter((line) => line.startsWith("• ")).map((line) => /• ([^(:]+)[(:]/.exec(line)?.[1]?.trim() ?? line);
const skillByName = (name: string) => gems.data.skills.find((skill) => skill.name === name)!;
const groupsOf = (name: string) => skillByName(name).cutGroups ?? [];

describe("qué arma nombra un texto", () => {
  it("reconoce las cinco armas y las de hechicero, en español y en inglés", () => {
    expect(weaponInText("Mazo de guerra pesado")).toEqual({ group: "Maza", caster: false });
    expect(weaponInText("Arco corto de caza")).toEqual({ group: "Arco", caster: false });
    expect(weaponInText("Ballesta de asedio")).toEqual({ group: "Ballesta", caster: false });
    expect(weaponInText("Siege Crossbow")).toEqual({ group: "Ballesta", caster: false });
    expect(weaponInText("Lanza de caza")).toEqual({ group: "Lanza", caster: false });
    expect(weaponInText("Bastón largo")).toEqual({ group: "Bastón", caster: false });
    expect(weaponInText("Báculo de ceniza")).toEqual({ group: null, caster: true });
    expect(weaponInText("Bone Wand")).toEqual({ group: null, caster: true });
  });

  it("no adivina un arma con otro nombre", () => {
    expect(weaponInText("Túnica de seda")).toBeNull();
  });
});

describe("¿se puede usar la habilidad con esa arma?", () => {
  it("una de arma solo vale con su arma", () => {
    expect(skillWeaponFit(["Arco"], "Arco")).toEqual({ kind: "weapon", weapons: ["Arco"], fits: true });
    expect(skillWeaponFit(["Arco"], "Maza")).toEqual({ kind: "weapon", weapons: ["Arco"], fits: false });
    expect(skillWeaponFit(["Arco", "Lanza"], "Lanza")).toMatchObject({ fits: true });
    expect(skillWeaponFit(["Arco"], null)).toMatchObject({ fits: null });
  });

  it("un hechizo no pide arma; sin tabla de tallado no se sabe", () => {
    expect(skillWeaponFit(["Elemental"], "Maza")).toEqual({ kind: "spell", school: "Elemental" });
    expect(skillWeaponFit(["Espíritu"], "Arco")).toEqual({ kind: "spirit" });
    expect(skillWeaponFit([], "Arco")).toEqual({ kind: "unknown" });
  });
});

describe("qué arma lleva el personaje", () => {
  it("la lee de la pieza", () => {
    expect(carriedWeapon(gems, warrior)).toMatchObject({ group: "Maza", caster: false });
    expect(carriedWeapon(gems, sorceress)).toMatchObject({ group: null, caster: true });
  });

  it("sin pieza, la saca de las habilidades que ya usa", () => {
    expect(carriedWeapon(gems, character([{ name: "Flecha de rayo" }, { name: "Pararrayos" }]))).toMatchObject({ group: "Arco" });
    expect(carriedWeapon(gems, character([{ name: "Chispa" }]))).toMatchObject({ group: null, caster: true });
    expect(carriedWeapon(gems, null)).toEqual({ group: null, caster: false, piece: null });
  });
});

describe("«¿qué habilidad me cojo?»", () => {
  it.each([
    "no se que habilidades elegir",
    "que habilidad me cojo ahora?",
    "que habilidades pegan con mi arma?",
    "cuales son las habilidades de ballesta?",
    "no tengo ni idea de que skills coger",
    "que hechizos puedo elegir?",
  ])("reconoce «%s»", (question) => {
    expect(isSkillBrowseQuestion(normalizeQuestion(question))).toBe(true);
  });

  it.each([
    "que gema de asistencia le pongo a terremoto?",
    "tengo una gema sin tallar de nivel 7 que habilidad cojo?",
    "que ataques hace el jefe del acto 2?",
    "por que muero tanto?",
  ])("no se queda con «%s»", (question) => {
    expect(isSkillBrowseQuestion(normalizeQuestion(question))).toBe(false);
  });

  it("la de la gema sin tallar sigue siendo de su regla de siempre", () => {
    expect(isSkillChoiceQuestion(normalizeQuestion("tengo una gema sin tallar de nivel 7 que habilidad cojo?"))).toBe(true);
  });

  it("solo propone habilidades del arma que lleva, y ninguna que ya tenga", () => {
    const answer = answerSkillBrowseQuestion(gems, "no se que habilidades elegir", warrior, "es");
    const names = bullets(answer);
    expect(names.length).toBeGreaterThanOrEqual(3);
    for (const name of names) expect(groupsOf(name)).toContain("Maza");
    expect(names).not.toContain("Terremoto");
    expect(names).not.toContain("Embate rodante");
    expect(answer).toContain("Llevas maza");
  });

  it("con un arma a dos manos y sin mano secundaria no propone las que piden escudo", () => {
    const answer = answerSkillBrowseQuestion(gems, "no se que habilidades elegir", warrior, "es");
    expect(answer).not.toContain("pide escudo");
  });

  it("primero lo que puede tallar ya con su gema más alta", () => {
    const answer = answerSkillBrowseQuestion(gems, "que habilidad me cojo?", warrior, "es")!;
    const first = bullets(answer)[0]!;
    expect(skillByName(first).grade).toBeLessThanOrEqual(5);
    expect(answer).toContain("Tu gema más alta es de nivel 5");
  });

  it("si nombra otra arma, enseña esa y avisa de que no es la suya", () => {
    const answer = answerSkillBrowseQuestion(gems, "que habilidades hay de arco?", warrior, "es")!;
    for (const name of bullets(answer)) expect(groupsOf(name)).toContain("Arco");
    expect(answer).toContain("Ojo: tú llevas maza");
  });

  it("a quien lanza hechizos le enseña hechizos, no ataques de arma", () => {
    const answer = answerSkillBrowseQuestion(gems, "que hechizos puedo elegir?", sorceress, "es")!;
    for (const name of bullets(answer)) expect(groupsOf(name)).toContain("Elemental");
    expect(answer).toContain("no piden un arma concreta");
  });

  it("«Lanza de rayos» en la pregunta no es llevar una lanza", () => {
    const answer = answerSkillBrowseQuestion(gems, "que habilidades combinan bien con flecha de rayo?", ranger, "es")!;
    for (const name of bullets(answer)) expect(groupsOf(name)).toContain("Arco");
    expect(answer).toContain("comparten");
    expect(answer).toContain("no sé decirte si la combinación es buena");
  });

  it("sin saber el arma, la pregunta en vez de inventarla", () => {
    const answer = answerSkillBrowseQuestion(gems, "que habilidad me cojo?", null, "es")!;
    expect(answer).toContain("necesito saber tu arma");
    expect(bullets(answer)).toEqual([]);
  });

  it("contesta en inglés", () => {
    const answer = answerSkillBrowseQuestion(gems, "which skills should i pick?", warrior, "en")!;
    expect(answer).toContain("You carry a mace");
    expect(answer).not.toMatch(/Llevas|nivel de gema/);
  });
});

describe("«¿me vale con mi arma?»", () => {
  it("dice que no y con qué arma sale", () => {
    const answer = answerSkillFitQuestion(gems, "me vale flecha de rayo con mi mazo?", warrior, "es")!;
    expect(answer.startsWith("No. Flecha de rayo es una habilidad de arco")).toBe(true);
    expect(answer).toContain("tú llevas maza");
  });

  it("dice que sí cuando el arma es la suya", () => {
    const answer = answerSkillFitQuestion(gems, "terremoto me sirve con mi maza?", warrior, "es")!;
    expect(answer.startsWith("Sí. Terremoto es una habilidad de maza")).toBe(true);
    expect(answer).toContain("no cuánto daño hace");
  });

  it("un hechizo vale con cualquier arma", () => {
    const answer = answerSkillFitQuestion(gems, "bola de fuego me vale con mi baculo?", sorceress, "es")!;
    expect(answer.startsWith("Sí. Bola de fuego es un hechizo")).toBe(true);
  });

  it("con un arma de hechicero, una de maza no vale", () => {
    const answer = answerSkillFitQuestion(gems, "terremoto me sirve si llevo baculo?", sorceress, "es")!;
    expect(answer.startsWith("No. Terremoto es una habilidad de maza")).toBe(true);
  });

  it("si la habilidad no está en las tablas de tallado, dice que no lo sabe", () => {
    expect(groupsOf("Descarga de caos")).toEqual([]);
    const answer = answerSkillFitQuestion(gems, "descarga de caos me vale con mi arco?", ranger, "es")!;
    expect(answer.startsWith("No lo sé.")).toBe(true);
  });

  it("sin nombrar una, mira las que lleva y las cuenta", () => {
    const answer = answerSkillFitQuestion(gems, "esta build me vale con mi arco?", ranger, "es")!;
    expect(answer).toContain("puedes usar 3 de tus 3 habilidades");
    expect(answer).toContain("Flecha de rayo: sí, es una habilidad de arco.");
    expect(answer).toContain("Heraldo de trueno: es una gema de espíritu.");
  });

  it("y cuenta las que no valen si cambia de arma", () => {
    const answer = answerSkillFitQuestion(gems, "mis habilidades me valen con una maza?", ranger, "es")!;
    expect(answer).toContain("puedes usar 1 de tus 3 habilidades");
    expect(answer).toContain("Flecha de rayo: no, es una habilidad de arco.");
  });

  it("no se queda con preguntas de asistencias ni sin arma", () => {
    expect(isSkillFitQuestion(gems, normalizeQuestion("me vale esta asistencia con terremoto?"))).toBe(false);
    expect(isSkillFitQuestion(gems, normalizeQuestion("me vale terremoto?"))).toBe(false);
  });
});

describe("«¿por qué combinan?»", () => {
  it("dice qué comparten y qué le da la asistencia", () => {
    const answer = answerWhyCombineQuestion(gems, "por que furia va bien con terremoto?", "es")!;
    expect(answer).toContain("Furia sí encaja con Terremoto");
    expect(answer).toContain("ataque, cuerpo a cuerpo");
    expect(answer).toContain("otorgan 3 de furia");
    expect(answer).toContain("no cuánto daño hace");
  });

  it("si no encaja, lo dice", () => {
    const answer = answerWhyCombineQuestion(gems, "por que furia va bien con chispa?", "es")!;
    expect(answer).toContain("Furia no encaja con Chispa");
  });

  it("sin una asistencia y una habilidad con nombre, no contesta", () => {
    expect(answerWhyCombineQuestion(gems, "por que muero tanto?", "es")).toBeNull();
    expect(answerWhyCombineQuestion(gems, "por que furia?", "es")).toBeNull();
  });
});

describe("«¿cómo monto mi propia build?»", () => {
  it("da los pasos con su arma y su habilidad", () => {
    const answer = answerOwnBuildQuestion(gems, "como monto mi propia build?", warrior, "es")!;
    expect(answer).toContain("No te doy una build hecha");
    expect(answer).toContain("Llevas maza");
    expect(answer).toContain("Embate rodante");
    expect(answer).toContain("«Monta tu build»");
  });

  it("no se queda con otras preguntas", () => {
    expect(answerOwnBuildQuestion(gems, "que mejoro primero?", warrior, "es")).toBeNull();
  });
});

describe("las cuatro juntas", () => {
  it("la más concreta gana", () => {
    expect(answerSkillChoiceTopic(gems, "por que furia va bien con terremoto?", warrior, "es")).toContain("sí encaja");
    expect(answerSkillChoiceTopic(gems, "me vale flecha de rayo con mi mazo?", warrior, "es")).toContain("No. Flecha de rayo");
    expect(answerSkillChoiceTopic(gems, "que mejoro primero?", warrior, "es")).toBeNull();
  });
});

describe("la lista para «Monta tu build»", () => {
  it("trae solo lo que se puede tallar, con su grupo", () => {
    const list = skillChoices(gems.data, gems.locale, "es");
    expect(list.length).toBeGreaterThan(200);
    for (const skill of list) expect(skill.groups.length).toBeGreaterThan(0);
    expect(list.find((skill) => skill.name === "Terremoto")).toMatchObject({ groups: ["Maza"], grade: 1 });
    expect(list.find((skill) => skill.name === "Descarga de caos")).toBeUndefined();
  });

  it("en inglés trae los nombres en inglés", () => {
    const list = skillChoices(gems.data, gems.locale, "en");
    expect(list.some((skill) => skill.name === "Earthquake")).toBe(true);
  });
});
