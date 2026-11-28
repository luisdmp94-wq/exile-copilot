import type { ReactNode } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import type { PlannerVerdict } from "@shared/craftingPlannerRules.js";
import type { Modifier } from "@shared/domain.js";
import { Badge } from "@/components/ui/badge";
import { texts, useLang, useText } from "@/i18n/lang";
import { withoutRollRange } from "@/lib/modifierText";

/**
 * El marco común de los planificadores de crafteo avanzado (tarea 19 del
 * plan): previsión, sacrificio, emociones y flujos. Respuesta primero: arriba
 * el veredicto con la pieza delante; debajo, lo que dice el juego y de dónde
 * sale. Ninguno crea sesión: solo leen.
 */

const PLANNER_STATUS_STYLE = {
  compatible: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  blocked: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  "needs-data": "border-amber-500/40 bg-amber-500/10 text-amber-300",
} as const;

const TEXT = texts(
  {
    status: { compatible: "Se puede usar", blocked: "No se puede", "needs-data": "Faltan datos" } as Record<PlannerVerdict["status"], string>,
    gameSays: "Lo que dice en el juego",
    before: "Antes de gastarlo",
    sourceBefore: (date: string, patch: string) => `Texto del objeto leído el ${date} (parche ${patch}) en `,
    sourceAnd: " · presentado por GGG en ",
    sourceOfficial: "sus notas oficiales",
    wanted: "lo quieres conservar",
    notWanted: "sin marcar",
    markWanted: "Toca los que quieres conservar y te digo la probabilidad.",
  },
  {
    status: { compatible: "You can use it", blocked: "Can't be used", "needs-data": "Data missing" },
    gameSays: "What it says in game",
    before: "Before you spend it",
    sourceBefore: (date: string, patch: string) => `Item text read on ${date} (patch ${patch}) at `,
    sourceAnd: " · introduced by GGG in ",
    sourceOfficial: "its official notes",
    wanted: "you want to keep it",
    notWanted: "not marked",
    markWanted: "Tap the ones you want to keep and I'll give you the odds.",
  },
);

/** «2026-11-28» → «28-11-2026». */
const dayFirst = (iso: string) => iso.split("-").reverse().join("-");

interface CraftingPlannerCardProps {
  /** Prefijo de los `data-testid`: `crafting-foresight`, `crafting-flux`… */
  testId: string;
  itemId: string;
  eyebrow: string;
  title: string;
  intro: string;
  verdict: PlannerVerdict;
  /** Lo propio de cada planificador: va entre el veredicto y el texto del juego. */
  children?: ReactNode;
  /** Bloques con el texto del objeto, tal como sale en el juego. */
  gameText: Array<{ name?: string; lines: readonly string[]; note?: string | null }>;
  /** Pasos de comprobación; solo se enseñan cuando la moneda se puede usar. */
  beforeSteps: readonly string[];
  source: { readAt: string; patch: string; url: string; officialUrl: string };
  /** Lo que el planificador no hace, en una frase. */
  sourceAfter: string;
}

export function CraftingPlannerCard({
  testId,
  itemId,
  eyebrow,
  title,
  intro,
  verdict,
  children,
  gameText,
  beforeSteps,
  source,
  sourceAfter,
}: CraftingPlannerCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const titleId = `${testId}-title-${itemId}`;

  return (
    <section
      className="flex flex-col gap-4 rounded-md border border-violet-500/25 bg-violet-500/[0.035] p-3"
      data-testid={testId}
      aria-labelledby={titleId}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-violet-300/80">{eyebrow}</p>
          <h3 id={titleId} className="mt-1 font-medium text-foreground">
            {title}
          </h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{intro}</p>
        </div>
        <Badge variant="outline" className={PLANNER_STATUS_STYLE[verdict.status]} data-testid={`${testId}-status`} data-status={verdict.status}>
          {t.status[verdict.status]}
        </Badge>
      </div>

      <div className={`rounded-md border p-3 text-sm ${PLANNER_STATUS_STYLE[verdict.status]}`} data-testid={`${testId}-reason`}>
        <p className="font-medium leading-relaxed">{verdict.reason}</p>
        {verdict.outlook.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-foreground/90">
            {verdict.outlook.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>

      {children}

      <div className="rounded-md border border-border/60 bg-muted/10 p-3 text-xs" data-testid={`${testId}-game-text`}>
        <p className="font-semibold text-foreground">{t.gameSays}</p>
        {gameText.map((block) => (
          <div key={block.name ?? block.lines[0]} className="mt-1.5">
            {block.name && <p className="font-medium text-foreground/90">{block.name}</p>}
            {block.lines.map((line) => (
              <p key={line} className="leading-relaxed text-foreground/85">
                {line}
              </p>
            ))}
            {block.note && <p className="mt-1 leading-relaxed text-amber-300/90">{block.note}</p>}
          </div>
        ))}
      </div>

      {verdict.status === "compatible" && beforeSteps.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t.before}</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5">
            {beforeSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {t.sourceBefore(lang === "en" ? source.readAt : dayFirst(source.readAt), source.patch)}
        <a className="underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">
          poe2db
        </a>
        {t.sourceAnd}
        <a className="underline underline-offset-2" href={source.officialUrl} target="_blank" rel="noreferrer">
          {t.sourceOfficial}
        </a>
        {`. ${sourceAfter}`}
      </p>
    </section>
  );
}

interface PlannerModifierListProps {
  testId: string;
  title: string;
  modifiers: readonly Modifier[];
  protectedModifierIds: readonly string[];
  /** Cambia los marcados como «quiero conservar»: se marcan aquí mismo, con un toque. */
  onChange: (ids: string[]) => void;
}

/** Los modificadores entre los que se sortea. Un toque marca o desmarca el que se quiere conservar. */
export function PlannerModifierList({ testId, title, modifiers, protectedModifierIds, onChange }: PlannerModifierListProps) {
  const t = useText(TEXT);
  if (modifiers.length === 0) return null;
  const toggle = (id: string) =>
    onChange(protectedModifierIds.includes(id) ? protectedModifierIds.filter((each) => each !== id) : [...protectedModifierIds, id]);
  return (
    <div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.markWanted}</p>
      <ul className="mt-1 space-y-1" data-testid={testId}>
        {modifiers.map((modifier) => {
          const wanted = protectedModifierIds.includes(modifier.id);
          return (
            <li key={modifier.id}>
              <button
                type="button"
                aria-pressed={wanted}
                onClick={() => toggle(modifier.id)}
                className={`flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                  wanted
                    ? "border-emerald-500/35 bg-emerald-500/[0.06] text-emerald-100"
                    : "border-border/60 bg-muted/10 text-foreground/85 hover:border-emerald-500/30"
                }`}
              >
                {wanted ? (
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1 whitespace-pre-line break-words">{withoutRollRange(modifier.text)}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{wanted ? t.wanted : t.notWanted}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
