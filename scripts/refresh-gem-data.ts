/**
 * Regenera `server/data/gems.es.json`: gemas de habilidad y de asistencia de
 * PoE2 con sus nombres y textos del cliente en español. Las reglas trabajan
 * siempre sobre este archivo.
 *
 * Con `--en` regenera `server/data/gems.en.json`: solo nombre, descripción y
 * efectos en inglés de cada gema, unidos por su identificador. Sirve para
 * enseñar las gemas en inglés sin tocar las reglas.
 *
 * Fuente: poe2db.tw/sp y poe2db.tw/us (listados + la ficha pequeña de cada
 * gema). Hay que volver a ejecutar los dos en cada parche que toque gemas:
 *
 *   npm run data:gems
 *   npm run data:gems -- --en
 *
 * Lee unas 930 fichas de 3 KB, de seis en seis. Medido el 25-11-2026: 2 min
 * 40 s en español y 1 min en inglés. Al acabar dice qué gemas son nuevas, cuáles
 * ya no están y cuáles cambian de texto frente al archivo que había.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isRealGem } from "../shared/gemCatalog";
import { compareEntries, describeChanges, readPrevious } from "./lib/dataDiff";

const BASE = "https://poe2db.tw";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; exile-copilot-data)" };
const ENGLISH = process.argv.includes("--en");
const SITE = ENGLISH ? "us" : "sp";
const OUT = fileURLToPath(new URL(ENGLISH ? "../server/data/gems.en.json" : "../server/data/gems.es.json", import.meta.url));

type Attribute = "Fue" | "Des" | "Int";

interface Row {
  slug: string;
  name: string;
  /** `null` en las gemas de dos atributos: poe2db no les pone un color. */
  attribute: Attribute | null;
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
    new RegExp(
      `<tr data-filters="[^"]*"><td><a class="(gem_\\w+|gemitem)" data-hover="([^"]+)" href="\\/${SITE}\\/([^"]+)">[\\s\\S]*?<\\/a><td><a [^>]*>([^<]+)<\\/a>\\s*(?:\\((\\d+)\\))?<div class="gem_tags small">([\\s\\S]*?)<\\/div>`,
      "g",
    );
  for (const match of page.matchAll(pattern)) {
    const [, color, hover, slug, name, grade, tagHtml] = match;
    // «gemitem» es la clase de las gemas sin un color único (ballesta, bastón,
    // formas…): también son gemas. Saltárselas dejó fuera más de la mitad de
    // las habilidades hasta el 19-11-2026.
    const attribute = COLOR_ATTRIBUTE[color] ?? null;
    if ((attribute === null && color !== "gemitem") || rows.has(slug)) continue;
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

/**
 * La tabla «Skill Gems Gemcutting» del listado: en qué grupo («Maza», «Arco»,
 * «Ocultismo»…) sale cada habilidad al tallar una gema sin tallar. Es la única
 * pista que da poe2db del arma de cada habilidad.
 */
function parseGemcutting(page: string, groups: Map<string, string[]>): void {
  const start = page.indexOf('id="SkillGemsGemcutting"');
  const end = page.indexOf('id="TierLevel"');
  if (start < 0) return;
  const table = page.slice(start, end > start ? end : undefined);
  for (const row of table.matchAll(/<tr><td><a href="[^"]*">(?:<img[^>]*>)?([^<]*)<\/a><\/td><td>\d+<\/td><td>([\s\S]*?)(?=<tr>|<\/tbody>)/g)) {
    for (const gem of row[2].matchAll(new RegExp(`<figcaption><a class="[^"]*" data-hover="[^"]*" href="\\/${SITE}\\/([^"]+)">`, "g"))) {
      addGroup(groups, gem[1], decode(row[1]).trim());
    }
  }
}

function addGroup(groups: Map<string, string[]>, slug: string, group: string): void {
  const list = groups.get(slug) ?? [];
  if (!list.includes(group)) list.push(group);
  groups.set(slug, list);
}

/** El nivel de gema que la lista de gemas de espíritu da a cada una (Heraldo de hielo: 4, no el 1 del listado general). */
const spiritGrades = new Map<string, number>();

/** Grupos de tallado de cada habilidad: su arma (o escuela) y «Espíritu» para las gemas de espíritu. */
async function cutGroupsBySlug(skillListing: string): Promise<Map<string, string[]>> {
  const groups = new Map<string, string[]>();
  parseGemcutting(skillListing, groups);
  // La lista de gemas de espíritu: lo único que se talla con una gema de espíritu sin tallar.
  for (const row of parseListing(await get(`${BASE}/${SITE}/Spirit_Gems`))) {
    addGroup(groups, row.slug, "Espíritu");
    if (row.grade !== null) spiritGrades.set(row.slug, row.grade);
  }
  return groups;
}

async function build(listing: string, kind: "skill" | "support") {
  const page = await get(`${BASE}/${SITE}/${listing}`);
  const listed = parseListing(page);
  const cutGroups = kind === "skill" && !ENGLISH ? await cutGroupsBySlug(page) : new Map<string, string[]>();
  if (kind === "skill" && !ENGLISH) console.log(`${listing}: ${cutGroups.size} habilidades con grupo de tallado`);
  // Fuera las gemas que el juego retiró y las entradas que no son gemas.
  // Una asistencia sin atributo no se puede filtrar por hueco: se avisa y se salta.
  const withoutAttribute = kind === "support" ? listed.filter((row) => row.attribute === null) : [];
  if (withoutAttribute.length > 0) {
    console.log(`${listing}: ${withoutAttribute.length} asistencias sin atributo, saltadas: ${withoutAttribute.map((row) => row.name).join(", ")}`);
  }
  const real = listed.filter(isRealGem);
  if (real.length < listed.length) console.log(`${listing}: ${listed.length - real.length} entradas descartadas (retiradas o de plantilla)`);
  const rows = real.filter((row) => kind === "skill" || row.attribute !== null);
  let failed = 0;
  const entries = await mapLimit(rows, 6, async (row) => {
    let card: Card;
    try {
      // Algunas fichas vienen como ruta relativa («?s=Data…»): se leen en /<idioma>/hover.
      const hoverUrl = row.hover.startsWith("?") ? `${BASE}/${SITE}/hover${row.hover}` : row.hover;
      card = parseCard(await get(hoverUrl));
    } catch {
      failed += 1;
      card = { category: null, grade: null, costMultiplier: null, reserve: null, description: "", effects: [] };
    }
    const tags = row.tags.filter((tag) => tag !== "Asistencia");
    if (ENGLISH) {
      return { slug: row.slug, name: row.name, description: card.description, effects: card.effects };
    }
    return {
      slug: row.slug,
      name: row.name,
      attribute: row.attribute,
      grade: spiritGrades.get(row.slug) ?? card.grade ?? row.grade,
      tags,
      ...(kind === "skill" ? { cutGroups: cutGroups.get(row.slug) ?? [] } : {}),
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

// Qué ha cambiado desde la última vez: el archivo tiene cientos de líneas largas
// y el `git diff` no se lee. Sin cambios el día de un parche = poe2db aún no lo tiene.
type Saved = { fetchedAt?: string; skills?: Array<{ slug: string; name: string }>; supports?: Array<{ slug: string; name: string }> };
const previous = readPrevious<Saved>(OUT);
if (previous) {
  let total = 0;
  for (const [label, before, after] of [
    ["Habilidades", previous.skills ?? [], skills],
    ["Asistencias", previous.supports ?? [], supports],
  ] as const) {
    const names = new Map([...before, ...after].map((gem) => [gem.slug, gem.name]));
    const table = (gems: ReadonlyArray<{ slug: string }>) => new Map(gems.map((gem) => [gem.slug, JSON.stringify(gem)]));
    const changes = compareEntries(table(before), table(after));
    total += changes.added.length + changes.removed.length + changes.changed.length;
    for (const line of describeChanges(label, changes, (slug) => names.get(slug) ?? slug)) console.log(line);
  }
  if (total === 0) {
    console.log(`poe2db no ha cambiado ninguna gema desde el ${previous.fetchedAt ?? "último archivo"}: si esperabas un parche nuevo, aún no lo tiene.`);
  }
}

const data = {
  source: `https://poe2db.tw/${SITE}/`,
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
