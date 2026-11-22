/**
 * ¿Qué datos de la web están viejos? Resumen para el día de un parche (la 1.0
 * sale el 11-12-2026). No cambia nada: solo lee y avisa.
 *
 *   npm run data:status              lo que hay en el repositorio
 *   npm run data:status -- --online  además mira si GGG ha publicado un árbol nuevo
 *
 * Qué hacer con cada aviso: docs/DIA-DE-LA-1.0.md.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { guidesFor } from "../src/guides/index.js";
import { PASSIVE_ROUTES } from "../src/guides/passiveRoutes.js";

const ROOT = new URL("../", import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(fileURLToPath(new URL(path, ROOT)), "utf8")) as unknown;

const OK = "✔";
const WARN = "⚠";

/** La versión que se espera ver en los datos: --target 1.0, o la del parche activo. */
function targetPatch(): string {
  const index = process.argv.indexOf("--target");
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return process.env.DEFAULT_PATCH ?? "0.5.5";
}

/** «0.5.5», «0.5.4f» → «0.5»: lo que cambia de verdad entre ligas. */
function family(value: string | null | undefined): string | null {
  const match = /^\s*(\d+)[_.](\d+)/.exec(value ?? "");
  return match ? `${match[1]}.${match[2]}` : null;
}

function daysSince(date: string): number | null {
  const parsed = Date.parse(date.includes("-") && date.length === 10 && /^\d{2}-/.test(date) ? date.split("-").reverse().join("-") : date);
  return Number.isNaN(parsed) ? null : Math.floor((Date.now() - parsed) / 86_400_000);
}

const lines: string[] = [];
let warnings = 0;
function row(ok: boolean, label: string, detail: string, todo?: string) {
  if (!ok) warnings += 1;
  lines.push(`${ok ? OK : WARN} ${label.padEnd(22)} ${detail}${!ok && todo ? `\n    → ${todo}` : ""}`);
}

async function main(): Promise<void> {
  const target = targetPatch();
  const targetFamily = family(target);
  lines.push(`Datos de Exile Copilot frente al parche ${target}\n`);

  // Árbol de pasivas (tarjeta «Tu árbol de pasivas» y el Mentor).
  const tree = read("server/data/passives/tree.json") as {
    source: { commit: string; commitMessage: string; commitDate: string; generatedAt: string };
  };
  const treeOk = family(tree.source.commitMessage) === targetFamily;
  row(
    treeOk,
    "Árbol de pasivas",
    `${tree.source.commitMessage} (GGG ${tree.source.commit.slice(0, 8)}, ${tree.source.commitDate.slice(0, 10)})`,
    "npm run data:tree -- --latest (cuando GGG publique el árbol del parche)",
  );
  if (process.argv.includes("--online")) {
    try {
      const response = await fetch("https://api.github.com/repos/grindinggear/poe2-skilltree-export/commits/HEAD", {
        headers: { "User-Agent": "exile-copilot-data" },
      });
      const latest = (await response.json()) as { sha: string; commit: { message: string; committer: { date: string } } };
      const same = latest.sha === tree.source.commit;
      row(
        same,
        "  último de GGG",
        `${latest.commit.message.split("\n")[0]} (${latest.sha.slice(0, 8)}, ${latest.commit.committer.date.slice(0, 10)})`,
        "Hay un árbol nuevo: npm run data:tree -- --latest",
      );
    } catch (error) {
      row(false, "  último de GGG", `no se pudo mirar (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // Path of Building 2 en la web («Tus números», editor, exportar).
  const pob = read("server/data/pob/meta.json") as { commit: string; commitDate: string; pobVersion: string; treeVersion: string };
  // El árbol del motor («0_5») tiene que ser de la misma familia que el parche.
  const pobOk = family(pob.treeVersion) === targetFamily;
  row(
    pobOk,
    "Motor de PoB2",
    `PoB2 ${pob.pobVersion}, árbol ${pob.treeVersion} (${pob.commit.slice(0, 8)}, ${pob.commitDate.slice(0, 10)})`,
    "npm run data:pob -- --latest y npm run data:items-en (cuando PoB2 publique su versión del parche)",
  );
  if (process.argv.includes("--online")) {
    try {
      const response = await fetch("https://api.github.com/repos/PathOfBuildingCommunity/PathOfBuilding-PoE2/commits/dev", {
        headers: { "User-Agent": "exile-copilot-data" },
      });
      const latest = (await response.json()) as { sha: string; commit: { message: string; committer: { date: string } } };
      row(
        latest.sha === pob.commit,
        "  último de PoB2",
        `${latest.commit.message.split("\n")[0].slice(0, 60)} (${latest.sha.slice(0, 8)}, ${latest.commit.committer.date.slice(0, 10)})`,
        "Hay cambios en PoB2: npm run data:pob -- --latest (si traen el parche nuevo)",
      );
    } catch (error) {
      row(false, "  último de PoB2", `no se pudo mirar (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  // Gemas (consejero de gemas, revisión rápida, Mentor).
  for (const [file, label] of [
    ["server/data/gems.es.json", "Gemas (español)"],
    ["server/data/gems.en.json", "Gemas (inglés)"],
  ] as const) {
    const gems = read(file) as { fetchedAt: string };
    const age = daysSince(gems.fetchedAt);
    row(age !== null && age <= 30, label, `poe2db del ${gems.fetchedAt}${age !== null ? ` (hace ${age} días)` : ""}`, file.includes(".en.") ? "npm run data:gems -- --en" : "npm run data:gems");
  }

  // Guías por acto.
  for (const guide of [...guidesFor("es")].sort((a, b) => a.act - b.act)) {
    row(
      family(guide.checkedPatch) === targetFamily,
      `Guía ${guide.actLabel}`,
      `comprobada para ${guide.checkedPatch} el ${guide.checkedOn}`,
      `revisar zonas, jefes y recompensas con el juego y cambiar checkedPatch/checkedOn en src/guides (${guide.slug}, en español y en inglés)`,
    );
  }

  // Rutas de pasivas escritas a mano (hoy ocultas en las guías).
  for (const route of PASSIVE_ROUTES) {
    row(
      family(route.checkedPatch) === targetFamily,
      `Ruta «${route.id}»`,
      `árbol ${route.checkedPatch} (oculta en la web)`,
      "npx tsx scripts/compute-passive-route.ts --download tras actualizar sourceCommit; o dejarla oculta",
    );
  }

  // Builds destacadas.
  const featured = read("server/data/featuredBuilds.json") as { entries?: Array<{ patch?: string }> };
  const builds = featured.entries ?? [];
  const patches = [...new Set(builds.map((build) => build.patch ?? "?"))];
  row(
    patches.every((patch) => family(patch) === targetFamily),
    "Builds destacadas",
    `${builds.length} builds de ${patches.join(", ")}`,
    "las de otro parche se apartan solas; buscar builds nuevas del parche con autor y fuente",
  );

  // Parches y liga.
  const patchList = read("server/data/patches.json") as Array<{ id: string; status?: string; releaseDate?: string }>;
  const entry = patchList.find((patch) => patch.id === target);
  row(
    entry !== undefined && entry.status !== "announced",
    "Ficha del parche",
    entry ? `${entry.id} · ${entry.status ?? "sin estado"}${entry.releaseDate ? ` · ${entry.releaseDate}` : ""}` : `no hay ficha de ${target}`,
    "docs/POE2-1.0-READINESS.md, paso 1 (fuente oficial posterior al lanzamiento)",
  );
  // Compatibilidad: sin ella, la web no puede trabajar con el parche aunque
  // todos los datos de arriba estén al día (Crafting, mercado y Mentor se cierran).
  const compatibility = read("server/data/patchCompatibility.json") as {
    patches?: Array<{
      patchId: string;
      status: string;
      reviewedAt: string | null;
      features: Array<{ id: string; status: string }>;
    }>;
  };
  const coverage = compatibility.patches?.find((record) => record.patchId === target);
  const stopped = coverage?.features.filter((feature) => feature.status === "review-required") ?? [];
  row(
    coverage !== undefined && coverage.status !== "review-required",
    "Compatibilidad",
    coverage
      ? `${coverage.status}${coverage.reviewedAt ? ` · revisada ${coverage.reviewedAt}` : " · sin revisar"}` +
          (stopped.length > 0 ? ` · detenido: ${stopped.map((feature) => feature.id).join(", ")}` : "")
      : `no hay ficha de compatibilidad de ${target}`,
    `npm run readiness:${target} y docs/POE2-1.0-READINESS.md`,
  );
  if (process.env.DEFAULT_PATCH) {
    row(
      process.env.DEFAULT_PATCH === target,
      "DEFAULT_PATCH",
      process.env.DEFAULT_PATCH,
      "cambiarlo en Render solo al cerrar docs/POE2-1.0-READINESS.md",
    );
  } else {
    lines.push("· DEFAULT_PATCH           sin poner aquí (el de la web está en Render → Environment)");
  }
  lines.push(
    `· DEFAULT_LEAGUE          ${process.env.DEFAULT_LEAGUE ?? "sin poner aquí"} (en Render: la liga nueva el día del parche)`,
  );

  lines.push("");
  lines.push(warnings === 0 ? `${OK} Todo al día para ${target}.` : `${WARN} ${warnings} cosa(s) por revisar. Qué hacer: docs/DIA-DE-LA-1.0.md`);
  console.log(lines.join("\n"));
}

void main();
