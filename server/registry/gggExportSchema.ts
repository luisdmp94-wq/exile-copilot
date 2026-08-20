import { z } from "zod";

/**
 * Esquema de ENTRADA del export oficial del árbol de pasivas de PoE2.
 * Fuente: https://github.com/grindinggear/poe2-skilltree-export (`data.json`).
 *
 * Se usa SOLO en el proceso offline de generación del registro
 * (`scripts/build-passive-registry.ts`), nunca en runtime.
 *
 * Criterio de rigor: cada campo que consumimos está tipado exactamente y es
 * obligatorio donde la fuente garantiza que existe; los campos que NO
 * consumimos (iconos, coordenadas, aristas…) se descartan sin fallar, porque
 * GGG añade campos con frecuencia y romper por eso no protegería nada. Lo que
 * sí falla ruidosamente es cualquier cambio en la estructura de la que
 * dependemos, más los invariantes verificados en `assertExportInvariants`.
 */

/**
 * Nodo del export. `id` es el identificador de PassiveSkills que aparece en un
 * `.build` oficial; puede ser `null` (marcadores vacíos de ascendencias
 * heredadas) o faltar (nodo raíz del árbol): en ambos casos NO es una pasiva
 * direccionable y queda fuera del registro.
 */
export const GggExportNodeSchema = z.object({
  id: z.string().nullable().optional(),
  skill: z.number().int().optional(),
  name: z.string().optional(),
  stats: z.array(z.string()).optional(),
  ascendancyId: z.string().optional(),
  isNotable: z.boolean().optional(),
  isKeystone: z.boolean().optional(),
  isMastery: z.boolean().optional(),
  isJewelSocket: z.boolean().optional(),
  isAscendancyStart: z.boolean().optional(),
});
export type GggExportNode = z.infer<typeof GggExportNodeSchema>;

/** Ascendencia declarada dentro de una clase. `name` puede ser null en la fuente. */
export const GggExportAscendancySchema = z.object({
  id: z.string().min(1),
  name: z.string().nullable().optional(),
});

export const GggExportClassSchema = z.object({
  name: z.string().min(1),
  ascendancies: z.array(GggExportAscendancySchema).optional(),
});

export const GggSkillTreeExportSchema = z.object({
  classes: z.array(GggExportClassSchema).min(1),
  nodes: z.record(z.string(), GggExportNodeSchema),
});
export type GggSkillTreeExport = z.infer<typeof GggSkillTreeExportSchema>;

/** Mínimos defendibles: si la fuente encoge de golpe, algo ha cambiado de verdad. */
export const MIN_EXPECTED_NODES = 1000;
export const MIN_EXPECTED_CLASSES = 5;

/**
 * Invariantes que el export debe cumplir para poder derivar un registro fiable.
 * Falla con un mensaje claro en lugar de degradarse en silencio.
 */
export function assertExportInvariants(data: GggSkillTreeExport): void {
  const nodeKeys = Object.keys(data.nodes);
  if (nodeKeys.length < MIN_EXPECTED_NODES) {
    throw new Error(
      `Export inesperado: ${nodeKeys.length} nodos (se esperaban al menos ${MIN_EXPECTED_NODES}). ` +
        "La estructura oficial puede haber cambiado; revisa el export antes de regenerar el registro.",
    );
  }
  if (data.classes.length < MIN_EXPECTED_CLASSES) {
    throw new Error(
      `Export inesperado: ${data.classes.length} clases (se esperaban al menos ${MIN_EXPECTED_CLASSES}).`,
    );
  }

  const seen = new Set<string>();
  let addressable = 0;
  for (const key of nodeKeys) {
    const node = data.nodes[key];
    if (node === undefined || typeof node.id !== "string" || node.id.length === 0) continue;
    addressable += 1;
    if (seen.has(node.id)) {
      throw new Error(
        `Export inesperado: id de PassiveSkills duplicado "${node.id}". ` +
          "El registro exige ids únicos para resolver sin ambigüedad.",
      );
    }
    seen.add(node.id);
    if (typeof node.name !== "string") {
      throw new Error(
        `Export inesperado: el nodo "${node.id}" no trae "name" (string). ` +
          "No se inventan nombres: el proceso se detiene.",
      );
    }
    if (!Array.isArray(node.stats)) {
      throw new Error(`Export inesperado: el nodo "${node.id}" no trae "stats" (array).`);
    }
  }
  if (addressable < MIN_EXPECTED_NODES) {
    throw new Error(
      `Export inesperado: solo ${addressable} nodos con id de PassiveSkills utilizable.`,
    );
  }
}
