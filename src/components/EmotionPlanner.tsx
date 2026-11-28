import { useState } from "react";
import { EMOTION_SOURCE, emotionAffixWord, evaluateEmotionPlan } from "@shared/craftingEmotions.js";
import type { Item } from "@shared/domain.js";
import { CraftingPlannerCard, PlannerModifierList } from "@/components/CraftingPlannerCard";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    eyebrow: "Cambia un modificador de una joya",
    title: "Emociones líquidas",
    intro: "Mira tu joya y te dice qué modificador le pondría cada emoción y qué probabilidad hay de perder uno que quieres.",
    which: "¿Qué emoción tienes?",
    choose: "Elige una emoción",
    nothingFor: "no dice nada para esta joya",
    all: (count: number) => `Ver qué pone cada una de las ${count} en esta joya`,
    modifiers: "Lo que puede quitar",
    beforeSteps: [
      "Comprueba que la joya sigue igual que cuando la pegaste aquí.",
      "Pon la emoción encima de la joya en el juego y lee su descripción: si no coincide con lo de arriba, no la gastes.",
      "Decide antes qué harás si se lleva un modificador que querías conservar.",
    ],
    sourceAfter: "No calculo qué modificador vale más: eso lo decides tú.",
  },
  {
    eyebrow: "Swaps one modifier on a jewel",
    title: "Liquid emotions",
    intro: "It looks at your jewel and tells you which modifier each emotion would add and how likely you are to lose one you want.",
    which: "Which emotion do you have?",
    choose: "Pick an emotion",
    nothingFor: "says nothing for this jewel",
    all: (count: number) => `See what each of the ${count} adds to this jewel`,
    modifiers: "What it can remove",
    beforeSteps: [
      "Check the jewel is still the same as when you pasted it here.",
      "Hover the emotion over the jewel in game and read its description: if it doesn't match the above, don't spend it.",
      "Decide beforehand what you'll do if it takes a modifier you wanted to keep.",
    ],
    sourceAfter: "I don't work out which modifier is worth more: that's your call.",
  },
);

interface EmotionPlannerProps {
  item: Item;
  patch: string;
  protectedModifierIds: string[];
  /** Cambia los modificadores marcados como «quiero conservar». */
  onProtectedChange: (ids: string[]) => void;
}

/** Planificador de emociones líquidas (tarea 19 del plan). */
export function EmotionPlanner({ item, patch, protectedModifierIds, onProtectedChange }: EmotionPlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [emotionId, setEmotionId] = useState<string | null>(null);
  const evaluation = evaluateEmotionPlan(item, { patch, protectedModifierIds, emotionId }, lang);
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const target = evaluation.jewel?.timeLost ? "time-lost" : "basic";
  const selectId = `crafting-emotion-select-${item.id}`;

  return (
    <CraftingPlannerCard
      testId="crafting-emotion"
      itemId={item.id}
      eyebrow={t.eyebrow}
      title={evaluation.selected?.name ?? t.title}
      intro={t.intro}
      verdict={evaluation}
      gameText={[{ lines: [EMOTION_SOURCE.text[target][lang]] }]}
      beforeSteps={t.beforeSteps}
      source={{
        readAt: EMOTION_SOURCE.readAt,
        patch: EMOTION_SOURCE.patch,
        url: EMOTION_SOURCE.url[lang],
        officialUrl: EMOTION_SOURCE.official.url,
      }}
      sourceAfter={t.sourceAfter}
    >
      {evaluation.options.length > 0 && (
        <>
          <div>
            <label htmlFor={selectId} className="text-xs font-semibold text-foreground">
              {t.which}
            </label>
            <select
              id={selectId}
              className="mt-1 block w-full max-w-md rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              value={emotionId ?? ""}
              onChange={(event) => setEmotionId(event.target.value || null)}
              data-testid="crafting-emotion-select"
            >
              <option value="">{t.choose}</option>
              {evaluation.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <details className="text-xs" data-testid="crafting-emotion-all">
            <summary className="cursor-pointer font-semibold text-foreground">{t.all(evaluation.options.length)}</summary>
            <ul className="mt-1 space-y-1">
              {evaluation.options.map((option) => (
                <li key={option.id} className="rounded border border-border/60 bg-muted/10 px-2 py-1.5">
                  <span className="font-medium text-foreground">{option.name}</span>
                  {option.outcomes.length === 0 ? (
                    <span className="text-muted-foreground"> · {t.nothingFor}</span>
                  ) : (
                    option.outcomes.map((outcome) => (
                      <span key={`${outcome.affix}-${outcome.text}`} className="block text-foreground/85">
                        <span className="text-muted-foreground">{emotionAffixWord(outcome.affix, lang)}: </span>
                        {outcome.text}
                      </span>
                    ))
                  )}
                </li>
              ))}
            </ul>
          </details>
          <PlannerModifierList
            testId="crafting-emotion-modifiers"
            title={t.modifiers}
            modifiers={explicit}
            protectedModifierIds={protectedModifierIds}
            onChange={onProtectedChange}
          />
        </>
      )}
    </CraftingPlannerCard>
  );
}
