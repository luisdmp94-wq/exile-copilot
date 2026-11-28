// Saca de poe2db lo que cada emoción líquida le pone a cada joya y lo escribe
// en `shared/craftingEmotionData.ts` (tarea 19 del plan: planificador de
// emociones). No se escribe a mano: cada línea es el texto del objeto en el
// juego, en inglés y en español.
//
// Uso:
//   node scripts/refresh-emotion-data.mjs                      (descarga las dos páginas)
//   node scripts/refresh-emotion-data.mjs <us.html> <sp.html>  (páginas ya guardadas)
//
// Si poe2db cambia la página y las dos listas dejan de cuadrar, el script
// falla en vez de escribir datos a medias.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE = {
  en: "https://poe2db.tw/us/Stackable_Currency",
  es: "https://poe2db.tw/sp/Stackable_Currency",
};
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../shared/craftingEmotionData.ts");

const HEADER = {
  en: /^(.+?)Stack Size: \d/,
  es: /^(.+?)Tamaño de la pila: \d/,
};
const JEWELS = {
  en: { Ruby: "ruby", Sapphire: "sapphire", Emerald: "emerald", Diamond: "diamond" },
  es: { Rubí: "ruby", Zafiro: "sapphire", Esmeralda: "emerald", Diamante: "diamond" },
};
const AFFIXES = {
  en: { Prefix: "prefix", Suffix: "suffix" },
  es: { Prefijo: "prefix", Sufijo: "suffix" },
};
/** La frase que tienen todas las emociones y ninguna otra moneda. */
const EMOTION_RULE = {
  en: /^Removes a random modifer and Augments a Rare (Basic|Time-Lost) Jewel with a$/,
  es: /^Elimina un modificador aleatorio y mejora una joya (básica rara con|rara perdida)$/,
};
/** Restos internos de la página que no son texto del juego. */
const JUNK = /^(?:&nbsp;?|local jewel effect base radius \[\d+\]|[a-z][a-z +%]*\[\d+\])$/;

function visibleLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(?:br|\/p|\/div|\/tr|\/li|\/h\d|\/td|\/th)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Parte la página en objetos (nombre + sus líneas) y se queda con las emociones. */
function emotions(html, lang) {
  const entries = [];
  let current = null;
  for (const line of visibleLines(html)) {
    const header = HEADER[lang].exec(line);
    if (header) {
      current = { name: header[1].trim(), lines: [] };
      entries.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  const jewelWords = Object.keys(JEWELS[lang]).join("|");
  const affixWords = Object.keys(AFFIXES[lang]).join("|");
  const outcomeStart = new RegExp(`^(${jewelWords}) (${affixWords}): (.+)$`);

  return entries
    .map((entry) => {
      const ruleAt = entry.lines.findIndex((line) => EMOTION_RULE[lang].test(line));
      if (ruleAt < 0) return null;
      const rule = EMOTION_RULE[lang].exec(entry.lines[ruleAt]);
      const target = /Time-Lost|perdida/.test(rule[1]) ? "time-lost" : "basic";
      const outcomes = [];
      // La regla ocupa dos líneas; después vienen las joyas.
      for (const line of entry.lines.slice(ruleAt + 2)) {
        if (JUNK.test(line)) continue;
        const start = outcomeStart.exec(line);
        if (start) {
          outcomes.push({ jewel: JEWELS[lang][start[1]], affix: AFFIXES[lang][start[2]], text: start[3] });
        } else if (outcomes.length > 0 && !/^(?:Can be used|Se puede usar|Right click|Haz clic|Shift)/.test(line)) {
          // Un modificador de dos líneas («Increases and Reductions to» / «… Fire Damage»).
          outcomes[outcomes.length - 1].text += ` ${line}`;
        } else {
          break;
        }
      }
      return { name: entry.name, target, outcomes };
    })
    .filter(Boolean);
}

async function page(lang, file) {
  if (file) return readFileSync(file, "utf8");
  const response = await fetch(SOURCE[lang], { headers: { "user-agent": "Mozilla/5.0" } });
  if (!response.ok) throw new Error(`${SOURCE[lang]} respondió ${response.status}`);
  return response.text();
}

const [enFile, esFile] = process.argv.slice(2);
const en = emotions(await page("en", enFile), "en");
const es = emotions(await page("es", esFile), "es");

if (en.length === 0 || en.length !== es.length) {
  throw new Error(`Las listas no cuadran: ${en.length} emociones en inglés y ${es.length} en español.`);
}

const data = en.map((entry, index) => {
  const other = es[index];
  const shape = (list) => list.map((outcome) => `${outcome.jewel}:${outcome.affix}`).join(",");
  if (entry.target !== other.target || shape(entry.outcomes) !== shape(other.outcomes) || entry.outcomes.length === 0) {
    throw new Error(`«${entry.name}» y «${other.name}» no describen las mismas joyas.`);
  }
  return {
    id: entry.name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""),
    name: { es: other.name, en: entry.name },
    target: entry.target,
    outcomes: entry.outcomes.map((outcome, at) => ({
      jewel: outcome.jewel,
      affix: outcome.affix,
      text: { es: other.outcomes[at].text, en: outcome.text },
    })),
  };
});

const today = new Date().toISOString().slice(0, 10);
const file = `// GENERADO por scripts/refresh-emotion-data.mjs: no editar a mano.
// Texto de cada emoción líquida en el juego, tal como lo publica poe2db
// (${SOURCE.en} y ${SOURCE.es}).
import type { EmotionData } from "./craftingEmotions.js";

export const EMOTION_DATA_READ_AT = "${today}";

export const EMOTION_DATA: EmotionData[] = [
${data
  .map(
    (entry) =>
      `  {\n    id: ${JSON.stringify(entry.id)},\n    name: ${JSON.stringify(entry.name)},\n    target: ${JSON.stringify(entry.target)},\n    outcomes: [\n${entry.outcomes
        .map((outcome) => `      ${JSON.stringify(outcome)},`)
        .join("\n")}\n    ],\n  },`,
  )
  .join("\n")}
];
`;
writeFileSync(OUT, file, "utf8");
console.log(`${data.length} emociones escritas en ${OUT}`);
for (const entry of data) console.log(`  ${entry.target === "time-lost" ? "T" : "B"} ${entry.name.en} · ${entry.name.es} (${entry.outcomes.length})`);
