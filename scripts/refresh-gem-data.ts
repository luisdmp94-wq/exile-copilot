/**
 * Regenera `server/data/gems.es.json`: gemas de habilidad y de asistencia de
 * PoE2 con sus nombres y textos del cliente en español.
 *
 * Fuente: poe2db.tw/sp (listados + la ficha pequeña de cada gema). Hay que
 * volver a ejecutarlo en cada parche que toque gemas:
 *
 *   npm run data:gems
 *
 * Lee unas 730 fichas de 3 KB, de seis en seis, y tarda alrededor de un minuto.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "https://poe2db.tw";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; exile-copilot-data)" };
const OUT = fileURLToPath(new URL("../server/data/gems.es.json", import.meta.url));

type Attribute = "Fue" | "Des" | "Int";

interface Row {
  slug: string;
  name: string;
  attribute: Attribute;
  grade: number | null;
  tags: string[];
  hover: string;
}

const COLOR_ATTRIBUTE: Record<string, Attribute> = { gem_red: "Fue", gem_green: "Des", gem_blue: "Int" };

function decode(value: string): string {
  return value
    .replace(new RegExp("&nbsp;|" + String.fromCharCode(160), "g"), " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)));
}

function plain(fragment: string): string {
  return decode(fragment.replace(/<br\s*\/?>|<\/div>/gi, " ").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .replace(/\s+([:,.%])/g, "$1")
    .trim();
}

async function get(url: string, attempt = 1): Promise<string> {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      return get(url, attempt + 1);
    }
    throw new Error(`${response.status} al leer ${url}`);
  }
  return response.text();
}

function parseListing(page: string): Row[] {
  const rows = new Map<string, Row>();
  const pattern =
    /<tr data-filters="[^"]*"><td><a class="(gem_\w+)" data-hover="([^"]+)" href="\/sp\/([^"]+)">[\s\S]*?<\/a><td><a [^>]*>([^<]+)<\/a>\s*(?:\((\d+)\))?<div class="gem_tags small">([\s\S]*?)<\/div>/g;
  for (const match of page.matchAll(pattern)) {
    const [, color, hover, slug, name, grade, tagHtml] = match;
    const attribute = COLOR_ATTRIBUTE[color];
    if (!attribute || rows.has(slug)) continue;
    rows.set(slug, {
      slug,
      name: decode(name).trim(),
      attribute,
      grade: grade ? Number(grade) : null,
      tags: [...tagHtml.matchAll(/>([^<]+)<\/a>/g)].map((tag) => decode(tag[1]).trim()),
      hover,
    });
  }
  return [...rows.values()];
}

interface Card {
  category: string | null;
  grade: number | null;
  costMultiplier: string | null;
  reserve: string | null;
  description: string;
  effects: string[];
}

function parseCard(card: string): Card {
  const text = plain(card);
  const property = (label: string) => new RegExp(`${label}: ([^:]+?)(?= [A-ZÁÉÍÓÚ][a-záéíóúñ ]+:|$)`).exec(text)?.[1]?.trim() ?? null;
  const grade = /Grado: (\d+)/.exec(text)?.[1];
  const blocks = (className: string) =>
    [...card.matchAll(new RegExp(`<div class="${className}">([\\s\\S]*?)</div>`, "g"))]
      .map((block) => plain(block[1]))
      .filter(Boolean);
  return {
    category: /Categoría: ([^:]+?) (?:Grado|Multiplicador|Requisitos|Reserva)/.exec(text)?.[1]?.trim() ?? property("Categoría"),
    grade: grade ? Number(grade) : null,
    costMultiplier: /Multiplicador de costo: (\d+%)/.exec(text)?.[1] ?? null,
    reserve: /Reserva(?: adicional)?: ([\d() —-]+ ?Espíritu)/.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ?? null,
    description: blocks("secDescrText").join(" "),
    effects: blocks("explicitMod").slice(0, 6),
  };
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

async function build(listing: string, kind: "skill" | "support") {
  const rows = parseListing(await get(`${BASE}/sp/${listing}`));
  let failed = 0;
  const entries = await mapLimit(rows, 6, async (row) => {
    let card: Card;
    try {
      card = parseCard(await get(row.hover));
    } catch {
      failed += 1;
      card = { category: null, grade: null, costMultiplier: null, reserve: null, description: "", effects: [] };
    }
    const tags = row.tags.filter((tag) => tag !== "Asistencia");
    return {
      slug: row.slug,
      name: row.name,
      attribute: row.attribute,
      grade: card.grade ?? row.grade,
      tags,
      ...(kind === "support" ? { category: card.category, lineage: tags.includes("Linaje"), costMultiplier: card.costMultiplier } : {}),
      reserve: card.reserve,
      description: card.description,
      effects: card.effects,
    };
  });
  console.log(`${listing}: ${entries.length} gemas, ${failed} fichas sin leer`);
  return entries;
}

const skills = await build("Skill_Gems", "skill");
const supports = await build("Support_Gems", "support");
if (skills.length < 100 || supports.length < 200) {
  throw new Error("Demasiadas pocas gemas: poe2db ha cambiado de formato. No se sobrescribe el archivo.");
}
const data = {
  source: "https://poe2db.tw/sp/",
  fetchedAt: new Date().toISOString().slice(0, 10),
  skills,
  supports,
};
writeFileSync(
  OUT,
  `{\n"source": ${JSON.stringify(data.source)},\n"fetchedAt": ${JSON.stringify(data.fetchedAt)},\n"skills": [\n${skills
    .map((entry) => JSON.stringify(entry))
    .join(",\n")}\n],\n"supports": [\n${supports.map((entry) => JSON.stringify(entry)).join(",\n")}\n]\n}\n`,
  "utf8",
);
console.log(`escrito ${OUT}`);
