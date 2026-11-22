/**
 * Traducción de objetos del cliente en español al inglés que lee Path of
 * Building 2:
 *
 *   server/data/pob/item-translations.json
 *     mods     plantilla en español → plantilla en inglés («+# a la inteligencia» → «+# to Intelligence»)
 *     bases    base en español → inglés («Varita marchita» → «Withered Wand»)
 *     uniques  único en español → inglés («Ramito de vida» → «Lifesprig»)
 *
 * Uso (proceso OFFLINE: nunca se ejecuta al servir la web):
 *
 *   npm run data:items-en
 *
 * Fuente: poe2db.tw. Cada página de modificadores (Varitas, Botas de destreza…)
 * existe en /us y en /sp con la misma lista en el mismo orden: se emparejan
 * fila a fila y solo se acepta una pareja si lleva los mismos números. Las
 * bases y los únicos se emparejan por su enlace, que es igual en los dos
 * idiomas. Lo que no se pueda traducir se queda en español y la web lo cuenta.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { itemTemplate } from "../shared/itemTranslation.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(ROOT, "server/data/pob/item-translations.json");
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; exile-copilot-data)" };

/** Páginas de tipos de objeto que no son equipo (tablillas, reliquias…). */
const NOT_EQUIPMENT = /Tablet|Relic|Waystone/;

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { headers: HEADERS });
    if (response.ok) return response.text();
    if (attempt === 3) throw new Error(`${url} devolvió HTTP ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
  }
  throw new Error("inalcanzable");
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 250));

/** El JSON de `new ModsView({...})` de una página de poe2db. */
function modsView(html: string): Record<string, unknown> | null {
  const marker = html.indexOf("new ModsView(");
  if (marker < 0) return null;
  const start = marker + "new ModsView(".length;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index++) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(start, index + 1)) as Record<string, unknown>;
    }
  }
  return null;
}

function decode(text: string): string {
  return text
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

/** Las líneas de un modificador de poe2db (HTML con `<br>` entre líneas). */
function modLines(html: string): string[] {
  return decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Enlaces de bases o únicos: el `href` es el mismo en los dos idiomas. */
function namesByLink(html: string, className: RegExp): Map<string, string> {
  const names = new Map<string, string>();
  for (const match of html.matchAll(/<a class="([^"]*)"[^>]*href="(?:\/(?:us|sp)\/)?([^"#]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    if (!className.test(match[1])) continue;
    const text = decode(match[3].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (text && !names.has(match[2])) names.set(match[2], text);
  }
  return names;
}

interface UniqueBlock {
  name: string;
  base: string;
  lines: string[];
}

/**
 * Únicos de la página «Unique_item»: nombre, base y sus líneas. Cada ficha
 * empieza en el enlace con `uniqueName` y acaba en la siguiente ficha.
 */
function uniqueBlocks(html: string): Map<string, UniqueBlock> {
  const blocks = new Map<string, UniqueBlock>();
  const starts = [...html.matchAll(/href="(?:\/(?:us|sp)\/)?([^"#]+)"[^>]*>\s*<span class="uniqueName">([^<]+)<\/span>\s*<span class="uniqueTypeLine">([^<]+)<\/span>/g)];
  starts.forEach((match, index) => {
    const end = index + 1 < starts.length ? starts[index + 1].index : html.length;
    const body = html.slice(match.index, end);
    const lines = [...body.matchAll(/<div class="(?:implicitMod|explicitMod)">([\s\S]*?)<\/div>/g)].flatMap((line) => modLines(line[1]));
    if (!blocks.has(match[1])) blocks.set(match[1], { name: decode(match[2]).trim(), base: decode(match[3]).trim(), lines });
  });
  return blocks;
}

async function main(): Promise<void> {
  const modifiersPage = await fetchText("https://poe2db.tw/us/Modifiers");
  const pages = [...new Set([...modifiersPage.matchAll(/href="(?:\/us\/)?([A-Za-z_'-]+)#ModifiersCalc"/g)].map((match) => match[1]))].filter(
    (page) => !NOT_EQUIPMENT.test(page),
  );
  console.log(`[items-en] ${pages.length} páginas de modificadores de equipo`);

  const votes = new Map<string, Map<string, number>>();
  const bases = new Map<string, string>();
  const vote = (spanish: string, english: string) => {
    const es = itemTemplate(spanish);
    const en = itemTemplate(english);
    if (!es || !en || es.numbers.length !== en.numbers.length) return;
    // Mismos números en el mismo orden: si no, la pareja no es fiable.
    if (es.numbers.join("|") !== en.numbers.join("|")) return;
    const options = votes.get(es.key) ?? new Map<string, number>();
    options.set(en.text, (options.get(en.text) ?? 0) + 1);
    votes.set(es.key, options);
  };

  let rows = 0;
  for (const page of pages) {
    const [english, spanish] = [await fetchText(`https://poe2db.tw/us/${page}`), await fetchText(`https://poe2db.tw/sp/${page}`)];
    await pause();
    const us = modsView(english);
    const sp = modsView(spanish);
    if (us && sp) {
      for (const [category, list] of Object.entries(us)) {
        const other = sp[category];
        if (!Array.isArray(list) || !Array.isArray(other) || list.length !== other.length) continue;
        list.forEach((row, index) => {
          const a = row as { str?: string };
          const b = other[index] as { str?: string };
          if (typeof a.str !== "string" || typeof b.str !== "string") return;
          const enLines = modLines(a.str);
          const esLines = modLines(b.str);
          if (enLines.length !== esLines.length) return;
          enLines.forEach((line, lineIndex) => vote(esLines[lineIndex], line));
          rows++;
        });
      }
    }
    // Bases (y sus implícitos, que vienen en la ficha de cada base).
    const enBases = namesByLink(english, /\bwhiteitem\b/);
    const esBases = namesByLink(spanish, /\bwhiteitem\b/);
    for (const [link, name] of enBases) {
      const es = esBases.get(link);
      if (es) bases.set(es, name);
    }
  }

  const uniques = new Map<string, string>();
  const [uniquesEn, uniquesEs] = [await fetchText("https://poe2db.tw/us/Unique_item"), await fetchText("https://poe2db.tw/sp/Unique_item")];
  const enUniques = uniqueBlocks(uniquesEn);
  const esUniques = uniqueBlocks(uniquesEs);
  let uniqueRows = 0;
  for (const [link, english] of enUniques) {
    const spanish = esUniques.get(link);
    if (!spanish) continue;
    uniques.set(spanish.name, english.name);
    if (!bases.has(spanish.base)) bases.set(spanish.base, english.base);
    // Las líneas de cada único, emparejadas en orden si son las mismas.
    if (spanish.lines.length === english.lines.length) {
      english.lines.forEach((line, index) => vote(spanish.lines[index], line));
      uniqueRows++;
    }
  }
  console.log(`[items-en] ${enUniques.size} únicos, ${uniqueRows} con sus líneas emparejadas`);

  const mods: Record<string, string> = {};
  for (const [spanish, options] of votes) {
    const best = [...options.entries()].sort((a, b) => b[1] - a[1])[0];
    mods[spanish] = best[0];
  }
  const sortedObject = (map: Map<string, string> | Record<string, string>) =>
    Object.fromEntries(Object.entries(map instanceof Map ? Object.fromEntries(map) : map).sort(([a], [b]) => a.localeCompare(b)));

  const output = {
    source: "https://poe2db.tw (páginas /us y /sp de modificadores, bases y únicos)",
    generatedAt: new Date().toISOString().slice(0, 10),
    generatedBy: "scripts/build-item-translations.ts",
    mods: sortedObject(mods),
    bases: sortedObject(bases),
    uniques: sortedObject(uniques),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(output)}\n`);
  console.log(
    `[items-en] ${rows} filas emparejadas → ${Object.keys(mods).length} plantillas, ` +
      `${bases.size} bases, ${uniques.size} únicos`,
  );
}

await main();
