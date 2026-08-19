import { randomUUID } from "node:crypto";
import {
  GggBuildPlannerV1Schema,
  type GggBuildPlannerV1,
  type GggBuildSkill,
  type GggBuildSupport,
} from "../../shared/gggBuildPlanner.js";
import type {
  CharacterProfile,
  Item,
  ItemSlot,
  PassiveNode,
  SkillSetup,
  SupportGem,
} from "../../shared/domain.js";
import { ApiHttpError } from "../errors.js";

/**
 * Importador del formato OFICIAL `.build` (GGG Build Planner v1, Experimental).
 * Fuente del esquema: https://www.pathofexile.com/developer/docs/game
 *
 * Separación de modelos:
 *  - GggBuildPlannerV1: el archivo oficial (pasivas/skills por id de tablas GGG).
 *  - CharacterProfile (snapshot interno): el dominio rico de la app.
 *
 * El formato oficial NO contiene nivel, liga, resistencias, atributos ni vida:
 * esos campos quedan desconocidos (null / defaults) y se avisa al usuario.
 * Los nombres visibles de pasivas/skills NO son resolubles desde ids oficiales
 * sin datos de juego: se usa el id como `ref` y se marca con warning.
 */

export interface GggImportResult {
  profile: CharacterProfile;
  warnings: string[];
}

/** Mapeo de inventory_id (tabla Inventories, ids del ejemplo oficial) → slot interno. */
const INVENTORY_TO_SLOT: Record<string, ItemSlot> = {
  Weapon1: "weapon",
  Weapon2: "weapon",
  Helm1: "helmet",
  BodyArmour1: "body",
  Gloves1: "gloves",
  Boots1: "boots",
  Belt1: "belt",
  Amulet1: "amulet",
  Ring1: "ring1",
  Ring2: "ring2",
  Flask1: "flask",
  Flask2: "flask",
};

export function parseGggBuildPlanner(content: string): GggBuildPlannerV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    throw new ApiHttpError(
      400,
      "build-json-invalido",
      `El contenido parece JSON pero no se pudo parsear: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const result = GggBuildPlannerV1Schema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("; ");
    throw new ApiHttpError(
      400,
      "ggg-build-invalido",
      `El JSON no cumple el esquema oficial Build Planner v1: ${detail}`,
    );
  }
  return result.data;
}

function toPassiveNode(entry: string | { id: string; additional_text?: string }): PassiveNode {
  if (typeof entry === "string") return { ref: entry, isOfficialId: true };
  const node: PassiveNode = { ref: entry.id, isOfficialId: true };
  if (entry.additional_text !== undefined) node.additionalText = entry.additional_text;
  return node;
}

function toSupportGem(entry: string | GggBuildSupport): SupportGem {
  const id = typeof entry === "string" ? entry : entry.id;
  return { name: id, gemId: id };
}

function toSkillSetup(entry: string | GggBuildSkill, index: number): SkillSetup {
  if (typeof entry === "string") {
    return {
      id: randomUUID(),
      label: `Skill ${index + 1}`,
      mainSkill: entry,
      mainSkillGemId: entry,
      supports: [],
    };
  }
  return {
    id: randomUUID(),
    label: entry.additional_text ? `Skill ${index + 1}` : `Skill ${index + 1}`,
    mainSkill: entry.id,
    mainSkillGemId: entry.id,
    supports: (entry.support_skills ?? []).map(toSupportGem),
  };
}

function toItem(slot: {
  inventory_id: string;
  unique_name?: string;
  additional_text?: string;
}): Item {
  const mapped = INVENTORY_TO_SLOT[slot.inventory_id];
  return {
    id: randomUUID(),
    name: slot.unique_name ?? slot.inventory_id,
    // El formato oficial no almacena la base del objeto: solo pistas de texto.
    baseType: "No verificado",
    slot: mapped ?? "other",
    rarity: slot.unique_name ? "unique" : "other",
    modifiers: [],
    ...(slot.additional_text !== undefined ? { rawText: slot.additional_text } : {}),
    sources: [
      {
        kind: "ggg",
        label: "Archivo .build oficial (GGG Build Planner v1)",
        retrievedAt: new Date().toISOString(),
      },
    ],
  };
}

export function importGggBuildPlanner(
  build: GggBuildPlannerV1,
  defaults: { league: string; patch: string },
): GggImportResult {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  warnings.push(
    "El formato oficial .build NO almacena nivel, liga, parche, atributos, resistencias ni vida: " +
      "quedan desconocidos y debes completarlos manualmente (se asume nivel 1 y la liga/parche por defecto de la app).",
  );
  if ((build.passives ?? []).length > 0 || (build.skills ?? []).length > 0) {
    warnings.push(
      "Los nombres visibles de pasivas y skills no son resolubles desde sus ids oficiales sin datos del juego: " +
        "se usa el id como referencia (nombre no verificado).",
    );
  }
  if ((build.inventory_slots ?? []).length > 0) {
    warnings.push(
      "Los inventory_slots del formato oficial son solo pistas de texto: se importan como objetos sin mods ni base verificada.",
    );
  }

  const profile: CharacterProfile = {
    id: randomUUID(),
    name: build.name,
    // No hay mapeo documentado ascendancy → clase: no inventamos.
    characterClass: "Desconocida",
    ...(build.ascendancy !== undefined ? { ascendancy: build.ascendancy } : {}),
    level: 1, // desconocido en el formato oficial; el usuario debe corregirlo
    archetype: "mercenary-crossbow",
    league: defaults.league,
    patch: defaults.patch,
    items: (build.inventory_slots ?? []).map(toItem),
    skills: (build.skills ?? []).map(toSkillSetup),
    passives: { allocated: (build.passives ?? []).map(toPassiveNode) },
    attributes: { str: null, dex: null, int: null },
    resistances: { fire: null, cold: null, lightning: null, chaos: null },
    ...(build.description !== undefined ? { notes: build.description } : {}),
    sources: [
      {
        kind: "ggg",
        label: "Archivo .build oficial (GGG Build Planner v1)",
        retrievedAt: now,
      },
    ],
    importedAt: now,
  };

  return { profile, warnings };
}
