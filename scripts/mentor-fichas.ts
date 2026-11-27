/**
 * Enseña las FICHAS que vería la IA en cada turno de una charla, sin gastar
 * cupo: una IA de mentira que no redacta nada (tarea 14, 26-11-2026).
 *
 * Uso: npx tsx scripts/mentor-fichas.ts <charlas.json> [N1,N2]
 * El JSON es el que escribe scripts/mentor-charla.mjs (MEDIR_SALIDA): de ahí
 * salen las preguntas y lo que contestó el Mentor en cada turno. El personaje
 * se lee de un JSON aparte: MEDIR_PERFILES=<perfiles.json> ({ "N1": {...} }).
 */
import { readFileSync } from "node:fs";
import { CharacterProfileSchema, RecommendationMemorySchema } from "../shared/domain.js";
import { loadGemData } from "../server/advice/supportGemAdvisor.js";
import { loadEnglishGemLocale } from "../server/advice/gemLocale.js";
import { loadConfig } from "../server/config.js";
import { createDatabase } from "../server/db/database.js";
import { MentorAiError, type MentorDecisionSelector } from "../server/mentor/mentorAi.js";
import { loadGuideKnowledge } from "../server/mentor/guideKnowledge.js";
import { answerMentorQuery } from "../server/mentor/mentorService.js";
import type { MentorWriteInput } from "../server/mentor/mentorWriter.js";
import { PoeNinjaClient, PriceService } from "../server/services/poeninja.js";

const [, , resultsPath, only] = process.argv;
if (!resultsPath || !process.env.MEDIR_PERFILES) {
  console.error("Uso: MEDIR_PERFILES=perfiles.json npx tsx scripts/mentor-fichas.ts charlas.json [N1,N2]");
  process.exit(1);
}
const results = JSON.parse(readFileSync(resultsPath, "utf8")) as Array<{ id: string; question: string; answer: string }>;
const profiles = JSON.parse(readFileSync(process.env.MEDIR_PERFILES, "utf8")) as Record<string, unknown>;
const wanted = only ? only.split(",") : null;

const config = { ...loadConfig({}), poeNinjaOffline: true };
let seen: MentorWriteInput | null = null;
const selector: MentorDecisionSelector = {
  name: "sin-ia",
  select: async () => {
    throw new MentorAiError("sin IA");
  },
  route: async () => ({ topic: "none" as const, skill: null, support: null, wish: null }),
  write: async (input: MentorWriteInput) => {
    seen = input;
    throw new MentorAiError("sin IA");
  },
};
const deps = {
  priceService: new PriceService(new PoeNinjaClient({ db: createDatabase(":memory:"), config })),
  selector,
  gems: { data: loadGemData(), locale: loadEnglishGemLocale() },
  guides: loadGuideKnowledge(),
};
const memory = RecommendationMemorySchema.parse({ revision: "journal-memory-v1:0000000000000000", primaryEntry: null, recentCompleted: [] });

const chats = new Map<string, typeof results>();
for (const row of results) {
  const chat = row.id.split(".")[0]!;
  chats.set(chat, [...(chats.get(chat) ?? []), row]);
}
for (const [chat, turns] of chats) {
  if (wanted && !wanted.includes(chat)) continue;
  const profile = CharacterProfileSchema.parse(profiles[chat]);
  const conversation: Array<{ role: "player" | "mentor"; text: string }> = [];
  for (const turn of turns) {
    seen = null;
    await answerMentorQuery(
      { profile, budget: null, goal: { kind: "balanced" as const }, league: profile.league, patch: profile.patch, memory, question: turn.question, conversation: conversation.slice(-8) },
      deps,
    );
    console.log(`\n=== ${turn.id} «${turn.question}»`);
    const input = seen as MentorWriteInput | null;
    if (!input) console.log("  (no pasa por el redactor)");
    else for (const ficha of input.fichas) console.log(`  ${ficha.id} [${ficha.tema}] ${ficha.texto}`);
    conversation.push({ role: "player", text: turn.question.slice(0, 800) }, { role: "mentor", text: turn.answer.slice(0, 800) });
  }
}
process.exit(0);
