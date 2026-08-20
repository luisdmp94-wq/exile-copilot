import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  PassiveRegistrySchema,
  type PassiveRegistry,
  type PlanResolution,
  type RegistrySourceSummary,
  type ResolvedAscendancy,
  type ResolvedPassive,
} from "../../shared/passiveRegistry.js";
import type { GggBuildPlannerV1 } from "../../shared/gggBuildPlanner.js";

/**
 * Servicio de SOLO LECTURA del registro de pasivas y ascendencias.
 *
 * - Carga perezosa y cacheada del artefacto versionado; cero red en runtime.
 * - Valida el registro con su esquema estricto: si el artefacto no cumple,
 *   falla de forma explícita en lugar de resolver a medias.
 * - Un id desconocido devuelve SIEMPRE un resultado explícito no verificado
 *   con el id crudo intacto. El nombre jamás se deduce del texto del id.
 */

/**
 * Artefacto activo. El nombre lleva el commit de origen (no un parche del
 * juego): al fijar una revisión nueva se cambia aquí de forma consciente.
 */
const REGISTRY_FILE = "passiveRegistry.1e9eb2d8.json";

let cached: {
  registry: PassiveRegistry;
  nodesById: Map<string, PassiveRegistry["nodes"][number]>;
  ascendanciesById: Map<string, PassiveRegistry["ascendancies"][number]>;
} | null = null;

function load(): NonNullable<typeof cached> {
  if (cached !== null) return cached;

  const path = fileURLToPath(new URL(`../data/passives/${REGISTRY_FILE}`, import.meta.url));
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(
      `No se pudo leer el registro de pasivas (${REGISTRY_FILE}). ` +
        `Regenéralo con "npx tsx scripts/build-passive-registry.ts". Detalle: ` +
        (err instanceof Error ? err.message : String(err)),
    );
  }

  const parsed = PassiveRegistrySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
      .join("; ");
    throw new Error(`El registro de pasivas no cumple su esquema estricto: ${detail}`);
  }

  const registry = parsed.data;
  cached = {
    registry,
    nodesById: new Map(registry.nodes.map((n) => [n.id, n])),
    ascendanciesById: new Map(registry.ascendancies.map((a) => [a.id, a])),
  };
  return cached;
}

/** Procedencia resumida del registro (para la UI y los informes). */
export function getRegistrySource(): RegistrySourceSummary {
  const { registry } = load();
  const p = registry.provenance;
  return {
    sourceRepository: p.sourceRepository,
    sourceCommit: p.sourceCommit,
    testedAgainstPatch: p.testedAgainstPatch,
    dataOwner: p.dataOwner,
    license: p.license,
  };
}

/** Procedencia completa (auditoría). */
export function getRegistryProvenance(): PassiveRegistry["provenance"] {
  return load().registry.provenance;
}

/**
 * Id de PassiveSkills → nombre inglés oficial verificado.
 * Desconocido → `{ verified: false, name: null }` con el id crudo intacto.
 */
export function resolvePassive(id: string): ResolvedPassive {
  const node = load().nodesById.get(id);
  if (node === undefined) {
    return { id, name: null, verified: false, stats: [], nodeType: null, ascendancyId: null };
  }
  return {
    id: node.id,
    name: node.name,
    verified: true,
    stats: [...node.stats],
    nodeType: node.nodeType,
    ascendancyId: node.ascendancyId,
  };
}

/**
 * Id de ascendencia → nombre oficial y clase verificados.
 * La fuente publica algunas ascendencias sin nombre (`name: null`): en ese caso
 * la clase sí se verifica pero el nombre queda como desconocido.
 */
export function resolveAscendancy(id: string): ResolvedAscendancy {
  const asc = load().ascendanciesById.get(id);
  if (asc === undefined) {
    return { id, name: null, className: null, verified: false };
  }
  return {
    id: asc.id,
    name: asc.name,
    className: asc.className,
    // Sin nombre publicado no se puede dar por resuelto el nombre visible.
    verified: asc.name !== null,
  };
}

/**
 * Resuelve los identificadores de un `.build` oficial. NO modifica el plan:
 * devuelve una estructura paralela con el id crudo siempre presente.
 */
export function resolvePlan(build: GggBuildPlannerV1): PlanResolution {
  const passives = (build.passives ?? []).map((entry) =>
    resolvePassive(typeof entry === "string" ? entry : entry.id),
  );
  return {
    ascendancy: build.ascendancy !== undefined ? resolveAscendancy(build.ascendancy) : null,
    passives,
    resolvedCount: passives.filter((p) => p.verified).length,
    totalCount: passives.length,
    source: getRegistrySource(),
  };
}

/** Solo para tests: fuerza una recarga del artefacto. */
export function resetRegistryCacheForTests(): void {
  cached = null;
}
