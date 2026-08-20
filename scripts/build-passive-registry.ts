/**
 * Proceso OFFLINE y reproducible: export oficial de GGG → registro interno mínimo.
 *
 *   npx tsx scripts/build-passive-registry.ts --input <ruta a data.json>
 *   npx tsx scripts/build-passive-registry.ts --download   (descarga la revisión FIJADA)
 *
 * Reglas:
 *  - La revisión de origen está FIJADA por commit y por SHA-256. Si el archivo
 *    no coincide, el proceso falla: nunca se genera un registro a partir de
 *    datos distintos de los auditados.
 *  - Nada de esto ocurre durante una petición normal: la app solo lee el
 *    artefacto ya generado y versionado.
 *  - No se copian sprites ni recursos gráficos, solo texto necesario para
 *    resolver identificadores.
 */
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PassiveRegistrySchema,
  type PassiveRegistry,
  type PassiveNodeType,
  type RegistryAscendancy,
  type RegistryNode,
} from "../shared/passiveRegistry.js";
import {
  GggSkillTreeExportSchema,
  assertExportInvariants,
  type GggExportNode,
} from "../server/registry/gggExportSchema.js";

// --- Revisión FIJADA del export oficial -------------------------------------
const SOURCE_REPOSITORY = "grindinggear/poe2-skilltree-export";
const SOURCE_URL = "https://github.com/grindinggear/poe2-skilltree-export";
const SOURCE_COMMIT = "1e9eb2d8c1946398c3aaaacfbaead5c75c0d1fa6";
const SOURCE_COMMIT_DATE = "2026-06-15T23:50:47Z";
/** Etiqueta que la PROPIA fuente da a ese commit. No es nuestro parche probado. */
const SOURCE_COMMIT_MESSAGE = "0.5.2";
const SOURCE_FILE_URL = `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${SOURCE_COMMIT}/data.json`;
const SOURCE_FILE_SHA256 = "f83c94ce7b09f2bfc5b3b1d63523c2ab3d2582d0e964f6aeec34b8b0390abcfe";
const SOURCE_FILE_BYTES = 5_141_380;
const RETRIEVED_AT = "2026-08-20";
/** Compatibilidad PROBADA por nosotros; GGG no afirma esta correspondencia. */
const TESTED_AGAINST_PATCH = "0.5.4f";
const LICENSE_NOTE =
  "No se encontró licencia explícita en el repositorio de origen (GitHub no declara licencia). " +
  "Los datos pertenecen a Grinding Gear Games; se usan solo para resolver identificadores oficiales.";

/** Nombre del artefacto: lleva el commit de origen, nunca un parche del juego. */
const OUTPUT_FILE = `passiveRegistry.${SOURCE_COMMIT.slice(0, 8)}.json`;
const OUTPUT_DIR = fileURLToPath(new URL("../server/data/passives/", import.meta.url));

function fail(message: string): never {
  console.error(`\n[build-passive-registry] ERROR: ${message}\n`);
  process.exit(1);
}

/** Prioridad documentada: un nodo puede llevar varias flags; se elige la más específica. */
function nodeTypeOf(node: GggExportNode): PassiveNodeType {
  if (node.isKeystone === true) return "keystone";
  if (node.isMastery === true) return "mastery";
  if (node.isJewelSocket === true) return "jewel-socket";
  if (node.isAscendancyStart === true) return "ascendancy-start";
  if (node.isNotable === true) return "notable";
  return "small";
}

async function loadSource(): Promise<string> {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  if (inputIndex !== -1) {
    const path = args[inputIndex + 1];
    if (path === undefined) fail("--input requiere una ruta al data.json oficial.");
    return readFileSync(resolve(path), "utf8");
  }
  if (args.includes("--download")) {
    console.log(`[build-passive-registry] descargando revisión fijada: ${SOURCE_FILE_URL}`);
    const res = await fetch(SOURCE_FILE_URL);
    if (!res.ok) fail(`la descarga devolvió HTTP ${res.status}.`);
    return res.text();
  }
  fail(
    "indica el origen: --input <ruta a data.json> o --download (descarga la revisión fijada).\n" +
      `  Revisión fijada: ${SOURCE_FILE_URL}`,
  );
}

async function main(): Promise<void> {
  const raw = await loadSource();

  // 1) Verificación de la revisión exacta (bytes y hash), antes de nada.
  const bytes = Buffer.byteLength(raw, "utf8");
  const sha256 = createHash("sha256").update(raw, "utf8").digest("hex");
  if (sha256 !== SOURCE_FILE_SHA256) {
    fail(
      `el data.json no coincide con la revisión fijada.\n` +
        `  esperado sha256: ${SOURCE_FILE_SHA256}\n` +
        `  obtenido sha256: ${sha256}\n` +
        `  Fija una revisión nueva de forma consciente antes de regenerar.`,
    );
  }
  if (bytes !== SOURCE_FILE_BYTES) {
    fail(`tamaño inesperado: ${bytes} bytes (esperados ${SOURCE_FILE_BYTES}).`);
  }
  console.log(`[build-passive-registry] revisión verificada (${bytes} bytes, sha256 ${sha256.slice(0, 12)}…)`);

  // 2) Validación estricta de la ENTRADA.
  const parsed = GggSkillTreeExportSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    fail(
      "el export oficial no cumple el esquema de entrada:\n  " +
        parsed.error.issues
          .slice(0, 10)
          .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
          .join("\n  "),
    );
  }
  const data = parsed.data;
  assertExportInvariants(data);

  // 3) Transformación mínima (sin iconos ni coordenadas).
  const nodes: RegistryNode[] = [];
  for (const key of Object.keys(data.nodes)) {
    const node = data.nodes[key];
    if (node === undefined) continue;
    // Sin id de PassiveSkills no es direccionable desde un `.build`.
    if (typeof node.id !== "string" || node.id.length === 0) continue;
    nodes.push({
      id: node.id,
      name: node.name ?? "",
      stats: node.stats ?? [],
      nodeType: nodeTypeOf(node),
      ascendancyId: node.ascendancyId ?? null,
    });
  }
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  const ascendancies: RegistryAscendancy[] = [];
  const classes = data.classes.map((cls) => {
    const ids: string[] = [];
    for (const asc of cls.ascendancies ?? []) {
      ids.push(asc.id);
      // name null/ausente se conserva como null: la fuente no lo publica y no se inventa.
      ascendancies.push({ id: asc.id, name: asc.name ?? null, className: cls.name });
    }
    return { name: cls.name, ascendancyIds: ids };
  });
  ascendancies.sort((a, b) => a.id.localeCompare(b.id));

  const registry: PassiveRegistry = {
    registryVersion: 1,
    provenance: {
      sourceRepository: SOURCE_REPOSITORY,
      sourceUrl: SOURCE_URL,
      sourceFileUrl: SOURCE_FILE_URL,
      sourceCommit: SOURCE_COMMIT,
      sourceCommitDate: SOURCE_COMMIT_DATE,
      sourceCommitMessage: SOURCE_COMMIT_MESSAGE,
      sourceFileSha256: SOURCE_FILE_SHA256,
      sourceFileBytes: SOURCE_FILE_BYTES,
      retrievedAt: RETRIEVED_AT,
      dataOwner: "Grinding Gear Games",
      license: null,
      licenseNote: LICENSE_NOTE,
      testedAgainstPatch: TESTED_AGAINST_PATCH,
      generatedBy: "scripts/build-passive-registry.ts",
    },
    classes,
    ascendancies,
    nodes,
  };

  // 4) Validación estricta de la SALIDA.
  const validated = PassiveRegistrySchema.safeParse(registry);
  if (!validated.success) {
    fail(
      "el registro generado no cumple su propio esquema:\n  " +
        validated.error.issues
          .slice(0, 10)
          .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
          .join("\n  "),
    );
  }

  const outPath = resolve(OUTPUT_DIR, OUTPUT_FILE);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(validated.data, null, 2)}\n`, "utf8");
  console.log(
    `[build-passive-registry] escrito ${outPath}\n` +
      `  nodos: ${nodes.length} | clases: ${classes.length} | ascendencias: ${ascendancies.length}`,
  );
}

await main();
