import {
  GggBuildPlannerV1Schema,
  type ExportReport,
  type GggBuildInventorySlot,
  type GggBuildPassive,
  type GggBuildPlannerV1,
  type GggBuildSkill,
} from "../../shared/gggBuildPlanner.js";
import type { BuildTarget, CharacterProfile, ItemSlot } from "../../shared/domain.js";
import { RECOMMENDATION_LABELS, RECOMMENDATION_SLOT_HINTS } from "../engine/rules.js";

/**
 * Exportador al formato OFICIAL `.build` (GGG Build Planner v1).
 *
 * Principios:
 *  - El informe (`report`) es la verdad: nunca se promete round-trip sin
 *    pérdida. El resultado es "válido contra el esquema GGG", NUNCA
 *    "probado en el juego".
 *  - Fidelidad del plan: si `target.plan` existe, se parte del objeto oficial
 *    CRUDO importado y se preservan TODOS sus campos (author, link,
 *    level_interval, weapon_set, additional_text, slot_x/slot_y…). Lo que no
 *    se pueda preservar se lista en `report.skippedUnverified`.
 *  - `ascendancy` se escribe SOLO desde `profile.ascendancyId` (id oficial);
 *    el nombre visible nunca se escribe como id. `unique_name` solo se
 *    exporta si es una entrada verificada: sin tabla oficial disponible, por
 *    defecto NO se exporta y se reporta.
 *  - Las recomendaciones aplicadas se DESCARTAN como dato estructurado, pero
 *    se incluyen como texto legible en `description` ("Mejoras planificadas:
 *    1) … 2) …") y, cuando hay slot/skill relacionado, también en
 *    `additional_text`.
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

/** Texto legible de una recomendación aplicada ya validada. */
function recommendationLabel(recId: string): string {
  return RECOMMENDATION_LABELS[recId]!;
}

/** Sección legible en español con las mejoras planificadas. */
function plannedImprovementsText(appliedRecommendations: string[]): string {
  const lines = appliedRecommendations.map((id, i) => `${i + 1}) ${recommendationLabel(id)}`);
  return `Mejoras planificadas:\n${lines.join("\n")}`;
}

export function exportGggBuild(
  profile: CharacterProfile,
  target?: BuildTarget,
  appliedRecommendations: string[] = [],
): GggExportResult {
  const skippedUnverified: string[] = [];
  const exportableAppliedRecommendations = appliedRecommendations.filter((id) => {
    if (id.startsWith("rec-sesion-") || id.startsWith("rec-memoria-")) {
      skippedUnverified.push(
        `Recomendación aplicada "${id}" omitida: no es una mejora de juego exportable.`,
      );
      return false;
    }
    if (RECOMMENDATION_LABELS[id] !== undefined) return true;
    skippedUnverified.push(
      `Recomendación aplicada "${id}" omitida: no es una mejora de juego exportable con etiqueta verificada.`,
    );
    return false;
  });
  const plan = target?.plan ?? null;

  // --- Pasivas -------------------------------------------------------------
  // Con plan: se preservan CRUDAS del objeto oficial (fidelidad total).
  // Sin plan: solo pasivas del snapshot con id oficial verificado.
  let passives: Array<string | GggBuildPassive> | undefined;
  if (plan) {
    passives = plan.build.passives ? [...plan.build.passives] : undefined;
  } else {
    const out: Array<string | GggBuildPassive> = [];
    for (const node of profile.passives.allocated) {
      if (!node.isOfficialId) {
        skippedUnverified.push(
          `Pasiva "${node.ref}" sin id oficial de PassiveSkills (nombre no verificado).`,
        );
        continue;
      }
      if (node.additionalText !== undefined) {
        out.push({ id: node.ref, additional_text: node.additionalText });
      } else {
        out.push(node.ref);
      }
    }
    if (out.length > 0) passives = out;
  }

  // --- Skills --------------------------------------------------------------
  let skills: Array<string | GggBuildSkill> | undefined;
  if (plan) {
    // Copia por elemento: la anotación de mejoras nunca muta el plan de entrada.
    skills = plan.build.skills
      ? plan.build.skills.map((s) => (typeof s === "object" ? { ...s } : s))
      : undefined;
  } else {
    const out: GggBuildSkill[] = [];
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
      out.push(entry);
    }
    if (out.length > 0) skills = out;
  }

  // --- Inventory slots -------------------------------------------------------
  let inventorySlots: GggBuildInventorySlot[] | undefined;
  if (plan) {
    inventorySlots = plan.build.inventory_slots
      ? plan.build.inventory_slots.map((s) => ({ ...s }))
      : undefined;
  } else {
    const out: GggBuildInventorySlot[] = [];
    for (const item of profile.items) {
      const inventoryId = SLOT_TO_INVENTORY[item.slot];
      if (!inventoryId) continue;
      if (item.rarity === "unique") {
        // Sin tabla oficial de UniqueName disponible: por defecto NO se exporta.
        skippedUnverified.push(
          `unique_name "${item.name}" no exportado: no hay tabla oficial de UniqueName disponible para verificarlo.`,
        );
      }
      out.push({
        inventory_id: inventoryId,
        additional_text: `${item.name} (${item.baseType}) — pista generada por Exile Copilot; los mods concretos no son exportables al formato oficial.`,
      });
    }
    if (out.length > 0) inventorySlots = out;
  }

  // --- Recomendaciones aplicadas → texto legible -----------------------------
  if (exportableAppliedRecommendations.length > 0) {
    for (const recId of exportableAppliedRecommendations) {
      const hint = RECOMMENDATION_SLOT_HINTS[recId];
      if (!hint) continue; // sin mapeo: igualmente aparece en description
      const label = recommendationLabel(recId);
      if (hint.kind === "inventory" && inventorySlots) {
        const slot = inventorySlots.find((s) => s.inventory_id === hint.inventoryId);
        if (slot) {
          slot.additional_text = `${slot.additional_text ?? ""}\n\nMejora planificada: ${label}`.trim();
        }
      } else if (hint.kind === "skill" && skills && skills.length > 0) {
        const first = skills[0];
        if (typeof first === "object") {
          first.additional_text = `${first.additional_text ?? ""}\n\nMejora planificada: ${label}`.trim();
        }
      }
    }
  }

  // --- description: plan/target + mejoras planificadas -----------------------
  const descriptionParts: string[] = [];
  if (plan?.build.description) descriptionParts.push(plan.build.description);
  else if (target?.summary) descriptionParts.push(target.summary);
  if (exportableAppliedRecommendations.length > 0) {
    descriptionParts.push(plannedImprovementsText(exportableAppliedRecommendations));
  }

  // --- ascendancy: SOLO el id oficial (ascendancyId), nunca el nombre visible
  const ascendancyId = profile.ascendancyId ?? plan?.build.ascendancy;
  if (profile.ascendancy !== null && profile.ascendancyId === null) {
    skippedUnverified.push(
      `Ascendencia "${profile.ascendancy}" es solo un nombre visible sin id oficial: no se exporta como ascendancy.`,
    );
  }

  // Campos raíz NO documentados del plan importado: se conservan tal cual
  // (el esquema es loose); la reconstrucción del objeto raíz no debe perderlos.
  const DOCUMENTED_ROOT_KEYS = new Set([
    "name",
    "author",
    "link",
    "description",
    "ascendancy",
    "passives",
    "skills",
    "inventory_slots",
  ]);
  const extraRootFields = plan
    ? Object.fromEntries(
        Object.entries(plan.build).filter(([key]) => !DOCUMENTED_ROOT_KEYS.has(key)),
      )
    : {};

  const build: GggBuildPlannerV1 = {
    ...extraRootFields,
    name: plan?.build.name ?? profile.name,
    ...(plan?.build.author !== undefined
      ? { author: plan.build.author }
      : { author: "Exile Copilot" }),
    ...(plan?.build.link !== undefined
      ? { link: plan.build.link }
      : target?.sourceUrl !== undefined
        ? { link: target.sourceUrl }
        : {}),
    ...(descriptionParts.length > 0 ? { description: descriptionParts.join("\n\n") } : {}),
    ...(ascendancyId !== undefined && ascendancyId !== null ? { ascendancy: ascendancyId } : {}),
    ...(passives !== undefined ? { passives } : {}),
    ...(skills !== undefined ? { skills } : {}),
    ...(inventorySlots !== undefined ? { inventory_slots: inventorySlots } : {}),
  };

  // Validación defensiva: el resultado es "válido contra el esquema GGG".
  const validated = GggBuildPlannerV1Schema.parse(build);

  const report: ExportReport = {
    exported: {
      name: true,
      ascendancy: validated.ascendancy !== undefined,
      passives: validated.passives?.length ?? 0,
      skills: validated.skills?.length ?? 0,
      inventorySlots: validated.inventory_slots?.length ?? 0,
    },
    notExportable: [
      "Nivel del personaje",
      "Liga y parche",
      "Atributos (str/dex/int)",
      "Resistencias (fire/cold/lightning/chaos)",
      "Vida y defensas (ES/evasión/armadura)",
      "Mods concretos, calidad y requisitos de los objetos (los inventory_slots solo son pistas de texto)",
      "Presupuesto y objetivo del jugador",
      "Recomendaciones aplicadas como dato estructurado (se incluyen como texto legible en description/additional_text)",
    ],
    skippedUnverified,
  };

  const fileName = sanitizeFileName(validated.name);
  return { fileName, content: JSON.stringify(validated, null, 2), report };
}
