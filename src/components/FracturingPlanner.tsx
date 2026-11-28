import { FRACTURING_ORB_SOURCE, evaluateFracturingPlan } from "@shared/craftingFracturing.js";
import type { Item } from "@shared/domain.js";
import { CraftingPlannerCard, PlannerModifierList } from "@/components/CraftingPlannerCard";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    eyebrow: "Deja fijo un modificador",
    intro: "Mira tu pieza y te dice si el orbe se puede usar y qué probabilidad hay de que se quede fijo un modificador que quieres.",
    modifiers: "Dónde puede caer",
    beforeSteps: [
      "Comprueba que la pieza sigue igual que cuando la pegaste aquí.",
      "Pon el orbe encima de la pieza en el juego y lee su descripción: si no coincide con la de arriba, no lo gastes.",
      "Decide antes qué harás si se queda fijo un modificador que no querías.",
    ],
    sourceAfter: "No calculo qué modificador vale más: eso lo decides tú.",
  },
  {
    eyebrow: "Locks one modifier in place",
    intro: "It looks at your item and tells you whether the orb can be used and how likely it is to lock a modifier you want.",
    modifiers: "Where it can land",
    beforeSteps: [
      "Check the item is still the same as when you pasted it here.",
      "Hover the orb over the item in game and read its description: if it doesn't match the one above, don't spend it.",
      "Decide beforehand what you'll do if it locks a modifier you didn't want.",
    ],
    sourceAfter: "I don't work out which modifier is worth more: that's your call.",
  },
);

interface FracturingPlannerProps {
  item: Item;
  /** El parche del personaje: la regla se leyó en 0.5.5 y no se da por buena para otro. */
  patch: string;
  /** Los modificadores que el jugador marcó como «quiero conservar» en su plan. */
  protectedModifierIds: string[];
  /** Cambia los modificadores marcados como «quiero conservar». */
  onProtectedChange: (ids: string[]) => void;
}

/**
 * Planificador del Orbe fracturante (tarea 19 del plan). Respuesta primero: si
 * se puede usar y qué pasará, con la pieza delante. No crea sesión: solo lee.
 */
export function FracturingPlanner({ item, patch, protectedModifierIds, onProtectedChange }: FracturingPlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const evaluation = evaluateFracturingPlan(item, { patch, protectedModifierIds }, lang);
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");

  return (
    <CraftingPlannerCard
      testId="crafting-fracturing"
      itemId={item.id}
      eyebrow={t.eyebrow}
      title={FRACTURING_ORB_SOURCE.name[lang]}
      intro={t.intro}
      verdict={evaluation}
      gameText={[{ lines: [FRACTURING_ORB_SOURCE.text[lang], FRACTURING_ORB_SOURCE.restriction[lang]] }]}
      beforeSteps={t.beforeSteps}
      source={{
        readAt: FRACTURING_ORB_SOURCE.readAt,
        patch: FRACTURING_ORB_SOURCE.patch,
        url: FRACTURING_ORB_SOURCE.url[lang],
        officialUrl: FRACTURING_ORB_SOURCE.official.url,
      }}
      sourceAfter={t.sourceAfter}
    >
      {evaluation.status === "compatible" && (
        <PlannerModifierList
          testId="crafting-fracturing-modifiers"
          title={t.modifiers}
          modifiers={explicit}
          protectedModifierIds={protectedModifierIds}
          onChange={onProtectedChange}
        />
      )}
    </CraftingPlannerCard>
  );
}
