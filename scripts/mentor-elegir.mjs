/**
 * Medición de «elegir habilidades» (tarea 16 del plan, 27-11-2026). Sale de lo
 * que contó Gabo, el hermano de Luis: «lo peor es elegir habilidades» y al
 * final copió una build porque montar la suya era difícil y lento.
 *
 * Uso:
 *   node scripts/mentor-elegir.mjs             → las diez de desarrollo (D), SOLO REGLAS
 *   node scripts/mentor-elegir.mjs --control   → las doce de control (C), SOLO REGLAS
 *   --con-ia usa la IA del .env (gasta cupo de Groq: como mucho dos pasadas al día).
 *   MEDIR_SALIDA=ruta.json guarda ahí las respuestas.
 *
 * Las de desarrollo (D) se escribieron para ver el problema y con ellas se
 * escriben las reglas: no valen de prueba. Las de control (C) se escribieron
 * ANTES de tocar el código, con otros personajes (los de --control14), y no se
 * miran mientras se escriben las reglas.
 *
 * Qué cuenta como «bien» (escrito antes de medir):
 *  - Elegir («¿qué habilidad me cojo?», «¿cuáles hay de ballesta?»): nombra tres
 *    o más habilidades de verdad que valen con el arma que lleva, ninguna de
 *    otra arma, y dice qué hace cada una.
 *  - «¿Me vale X con mi arma?»: dice sí o no, bien, y con qué arma sale X.
 *  - «¿Por qué combinan?»: dice qué tienen en común o qué le hace la asistencia
 *    a esa habilidad. No habla de resistencias ni de otra cosa.
 *  - «Quiero montar mi build»: da pasos o manda al configurador. No «no lo sé».
 *  «A medias»: contesta al tema pero falta algo de lo de arriba. «Mal»: «no lo
 *  sé», otro tema o un dato falso.
 */
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const PORT = Number(process.env.MEDIR_PORT ?? 7194);
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const CON_IA = process.argv.includes("--con-ia");
const tempRoot = mkdtempSync(join(tmpdir(), "exile-copilot-elegir-"));
const OUT = process.env.MEDIR_SALIDA ?? join(tempRoot, "elegir.json");

/** Los personajes son los de las charlas: se piden a mentor-charla.mjs para no copiarlos. */
function perfiles(flag) {
  const file = join(tempRoot, `perfiles${flag}.json`);
  execSync(`"${process.execPath}" "${join(REPO, "scripts", "mentor-charla.mjs")}" ${flag} --perfiles`, {
    env: { ...process.env, MEDIR_SALIDA: file },
    stdio: "ignore",
  });
  return JSON.parse(readFileSync(file, "utf8"));
}

const K = perfiles("--control");
const N = perfiles("--control14");
const guerrero = K.K1; // mazo a dos manos, nivel 14
const exploradora = Object.values(K).find((p) => p.name !== guerrero.name); // arco, nivel 22
const mercenario = N.N1; // ballesta, nivel 47
const monje = N.N2; // bastón, nivel 35
const hechicera = N.N3; // báculo, hechizos de rayo y hielo, nivel 28
const cazadora = N.N4; // lanza y rodela, nivel 24

const DESARROLLO = [
  ["D1", guerrero, "no se que habilidades elegir"],
  ["D2", guerrero, "que habilidad me cojo ahora?"],
  ["D3", guerrero, "que habilidades pegan con mi arma?"],
  ["D4", guerrero, "por que furia va bien con terremoto?"],
  ["D5", guerrero, "me vale flecha de rayo con mi mazo?"],
  ["D6", guerrero, "como monto mi propia build?"],
  ["D7", exploradora, "no se que habilidades elegir"],
  ["D8", exploradora, "que habilidades pegan con mi arco?"],
  ["D9", exploradora, "que habilidades combinan bien con flecha de rayo?"],
  ["D10", exploradora, "esta build me vale con mi arco?"],
];

const CONTROL = [
  ["C1", mercenario, "q habilidad me pillo ahora?"],
  ["C2", mercenario, "cuales son las habilidades de ballesta?"],
  ["C3", mercenario, "puedo usar cascada glacial con la ballesta?"], // no: es de bastón
  ["C4", monje, "no tengo ni idea de que skills coger"],
  ["C5", monje, "que ataques hay para baston?"],
  ["C6", monje, "flecha de rayo sirve con mi baston?"], // no: es de arco
  ["C7", hechicera, "que hechizos puedo elegir?"],
  ["C8", hechicera, "bola de fuego me vale con mi baculo?"], // sí: es un hechizo, no pide un arma
  ["C9", hechicera, "terremoto me sirve si llevo baculo?"], // no: es de maza
  ["C10", cazadora, "que habilidades van con lanza?"],
  ["C11", cazadora, "por que combina ataques rapidos con corte giratorio?"],
  ["C12", cazadora, "quiero montarme mi propia build, por donde empiezo?"],
];

const ASKED = process.argv.includes("--control") ? CONTROL : DESARROLLO;

const env = {
  ...process.env,
  PORT: String(PORT),
  NODE_ENV: "development",
  PUBLIC_DEPLOYMENT: "false",
  SECURE_COOKIES: "false",
  POE_NINJA_OFFLINE: "true",
  MENTOR_RATE_LIMIT_PER_MINUTE: "300",
  DATABASE_PATH: join(tempRoot, "elegir.db"),
};
if (!CON_IA) env.MENTOR_AI_ENABLED = "false";

const proc = spawn(
  process.execPath,
  [join(REPO, "node_modules", "vite", "bin", "vite.js"), "--port", String(PORT), "--strictPort"],
  { cwd: REPO, env, stdio: ["ignore", "pipe", "pipe"] },
);

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
      intent: a?.intent ?? null, responseMode: a?.responseMode ?? null, model: a?.model ?? null,
      answer: a?.answer ?? JSON.stringify(body),
    });
    await wait(a?.model ? 20000 : 300);
  }
} catch (err) {
  console.error("ERROR:", err.message);
} finally {
  writeFileSync(OUT, JSON.stringify(results, null, 2), "utf8");
  try { execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: "ignore" }); } catch { proc.kill(); }
}
for (const r of results) {
  console.log(`\n### ${r.id} [${r.personaje}] ${r.question}\n(${r.intent}, ${r.responseMode}, modelo: ${r.model})\n${r.answer}`);
}
console.log(`\nhecho: ${results.length} respuestas en ${OUT}`);
process.exit(0);
