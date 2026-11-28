import { ArrowRight } from "lucide-react";
import { FLUXES, FLUX_SOURCE, evaluateFluxPlan } from "@shared/craftingFluxes.js";
import type { Item } from "@shared/domain.js";
import { CraftingPlannerCard } from "@/components/CraftingPlannerCard";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    eyebrow: "Cambia las resistencias de elemento",
    title: "Flujos",
    intro: "Mira las resistencias de tu pieza y te dice qué haría cada uno de los cuatro flujos.",
    each: "Qué haría cada flujo en esta pieza",
    allTo: (target: string) => `todo a ${target}`,
    noChange: "No cambia nada en esta pieza.",
    beforeSteps: [
      "Comprueba que la pieza sigue igual que cuando la pegaste aquí.",
      "Pon el flujo encima de la pieza en el juego y lee su descripción: si no coincide con la de abajo, no lo gastes.",
      "Mira antes qué resistencia te falta de verdad (tecla C en el juego).",
    ],
    sourceAfter: "No sé qué resistencia le falta a tu personaje: eso lo ves en el juego.",
  },
  {
    eyebrow: "Changes resistances to another element",
    title: "Fluxes",
    intro: "It reads your item's resistances and tells you what each of the four fluxes would do.",
    each: "What each flux would do to this item",
    allTo: (target: string) => `everything to ${target}`,
    noChange: "Changes nothing on this item.",
    beforeSteps: [
      "Check the item is still the same as when you pasted it here.",
      "Hover the flux over the item in game and read its description: if it doesn't match the one below, don't spend it.",
      "Check first which resistance you're actually short on (C key in game).",
    ],
    sourceAfter: "I don't know which resistance your character is short on: you see that in game.",
  },
);

interface FluxPlannerProps {
  item: Item;
  patch: string;
}

/** Planificador de flujos de resistencias (tarea 19 del plan). */
export function FluxPlanner({ item, patch }: FluxPlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const evaluation = evaluateFluxPlan(item, { patch }, lang);

  return (
    <CraftingPlannerCard
      testId="crafting-flux"
      itemId={item.id}
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      verdict={evaluation}
      gameText={[
        ...FLUXES.map((flux) => ({ name: flux.name[lang], lines: [flux.text[lang]] })),
        { lines: [FLUX_SOURCE.usedOn[lang]] },
      ]}
      beforeSteps={t.beforeSteps}
      source={{
        readAt: FLUX_SOURCE.readAt,
        patch: FLUX_SOURCE.patch,
        url: FLUX_SOURCE.equivalencesUrl[lang],
        officialUrl: FLUX_SOURCE.official.url,
      }}
      sourceAfter={t.sourceAfter}
    >
      {evaluation.options.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-foreground">{t.each}</p>
          <ul className="mt-1 space-y-2" data-testid="crafting-flux-options">
            {evaluation.options.map((option) => (
              <li
                key={option.id}
                className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 text-xs"
                data-testid={`crafting-flux-option-${option.id}`}
              >
                <p className="font-medium text-foreground">
                  {option.name} <span className="font-normal text-muted-foreground">· {t.allTo(option.target)}</span>
                </p>
                {option.changes.length === 0 ? (
                  <p className="mt-0.5 text-muted-foreground">{t.noChange}</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {option.changes.map((change) => (
                      <li key={`${change.modifierId}-${change.from}`} className="flex flex-wrap items-center gap-x-1.5 text-foreground/85">
                        <span>{change.from}</span>
                        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="text-emerald-200">{change.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {option.warnings.map((warning) => (
                  <p key={warning} className="mt-1 text-amber-300/90">
                    {warning}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}
    </CraftingPlannerCard>
  );
}
