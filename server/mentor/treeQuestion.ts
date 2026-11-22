/**
 * Preguntas al Mentor sobre el árbol de pasivas («¿por dónde sigo en el
 * árbol?», «¿qué notable cojo?»).
 *
 * Contesta lo mismo que la tarjeta «Tu árbol de pasivas»: las reglas y el
 * árbol oficial deciden. Sin IA y sin inventar: si el personaje no trae su
 * árbol, se le dice cómo meterlo.
 */
import type { CharacterProfile } from "../../shared/domain.js";
import { normalizeQuestion } from "../../shared/mentorIntent.js";
import { treeRequestFromProfile } from "../../shared/passiveTreeRequest.js";
import { advisePassiveTree, type TreeKnowledge } from "../advice/passiveTreeAdvisor.js";

type Lang = "es" | "en";

/** «árbol», «pasivas», «notable», «puntos de pasiva», «skill tree», «passive». */
export function isPassiveTreeQuestion(normalizedQuestion: string): boolean {
  const q = ` ${normalizedQuestion} `;
  if (/\b(gemas?|asistencias?|soportes?|support)\b/.test(q)) return false;
  return /\barbol\b|\bpasivas?\b|\bnotables?\b|\bpuntos? de (pasiva|habilidad)|\bskill tree\b|\bpassive( tree| skills?| points?)?\b|\bpassives\b|\bnotables?\b|\bkeystones?\b|\bpuntos? del arbol\b/.test(q);
}

function list(items: string[]): string {
  return items.map((line) => `- ${line}`).join("\n");
}

export function answerPassiveTreeQuestion(
  knowledge: TreeKnowledge,
  question: string,
  profile: CharacterProfile | null,
  lang: Lang,
): string | null {
  if (!isPassiveTreeQuestion(normalizeQuestion(question))) return null;
  const es = lang === "es";

  if (!profile || profile.passives.allocated.length === 0) {
    return es
      ? "Para decirte por dónde seguir necesito tu árbol. Pega tu código de Path of Building 2 en " +
          "«Editar personaje» → «Rellénalo rápido» y te digo tus próximos notables, con el camino dibujado."
      : "To tell you where to go next I need your tree. Paste your Path of Building 2 code in " +
          "“Edit character” → “Fill it in fast” and I'll show your next notables, with the path drawn.";
  }

  const advice = advisePassiveTree(knowledge, treeRequestFromProfile(profile, lang));
  if (advice.skills.length === 0) {
    return es
      ? "Tengo tu árbol, pero no sé qué habilidad usas para hacer daño. Dímela en «Editar personaje» " +
          "(o en la revisión rápida) y te digo qué notables le sirven."
      : "I have your tree, but I don't know which skill does your damage. Tell me in “Edit character” " +
          "(or in the quick review) and I'll tell you which notables help it.";
  }
  if (advice.offence.length === 0 && advice.defence === null) {
    return es
      ? "No veo ningún notable cerca que ayude a lo que usas. Mira tu árbol dibujado en «Tu árbol de pasivas»."
      : "I don't see any nearby notable that helps what you use. Look at your tree in “Your passive tree”.";
  }

  const lines: string[] = [];
  const skills = advice.skills.slice(0, 3).join(es ? ", " : ", ");
  lines.push(es ? `Por dónde seguir en tu árbol (para ${skills}):` : `Where to go next in your tree (for ${skills}):`);
  advice.offence.forEach((step, index) => {
    const points = es ? `${step.points} ${step.points === 1 ? "punto" : "puntos"}` : `${step.points} ${step.points === 1 ? "point" : "points"}`;
    lines.push(`${index + 1}. ${step.name} (${points}): ${step.stats.join("; ")}. ${step.reasons.join(" ")}`);
  });
  if (advice.defence) {
    const step = advice.defence;
    lines.push(
      es
        ? `Si mueres mucho: ${step.name} (${step.points} puntos desde tu árbol de hoy): ${step.stats.join("; ")}.`
        : `If you die a lot: ${step.name} (${step.points} points from your tree today): ${step.stats.join("; ")}.`,
    );
  }
  const notes: string[] = [];
  notes.push(
    es
      ? "En el árbol del juego, escribe el nombre en «Busca aquí». El camino lo tienes dibujado en «Tu árbol de pasivas»."
      : "In the game's tree, type the name in the search box. The path is drawn in “Your passive tree”.",
  );
  if (advice.versionMismatch) {
    notes.push(
      es
        ? `Tu código es del árbol ${advice.versionMismatch.code} y la web usa el ${advice.versionMismatch.tree}: algún nodo puede no casar.`
        : `Your code is from tree ${advice.versionMismatch.code} and the site uses ${advice.versionMismatch.tree}: some nodes may not match.`,
    );
  }
  return `${lines.join("\n")}\n\n${list(notes)}`;
}
