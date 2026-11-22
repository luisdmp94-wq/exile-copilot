import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile } from "../../shared/domain.js";
import { skillSupportsUnknown } from "../../shared/quickReview.js";
import { ScreenshotSheetSchema } from "../../shared/screenshotRead.js";
import { skillLinksRule } from "../../server/engine/rules.js";
import {
  applySheetToProfile,
  applySkillsToProfile,
  mergeImportedProfile,
} from "../../src/lib/profileFromReads.js";
import { patchQuickReviewForm, peekQuickReviewForm } from "../../src/lib/quickReviewStorage.js";

function profile(patch: Partial<CharacterProfile> = {}): CharacterProfile {
  return CharacterProfileSchema.parse({
    id: "bruja",
    name: "Mi bruja",
    characterClass: "Bruja",
    level: 34,
    levelSource: "observed",
    league: "Standard",
    patch: "0.5.4f",
    importedAt: "2026-11-22T00:00:00.000Z",
    skills: [{ id: "s1", label: "", mainSkill: "Contagio", supports: [{ name: "Aflicción veloz I" }] }],
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    ...patch,
  });
}

const sheet = (values: Record<string, unknown>) =>
  ScreenshotSheetSchema.parse({
    level: null,
    className: null,
    life: null,
    energyShield: null,
    mana: null,
    spirit: null,
    str: null,
    dex: null,
    int: null,
    fire: null,
    cold: null,
    lightning: null,
    chaos: null,
    ...values,
  });

describe("captura de la hoja del personaje (tecla C)", () => {
  it("rellena nivel, vida, escudo, atributos y resistencias en el mismo personaje", () => {
    const read = applySheetToProfile(
      profile(),
      sheet({ level: 44, life: 812, energyShield: 230, str: 20, dex: 33, int: 150, fire: 65, cold: 18, lightning: 40, chaos: -2 }),
    );
    expect(read.profile.id).toBe("bruja");
    expect(read.profile).toMatchObject({
      level: 44,
      levelSource: "observed",
      life: 812,
      energyShield: 230,
      attributes: { str: 20, dex: 33, int: 150 },
      resistances: { fire: 65, cold: 18, lightning: 40, chaos: -2 },
    });
    expect(read.filled).toBe(10);
    // La revisión rápida se pone al día con lo mismo.
    expect(read.review).toEqual({ level: "44", fire: "65", cold: "18", lightning: "40" });
  });

  it("lo que la captura no enseña no se toca", () => {
    const base = profile({ life: 700 });
    const read = applySheetToProfile(base, sheet({ cold: 18 }));
    expect(read.profile.life).toBe(700);
    expect(read.profile.level).toBe(34);
    expect(read.filled).toBe(1);
  });

  it("apunta la ascendencia solo si la hoja enseña una distinta de la clase", () => {
    expect(applySheetToProfile(profile(), sheet({ className: "Liche" })).profile.ascendancy).toBe("Liche");
    expect(applySheetToProfile(profile(), sheet({ className: "Bruja" })).filled).toBe(0);
    // Aunque el perfil diga otra clase, una clase base no es una ascendencia.
    expect(applySheetToProfile(profile({ characterClass: "Ranger" }), sheet({ className: "Bruja" })).profile.ascendancy).toBeNull();
  });
});

describe("captura de la ventana de habilidades", () => {
  const skills = [
    { name: "Contagio", level: 10 },
    { name: "Drenar esencia", level: 10 },
    { name: "Guerrero esqueleto", level: 9 },
  ];

  it("la que elige el jugador va la primera; las que ya tenía conservan sus apoyos", () => {
    const read = applySkillsToProfile(profile(), skills, 1);
    expect(read.profile.skills.map((skill) => skill.mainSkill)).toEqual([
      "Drenar esencia",
      "Contagio",
      "Guerrero esqueleto",
    ]);
    expect(read.profile.skills[1]?.supports).toHaveLength(1);
    expect(read.review).toEqual({
      mainSkill: "Drenar esencia",
      gemLevel: "10",
      otherSkills: "Contagio, Guerrero esqueleto",
    });
  });

  it("de las habilidades nuevas no se dice «tiene 0 apoyos»", () => {
    const read = applySkillsToProfile(profile(), skills, 1);
    expect(skillSupportsUnknown(read.profile.skills[0]!)).toBe(true);
    expect(skillLinksRule({ profile: read.profile, league: "Standard", patch: "0.5.4f" })).toEqual([]);
    // En cuanto el jugador le pone un apoyo, vuelve a contar como cualquier otra.
    const withSupport = { ...read.profile.skills[0]!, supports: [{ name: "Eficacia", gemId: null }] };
    expect(skillSupportsUnknown(withSupport)).toBe(false);
  });
});

describe("código de PoB2 sobre el mismo personaje", () => {
  it("entra el equipo, las habilidades y las estadísticas; se quedan id, nombre, liga y parche", () => {
    const current = profile({ name: "Mi bruja", league: "Forbidden Rites" });
    const imported = profile({
      id: "otro-id",
      name: "Importado",
      league: "Standard",
      patch: "0.5.5",
      level: 45,
      ascendancy: "Liche",
      items: [{ id: "i1", name: "Varita", baseType: "Varita marchita", slot: "weapon", rarity: "rare" }],
      skills: [{ id: "p1", label: "", mainSkill: "Drenar esencia", mainSkillGemId: null, supports: [{ name: "A", gemId: null }, { name: "B", gemId: null }] }],
      resistances: { fire: 70, cold: 30, lightning: 45, chaos: 0 },
      life: 900,
    } as Partial<CharacterProfile>);
    const read = mergeImportedProfile(current, imported);
    expect(read.profile).toMatchObject({
      id: "bruja",
      name: "Mi bruja",
      league: "Forbidden Rites",
      patch: "0.5.4f",
      level: 45,
      ascendancy: "Liche",
      life: 900,
      resistances: { fire: 70, cold: 30, lightning: 45, chaos: 0 },
    });
    expect(read.profile.items).toHaveLength(1);
    expect(read.profile.skills[0]?.mainSkill).toBe("Drenar esencia");
    expect(read.review).toMatchObject({ level: "45", mainSkill: "Drenar esencia", fire: "70" });
  });

  it("un código sin equipo ni habilidades no borra los que había", () => {
    const current = profile({ items: [{ id: "i0", name: "Casco", baseType: "Casco", slot: "helmet", rarity: "rare" }] } as Partial<CharacterProfile>);
    const empty = profile({ id: "x", skills: [], levelSource: "placeholder" });
    const read = mergeImportedProfile(current, empty);
    expect(read.profile.items).toHaveLength(1);
    expect(read.profile.skills[0]?.mainSkill).toBe("Contagio");
    expect(read.filled).toBe(0);
  });
});

describe("la revisión rápida se pone al día sin perder lo demás", () => {
  it("cambia solo los campos dados", () => {
    const data = new Map<string, string>();
    const store = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    patchQuickReviewForm(store, "bruja", { level: "30", act: "3", mainSkill: "Contagio" });
    patchQuickReviewForm(store, "bruja", { level: "44", mainSkill: "Drenar esencia" });
    expect(peekQuickReviewForm(store, "bruja")).toEqual({ level: "44", act: "3", mainSkill: "Drenar esencia" });
  });
});
