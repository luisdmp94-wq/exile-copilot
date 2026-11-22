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
 * Artefactos versionados, el más reciente primero. El nombre lleva el commit
 * de origen (no un parche del juego). Se conservan varios a la vez para que
 * un parche nuevo pueda prepararse antes de cambiar `DEFAULT_PATCH`: cada
 * parche solo resuelve con el registro probado contra él y autorizado por su
 * cobertura. Al fijar una revisión nueva se añade aquí de forma consciente.
 */
const REGISTRY_FILES = [
  { file: "passiveRegistry.bd87e651.json", evidenceId: "passive-registry.bd87e651" },
  { file: "passiveRegistry.1e9eb2d8.json", evidenceId: "passiveRegistry.1e9eb2d8" },
] as const;
/** Registro más reciente: el que audita `readiness` para el parche objetivo. */
export const PASSIVE_REGISTRY_EVIDENCE_ID: string = REGISTRY_FILES[0].evidenceId;

interface LoadedRegistry {
  registry: PassiveRegistry;
  nodesById: Map<string, PassiveRegistry["nodes"][number]>;
  ascendanciesById: Map<string, PassiveRegistry["ascendancies"][number]>;
}

const cache = new Map<string, LoadedRegistry>();

function load(evidenceId: string = PASSIVE_REGISTRY_EVIDENCE_ID): LoadedRegistry {
  const hit = cache.get(evidenceId);
  if (hit !== undefined) return hit;
  const entry = REGISTRY_FILES.find((candidate) => candidate.evidenceId === evidenceId);
  if (entry === undefined) {
    throw new Error(`No hay ningún registro de pasivas con la evidencia ${evidenceId}.`);
  }
  const REGISTRY_FILE = entry.file;

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
  const loaded: LoadedRegistry = {
    registry,
    nodesById: new Map(registry.nodes.map((n) => [n.id, n])),
    ascendanciesById: new Map(registry.ascendancies.map((a) => [a.id, a])),
  };
  cache.set(evidenceId, loaded);
  return loaded;
}

/**
 * Registro que puede resolver un parche: probado dentro del propio artefacto
 * contra ese parche y con su id de evidencia autorizado por la cobertura.
 */
function registryEvidenceForPatch(
  patch: string,
  authorizedEvidenceIds: readonly string[],
): string | null {
  for (const entry of REGISTRY_FILES) {
    if (!authorizedEvidenceIds.includes(entry.evidenceId)) continue;
    if (load(entry.evidenceId).registry.provenance.testedAgainstPatch === patch) {
      return entry.evidenceId;
    }
  }
  return null;
}

/** Procedencia resumida del registro (para la UI y los informes). */
export function getRegistrySource(
  evidenceId: string = PASSIVE_REGISTRY_EVIDENCE_ID,
): RegistrySourceSummary {
  const { registry } = load(evidenceId);
  const p = registry.provenance;
  return {
    game: registry.game,
    sourceRepository: p.sourceRepository,
    sourceCommit: p.sourceCommit,
    testedAgainstPatch: p.testedAgainstPatch,
    dataOwner: p.dataOwner,
    license: p.license,
  };
}

/** Procedencia completa (auditoría). */
export function getRegistryProvenance(
  evidenceId: string = PASSIVE_REGISTRY_EVIDENCE_ID,
): PassiveRegistry["provenance"] {
  return load(evidenceId).registry.provenance;
}

/**
 * El artefacto solo puede resolver nombres cuando coinciden tanto el parche
 * probado dentro del propio registro como su id de evidencia autorizado.
 */
export function registrySupportsPatch(
  patch: string,
  authorizedEvidenceIds: readonly string[],
): boolean {
  return registryEvidenceForPatch(patch, authorizedEvidenceIds) !== null;
}

/**
 * Id de PassiveSkills → nombre inglés oficial verificado.
 * Desconocido → `{ verified: false, name: null }` con el id crudo intacto.
 */
export function resolvePassive(
  id: string,
  evidenceId: string = PASSIVE_REGISTRY_EVIDENCE_ID,
): ResolvedPassive {
  const node = load(evidenceId).nodesById.get(id);
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
export function resolveAscendancy(
  id: string,
  evidenceId: string = PASSIVE_REGISTRY_EVIDENCE_ID,
): ResolvedAscendancy {
  const asc = load(evidenceId).ascendanciesById.get(id);
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
export function resolvePlan(
  build: GggBuildPlannerV1,
  patch?: string,
  authorizedEvidenceIds?: readonly string[],
): PlanResolution {
  const evidenceId =
    patch !== undefined && authorizedEvidenceIds !== undefined
      ? registryEvidenceForPatch(patch, authorizedEvidenceIds) ?? PASSIVE_REGISTRY_EVIDENCE_ID
      : PASSIVE_REGISTRY_EVIDENCE_ID;
  const passives = (build.passives ?? []).map((entry) =>
    resolvePassive(typeof entry === "string" ? entry : entry.id, evidenceId),
  );
  return {
    ascendancy:
      build.ascendancy !== undefined ? resolveAscendancy(build.ascendancy, evidenceId) : null,
    passives,
    resolvedCount: passives.filter((p) => p.verified).length,
    totalCount: passives.length,
    source: getRegistrySource(evidenceId),
  };
}

/** Solo para tests: fuerza una recarga del artefacto. */
export function resetRegistryCacheForTests(): void {
  cache.clear();
}
