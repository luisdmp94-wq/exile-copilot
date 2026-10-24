import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { CharacterProfileSchema, type CharacterProfile, type ItemSlot } from "../../shared/domain.js";
import { importBuild } from "../../server/importers/buildImporter.js";
import * as rules from "../../src/lib/buildPriorities.js";

// Estos casos fijan los textos en español; los de inglés están en checkText.test.ts.
const extraDamageTaken = (resistance: number, target: number) =>
  rules.extraDamageTaken(resistance, target, "es");
const findBuildPriorities = (profile: CharacterProfile) => rules.findBuildPriorities(profile, "es");

const ALL_SLOTS: ItemSlot[] = [
  "weapon", "helmet", "body", "gloves", "boots", "belt", "amulet", "ring1", "ring2",
];

function profileWith(options: {
  resistances?: { fire?: number | null; cold?: number | null; lightning?: number | null; chaos?: number | null };
  slots?: ItemSlot[];
}) {
  return CharacterProfileSchema.parse({
    id: "chequeo-test",
    name: "Prueba",
    characterClass: "Monk",
    league: "Standard",
    patch: "0.5.5",
    importedAt: "2026-10-24T00:00:00.000Z",
    resistances: { fire: 75, cold: 75, lightning: 75, chaos: 0, ...options.resistances },
    items: (options.slots ?? ALL_SLOTS).map((slot, index) => ({
      id: `item-${index}`,
      name: `Objeto ${index}`,
      baseType: "Base",
      slot,
      rarity: "rare",
    })),
  });
}

function makePobCode(xml: string): string {
  return deflateSync(Buffer.from(xml, "utf8"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function importFixture(name: string, encode: boolean) {
  const raw = readFileSync(
    fileURLToPath(new URL(`../../server/fixtures/pob2/${name}`, import.meta.url)),
    "utf8",
  );
  const { profile } = importBuild(
    encode ? makePobCode(raw) : raw.trim(),
    { league: "Standard", patch: "0.5.5" },
    "character",
  );
  if (!profile) throw new Error("El código PoB2 debería producir un personaje");
  return profile;
}

describe("chequeo de build — daño extra recibido", () => {
  it("compara el daño recibido con el del objetivo", () => {
    expect(extraDamageTaken(52, 75)).toBe("un 92% más");
    expect(extraDamageTaken(70, 75)).toBe("un 20% más");
    expect(extraDamageTaken(-50, 75)).toBe("6 veces más");
    expect(extraDamageTaken(-20, 0)).toBe("un 20% más");
  });
});

describe("chequeo de build — prioridades", () => {
  it("una build con todo cubierto no recibe prioridades inventadas", () => {
    expect(findBuildPriorities(profileWith({}))).toEqual([]);
  });

  it("lista cada resistencia baja con los puntos que faltan y el daño extra de la peor", () => {
    const [priority] = findBuildPriorities(
      profileWith({ resistances: { fire: 52, cold: 75, lightning: 60 } }),
    );
    expect(priority).toMatchObject({
      id: "resistencias-elementales",
      severity: "alta",
      facts: ["Fuego 52% · te faltan 23 puntos", "Rayo 60% · te faltan 15 puntos"],
    });
    expect(priority.why).toBe("Con fuego al 52% recibes un 92% más daño de fuego que con el 75%.");
  });

  it("gradúa la gravedad por la resistencia más baja", () => {
    const severityFor = (fire: number) =>
      findBuildPriorities(profileWith({ resistances: { fire } }))[0]?.severity;
    expect(severityFor(55)).toBe("alta");
    expect(severityFor(67)).toBe("media");
    expect(severityFor(72)).toBe("baja");
  });

  it("no evalúa una resistencia sin dato como si fuera 0", () => {
    expect(
      findBuildPriorities(profileWith({ resistances: { fire: null, cold: null, lightning: null, chaos: null } })),
    ).toEqual([]);
  });

  it("señala el caos negativo y lo deja por detrás de lo urgente", () => {
    const priorities = findBuildPriorities(
      profileWith({ resistances: { fire: 40, chaos: -30 } }),
    );
    expect(priorities.map((p) => p.id)).toEqual(["resistencias-elementales", "resistencia-caos"]);
    expect(priorities[1]).toMatchObject({
      severity: "media",
      facts: ["Caos −30% · te faltan 30 puntos para llegar a 0%"],
      why: "Con −30% recibes un 30% más daño de caos que con 0%.",
    });
  });

  it("nombra los huecos vacíos y los marca urgentes si falta el arma o el pecho", () => {
    const withoutRing = findBuildPriorities(
      profileWith({ slots: ALL_SLOTS.filter((slot) => slot !== "ring2") }),
    );
    expect(withoutRing).toEqual([
      expect.objectContaining({
        id: "huecos-equipo",
        severity: "media",
        title: "Rellena el hueco de equipo vacío",
        facts: ["Vacío: Anillo 2"],
      }),
    ]);

    const withoutBody = findBuildPriorities(
      profileWith({ slots: ALL_SLOTS.filter((slot) => slot !== "body") }),
    );
    expect(withoutBody[0]).toMatchObject({ severity: "alta", facts: ["Vacío: Pecho"] });
  });

  it("un código sin equipo no se convierte en nueve huecos vacíos", () => {
    expect(findBuildPriorities(profileWith({ slots: [] }))).toEqual([]);
  });

  it("nunca devuelve más de 3 prioridades", () => {
    const priorities = findBuildPriorities(
      profileWith({ resistances: { fire: 0, cold: 0, lightning: 0, chaos: -60 }, slots: ["weapon"] }),
    );
    expect(priorities.length).toBeLessThanOrEqual(3);
    expect(priorities.map((p) => p.id)).toEqual([
      "resistencias-elementales",
      "huecos-equipo",
      "resistencia-caos",
    ]);
  });
});

describe("chequeo de build — prioridades desde códigos PoB2", () => {
  it("build de nivel 90 con resistencias cubiertas y poco equipo: solo pide rellenar huecos", () => {
    const priorities = findBuildPriorities(importFixture("richCharacter.synthetic.xml", true));
    expect(priorities.map((p) => p.id)).toEqual(["huecos-equipo"]);
    expect(priorities[0].severity).toBe("alta");
  });

  it("personaje real de nivel 1 sin resistencias: lo primero son las elementales", () => {
    const priorities = findBuildPriorities(importFixture("realBuildCode.txt", false));
    expect(priorities[0]).toMatchObject({
      id: "resistencias-elementales",
      severity: "alta",
      facts: [
        "Fuego −50% · te faltan 125 puntos",
        "Frío −50% · te faltan 125 puntos",
        "Rayo −50% · te faltan 125 puntos",
      ],
    });
    expect(priorities[0].why).toContain("6 veces más daño de fuego");
  });
});
