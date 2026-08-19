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

const LevelIntervalSchema = z.union([
  z.number().int().nonnegative(),
  z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]),
]);

/** BuildPassive: pasiva del árbol. `id` es un id de la tabla PassiveSkills (p. ej. "strength89"). */
export const GggBuildPassiveSchema = z.object({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  weapon_set: z.number().int().min(0).max(2).optional(),
  additional_text: z.string().optional(),
});
export type GggBuildPassive = z.infer<typeof GggBuildPassiveSchema>;

/** BuildSupport: support de una skill. `id` es un id de BaseItemTypes (p. ej. "Metadata/Items/Gems/SupportGemFastForward"). */
export const GggBuildSupportSchema = z.object({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  additional_text: z.string().optional(),
});
export type GggBuildSupport = z.infer<typeof GggBuildSupportSchema>;

/** BuildSkill: skill del build. `id` es un id de BaseItemTypes (p. ej. "Metadata/Items/Gems/SkillGemEarthquake"). */
export const GggBuildSkillSchema = z.object({
  id: z.string(),
  level_interval: LevelIntervalSchema.optional(),
  additional_text: z.string().optional(),
  support_skills: z
    .array(z.union([z.string(), GggBuildSupportSchema]))
    .optional(),
});
export type GggBuildSkill = z.infer<typeof GggBuildSkillSchema>;

/** BuildInventorySlot: pista sobre un hueco de inventario. `inventory_id` es un id de Inventories (p. ej. "Weapon1"). */
export const GggBuildInventorySlotSchema = z.object({
  inventory_id: z.string(),
  slot_x: z.number().int().nonnegative().optional(),
  slot_y: z.number().int().nonnegative().optional(),
  level_interval: LevelIntervalSchema.optional(),
  unique_name: z.string().optional(),
  additional_text: z.string().optional(),
});
export type GggBuildInventorySlot = z.infer<typeof GggBuildInventorySlotSchema>;

/** Build: objeto raíz del archivo `.build` oficial. */
export const GggBuildPlannerV1Schema = z.object({
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
