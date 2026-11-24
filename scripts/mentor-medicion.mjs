/**
 * Medición del Mentor con dos personajes novatos (docs/MEDICION-MENTOR-2.md).
 *
 * Uso:
 *   node scripts/mentor-medicion.mjs --sin-ia   → solo reglas (unos segundos)
 *   node scripts/mentor-medicion.mjs            → con la IA del .env (20 s entre preguntas)
 *   --con-mods añade dos modificadores a cada pieza.
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
const PORT = Number(process.env.MEDIR_PORT ?? 7191);
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-medicion-"));
const OUT = join(tempRoot, "respuestas.json");

const item = (id, slot, name, baseType, itemLevel, extra = {}) => ({
  id, name, baseType, slot, rarity: "magic", itemLevel, modifiers: [], sources: [], ...extra,
});
const skill = (id, mainSkill, level, supports = []) => ({
  id, label: "", mainSkill, mainSkillGemId: null,
  supports: supports.map((name) => ({ name, gemId: null })),
  ...(level ? { level } : {}),
});

const guerrero = {
  id: "medicion-guerrero", name: "Mi guerrero", characterClass: "Guerrero",
  ascendancy: null, ascendancyId: null, level: 14, levelSource: "observed",
  archetype: "mazo a dos manos, golpes lentos y fuertes",
  league: "Runes of Aldur", patch: "0.5.5",
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
  passives: { allocated: [] },
  attributes: { str: 38, dex: 12, int: 9 },
  resistances: { fire: 15, cold: 0, lightning: 0, chaos: 0 },
  life: 380, armour: 210,
  sources: [], importedAt: "2026-11-24T19:00:00.000Z",
};

const exploradora = {
  id: "medicion-exploradora", name: "Mi exploradora", characterClass: "Exploradora",
  ascendancy: null, ascendancyId: null, level: 22, levelSource: "observed",
  archetype: "arco de rayo",
  league: "Runes of Aldur", patch: "0.5.5",
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
  passives: { allocated: [] },
  attributes: { str: 14, dex: 61, int: 22 },
  resistances: { fire: 20, cold: 5, lightning: 31, chaos: 0 },
  life: 640, evasion: 420,
  sources: [], importedAt: "2026-11-24T19:00:00.000Z",
};

if (process.argv.includes('--con-mods')) {
  const mod = (id, text) => ({ id, text, kind: 'explicit', values: [], verified: false });
  for (const p of [guerrero, exploradora]) {
    for (const it of p.items) {
      it.modifiers = it.slot === 'weapon'
        ? [mod(it.id + '-m1', '38% de daño físico aumentado'), mod(it.id + '-m2', 'Agrega de 4 a 9 de daño físico')]
        : [mod(it.id + '-m1', '+28 de vida máxima'), mod(it.id + '-m2', '+11% a la resistencia al fuego')];
    }
  }
}
const QUESTIONS = [
  ["G1", guerrero, "me matan mucho, que hago?"],
  ["G2", guerrero, "que gema de asistencia le pongo a embate rodante?"],
  ["G3", guerrero, "tengo una gema sin tallar de nivel 5, cual cojo?"],
  ["G4", guerrero, "donde pongo los puntos de pasivas?"],
  ["G5", guerrero, "que subo, fuerza o destreza?"],
  ["G6", guerrero, "me conviene llevar escudo o un mazo a dos manos?"],
  ["G7", guerrero, "pego muy poco a los jefes"],
  ["G8", guerrero, "que es el espiritu y para que sirve?"],
  ["G9", guerrero, "que ascendencia me cojo?"],
  ["G10", guerrero, "cuanta resistencia necesito?"],
  ["E1", exploradora, "que mejoro primero?"],
  ["E2", exploradora, "hay alguna asistencia para que flecha de rayo dispare mas flechas?"],
  ["E3", exploradora, "que pongo, disparo multiple 1 o 2?"],
  ["E4", exploradora, "tengo una gema de espiritu sin tallar, que me pongo?"],
  ["E5", exploradora, "por que muero de un golpe?"],
  ["E6", exploradora, "como se si un arco es mejor que el que llevo?"],
  ["E7", exploradora, "para que sirven los orbes exaltados? los gasto ya?"],
  ["E8", exploradora, "no puedo ponerme una gema, me sale en rojo"],
  ["E9", exploradora, "que pasivas cojo para hacer mas daño con el arco?"],
  ["E10", exploradora, "como consigo mas huecos para gemas de asistencia?"],
];

const env = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: "development",
  PUBLIC_DEPLOYMENT: "false",
  SECURE_COOKIES: "false",
  POE_NINJA_OFFLINE: "true",
  MENTOR_RATE_LIMIT_PER_MINUTE: "300",
  DATABASE_PATH: join(tempRoot, "medicion.db"),
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

  for (const [id, profile, question] of QUESTIONS) {
    const res = await fetch(`${BASE}/api/mentor/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question, profile, budget: null, goal: { kind: "balanced" },
        league: profile.league, patch: profile.patch, lang: "es",
      }),
    });
    const body = await res.json();
    const a = body.answer;
    results.push({
      id, personaje: profile.name, question, status: res.status,
      intent: a?.intent ?? null, responseMode: a?.responseMode ?? null,
      model: a?.model ?? null, fallbackReason: a?.fallbackReason ?? null,
      answer: a?.answer ?? JSON.stringify(body),
      nextAction: a?.nextAction?.text ?? null,
    });
    console.log(`${id} ${res.status} ${a?.intent} ${a?.responseMode} ${a?.fallbackReason ?? ""}`);
    await wait(a?.model ? 20000 : 500);
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
