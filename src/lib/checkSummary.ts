import type { BuildPriority, CheckStage } from "./buildPriorities";
import { CHECK_TEXT, type CheckLang } from "./checkText";

/**
 * Resumen en texto plano del chequeo, para pegarlo en Discord o Reddit al
 * pedir ayuda. Solo repite lo que ya muestra la página y termina con la
 * dirección de la web, que se toma de donde esté publicada.
 */
export function checkSummaryText(options: {
  /** «Ranger · Ritualist · nivel 90»; null en el modo manual. */
  identity: string | null;
  priorities: BuildPriority[];
  stage: CheckStage;
  lang: CheckLang;
  siteUrl: string;
}): string {
  const text = CHECK_TEXT[options.lang];
  const header = ["Exile Mentor", options.identity, text.summary.stage[options.stage]]
    .filter((part): part is string => !!part)
    .join(" · ");
  const lines =
    options.priorities.length === 0
      ? [text.priorities.none]
      : options.priorities.map(
          (priority, index) =>
            `${index + 1}. [${text.priorities.severity[priority.severity]}] ${priority.title} — ${priority.facts.join("; ")}`,
        );
  return [header, ...lines, text.summary.footer(options.siteUrl)].join("\n");
}
