/**
 * Medición del Mentor con dos personajes novatos (docs/MEDICION-MENTOR-2.md).
 *
 * Uso:
 *   node scripts/mentor-medicion.mjs --sin-ia   → solo reglas (unos segundos)
 *   node scripts/mentor-medicion.mjs            → con la IA del .env (20 s entre preguntas)
 *   --con-mods añade dos modificadores a cada pieza.
 *   --nuevas pregunta las veinte «preguntas nuevas» en vez de las veinte de siempre.
 *   --control pregunta las veinte de control (escritas con las instrucciones de la IA ya fijas).
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
// Groq gratis: 8.000 tokens por minuto. Entender una pregunta gasta unos 1.000.
// MEDIR_SOLO=C1,C7 pregunta solo esas.
const SOLO = process.env.MEDIR_SOLO ? process.env.MEDIR_SOLO.split(",") : null;
const ESPERA_IA_MS = Number(process.env.MEDIR_ESPERA_MS ?? 20000);
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
  // Casos reales de jugadores, fuera de las veinte: no cuentan en la nota.
  // R1: Luis en la web publicada (24-11-2026); recibió «no veo una causa clara».
  ["R1", exploradora, "tengo un arma unica pero no se si esta bien de daño me lo cambio por una varita amarilla?"],
  // R2: Luis en la web publicada (24-11-2026); recibió «el área Essences… no está revisada».
  ["R2", exploradora, "que gemas pondrias en drenar esencia?"],
];

/**
 * Preguntas nuevas (tarea 12, 25-11-2026): las mismas dudas dichas de otra
 * forma, como las escribe un novato. Se escribieron antes de ver ninguna
 * respuesta y ninguna regla se ha tocado mirándolas. Las dos últimas no tienen
 * regla: lo correcto es «no lo sé».
 */
const NUEVAS = [
  ["P1", guerrero, "no aguanto nada, me revientan en dos toques"],
  ["P2", guerrero, "que le meto a terremoto para que pegue mas fuerte?"],
  ["P3", guerrero, "me ha caido una piedra de esas de habilidad de nivel 5, en que la gasto?"],
  ["P4", guerrero, "que es mejor subir, la roja o la verde?"],
  ["P5", guerrero, "para que vale lo del espiritu ese?"],
  ["P6", guerrero, "cuando puedo elegir subclase?"],
  ["P7", guerrero, "que resis tengo que llevar en el acto 2?"],
  ["P8", guerrero, "no me deja equipar la gema, pone que no cumplo los requisitos"],
  ["P9", guerrero, "en que me gasto los puntos del arbol?"],
  ["P10", guerrero, "como le meto mas gemas de apoyo a una habilidad?"],
  ["P11", exploradora, "mi flecha de rayo se queda corta, como la subo?"],
  ["P12", exploradora, "me ha salido un arco nuevo, como se si me lo pongo?"],
  ["P13", exploradora, "tengo 3 exaltados, que hago con ellos?"],
  ["P14", exploradora, "que heraldos o auras me puedo poner?"],
  ["P15", exploradora, "hay alguna maldicion que me venga bien?"],
  ["P16", exploradora, "quiero ir con bichos que peleen por mi, cuales hay?"],
  ["P17", exploradora, "aceleracion de proyectiles, la 1 o la 2?"],
  ["P18", exploradora, "los jefes me duran una eternidad"],
  ["P19", exploradora, "donde farmeo oro rapido?"],
  ["P20", exploradora, "merece la pena el modo hardcore?"],
];
/**
 * Preguntas de control (tarea 12, 25-11-2026): escritas DESPUÉS de dejar fijas
 * las instrucciones de la IA, que no se han tocado desde entonces. Las nuevas
 * de arriba no valen de prueba limpia: las instrucciones se escribieron
 * conociéndolas. Las tres últimas no tienen regla: lo correcto es «no lo sé».
 */
const CONTROL = [
  ["C1", guerrero, "con que complemento embate rodante?"],
  ["C2", guerrero, "se puede poner una cuarta gemita en la habilidad?"],
  ["C3", guerrero, "tengo puntos sin gastar del arbolito ese, donde van?"],
  ["C4", guerrero, "me conviene mas fue o des?"],
  ["C5", guerrero, "el boss del acto 1 me funde"],
  ["C6", guerrero, "que es eso de reservar que pone en los heraldos?"],
  ["C7", guerrero, "titan o herrero?"],
  ["C8", guerrero, "el casco nuevo pone letras rojas y no me deja"],
  ["C9", guerrero, "que orbe uso para meterle otra propiedad a mi maza amarilla?"],
  ["C10", guerrero, "me pongo un escudo o sigo con el mazo grande?"],
  ["C11", exploradora, "pararrayos no hace nada de daño, que le hago?"],
  ["C12", exploradora, "este carcaj es mejor o peor que el mio?"],
  ["C13", exploradora, "hay algo para que los enemigos reciban mas daño de rayo?"],
  ["C14", exploradora, "puedo llevar un lobo o algo que me acompañe?"],
  ["C15", exploradora, "tengo 20 de frio, es poco?"],
  ["C16", exploradora, "me ha tocado una gema de apoyo sin tallar, cual saco?"],
  ["C17", exploradora, "tengo una sin tallar del 9, que saco para el arco?"],
  ["C18", exploradora, "para que sirve el orbe de caos?"],
  ["C19", exploradora, "que clase es la mas facil para empezar?"],
  ["C20", exploradora, "como vendo cosas a otros jugadores?"],
];
const ASKED = process.argv.includes("--control") ? CONTROL : process.argv.includes("--nuevas") ? NUEVAS : QUESTIONS;

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

  for (const [id, profile, question] of ASKED) {
    if (SOLO && !SOLO.includes(id)) continue;
    const started = Date.now();
    const res = await fetch(`${BASE}/api/mentor/query`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question, profile, budget: null, goal: { kind: "balanced" },
        league: profile.league, patch: profile.patch, lang: "es",
      }),
    });
    const body = await res.json();
    const ms = Date.now() - started;
    const a = body.answer;
    results.push({
      id, personaje: profile.name, question, status: res.status, ms,
      intent: a?.intent ?? null, responseMode: a?.responseMode ?? null,
      model: a?.model ?? null, fallbackReason: a?.fallbackReason ?? null,
      answer: a?.answer ?? JSON.stringify(body),
      nextAction: a?.nextAction?.text ?? null,
    });
    console.log(`${id} ${res.status} ${a?.intent} ${a?.responseMode} ${a?.fallbackReason ?? ""} ${ms} ms`);
    await wait(a?.model ? ESPERA_IA_MS : 500);
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
