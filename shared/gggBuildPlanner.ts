import { z } from "zod";

/**
 * Esquema oficial del Build Planner de GGG para PoE2 — versión 1 (Experimental).
 * Fuente: https://www.pathofexile.com/developer/docs/game (consultado 2026-08-19).
 *
 * Un archivo `.build` es JSON con un único objeto Build.
 * IMPORTANTE: el formato oficial NO puede almacenar nivel, liga, atributos,
 * resistencias, vida, defensas, presupuesto ni mods concretos de objetos
 * (solo pistas de texto por hueco de inventario). Todo eso vive en el
 * CharacterProfileSnapshot interno y se informa como no exportable.
 */

/** Doc oficial: "?(array of uint, or uint)" — un uint o un array de uint (longitud no restringida). */
const LevelIntervalSchema = z.union([
  z.number().int().nonnegative(),
  z.array(z.number().int().nonnegative()),
]);

/**
 * Los objetos del esquema son "loose" (conservan campos no documentados):
 * un `.build` con campos que el esquema v1 no documenta se importa y se
 * reexporta sin pérdida silenciosa; el importador los declara en warnings.
 */

/** BuildPassive: pasiva del árbol. `id` es un id de la tabla PassiveSkills (p. ej. "strength89"). */
export const GggBuildPassiveSchema = z.looseObject({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  /** Doc oficial: "a weapon set index between 0 and 2 (inclusive)". */
  weapon_set: z.number().int().min(0).max(2).optional(),
  additional_text: z.string().optional(),
});
export type GggBuildPassive = z.infer<typeof GggBuildPassiveSchema>;

/** BuildSupport: support de una skill. `id` es un id de BaseItemTypes (p. ej. "Metadata/Items/Gems/SupportGemFastForward"). */
export const GggBuildSupportSchema = z.looseObject({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  additional_text: z.string().optional(),
});
export type GggBuildSupport = z.infer<typeof GggBuildSupportSchema>;

/** BuildSkill: skill del build. `id` es un id de BaseItemTypes (p. ej. "Metadata/Items/Gems/SkillGemEarthquake"). */
export const GggBuildSkillSchema = z.looseObject({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  additional_text: z.string().optional(),
  support_skills: z
    .array(z.union([z.string(), GggBuildSupportSchema]))
    .optional(),
});
export type GggBuildSkill = z.infer<typeof GggBuildSkillSchema>;

/** BuildInventorySlot: pista sobre un hueco de inventario. `inventory_id` es un id de Inventories (p. ej. "Weapon1"). */
export const GggBuildInventorySlotSchema = z.looseObject({
  inventory_id: z.string(),
  slot_x: z.number().int().nonnegative().optional(),
  slot_y: z.number().int().nonnegative().optional(),
  level_interval: LevelIntervalSchema.optional(),
  unique_name: z.string().optional(),
  additional_text: z.string().optional(),
});
export type GggBuildInventorySlot = z.infer<typeof GggBuildInventorySlotSchema>;

/** Build: objeto raíz del archivo `.build` oficial. */
export const GggBuildPlannerV1Schema = z.looseObject({
  name: z.string(),
  author: z.string().optional(),
  link: z.string().optional(),
  description: z.string().optional(),
  ascendancy: z.string().optional(),
  passives: z
    .array(z.union([z.string(), GggBuildPassiveSchema]))
    .optional(),
  skills: z.array(z.union([z.string(), GggBuildSkillSchema])).optional(),
  inventory_slots: z.array(GggBuildInventorySlotSchema).optional(),
});
export type GggBuildPlannerV1 = z.infer<typeof GggBuildPlannerV1Schema>;

export const GGG_BUILD_PLANNER_VERSION = 1 as const;

/**
 * Plan objetivo importado: un `.build` oficial de GGG es un PLAN/instructor,
 * NO una captura del personaje equipado. Se conserva el objeto oficial crudo
 * para reexportarlo con fidelidad (level_interval, weapon_set, additional_text,
 * coordenadas, author, link…).
 */
export const BuildTargetPlanSchema = z.object({
  build: GggBuildPlannerV1Schema,
  importedAt: z.string(), // ISO 8601
  sourceUrl: z.string().optional(),
});
export type BuildTargetPlan = z.infer<typeof BuildTargetPlanSchema>;

/**
 * Informe de exportación: qué se pudo exportar al formato oficial y qué
 * información del snapshot interno NO puede representarse en Build Planner v1.
 */
export const ExportReportSchema = z.object({
  exported: z.object({
    name: z.boolean(),
    ascendancy: z.boolean(),
    passives: z.number().int(),
    skills: z.number().int(),
    inventorySlots: z.number().int(),
  }),
  /** Campos del snapshot que el formato oficial NO puede almacenar. */
  notExportable: z.array(z.string()),
  /** Elementos que sí caben en el formato pero no se exportaron por falta de id oficial verificable. */
  skippedUnverified: z.array(z.string()),
});
export type ExportReport = z.infer<typeof ExportReportSchema>;
