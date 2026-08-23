import { z } from "zod";

/**
 * Registro de conocimiento de crafting (capa de datos, no de motor).
 *
 * Este módulo NO calcula probabilidades, pesos efectivos ni resultados: solo
 * carga snapshots JSON versionados y responde, con rigor, qué se sabe y con qué
 * respaldo. La distinción que sostiene todo lo demás es:
 *
 *  - `verified-complete`  dato verificado Y demostrablemente exhaustivo;
 *  - `verified-partial`   dato verificado pero no exhaustivo;
 *  - `observed-only`      visto únicamente en capturas o textos del jugador;
 *  - `unavailable`        no disponible por ausencia de fuente o por bloqueo.
 *
 * Reglas duras del cargador:
 *  - un valor desconocido es `null`, jamás 0;
 *  - un campo con valor exige procedencia explícita;
 *  - `verified-complete` exige scope y pesos;
 *  - un snapshot parcial NUNCA entrega base para calcular probabilidad;
 *  - el nombre visible no es un identificador estable.
 */

/** Cómo se obtuvo el dato. Sin categorías que sugieran más rigor del real. */
export const ExtractionMethod = z.enum([
  /** Texto del propio cliente del juego, capturado por el jugador. */
  "in-game-tooltip",
  /** Texto de objeto copiado al portapapeles por el jugador. */
  "in-game-clipboard",
  /** Documentación publicada por Grinding Gear Games. */
  "official-documentation",
  /** Export oficial publicado por Grinding Gear Games. */
  "official-export",
  /** Artefacto derivado de los archivos del cliente por un tercero. */
  "third-party-client-extract",
  /** Redacción humana de un tercero (wiki, guía). */
  "third-party-editorial",
]);
export type ExtractionMethod = z.infer<typeof ExtractionMethod>;

export const Completeness = z.enum([
  "verified-complete",
  "verified-partial",
  "observed-only",
  "unavailable",
]);
export type Completeness = z.infer<typeof Completeness>;

const IsoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "fecha ISO inválida");

/**
 * Fuente citable. `redistributionAllowed: false` significa que sus datos NO
 * pueden copiarse a este repositorio, por mucho que sean accesibles.
 * `null` significa que los términos no se han podido determinar, que tampoco
 * autoriza a copiarlos.
 */
export const KnowledgeSourceSchema = z.strictObject({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  url: z.string().url().nullable(),
  consultedAt: IsoDate,
  /** Versión o parche al que corresponde la fuente; `null` si no lo declara. */
  version: z.string().min(1).max(60).nullable(),
  method: ExtractionMethod,
  /** Términos conocidos, citados o resumidos. `null` si no se han localizado. */
  terms: z.string().min(1).max(2000).nullable(),
  redistributionAllowed: z.boolean().nullable(),
  /** Huella del artefacto local cuando existe (sha256, prefijo estable). */
  fingerprint: z.string().min(8).max(128).nullable(),
  /** Qué extrae exactamente y qué riesgo introduce. */
  extracts: z.string().min(1).max(2000),
  risk: z.string().min(1).max(2000),
});
export type KnowledgeSource = z.infer<typeof KnowledgeSourceSchema>;

/** Procedencia de UN campo concreto. Sin esto, el campo no puede tener valor. */
export const FieldProvenanceSchema = z.strictObject({
  sourceId: z.string().min(1).max(80),
  method: ExtractionMethod,
  note: z.string().min(1).max(500).optional(),
});
export type FieldProvenance = z.infer<typeof FieldProvenanceSchema>;

/** Campos de un candidato que exigen procedencia cuando llevan valor. */
export const CANDIDATE_PROVENANCE_FIELDS = [
  "stableId",
  "displayName",
  "affixType",
  "modGroup",
  "tags",
  "minimumItemLevel",
  "weight",
] as const;
export type CandidateProvenanceField = (typeof CANDIDATE_PROVENANCE_FIELDS)[number];

export const ModCandidateSchema = z.strictObject({
  /**
   * Identificador interno del juego. `null` mientras no esté VERIFICADO: el
   * nombre visible no sirve como id y este registro no lo sustituye por uno
   * inventado.
   */
  stableId: z.string().min(1).max(120).nullable(),
  /** Texto mostrado. Nunca se usa como identidad. */
  displayName: z.string().min(1).max(300),
  affixType: z.enum(["prefix", "suffix"]).nullable(),
  modGroup: z.string().min(1).max(120).nullable(),
  tags: z.array(z.string().min(1).max(60)).nullable(),
  minimumItemLevel: z.number().int().min(1).max(200).nullable(),
  /**
   * Peso de aparición declarado por la fuente. `null` = desconocido.
   * `0` solo es admisible si la procedencia explica por qué (por ejemplo, una
   * exclusión por etiqueta), porque 0 y «no lo sé» no son lo mismo.
   */
  weight: z.number().int().min(0).nullable(),
  provenance: z.record(z.string(), FieldProvenanceSchema),
});
export type ModCandidate = z.infer<typeof ModCandidateSchema>;

/** Variante de moneda observada. `null` = el tooltip no muestra ese dato. */
export const ObservedVariantSchema = z.strictObject({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  minimumModifierLevel: z.number().int().min(1).max(200).nullable(),
  provenance: FieldProvenanceSchema,
});
export type ObservedVariant = z.infer<typeof ObservedVariantSchema>;

export const ObservedActionSchema = z.strictObject({
  id: z.string().min(1).max(60),
  /** Nombre localizado tal y como aparece en el cliente. */
  label: z.string().min(1).max(120),
  /** Nombre inglés mostrado entre paréntesis por el propio cliente. */
  labelEnglish: z.string().min(1).max(120).nullable(),
  targetRarity: z.enum(["normal", "magic", "rare"]),
  effect: z.string().min(1).max(500),
  /**
   * Máximo total de modificadores aleatorios que el tooltip declara para la
   * rareza resultante. `null` = el tooltip no lo declara.
   */
  declaredTotalLimit: z.number().int().min(1).max(20).nullable(),
  variants: z.array(ObservedVariantSchema).min(1),
  provenance: FieldProvenanceSchema,
});
export type ObservedAction = z.infer<typeof ObservedActionSchema>;

/**
 * Alcance del snapshot. `null` significa «sin acotar», que basta para material
 * observado pero NUNCA para `verified-complete`.
 */
export const SnapshotScopeSchema = z.strictObject({
  itemClasses: z.array(z.string().min(1).max(120)).min(1).nullable(),
  baseTypes: z.array(z.string().min(1).max(120)).min(1).nullable(),
});
export type SnapshotScope = z.infer<typeof SnapshotScopeSchema>;

export const CraftingKnowledgeSnapshotSchema = z
  .strictObject({
    snapshotId: z.string().min(1).max(120),
    game: z.literal("poe2"),
    /** Parche al que aplica. `null` = no se ha podido determinar. */
    patch: z.string().min(1).max(60).nullable(),
    /** Liga o ámbito de liga. `null` = no acotado a una liga concreta. */
    leagueScope: z.string().min(1).max(120).nullable(),
    asOf: IsoDate,
    completeness: Completeness,
    scope: SnapshotScopeSchema,
    sources: z.array(KnowledgeSourceSchema).min(1),
    modCandidates: z.array(ModCandidateSchema),
    observedActions: z.array(ObservedActionSchema),
    limitations: z.array(z.string().min(1).max(1000)),
    /**
     * Si el CONTENIDO de este snapshot puede redistribuirse. `null` = términos
     * indeterminados, que se trata igual que un no.
     */
    redistributionAllowed: z.boolean().nullable(),
  })
  .superRefine((snapshot, ctx) => {
    const fail = (message: string, path: (string | number)[] = []): void => {
      ctx.addIssue({ code: "custom", message, path });
    };

    const sourceIds = new Set(snapshot.sources.map((source) => source.id));
    const sourcesById = new Map(snapshot.sources.map((source) => [source.id, source]));
    if (sourceIds.size !== snapshot.sources.length) {
      fail("Hay ids de fuente duplicados.", ["sources"]);
    }

    const seenCandidateIds = new Set<string>();
    snapshot.modCandidates.forEach((candidate, index) => {
      const at = (field: string): (string | number)[] => ["modCandidates", index, field];

      if (candidate.stableId !== null) {
        if (seenCandidateIds.has(candidate.stableId)) {
          fail(`Candidato duplicado: ${candidate.stableId}`, at("stableId"));
        }
        seenCandidateIds.add(candidate.stableId);
      }

      // Todo campo CON valor exige procedencia; sin ella el dato no existe.
      for (const field of CANDIDATE_PROVENANCE_FIELDS) {
        const value = candidate[field];
        if (value === null || value === undefined) continue;
        const provenance = candidate.provenance[field];
        if (!provenance) {
          fail(`El campo «${field}» tiene valor pero no declara procedencia.`, at("provenance"));
          continue;
        }
        if (!sourceIds.has(provenance.sourceId)) {
          fail(
            `La procedencia de «${field}» cita una fuente que no está en sources: ${provenance.sourceId}.`,
            at("provenance"),
          );
        }
      }

      // 0 y «desconocido» no son lo mismo: un 0 debe estar justificado.
      if (candidate.weight === 0 && candidate.provenance.weight?.note === undefined) {
        fail(
          "Un peso 0 debe explicar en su procedencia por qué es 0 y no un valor desconocido.",
          at("weight"),
        );
      }
    });

    for (const action of snapshot.observedActions) {
      const ids = action.variants.map((variant) => variant.id);
      if (new Set(ids).size !== ids.length) {
        fail(`La acción ${action.id} repite ids de variante.`, ["observedActions"]);
      }
      for (const variant of action.variants) {
        if (!sourceIds.has(variant.provenance.sourceId)) {
          fail(
            `La variante ${variant.id} cita una fuente inexistente: ${variant.provenance.sourceId}.`,
            ["observedActions"],
          );
        }
      }
      if (!sourceIds.has(action.provenance.sourceId)) {
        fail(`La acción ${action.id} cita una fuente inexistente.`, ["observedActions"]);
      }
    }

    if (snapshot.completeness === "verified-complete") {
      if (snapshot.scope.itemClasses === null && snapshot.scope.baseTypes === null) {
        fail("«verified-complete» exige un scope declarado.", ["scope"]);
      }
      if (snapshot.modCandidates.length === 0) {
        fail("«verified-complete» sin candidatos no puede demostrar exhaustividad.", [
          "modCandidates",
        ]);
      }
      const missingWeight = snapshot.modCandidates.some(
        (candidate) => candidate.weight === null,
      );
      if (missingWeight) {
        fail("«verified-complete» exige peso en TODOS los candidatos.", ["modCandidates"]);
      }
      const totalWeight = snapshot.modCandidates.reduce(
        (sum, candidate) => sum + (candidate.weight ?? 0),
        0,
      );
      if (totalWeight <= 0) {
        fail("«verified-complete» exige al menos un peso positivo.", ["modCandidates"]);
      }
      if (snapshot.redistributionAllowed !== true) {
        fail(
          "«verified-complete» solo puede habilitar probabilidades con redistribución autorizada.",
          ["redistributionAllowed"],
        );
      }
      const blockedCandidateSource = snapshot.modCandidates
        .flatMap((candidate) => Object.values(candidate.provenance))
        .map((provenance) => sourcesById.get(provenance.sourceId))
        .find((source) => source?.redistributionAllowed !== true);
      if (blockedCandidateSource) {
        fail(
          `«verified-complete» cita una fuente sin redistribución autorizada: ${blockedCandidateSource.id}.`,
          ["sources"],
        );
      }
    }

    if (snapshot.completeness === "unavailable" && snapshot.modCandidates.length > 0) {
      fail("Un snapshot «unavailable» no puede aportar candidatos.", ["modCandidates"]);
    }
  });
export type CraftingKnowledgeSnapshot = z.infer<typeof CraftingKnowledgeSnapshotSchema>;

/** Comparador estable: misma entrada, misma salida, siempre. */
function compareCandidates(left: ModCandidate, right: ModCandidate): number {
  const affix = (candidate: ModCandidate): string => candidate.affixType ?? "~";
  return (
    affix(left).localeCompare(affix(right), "en") ||
    (left.modGroup ?? "~").localeCompare(right.modGroup ?? "~", "en") ||
    (left.stableId ?? "~").localeCompare(right.stableId ?? "~", "en") ||
    left.displayName.localeCompare(right.displayName, "en")
  );
}

export interface CraftingKnowledgeRegistry {
  readonly snapshots: readonly CraftingKnowledgeSnapshot[];
}

export class CraftingKnowledgeError extends Error {}

/**
 * Carga y valida snapshots. Rechaza cualquier cosa que no cumpla el contrato en
 * lugar de degradarla en silencio: un registro a medias es peor que ninguno.
 */
export function loadCraftingKnowledge(raw: readonly unknown[]): CraftingKnowledgeRegistry {
  const snapshots = raw.map((entry, index) => {
    const parsed = CraftingKnowledgeSnapshotSchema.safeParse(entry);
    if (!parsed.success) {
      const detail = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
        .join(" | ");
      throw new CraftingKnowledgeError(`Snapshot inválido en la posición ${index}: ${detail}`);
    }
    return parsed.data;
  });

  const ids = snapshots.map((snapshot) => snapshot.snapshotId);
  if (new Set(ids).size !== ids.length) {
    throw new CraftingKnowledgeError("Hay snapshotId duplicados.");
  }

  return {
    snapshots: [...snapshots]
      .map((snapshot) => ({
        ...snapshot,
        modCandidates: [...snapshot.modCandidates].sort(compareCandidates),
      }))
      .sort((left, right) => left.snapshotId.localeCompare(right.snapshotId, "en")),
  };
}

export interface ModPoolQuery {
  itemClass: string;
  baseType?: string;
  patch?: string;
  leagueScope?: string | null;
}

/**
 * Resultado discriminado. Solo `available-complete` habilita cualquier cálculo
 * posterior de probabilidad, y lo dice de forma explícita para que el motor no
 * tenga que deducirlo.
 */
export type ModPoolQueryResult =
  | {
      status: "available-complete";
      snapshotId: string;
      candidates: readonly ModCandidate[];
      /** Suma de pesos declarados. Solo existe cuando el pool es exhaustivo. */
      totalWeight: number;
      probabilityBasis: "sufficient";
      limitations: readonly string[];
    }
  | {
      status: "available-partial";
      snapshotId: string;
      candidates: readonly ModCandidate[];
      /** Nunca hay total: un pool parcial no puede normalizar nada. */
      probabilityBasis: "insufficient";
      reasons: readonly string[];
      limitations: readonly string[];
    }
  | {
      status: "unavailable";
      snapshotId: string | null;
      probabilityBasis: "insufficient";
      reasons: readonly string[];
      limitations: readonly string[];
    };

function scopeCovers(scope: SnapshotScope, query: ModPoolQuery): boolean {
  if (scope.itemClasses !== null && !scope.itemClasses.includes(query.itemClass)) return false;
  if (scope.baseTypes !== null) {
    // Un snapshot limitado a bases concretas no cubre una consulta que ni
    // siquiera identifica la base: asumirlo promovería un subconjunto a pool
    // exhaustivo para toda la clase.
    if (query.baseType === undefined || !scope.baseTypes.includes(query.baseType)) {
      return false;
    }
  }
  return true;
}

/**
 * Consulta segura del pool de modificadores.
 *
 * Nunca inventa candidatos, nunca promueve un snapshot parcial a completo y
 * nunca entrega `totalWeight` fuera del caso exhaustivo.
 */
export function queryModCandidates(
  registry: CraftingKnowledgeRegistry,
  query: ModPoolQuery,
): ModPoolQueryResult {
  const reasons: string[] = [];

  const scoped = registry.snapshots.filter((snapshot) => {
    if (snapshot.modCandidates.length === 0 && snapshot.completeness !== "unavailable") {
      return false;
    }
    if (!scopeCovers(snapshot.scope, query)) {
      reasons.push(`${snapshot.snapshotId}: el scope no cubre ${query.itemClass}.`);
      return false;
    }
    if (query.patch !== undefined && snapshot.patch !== null && snapshot.patch !== query.patch) {
      reasons.push(
        `${snapshot.snapshotId}: es del parche ${snapshot.patch} y se preguntó por ${query.patch}.`,
      );
      return false;
    }
    if (
      query.leagueScope !== undefined &&
      query.leagueScope !== null &&
      snapshot.leagueScope !== null &&
      snapshot.leagueScope !== query.leagueScope
    ) {
      reasons.push(
        `${snapshot.snapshotId}: es de la liga ${snapshot.leagueScope} y se preguntó por ${query.leagueScope}.`,
      );
      return false;
    }
    return true;
  });

  const complete = scoped.find((snapshot) => snapshot.completeness === "verified-complete");
  if (complete) {
    const totalWeight = complete.modCandidates.reduce(
      (sum, candidate) => sum + (candidate.weight ?? 0),
      0,
    );
    return {
      status: "available-complete",
      snapshotId: complete.snapshotId,
      candidates: complete.modCandidates,
      totalWeight,
      probabilityBasis: "sufficient",
      limitations: complete.limitations,
    };
  }

  const partial = scoped.find(
    (snapshot) =>
      snapshot.modCandidates.length > 0 &&
      (snapshot.completeness === "verified-partial" ||
        snapshot.completeness === "observed-only"),
  );
  if (partial) {
    return {
      status: "available-partial",
      snapshotId: partial.snapshotId,
      candidates: partial.modCandidates,
      probabilityBasis: "insufficient",
      reasons: [
        `El snapshot ${partial.snapshotId} es «${partial.completeness}»: no demuestra contener todos los candidatos ni todos los pesos.`,
        ...reasons,
      ],
      limitations: partial.limitations,
    };
  }

  const unavailable = scoped.find((snapshot) => snapshot.completeness === "unavailable");
  return {
    status: "unavailable",
    snapshotId: unavailable?.snapshotId ?? null,
    probabilityBasis: "insufficient",
    reasons:
      reasons.length > 0
        ? reasons
        : ["No hay ningún snapshot con candidatos para este alcance."],
    limitations: unavailable?.limitations ?? [],
  };
}

/** Acciones observadas, en orden estable por id. */
export function listObservedActions(
  registry: CraftingKnowledgeRegistry,
): readonly ObservedAction[] {
  return registry.snapshots
    .flatMap((snapshot) => snapshot.observedActions)
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}

/** Fuentes cuyo contenido NO puede copiarse a este repositorio. */
export function listBlockedSources(
  registry: CraftingKnowledgeRegistry,
): readonly KnowledgeSource[] {
  return registry.snapshots
    .flatMap((snapshot) => snapshot.sources)
    .filter((source) => source.redistributionAllowed !== true)
    .sort((left, right) => left.id.localeCompare(right.id, "en"));
}
