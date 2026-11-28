import { HINEKORA_LOCK_SOURCE, evaluateForesightPlan } from "@shared/craftingForesight.js";
import type { Item } from "@shared/domain.js";
import { CraftingPlannerCard } from "@/components/CraftingPlannerCard";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    eyebrow: "Mira antes de gastar",
    intro: "Te dice si se le puede poner a tu pieza y para qué te sirve. El resultado previsto lo enseña el juego, no esta web.",
    beforeSteps: [
      "Decide primero qué moneda vas a mirar: el Mechón solo vale para la siguiente.",
      "Pon el Mechón en la pieza y no la toques con nada más.",
      "Mira el resultado que enseña el juego. Si no te convence, no gastes la moneda sin leer antes qué pasa con el Mechón.",
    ],
    sourceAfter: "No calculo ni adivino el resultado: eso solo lo sabe el juego.",
  },
  {
    eyebrow: "Look before you spend",
    intro: "It tells you whether it can go on your item and what it's good for. The foreseen result is shown by the game, not this site.",
    beforeSteps: [
      "Decide first which currency you'll check: the Lock only covers the next one.",
      "Put the Lock on the item and don't touch it with anything else.",
      "Look at the result the game shows. If you're not convinced, don't spend the currency before reading what happens to the Lock.",
    ],
    sourceAfter: "I don't work out or guess the result: only the game knows it.",
  },
);

interface ForesightPlannerProps {
  item: Item;
  /** El parche del personaje: la regla se leyó en 0.5.5 y no se da por buena para otro. */
  patch: string;
  /** Los modificadores que el jugador marcó como «quiero conservar» en su plan. */
  protectedModifierIds: string[];
}

/** Planificador de previsión: el Mechón de Hinekora (tarea 19 del plan). */
export function ForesightPlanner({ item, patch, protectedModifierIds }: ForesightPlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const evaluation = evaluateForesightPlan(item, { patch, protectedModifierIds }, lang);

  return (
    <CraftingPlannerCard
      testId="crafting-foresight"
      itemId={item.id}
      eyebrow={t.eyebrow}
      title={HINEKORA_LOCK_SOURCE.name[lang]}
      intro={t.intro}
      verdict={evaluation}
      gameText={[{ lines: HINEKORA_LOCK_SOURCE.text[lang] }]}
      beforeSteps={t.beforeSteps}
      source={{
        readAt: HINEKORA_LOCK_SOURCE.readAt,
        patch: HINEKORA_LOCK_SOURCE.patch,
        url: HINEKORA_LOCK_SOURCE.url[lang],
        officialUrl: HINEKORA_LOCK_SOURCE.official.url,
      }}
      sourceAfter={t.sourceAfter}
    />
  );
}
