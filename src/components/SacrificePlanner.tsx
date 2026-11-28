import { SACRIFICE_ORBS, SACRIFICE_SOURCE, evaluateSacrificePlan } from "@shared/craftingSacrifice.js";
import type { Item } from "@shared/domain.js";
import { CraftingPlannerCard, PlannerModifierList } from "@/components/CraftingPlannerCard";
import { texts, useLang, useText } from "@/i18n/lang";
import { withoutRollRange } from "@/lib/modifierText";

const TEXT = texts(
  {
    eyebrow: "Mejora un encantamiento corrupto",
    title: "Orbes de sacrificio",
    intro: "Mira tu pieza y te dice cuál de los cuatro orbes le toca, si se puede usar y qué probabilidad hay de perder un modificador que quieres.",
    enchantment: "El encantamiento que mejorará",
    enchantments: "Encantamientos de la pieza",
    modifiers: "Lo que puede quitar",
    fourOrbs: "Hay cuatro, uno por tipo de pieza",
    orbFor: (name: string, target: string) => `${name}: ${target}`,
    beforeSteps: [
      "Comprueba que la pieza sigue igual que cuando la pegaste aquí.",
      "Pon el orbe encima de la pieza en el juego y lee su descripción: si no coincide con la de arriba, no lo gastes.",
      "Decide antes qué harás si se lleva un modificador que querías conservar.",
    ],
    sourceAfter: "No sé en qué se convierte cada encantamiento ni qué modificador vale más.",
  },
  {
    eyebrow: "Upgrades a corruption enchantment",
    title: "Orbs of Sacrifice",
    intro: "It looks at your item and tells you which of the four orbs it takes, whether it can be used and how likely you are to lose a modifier you want.",
    enchantment: "The enchantment it will upgrade",
    enchantments: "Enchantments on the item",
    modifiers: "What it can remove",
    fourOrbs: "There are four, one per kind of item",
    orbFor: (name: string, target: string) => `${name}: ${target}`,
    beforeSteps: [
      "Check the item is still the same as when you pasted it here.",
      "Hover the orb over the item in game and read its description: if it doesn't match the one above, don't spend it.",
      "Decide beforehand what you'll do if it takes a modifier you wanted to keep.",
    ],
    sourceAfter: "I don't know what each enchantment turns into, or which modifier is worth more.",
  },
);

interface SacrificePlannerProps {
  item: Item;
  patch: string;
  protectedModifierIds: string[];
  /** Cambia los modificadores marcados como «quiero conservar». */
  onProtectedChange: (ids: string[]) => void;
}

/** Planificador de los Orbes de sacrificio (tarea 19 del plan). */
export function SacrificePlanner({ item, patch, protectedModifierIds, onProtectedChange }: SacrificePlannerProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const evaluation = evaluateSacrificePlan(item, { patch, protectedModifierIds }, lang);
  const usable = evaluation.status === "compatible";
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const orb = evaluation.orb;

  return (
    <CraftingPlannerCard
      testId="crafting-sacrifice"
      itemId={item.id}
      eyebrow={t.eyebrow}
      title={orb ? orb.name[lang] : t.title}
      intro={t.intro}
      verdict={evaluation}
      gameText={
        orb
          ? [{ name: orb.name[lang], lines: [...orb.text[lang], SACRIFICE_SOURCE.usedOn[lang]], note: evaluation.translationNote }]
          : [
              {
                name: t.fourOrbs,
                lines: Object.values(SACRIFICE_ORBS).map((each) => t.orbFor(each.name[lang], each.target[lang])),
              },
            ]
      }
      beforeSteps={t.beforeSteps}
      source={{
        readAt: SACRIFICE_SOURCE.readAt,
        patch: SACRIFICE_SOURCE.patch,
        url: (orb ?? SACRIFICE_ORBS.yaomac).url[lang],
        officialUrl: SACRIFICE_SOURCE.official.url,
      }}
      sourceAfter={t.sourceAfter}
    >
      {usable && (
        <>
          <div data-testid="crafting-sacrifice-enchantments">
            <p className="text-xs font-semibold text-foreground">
              {evaluation.enchantments.length === 1 ? t.enchantment : t.enchantments}
            </p>
            <ul className="mt-1 space-y-1">
              {evaluation.enchantments.map((modifier) => (
                <li key={modifier.id} className="rounded border border-sky-500/30 bg-sky-500/[0.06] px-2 py-1.5 text-xs text-sky-100">
                  {withoutRollRange(modifier.text)}
                </li>
              ))}
            </ul>
          </div>
          <PlannerModifierList
            testId="crafting-sacrifice-modifiers"
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
