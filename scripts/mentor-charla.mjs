/**
 * Medición del Mentor con CHARLAS: una pregunta y dos repreguntas seguidas
 * (tarea 13 del plan, 25-11-2026). Las mediciones de preguntas sueltas
 * (scripts/mentor-medicion.mjs) no ven si el Mentor sigue el hilo.
 *
 * Uso:
 *   node scripts/mentor-charla.mjs            → las charlas de la bruja, con la IA del .env
 *   node scripts/mentor-charla.mjs --sin-ia   → solo reglas
 *   node scripts/mentor-charla.mjs --control  → las charlas de control
 *   MEDIR_SOLO=B1,B3 pregunta solo esas charlas.
 *
 * Cada turno manda los anteriores en `conversation`, igual que la web
 * (src/lib/mentorRequest.ts: los últimos ocho, 800 caracteres cada uno).
 *
 * Servidor local aislado: puerto propio y base SQLite temporal. No toca la web
 * publicada, sus estadísticas ni la base real. Las respuestas se escriben en un
 * JSON temporal; las notas (bien / a medias / mal) se ponen leyéndolas.
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.MEDIR_PORT ?? 7192);
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SOLO = process.env.MEDIR_SOLO ? process.env.MEDIR_SOLO.split(",") : null;
// Groq gratis: 8.000 tokens por minuto. Una respuesta redactada gasta unos 2.000.
const ESPERA_IA_MS = Number(process.env.MEDIR_ESPERA_MS ?? 20000);
const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-charla-"));
const OUT = process.env.MEDIR_SALIDA ?? join(tempRoot, "charlas.json");

const item = (id, slot, name, baseType, itemLevel, extra = {}) => ({
  id, name, baseType, slot, rarity: "magic", itemLevel, modifiers: [], sources: [], ...extra,
});
const skill = (id, mainSkill, level, supports = []) => ({
  id, label: "", mainSkill, mainSkillGemId: null,
  supports: supports.map((name) => ({ name, gemId: null })),
  ...(level ? { level } : {}),
});
const base = { ascendancyId: null, levelSource: "observed", league: "Runes of Aldur", patch: "0.5.5", passives: { allocated: [] }, sources: [], importedAt: "2026-11-25T19:00:00.000Z" };

/** Inventada, con la forma de la Liche de Luis (caos y esbirros, hielo en negativo). */
const bruja = {
  ...base,
  id: "charla-bruja", name: "Mi bruja", characterClass: "Bruja", ascendancy: "Liche", level: 49,
  archetype: "Bruja de caos con esbirros",
  items: [
    item("b-arma", "weapon", "Varita de hueso", "Varita de hueso", 44),
    item("b-cetro", "offhand", "Cetro de omen", "Cetro de omen", 41),
    item("b-pecho", "body", "Túnica de seda", "Túnica de seda", 45),
    item("b-casco", "helmet", "Corona de hueso", "Corona de hueso", 40),
    item("b-guantes", "gloves", "Guantes bordados", "Guantes bordados", 43),
    item("b-botas", "boots", "Zapatos de seda", "Zapatos de seda", 46),
    item("b-anillo", "ring1", "Anillo de amatista", "Anillo de amatista", 42),
  ],
  skills: [
    skill("b-s1", "Descarga de caos", 13, ["Lanzamiento rápido I", "Obscenidad I"]),
    skill("b-s2", "Guerrero esqueleto", 13, ["Último aliento"]),
    skill("b-s3", "Drenar esencia", 12, ["Aflicción veloz I"]),
    skill("b-s4", "Desesperación", 11),
    skill("b-s5", "Ofrenda de dolor", 11),
    skill("b-s6", "Exhumar", 11),
  ],
  attributes: { str: 7, dex: 25, int: 131 },
  resistances: { fire: 17, cold: -42, lightning: 9, chaos: 9 },
  life: 833, energyShield: 318,
};

const guerrero = {
  ...base,
  id: "charla-guerrero", name: "Mi guerrero", characterClass: "Guerrero", ascendancy: null, level: 14,
  archetype: "mazo a dos manos, golpes lentos y fuertes",
  items: [
    item("g-arma", "weapon", "Mazo de guerra pesado", "Mazo de guerra", 9, { requirements: { level: 8, str: 22 } }),
    item("g-pecho", "body", "Cota de malla gastada", "Cota de malla", 11, { requirements: { level: 10, str: 25 } }),
    item("g-casco", "helmet", "Yelmo de hierro", "Yelmo de hierro", 6),
    item("g-botas", "boots", "Grebas de hierro", "Grebas de hierro", 12),
  ],
  skills: [
    skill("g-s1", "Embate rodante", 5),
    skill("g-s2", "Terremoto", 3),
    skill("g-s3", "Rompearmaduras", 3),
    skill("g-s4", "Grito infernal", 3),
  ],
  attributes: { str: 38, dex: 12, int: 9 },
  resistances: { fire: 15, cold: 0, lightning: 0, chaos: 0 },
  life: 380, armour: 210,
};

const exploradora = {
  ...base,
  id: "charla-exploradora", name: "Mi exploradora", characterClass: "Exploradora", ascendancy: null, level: 22,
  archetype: "arco de rayo",
  items: [
    item("e-arma", "weapon", "Arco corto de caza", "Arco corto", 16, { requirements: { level: 14, dex: 38 } }),
    item("e-carcaj", "offhand", "Carcaj de flechas anchas", "Carcaj de flechas anchas", 18),
    item("e-pecho", "body", "Jubón de cuero", "Jubón de cuero", 20, { requirements: { level: 18, dex: 44 } }),
    item("e-guantes", "gloves", "Guantes de piel", "Guantes de piel", 15),
    item("e-botas", "boots", "Botas de piel", "Botas de piel", 21),
    item("e-anillo", "ring1", "Anillo de zafiro", "Anillo de zafiro", 19),
  ],
  skills: [
    skill("e-s1", "Flecha de rayo", 7, ["Aceleración de proyectiles I"]),
    skill("e-s2", "Pararrayos", 5),
    skill("e-s3", "Flecha invocadora de tormentas", 5),
    skill("e-s4", "Heraldo de trueno", 4),
  ],
  attributes: { str: 14, dex: 61, int: 22 },
  resistances: { fire: 20, cold: 5, lightning: 31, chaos: 0 },
  life: 640, evasion: 420,
};

/**
 * La charla que reprodujo la queja de Luis el 25-11-2026 («sigue diciendo lo
 * mismo sin ayudarme»), partida en tres charlas de tres turnos. Las frases son
 * las de la tarea 13 del plan; «porque no tengo daño contra bosses» es de Luis.
 * Con estas se escribieron las instrucciones de la IA: no valen de prueba limpia.
 */
const CHARLAS = [
  ["B1", bruja, [
    "que gema de asistencia le pongo a descarga de caos?",
    "y por que esa?",
    "esa no la tengo, que otra me vale?",
  ]],
  ["B2", bruja, [
    "mis esbirros se mueren enseguida",
    "ya, pero que hago exactamente?",
    "y con que gema aguantan mas?",
  ]],
  ["B3", bruja, [
    "como mato al jefe del acto 3?",
    "porque no tengo daño contra bosses",
    "ya, pero que hago exactamente?",
  ]],
];

/**
 * Charlas de control: escritas el 25-11-2026 DESPUÉS de dejar fijas las
 * instrucciones de la IA (server/mentor/mentorWriter.ts) y sin ver ninguna
 * respuesta. Otros personajes, otros actos, otras habilidades. Si se tocan
 * las instrucciones mirando estas, dejan de valer: hay que escribir otras.
 */
const CONTROL = [
  ["K1", guerrero, [
    "que le pongo a terremoto para que pegue mas?",
    "y por que esa primero?",
    "no me suena tenerla, dame otra",
  ]],
  ["K2", guerrero, [
    "el conde del acto 1 me revienta",
    "y que resistencia subo?",
    "vale, y que hago en la pelea?",
  ]],
  ["K3", exploradora, [
    "que no me puedo saltar en el acto 2?",
    "y eso donde esta?",
    "y el jefe final que tal es?",
  ]],
  ["K4", exploradora, [
    "flecha de rayo hace poco daño",
    "ya llevo aceleracion de proyectiles, otra cosa?",
    "y cual de esas pongo primero?",
  ]],
];

const ASKED = process.argv.includes("--control") ? CONTROL : CHARLAS;

const env = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: "development",
  PUBLIC_DEPLOYMENT: "false",
  SECURE_COOKIES: "false",
  POE_NINJA_OFFLINE: "true",
  MENTOR_RATE_LIMIT_PER_MINUTE: "300",
  DATABASE_PATH: join(tempRoot, "charla.db"),
};
if (process.argv.includes("--sin-ia")) env.MENTOR_AI_ENABLED = "false";

const proc = spawn(
  process.execPath,
  [join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(PORT), "--strictPort"],
  { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
proc.stdout.on("data", (d) => { serverLog += d; });
proc.stderr.on("data", (d) => { serverLog += d; });

const results = [];
try {
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    try { up = (await fetch(`${BASE}/api/health`)).ok; } catch { /* aún no */ }
    if (!up) await wait(500);
  }
  if (!up) throw new Error("el servidor local no arrancó");
  const health = await (await fetch(`${BASE}/api/health`)).json();
  console.log("mentor:", JSON.stringify(health.services?.mentor ?? null));

  for (const [id, profile, turns] of ASKED) {
    if (SOLO && !SOLO.includes(id)) continue;
    const conversation = [];
    for (let turn = 0; turn < turns.length; turn++) {
      const question = turns[turn];
      const started = Date.now();
      const res = await fetch(`${BASE}/api/mentor/query`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question, profile, budget: null, goal: { kind: "balanced" },
          league: profile.league, patch: profile.patch, lang: "es",
          ...(conversation.length > 0 ? { conversation: conversation.slice(-8) } : {}),
        }),
      });
      const body = await res.json();
      const ms = Date.now() - started;
      const a = body.answer;
      const answer = a?.answer ?? JSON.stringify(body);
      results.push({
        id: `${id}.${turn + 1}`, personaje: profile.name, question, status: res.status, ms,
        intent: a?.intent ?? null, responseMode: a?.responseMode ?? null,
        model: a?.model ?? null, fallbackReason: a?.fallbackReason ?? null,
        answer, nextAction: a?.nextAction?.text ?? null,
      });
      console.log(`${id}.${turn + 1} ${res.status} ${a?.intent} ${a?.responseMode} ${a?.fallbackReason ?? ""} ${ms} ms`);
      conversation.push({ role: "player", text: question.slice(0, 800) });
      if (a?.answer) conversation.push({ role: "mentor", text: a.answer.slice(0, 800) });
      await wait(a?.model ? ESPERA_IA_MS : 500);
    }
  }
} catch (err) {
  console.error("ERROR:", err.message);
} finally {
  writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
  writeFileSync(OUT.replace(/\.json$/, ".log"), serverLog, "utf8");
  try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch { proc.kill(); }
}
console.log(`hecho: ${results.length} respuestas en ${OUT}`);
process.exit(0);
