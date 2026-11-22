/**
 * Lo que hace falta para escribir la build de PoB2 de un personaje: clases,
 * gemas y el árbol. Se carga aparte (unos 200 KB) solo cuando se usa.
 */
import type { ItemTranslations } from "@shared/itemTranslation.js";
import type { PobBuildData, PobGemInfo } from "@shared/pobBuild.js";
import type { PobBundleMeta } from "./pobTypes";
import { loadPassiveGraph } from "@/lib/passiveTreeData";

interface GemsFile {
  levelTables: number[][];
  gems: Array<Omit<PobGemInfo, "levels"> & { levels: number[] | number }>;
  spanish: Record<string, string>;
}

export interface LoadedPobData extends PobBuildData {
  meta: PobBundleMeta;
}

let dataPromise: Promise<LoadedPobData> | null = null;

export function loadPobData(): Promise<LoadedPobData> {
  dataPromise ??= Promise.all([
    import("../../server/data/pob/classes.json"),
    import("../../server/data/pob/gems.json"),
    import("../../server/data/pob/meta.json"),
    import("../../server/data/pob/item-translations.json"),
    loadPassiveGraph(),
  ]).then(([classes, gemsModule, meta, translations, graph]) => {
    const gemsFile = gemsModule.default as unknown as GemsFile;
    const gems: PobGemInfo[] = gemsFile.gems.map((gem) => ({
      ...gem,
      levels: Array.isArray(gem.levels) ? gem.levels : (gemsFile.levelTables[gem.levels] ?? [0]),
    }));
    return {
      meta: meta.default as PobBundleMeta,
      treeVersion: (meta.default as PobBundleMeta).treeVersion,
      classes: classes.default,
      gems,
      spanishGems: gemsFile.spanish,
      resolveNode: (ref: string) => graph.keyById.get(ref) ?? (ref in graph.data.nodes ? ref : null),
      itemTranslations: translations.default as ItemTranslations,
    };
  });
  dataPromise.catch(() => {
    dataPromise = null;
  });
  return dataPromise;
}
