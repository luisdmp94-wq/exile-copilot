import { z } from "zod";
import {
  AttributesSchema,
  ItemSchema,
  PassiveSelectionSchema,
  ResistancesSchema,
  SkillSetupSchema,
} from "./domain.js";

/**
 * Formato de archivo `.build` de Exile Copilot (formatVersion 1).
 *
 * SUPUESTO DOCUMENTADO: GGG no publica un esquema formal y estable del
 * archivo `.build` de PoE2. Este esquema JSON versionado es el formato
 * propio de la aplicación. El importador es tolerante: acepta este esquema,
 * variantes parciales (campos ausentes se rellenan con valores por defecto)
 * y códigos de Path of Building (vía adaptador).
 */
export const BuildFileSchema = z.object({
  formatVersion: z.literal(1),
  app: z.string().default("exile-copilot"),
  exportedAt: z.string().optional(), // ISO 8601
  patch: z.string(),
  league: z.string(),
  character: z.object({
    name: z.string(),
    class: z.string(),
    ascendancy: z.string().optional(),
    level: z.number().int().min(1).max(100),
    archetype: z.string().optional(),
    attributes: AttributesSchema.optional(),
    resistances: ResistancesSchema.optional(),
    life: z.number().int().optional(),
    energyShield: z.number().int().optional(),
    evasion: z.number().int().optional(),
    armour: z.number().int().optional(),
  }),
  items: z.array(ItemSchema).default([]),
  skills: z.array(SkillSetupSchema).default([]),
  passives: PassiveSelectionSchema.default({ allocated: [] }),
  appliedRecommendations: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type BuildFile = z.infer<typeof BuildFileSchema>;

export const BUILD_FILE_FORMAT_VERSION = 1 as const;
