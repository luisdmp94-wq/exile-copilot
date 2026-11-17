/**
 * ACADEMIA DE CRAFTING — NIVEL MEDIO EN INGLÉS.
 *
 * Sustituye por id los textos de `craftingMediumAcademy.ts`. Hechos, decisiones
 * y objetos (salvo su texto) son los mismos, así que el resolutor da la misma
 * respuesta en los dos idiomas.
 */

import { localizeAcademyItem, type AcademyItemTextEn, type AcademyLang } from "./craftingAcademyEn.js";
import {
  CRAFTING_MEDIUM_ACADEMY_EVIDENCE,
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  CRAFTING_MEDIUM_BASE_READING_HELP,
  type MediumAcademyScenario,
} from "./craftingMediumAcademy.js";

export const CRAFTING_MEDIUM_ACADEMY_EVIDENCE_EN =
  "Synthetic exercises based on currency effects observed in the game client on 22 Aug 2026. They don't represent drops, mod pools, weights, odds or prices.";

export const CRAFTING_MEDIUM_BASE_READING_HELP_EN =
  "The base is the type shown under the item's name. You don't need to know the ideal base for your build to get started: use the piece you have equipped in that slot as a reference you can check. If you can't confirm yet that the candidate works for your character, don't spend.";

const GEMINI_BOW = "Gemini Bow";
const PHYS = "Increased Physical Damage";
const ADDS_PHYS = "Adds Physical Damage to Attacks";
const ATTACK_SPEED = "Increased Attack Speed";

export const MEDIUM_ACADEMY_ITEMS_EN: Readonly<Record<string, AcademyItemTextEn>> = {
  "medio-base-adecuada": { name: "Practice Bow", baseType: GEMINI_BOW },
  "medio-magico-sin-objetivo": {
    name: "Uncertain Bow",
    baseType: GEMINI_BOW,
    modifiers: { "med-o1": "+31 to Accuracy Rating" },
  },
  "medio-magico-inutil": {
    name: "Bow of Detours",
    baseType: GEMINI_BOW,
    modifiers: { "med-i1": "+22 to maximum Mana" },
  },
  "medio-magico-prometedor": {
    name: "Bow of the Edge",
    baseType: GEMINI_BOW,
    modifiers: { "med-p1": PHYS },
  },
  "medio-magico-completo": {
    name: "Bow of the Swift Edge",
    baseType: GEMINI_BOW,
    modifiers: { "med-c1": PHYS, "med-c2": ATTACK_SPEED },
  },
  "medio-raro-con-huecos": {
    name: "Progress Bow",
    baseType: GEMINI_BOW,
    modifiers: { "med-r1": PHYS, "med-r2": ADDS_PHYS, "med-r3": ATTACK_SPEED },
  },
  "medio-raro-objetivo-cumplido": {
    name: "Bow of the Passed Test",
    baseType: GEMINI_BOW,
    modifiers: {
      "med-f1": PHYS,
      "med-f2": ADDS_PHYS,
      "med-f3": ATTACK_SPEED,
      "med-f4": "+18 to Dexterity",
    },
  },
};

export interface MediumScenarioTextEn {
  title: string;
  situation: string;
  gameState: string;
  playerGoal: string;
  question: string;
  options: Record<string, { label: string; hint: string }>;
  explanation: string;
  takeaway: string;
  stopCondition: string;
  gameSteps: string[];
}

export const MEDIUM_ACADEMY_SCENARIOS_EN: Record<string, MediumScenarioTextEn> = {
  "medio-elegir-base": {
    title: "First, learn to recognize the base",
    situation:
      "You're at your stash with several pieces for the same slot, and you don't know your build's bases yet. Before spending, you open your equipment and read the piece you already wear in that slot as a first reference.",
    gameState: "Several bases and one equipped piece as a reference",
    playerGoal: "Confirm a candidate without guessing the ideal base",
    question: "If you don't know your build's bases yet, what do you do before spending?",
    options: {
      "med-base-correcta": {
        label: "I compare its type with the piece I have equipped",
        hint: "It's a reference you can check; if it's not enough, I don't spend yet",
      },
      "med-base-rara": { label: "I take the one with the flashiest name", hint: "The name doesn't tell you if it works for you" },
      "med-base-cualquiera": { label: "Any of them; I'll fix it later", hint: "Currency doesn't change the base type" },
    },
    explanation:
      "You don't need to memorize your build's ideal base. Start by reading the type shown under the name of your equipped piece and use it as a reference, not as proof that the candidate is better. If you can't confirm the candidate works for you, keep your currency.",
    takeaway: "First you recognize and confirm the base; then you decide if it deserves currency.",
    stopCondition: "Don't spend until you can confirm the candidate works for the slot you want to improve.",
    gameSteps: [
      "Open your equipment and read the type shown under the name of the piece you wear in that slot.",
      "Put the candidates side by side and compare their slot, type and requirements with that reference.",
      "If the comparison doesn't confirm that a candidate works for you, don't spend yet.",
    ],
  },
  "medio-definir-objetivo": {
    title: "Decide which problem you want to solve",
    situation:
      "The base does work for you, but you haven't decided yet what you want from it for your current character.",
    gameState: "Right base, goal still open",
    playerGoal: "Leave the stash with an improvement you can recognize",
    question: "What do you do before using the first currency?",
    options: {
      "med-objetivo-concreto": {
        label: "I pick one specific improvement",
        hint: "For example: damage, defence or a resistance I'm missing",
      },
      "med-objeto-perfecto": { label: "I try to make the perfect item", hint: "It doesn't tell you when a roll is already good enough" },
      "med-gastar-primero": { label: "I start spending and decide later", hint: "Random currency doesn't know what you intend" },
    },
    explanation:
      "A specific goal lets you judge every result. “Raise my fire resistance” or “get more physical damage” can be checked; “make it perfect” never tells you when to stop.",
    takeaway: "One piece, one main problem.",
    stopCondition: "Don't use the first currency until you can say in one sentence which problem the piece should solve.",
    gameSteps: [
      "Open your character sheet and find one specific need.",
      "Pick a single priority for this piece: damage, defence, an attribute or a resistance.",
      "Use that priority to decide whether each result in the game helps you or not.",
    ],
  },
  "medio-primer-mod-inutil": {
    title: "Don't chase a bad start",
    situation:
      "You used a Transmutation. The piece is now magic, but its first modifier doesn't help the goal you picked.",
    gameState: "Magic item with a modifier you can't use",
    playerGoal: "Save currency for a promising base",
    question: "What's the most sensible decision?",
    options: {
      "med-cambiar-base": { label: "I try another base", hint: "I have nothing useful to protect yet" },
      "med-regio-inutil": { label: "I use Regal because it can fix it", hint: "Raising the rarity also keeps the bad start" },
      "med-exaltado-inutil": { label: "I use Exalted until it gets better", hint: "Exalted needs a rare item" },
    },
    explanation:
      "Having an open slot doesn't mean you must keep going. If the first result adds nothing to your goal, dropping that piece and starting on another base stops you from investing more in an item with no head start.",
    takeaway: "An open slot doesn't turn a bad start into a promising project.",
    stopCondition: "Set the piece aside if its first modifier adds nothing to the goal you picked.",
    gameSteps: [
      "After Transmutation, read the modifier that appeared.",
      "Compare it with the priority you chose before spending.",
      "If it adds nothing, set that piece aside and try another base instead of raising its rarity.",
    ],
  },
  "medio-completar-magico": {
    title: "Fill the magic item before upgrading it",
    situation:
      "This time the Transmutation did leave a useful modifier. The item is magic and still has room for another modifier.",
    gameState: "Magic item with one useful line and one open slot",
    playerGoal: "Use the last slot of the magic stage",
    question: "Which currency do you use now?",
    options: {
      "med-usar-aumento": { label: "Orb of Augmentation", hint: "Adds a modifier to the magic item" },
      "med-usar-regio-pronto": { label: "Regal Orb", hint: "It would make it rare without using that slot first" },
      "med-parar-magico": { label: "I always stop at the first useful mod", hint: "There's still a compatible, limited action" },
    },
    explanation:
      "Augmentation adds a random modifier to a magic item. Using it here lets you see the second modifier before deciding whether the piece is worth making rare.",
    takeaway: "If the magic item looks promising and still has a slot, finish that stage first.",
    stopCondition: "After Augmentation, reread both lines and don't raise the rarity if the result stopped being useful.",
    gameSteps: [
      "Check in the game that the piece is magic, has a useful line and still has an open slot.",
      "Right-click an Orb of Augmentation, then left-click the piece.",
      "Read both modifiers before deciding whether to continue.",
    ],
  },
  "medio-cuando-regio": {
    title: "Use Regal on something you want to keep",
    situation:
      "The magic item already has its two modifiers. At least one helps your character's goal, and you want to keep working on the same piece.",
    gameState: "Full magic item with one useful line",
    playerGoal: "Make it rare without losing what already works",
    question: "When does using a Regal Orb make sense?",
    options: {
      "med-regio-prometedor": { label: "Now: I want to keep this result", hint: "Regal keeps the modifiers and adds one" },
      "med-regio-cualquier-magico": {
        label: "On any magic item, even if nothing on it helps me",
        hint: "Rarity doesn't make its lines useful",
      },
      "med-aumento-lleno": { label: "I use another Augmentation first", hint: "The magic item already hit its observed limit" },
    },
    explanation:
      "Regal turns the magic item into a rare one, keeps its modifiers and adds one. Strategically, it's worth it when there's already something you want to keep, not just because the action is legal.",
    takeaway: "Don't raise the rarity of a piece you were already going to drop.",
    stopCondition: "After Regal, reread the whole rare item before deciding on any new spend.",
    gameSteps: [
      "Confirm that the magic piece already has two modifiers and that at least one helps you.",
      "Right-click a Regal Orb, then left-click the piece.",
      "Read the full new rare result before spending another currency.",
    ],
  },
  "medio-cuando-exaltado": {
    title: "Exalted is a gamble, not an automatic finish",
    situation:
      "The piece is already rare, keeps an improvement that helps you and still has room for another modifier.",
    gameState: "Useful rare item with at least one open slot",
    playerGoal: "Try for one extra improvement without expecting a specific result",
    question: "What must you accept before using Exalted?",
    options: {
      "med-exaltado-consciente": { label: "That it will add something random", hint: "There's room, but no guaranteed improvement" },
      "med-exaltado-garantiza": {
        label: "That it will complete my goal exactly",
        hint: "The observed effect doesn't promise a specific affix",
      },
      "med-exaltado-repite": { label: "That I can repeat it until I hit", hint: "Every slot you use changes the piece's state" },
    },
    explanation:
      "The observed Exalted effect is adding a random modifier to a rare item. Having room makes the action possible; it doesn't guarantee the result fits your character.",
    takeaway: "Before Exalted, you decide whether the piece is worth that gamble.",
    stopCondition: "Don't use Exalted if you wouldn't accept a random result or if the piece already solved your goal.",
    gameSteps: [
      "Check that the piece is rare, keeps something useful and still has an open slot.",
      "Accept that you can't choose which modifier will appear.",
      "If it's worth a try, right-click the Exalted Orb, use it once on the piece and read it again.",
    ],
  },
  "medio-probar-y-parar": {
    title: "Equip, test and learn to stop",
    situation:
      "The piece already gives the specific improvement you were after. There might still be room, but your main problem is solved.",
    gameState: "Your chosen goal is already on the piece",
    playerGoal: "Check the improvement while you play",
    question: "What do you do now?",
    options: {
      "med-equipar-probar": { label: "I equip it and test it", hint: "I check whether it really improves my character" },
      "med-llenar-siempre": { label: "I fill every slot because they're there", hint: "Free space doesn't mean you need it" },
      "med-cambiar-meta": { label: "I change the goal so I can keep spending", hint: "Moving the goal stops you from recognizing success" },
    },
    explanation:
      "The point of crafting is to improve what you play, not to always fill the item. Equip it, test your character and only go back to the bench if you spot a new need.",
    takeaway: "The craft ends in the game, not when the last slot is gone.",
    stopCondition: "Stop spending once testing in the game confirms your main need is solved.",
    gameSteps: [
      "Keep your previously equipped piece so you can switch back.",
      "Equip the candidate and compare your character sheet before and after.",
      "Test your skill in combat; if it solved your need, stop spending even if slots are left.",
    ],
  },
};

function localizeMediumScenario(scenario: MediumAcademyScenario): MediumAcademyScenario {
  const en = MEDIUM_ACADEMY_SCENARIOS_EN[scenario.id];
  const item = localizeAcademyItem(scenario.item, MEDIUM_ACADEMY_ITEMS_EN, "en");
  if (!en) return { ...scenario, item };
  return {
    ...scenario,
    title: en.title,
    situation: en.situation,
    gameState: en.gameState,
    playerGoal: en.playerGoal,
    question: en.question,
    explanation: en.explanation,
    takeaway: en.takeaway,
    stopCondition: en.stopCondition,
    gameSteps: [...en.gameSteps],
    item,
    options: scenario.options.map((option) => {
      const text = en.options[option.id];
      return text ? { ...option, label: text.label, hint: text.hint } : option;
    }),
  };
}

const MEDIUM_SCENARIOS_EN: readonly MediumAcademyScenario[] =
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map(localizeMediumScenario);

/** Situaciones del nivel medio en el idioma pedido (el español es el original). */
export function craftingMediumAcademyScenarios(
  lang: AcademyLang = "es",
): readonly MediumAcademyScenario[] {
  return lang === "en" ? MEDIUM_SCENARIOS_EN : CRAFTING_MEDIUM_ACADEMY_SCENARIOS;
}

export function craftingMediumAcademyEvidence(lang: AcademyLang = "es"): string {
  return lang === "en" ? CRAFTING_MEDIUM_ACADEMY_EVIDENCE_EN : CRAFTING_MEDIUM_ACADEMY_EVIDENCE;
}

export function craftingMediumBaseReadingHelp(lang: AcademyLang = "es"): string {
  return lang === "en" ? CRAFTING_MEDIUM_BASE_READING_HELP_EN : CRAFTING_MEDIUM_BASE_READING_HELP;
}
