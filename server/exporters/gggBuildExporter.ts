import {
  GggBuildPlannerV1Schema,
  type ExportReport,
  type GggBuildInventorySlot,
  type GggBuildPassive,
  type GggBuildPlannerV1,
  type GggBuildSkill,
} from "../../shared/gggBuildPlanner.js";
import type { BuildTarget, CharacterProfile, ItemSlot } from "../../shared/domain.js";

/**
 * Exportador al formato OFICIAL `.build` (GGG Build Planner v1).
 *
 * Principio rector: el informe (`report`) es la verdad. NUNCA se promete
 * round-trip sin pérdida: el formato oficial no puede almacenar nivel, liga,
 * parche, atributos, resistencias, vida/defensas, mods concretos de objetos,
 * presupuesto ni objetivo. Solo se exportan pasivas con id oficial
 * (`isOfficialId`), skills con `mainSkillGemId` y supports con `gemId`;
 * el resto va a `report.skippedUnverified`.
 */

export interface GggExportResult {
  fileName: string;
  content: string;
  report: ExportReport;
}

/** slot interno → inventory_id de la tabla Inventories (ids del ejemplo oficial de GGG). */
const SLOT_TO_INVENTORY: Partial<Record<ItemSlot, string>> = {
  weapon: "Weapon1",
  helmet: "Helm1",
  body: "BodyArmour1",
  gloves: "Gloves1",
  boots: "Boots1",
  belt: "Belt1",
  amulet: "Amulet1",
  ring1: "Ring1",
  ring2: "Ring2",
};

function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return `${cleaned.length > 0 ? cleaned : "exile-copilot-build"}.build`;
}

export function exportGggBuild(
  profile: CharacterProfile,
  target?: BuildTarget,
): GggExportResult {
  const skippedUnverified: string[] = [];

  // Pasivas: solo ids oficiales de PassiveSkills.
  const passives: Array<string | GggBuildPassive> = [];
  for (const node of profile.passives.allocated) {
    if (!node.isOfficialId) {
      skippedUnverified.push(
        `Pasiva "${node.ref}" sin id oficial de PassiveSkills (nombre no verificado).`,
      );
      continue;
    }
    if (node.additionalText !== undefined) {
      passives.push({ id: node.ref, additional_text: node.additionalText });
    } else {
      passives.push(node.ref);
    }
  }

  // Skills: solo gemas con id oficial de BaseItemTypes.
  const skills: GggBuildSkill[] = [];
  for (const skill of profile.skills) {
    if (skill.mainSkillGemId === null) {
      skippedUnverified.push(
        `Skill "${skill.mainSkill}" sin id oficial de BaseItemTypes (mainSkillGemId null).`,
      );
      continue;
    }
    const supports: string[] = [];
    for (const support of skill.supports) {
      if (support.gemId === null) {
        skippedUnverified.push(
          `Support "${support.name}" de "${skill.mainSkill}" sin id oficial (gemId null).`,
        );
        continue;
      }
      supports.push(support.gemId);
    }
    const entry: GggBuildSkill = { id: skill.mainSkillGemId };
    if (supports.length > 0) entry.support_skills = supports;
    skills.push(entry);
  }

  // Inventory slots: pistas de texto por hueco (el formato no guarda mods).
  const inventorySlots: GggBuildInventorySlot[] = [];
  for (const item of profile.items) {
    const inventoryId = SLOT_TO_INVENTORY[item.slot];
    if (!inventoryId) continue;
    const slot: GggBuildInventorySlot = {
      inventory_id: inventoryId,
      additional_text: `${item.name} (${item.baseType}) — pista generada por Exile Copilot; los mods concretos no son exportables al formato oficial.`,
    };
    if (item.rarity === "unique") slot.unique_name = item.name;
    inventorySlots.push(slot);
  }

  const build: GggBuildPlannerV1 = {
    name: profile.name,
    author: "Exile Copilot",
    ...(target?.sourceUrl !== undefined ? { link: target.sourceUrl } : {}),
    ...(target?.summary !== undefined ? { description: target.summary } : {}),
    ...(profile.ascendancy !== undefined ? { ascendancy: profile.ascendancy } : {}),
    ...(passives.length > 0 ? { passives } : {}),
    ...(skills.length > 0 ? { skills } : {}),
    ...(inventorySlots.length > 0 ? { inventory_slots: inventorySlots } : {}),
  };

  // Validación defensiva contra el esquema oficial antes de devolver.
  const validated = GggBuildPlannerV1Schema.parse(build);

  const report: ExportReport = {
    exported: {
      name: true,
      ascendancy: profile.ascendancy !== undefined,
      passives: passives.length,
      skills: skills.length,
      inventorySlots: inventorySlots.length,
    },
    notExportable: [
      "Nivel del personaje",
      "Liga y parche",
      "Atributos (str/dex/int)",
      "Resistencias (fire/cold/lightning/chaos)",
      "Vida y defensas (ES/evasión/armadura)",
      "Mods concretos, calidad y requisitos de los objetos (los inventory_slots solo son pistas de texto)",
      "Presupuesto y objetivo del jugador",
      "Recomendaciones aplicadas",
    ],
    skippedUnverified,
  };

  const fileName = sanitizeFileName(profile.name);
  return { fileName, content: JSON.stringify(validated, null, 2), report };
}
