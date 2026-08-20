import { z } from "zod";

/**
 * Registro interno de pasivas y ascendencias (Hito 4A).
 *
 * Se genera OFFLINE a partir del export oficial del árbol de pasivas de GGG
 * (grindinggear/poe2-skilltree-export) con `scripts/build-passive-registry.ts`.
 * En runtime NUNCA se descarga nada: la app solo lee el artefacto versionado.
 *
 * Solo se conserva lo necesario para resolver identificadores: id de
 * PassiveSkills, nombre inglés oficial, stats, tipo de nodo, ascendencia y
 * clases. No se copian sprites ni ningún recurso gráfico.
 *
 * Los esquemas de SALIDA son estrictos (`strictObject`): el formato es nuestro
 * y está bajo control, así que cualquier campo inesperado es un error, nunca
 * una degradación silenciosa.
 */

/** Tipo de nodo, cuando el export lo declara mediante sus flags. */
export const PassiveNodeType = z.enum([
  "keystone",
  "notable",
  "mastery",
  "jewel-socket",
  "ascendancy-start",
  "small",
]);
export type PassiveNodeType = z.infer<typeof PassiveNodeType>;

/**
 * Procedencia del registro. `testedAgainstPatch` es la compatibilidad que
 * NOSOTROS hemos probado, NO una versión que GGG afirme para estos datos:
 * el commit de origen se etiqueta con su propio mensaje (`sourceCommitMessage`).
 */
export const RegistryProvenanceSchema = z.strictObject({
  sourceRepository: z.string(),
  sourceUrl: z.string(),
  sourceFileUrl: z.string(),
  sourceCommit: z.string(),
  sourceCommitDate: z.string(),
  /** Mensaje del commit de origen (etiqueta de la propia fuente, p. ej. "0.5.2"). */
  sourceCommitMessage: z.string(),
  sourceFileSha256: z.string(),
  sourceFileBytes: z.number().int().positive(),
  retrievedAt: z.string(),
  dataOwner: z.literal("Grinding Gear Games"),
  /** null = no se encontró licencia explícita en el repositorio de origen. */
  license: z.string().nullable(),
  licenseNote: z.string(),
  /** Parche con el que se ha PROBADO la compatibilidad (no afirmado por la fuente). */
  testedAgainstPatch: z.string(),
  generatedBy: z.string(),
});
export type RegistryProvenance = z.infer<typeof RegistryProvenanceSchema>;

/** Entrada mínima de una pasiva: id oficial + nombre inglés + stats + tipo. */
export const RegistryNodeSchema = z.strictObject({
  /** Id de la tabla PassiveSkills, tal y como aparece en un `.build` oficial. */
  id: z.string().min(1),
  /** Nombre inglés oficial del export de GGG. */
  name: z.string(),
  stats: z.array(z.string()),
  nodeType: PassiveNodeType,
  /** Ascendencia a la que pertenece el nodo, si es un nodo de ascendencia. */
  ascendancyId: z.string().nullable(),
});
export type RegistryNode = z.infer<typeof RegistryNodeSchema>;

/** Ascendencia y su relación con la clase. `name: null` = la fuente no lo publica. */
export const RegistryAscendancySchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().nullable(),
  className: z.string(),
});
export type RegistryAscendancy = z.infer<typeof RegistryAscendancySchema>;

export const RegistryClassSchema = z.strictObject({
  name: z.string().min(1),
  ascendancyIds: z.array(z.string()),
});
export type RegistryClass = z.infer<typeof RegistryClassSchema>;

export const PassiveRegistrySchema = z.strictObject({
  /** Versión INTERNA del formato del registro (no la versión del juego). */
  registryVersion: z.literal(1),
  provenance: RegistryProvenanceSchema,
  classes: z.array(RegistryClassSchema).min(1),
  ascendancies: z.array(RegistryAscendancySchema).min(1),
  nodes: z.array(RegistryNodeSchema).min(1),
});
export type PassiveRegistry = z.infer<typeof PassiveRegistrySchema>;

// ---------------------------------------------------------------------------
// Resultados de resolución (contrato de lectura)
// ---------------------------------------------------------------------------

/**
 * Resolución de un id de pasiva. El id CRUDO siempre está disponible, resuelto
 * o no. `verified: false` significa "No verificado": el id no está en el
 * registro y su nombre NUNCA se deduce del propio texto del id.
 */
export const ResolvedPassiveSchema = z.strictObject({
  id: z.string(),
  name: z.string().nullable(),
  verified: z.boolean(),
  stats: z.array(z.string()),
  nodeType: PassiveNodeType.nullable(),
  ascendancyId: z.string().nullable(),
});
export type ResolvedPassive = z.infer<typeof ResolvedPassiveSchema>;

/** Resolución de un id de ascendencia a nombre oficial y clase. */
export const ResolvedAscendancySchema = z.strictObject({
  id: z.string(),
  name: z.string().nullable(),
  className: z.string().nullable(),
  verified: z.boolean(),
});
export type ResolvedAscendancy = z.infer<typeof ResolvedAscendancySchema>;

/** Resumen de procedencia que viaja al frontend (sin cargar todo el registro). */
export const RegistrySourceSummarySchema = z.strictObject({
  sourceRepository: z.string(),
  sourceCommit: z.string(),
  testedAgainstPatch: z.string(),
  dataOwner: z.literal("Grinding Gear Games"),
  license: z.string().nullable(),
});
export type RegistrySourceSummary = z.infer<typeof RegistrySourceSummarySchema>;

/** Resolución completa de un BuildTargetPlan (paralela al plan, nunca dentro). */
export const PlanResolutionSchema = z.strictObject({
  ascendancy: ResolvedAscendancySchema.nullable(),
  passives: z.array(ResolvedPassiveSchema),
  /** Cuántas pasivas del plan se resolvieron contra el registro. */
  resolvedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  source: RegistrySourceSummarySchema,
});
export type PlanResolution = z.infer<typeof PlanResolutionSchema>;

/**
 * Aviso obligatorio de GGG para productos de terceros que usan sus datos.
 * Debe mostrarse de forma visible en la interfaz.
 */
export const GGG_AFFILIATION_NOTICE =
  "This product isn't affiliated with or endorsed by Grinding Gear Games in any way.";
