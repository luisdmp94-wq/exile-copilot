/**
 * ACADEMIA DE CRAFTING — NIVEL AVANZADO EN INGLÉS.
 *
 * Sustituye por id los textos de `craftingAdvancedAcademy.ts`. Hechos, rutas
 * (salvo su texto), decisiones y objetos son los mismos, así que el resolutor
 * da la misma respuesta en los dos idiomas.
 */

import { localizeAcademyItem, type AcademyItemTextEn, type AcademyLang } from "./craftingAcademyEn.js";
import {
  CRAFTING_ADVANCED_ACADEMY_EVIDENCE,
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  type AdvancedAcademyScenario,
} from "./craftingAdvancedAcademy.js";

export const CRAFTING_ADVANCED_ACADEMY_EVIDENCE_EN =
  "Synthetic exercises for learning to decide inside PoE2. They don't represent a drop, a recipe, a mod pool or a chance.";

const LIFE = (value: number) => `+${value} to maximum Life`;

export const ADVANCED_ACADEMY_ITEMS_EN: Readonly<Record<string, AcademyItemTextEn>> = {
  "avanzado-contrato-abierto": {
    name: "Open Project Boots",
    baseType: "Swiftstep Boots",
    modifiers: {
      "av-c1": LIFE(96),
      "av-c2": "Increased Movement Speed",
      "av-c3": "+27% to Fire Resistance",
    },
  },
  "avanzado-conservar-opciones": {
    name: "Promising Gloves",
    baseType: "Stalker Gloves",
    modifiers: { "av-o1": LIFE(88) },
  },
  "avanzado-reemplazo": {
    name: "Amulet with a Protected Line",
    baseType: "Lapis Amulet",
    modifiers: {
      "av-r1": LIFE(108),
      "av-r2": "+24 to Dexterity",
      "av-r3": "+29% to Cold Resistance",
    },
  },
  "avanzado-salida-cumplida": {
    name: "Belt of the Goal Met",
    baseType: "Rawhide Belt",
    modifiers: {
      "av-s1": LIFE(122),
      "av-s2": "+31% to Fire Resistance",
      "av-s3": "+28% to Cold Resistance",
      "av-s4": "+25 to Strength",
    },
  },
  "avanzado-lectura-incompleta": {
    name: "Half-Read Helm",
    baseType: "Hunter Hood",
    modifiers: { "av-d1": LIFE(74) },
  },
  "avanzado-riesgos-empate": {
    name: "Ring at the Crossroads",
    baseType: "Unset Ring",
    modifiers: {
      "av-e1": LIFE(92),
      "av-e2": "+32% to Lightning Resistance",
      "av-e3": "+20 to Dexterity",
    },
  },
  "avanzado-base-agotada": {
    name: "Last-Attempt Boots",
    baseType: "Swiftstep Boots",
    modifiers: { "av-b1": "+19 to maximum Mana" },
  },
  "avanzado-transformacion": {
    name: "Ring Before the Flux",
    baseType: "Lazuli Ring",
    modifiers: {
      "av-f1": LIFE(103),
      "av-f2": "+27 to Strength",
      "av-f3": "+30% to Fire Resistance",
    },
  },
  "avanzado-sustitucion": {
    name: "Candidate Amulet",
    baseType: "Lapis Amulet",
    modifiers: {
      "av-x1": "Increased Projectile Damage",
      "av-x2": LIFE(91),
      "av-x3": "+18 to Dexterity",
    },
  },
};

export interface AdvancedScenarioTextEn {
  title: string;
  skill: string;
  situation: string;
  contract: { objective: string; protect: string[]; stop: string };
  /** Texto de cada ruta, por id de ruta dentro del caso. */
  routes?: Record<string, { label: string; consequence: string }>;
  question: string;
  options: Record<string, { label: string; hint: string }>;
  explanation: string;
  lesson: string;
  gameSteps: string[];
}

const REPLACEMENT_UNCHECKED = "It may replace a line; its exact text still needs checking.";

export const ADVANCED_ACADEMY_SCENARIOS_EN: Record<string, AdvancedScenarioTextEn> = {
  "avanzado-contrato-sin-salida": {
    title: "Deciding when you'll stop",
    skill: "Don't start without knowing when to stop",
    situation:
      "You've picked the improvement you're after and one line you don't want to lose, but you haven't decided yet what result you'll call good enough.",
    contract: {
      objective: "Add another useful defence line",
      protect: ["Keep the resistance already on it"],
      stop: "Not set",
    },
    question: "What's the right next step?",
    options: {
      "av-definir-salida": {
        label: "Set a stop condition",
        hint: "Something you can check when you look at the next result in the game",
      },
      "av-gastar-primero": { label: "Spend now and decide later", hint: "The piece still has an open slot" },
      "av-quitar-proteccion": { label: "Drop the untouchable line", hint: "That way there are fewer restrictions" },
    },
    explanation:
      "Without an exit, there's no objective way to call the craft finished. Set a condition you can observe first; then compare actions.",
    lesson: "A goal says where you're heading. The stop condition decides when you stop paying to keep going.",
    gameSteps: [
      "Before touching any currency, look at the piece and decide which specific improvement you want.",
      "Choose which current line you wouldn't accept losing.",
      "Set a result or a maximum number of attempts, and stick to it while you play.",
    ],
  },
  "avanzado-conservar-etapa": {
    title: "Keeping options open",
    skill: "Ordering two legal actions",
    situation:
      "The piece is magic and has a single modifier. Augmentation and Regal are both legal, but Regal changes the stage of the craft.",
    contract: {
      objective: "Finish the magic stage before going rare",
      protect: ["Keep the current modifier"],
      stop: "Review the piece once it has both magic lines",
    },
    routes: {
      augmentation: { label: "Orb of Augmentation", consequence: "Adds a line and keeps the piece magic." },
      regal: { label: "Regal Orb", consequence: "Adds a line and makes the piece rare." },
    },
    question: "Which action keeps more later decisions open?",
    options: {
      "av-aumento": { label: "Augmentation first", hint: "Regal will still be available afterwards" },
      "av-regio": { label: "Regal straight away", hint: "Moves to the rare stage right now" },
      "av-indiferente": { label: "The order doesn't matter", hint: "Both add a line" },
    },
    explanation:
      "Augmentation keeps the magic stage and leaves Regal as a later decision. Using Regal first closes off Augmentation.",
    lesson: "When two routes are legal, a conservative route keeps more verified decisions open.",
    gameSteps: [
      "Check that the magic piece has a single line and that it's useful to you.",
      "Use Augmentation on the piece in the game and read the second line.",
      "Only then decide whether to use Regal to make it rare.",
    ],
  },
  "avanzado-reemplazo-no-demostrado": {
    title: "Holding back a replacement",
    skill: "Don't risk a protected line blindly",
    situation:
      "You want to know whether an Essence or an Alloy could replace one of the three visible lines, but you haven't read the full description of either one in the game yet.",
    contract: {
      objective: "Judge whether it's safe to replace the line you can spare",
      protect: ["+108 to maximum Life", "+24 to Dexterity"],
      stop: "Stop if either of the two protected visible lines is at risk",
    },
    routes: {
      essence: { label: "Essence", consequence: REPLACEMENT_UNCHECKED },
      alloy: { label: "Alloy", consequence: REPLACEMENT_UNCHECKED },
    },
    question: "What do you do before choosing a tool?",
    options: {
      "av-pedir-tooltip": {
        label: "Read both of them in the game",
        hint: "Check effect, compatibility and risk before using them",
      },
      "av-essence": { label: "Pick the Essence by its name", hint: "It sounds more specific" },
      "av-alloy": { label: "Pick the Alloy by elimination", hint: "The other one doesn't inspire confidence" },
    },
    explanation:
      "There's no safe route without reading the full description. If a crafting item can replace a line, its name doesn't tell you which line might disappear.",
    lesson:
      "The uncertainty you can accept when adding isn't the same as when replacing something you already want to keep.",
    gameSteps: [
      "Put the piece and both crafting items together in your inventory or stash.",
      "Read each one's full description and find what it adds and what it can replace.",
      "Don't use either of them if the description doesn't let you protect the important lines.",
    ],
  },
  "avanzado-salida-cumplida": {
    title: "Recognizing the finish",
    skill: "Don't turn a success into another gamble",
    situation:
      "After the last use, the exact line you wanted appeared and the important lines are still there.",
    contract: {
      objective: "Get the exact line the player defined",
      protect: ["The two marked lines are still there"],
      stop: "The exact line shows up in the result",
    },
    routes: {
      exalted: {
        label: "Exalted Orb",
        consequence: "It would fill another slot, even though the goal is already met.",
      },
    },
    question: "What's the advanced decision?",
    options: {
      "av-parar": { label: "Stop and keep the result", hint: "The condition you chose is already met" },
      "av-otro-exaltado": { label: "Add another line", hint: "There's still an open slot" },
      "av-subir-objetivo": { label: "Change the goal now", hint: "Look for an even better result" },
    },
    explanation:
      "The improvement you planned is done. Having another legal action doesn't mean you have to use it; doing so would open a risk your goal didn't need.",
    lesson: "An exit condition only works if you respect it when it's time to stop.",
    gameSteps: [
      "Read the whole piece again after every currency.",
      "Check that your goal appeared and that the important lines are still there.",
      "Store the piece or equip it; don't use another currency just because a slot is still open.",
    ],
  },
  "avanzado-datos-incompletos": {
    title: "Getting the evidence back",
    skill: "Telling a block from bad luck",
    situation:
      "You're not seeing the piece's full description in the game. Its look suggests a slot might be open, but you can't confirm it.",
    contract: {
      objective: "Add a line without losing the current ones",
      protect: ["All the observed modifiers"],
      stop: "Review the result after a single legal action",
    },
    question: "What clears the block first?",
    options: {
      "av-recopiar": {
        label: "Check the full description in the game",
        hint: "Confirm rarity, modifiers, affixes and states",
      },
      "av-probar-moneda": { label: "Try a cheap currency", hint: "If it doesn't work, no harm done" },
      "av-deducir": { label: "Guess the slot from its look", hint: "It looks like an unfinished piece" },
    },
    explanation:
      "The next action is to read the piece properly, not to pick a currency. If you can't confirm its state, you shouldn't assume the slot exists.",
    lesson: "A data block protects the item. It's not a negative recommendation or a failed craft.",
    gameSteps: [
      "Open the item's advanced description in PoE2.",
      "Confirm its rarity, number of modifiers, prefixes, suffixes and special states.",
      "If information is still missing, don't use any currency on that piece.",
    ],
  },
  "avanzado-sin-ganador": {
    title: "Accepting there's no winner",
    skill: "Comparing risks without inventing a recipe",
    situation:
      "Two replacement routes have verified descriptions and both are compatible, but each one risks a different outcome. There are no verified weights or odds.",
    contract: {
      objective: "Change a line you can spare",
      protect: ["Keep the item's main line"],
      stop: "Only accept a result that keeps the main line",
    },
    routes: {
      essence: {
        label: "Verified Essence",
        consequence: "Guarantees its own line and replaces another one at random.",
      },
      alloy: {
        label: "Verified Alloy",
        consequence: "Applies its observed effect and replaces another line.",
      },
    },
    question: "What can the mentor honestly say?",
    options: {
      "av-comparar": { label: "Compare the outcomes and let me choose", hint: "There's no proven winner" },
      "av-elegir-essence": { label: "Essence is always better", hint: "Its line is guaranteed" },
      "av-elegir-alloy": { label: "Alloy is always more advanced", hint: "It has more conditions" },
    },
    explanation:
      "With two compatible routes and no provable edge, you have to compare what each one keeps and what it risks, not assume there's a winner.",
    lesson: "An advanced answer can also be: there isn't enough information to call one route better.",
    gameSteps: [
      "Put the piece and both crafting items together so you can read them without rushing.",
      "For each one, work out what it keeps, what it adds and what it can remove.",
      "Choose based on the loss you'd accept; if none is worth it, keep your crafting items.",
    ],
  },
  "avanzado-retirar-base": {
    title: "Retiring a base in time",
    skill: "Respect the failure exit too",
    situation:
      "You've already noted the second result. The target line didn't appear, and you've hit the attempt limit you wrote down before starting.",
    contract: {
      objective: "Get the target line while keeping the main one",
      protect: ["Keep the main line"],
      stop: "Two attempts at most; if both fail, switch base",
    },
    routes: {
      essence: {
        label: "Another verified attempt",
        consequence: "The action exists, but it would go past the limit you set.",
      },
    },
    question: "Which decision respects the limit you chose?",
    options: {
      "av-cambiar-base": { label: "Close this craft and switch base", hint: "The agreed limit has been reached" },
      "av-intento-extra": { label: "Allow one extra attempt", hint: "The action is still compatible" },
      "av-borrar-limite": { label: "Delete the stop condition", hint: "That way the craft can continue" },
    },
    explanation:
      "A compatible action doesn't cancel the limit you chose. Close this attempt and switch base; raising the limit after failing removes the protection it was meant to give you.",
    lesson: "Your plan should say when to keep a success and when to stop investing in a base.",
    gameSteps: [
      "Count your attempts while you work on the piece in the game.",
      "When you hit the limit you chose, move that piece out of your work area.",
      "Start on another base; don't change the rule just because the last attempt failed.",
    ],
  },
  "avanzado-simular-flux": {
    title: "Simulate before you transform",
    skill: "Judge the piece by the full result",
    situation:
      "You've read the Flux's full description and want to weigh its effect on the visible ring. It can affect more than one of the lines it names, but you haven't simulated how the whole piece would end up yet.",
    contract: {
      objective: "Judge the Flux without looking at just one line",
      protect: ["Keep the ring's important lines"],
      stop: "The simulated ring keeps the protected lines",
    },
    routes: {
      flux: {
        label: "Flux with a checked description",
        consequence:
          "Transforms every line its description names on the chosen piece, not just the one you want to use.",
      },
    },
    question: "What do you do before using the Flux?",
    options: {
      "av-simular-ambas": { label: "Simulate the whole ring", hint: "Check every line the result would affect" },
      "av-elegir-mayor-frio": { label: "Use it for the line I care about", hint: "I'm only looking at part of the piece" },
      "av-usar-botas": {
        label: "Use it because the description is already checked",
        hint: "Knowing the crafting item doesn't predict the piece's result",
      },
    },
    explanation:
      "Knowing the description isn't enough to accept the result. Simulate the whole ring first: a transformation can affect other named lines besides the one you want to use.",
    lesson: "A transformation is judged by the piece's final state, not just by the line you want to use.",
    gameSteps: [
      "Read the Flux and the ring in the game.",
      "Note which ring lines the description names and simulate the full result.",
      "Don't use the Flux if the simulation puts a line you want to keep at risk.",
    ],
  },
  "avanzado-simular-sustitucion": {
    title: "Checking the full swap",
    skill: "Don't break dependencies for one isolated upgrade",
    situation:
      "A candidate piece improves the offensive line you're after, but your equipped one gives attributes and resistances that may be holding up skill requirements and defensive caps. Both pieces have been read, but you haven't recalculated your character without the current one yet.",
    contract: {
      objective: "Swap the piece without breaking the rest of your gear",
      protect: ["Keep skill requirements met", "Don't open resistance gaps"],
      stop: "Your whole character still meets its dependencies",
    },
    question: "What do you do before equipping the candidate?",
    options: {
      "av-simular-cambio": {
        label: "Compare my character before and after",
        hint: "Recalculate attributes, resistances and requirements",
      },
      "av-equipar-mejora": { label: "Equip it for its main upgrade", hint: "The line I want is clearly better" },
      "av-descartar-candidata": {
        label: "Discard it without checking",
        hint: "The current piece already keeps everything stable",
      },
    },
    explanation:
      "The piece isn't judged on its own. Compare your whole character before and after: a local gain doesn't make up for losing a skill requirement or opening a resistance gap without noticing.",
    lesson:
      "Before swapping gear, protect the dependencies the current piece holds up, even if they're not part of your main goal.",
    gameSteps: [
      "Open your character sheet and note your attributes and resistances with the current piece equipped.",
      "Equip the candidate in the game and check those values and your skills again.",
      "Keep the swap only if you still meet your requirements and defensive caps.",
    ],
  },
};

function localizeAdvancedScenario(scenario: AdvancedAcademyScenario): AdvancedAcademyScenario {
  const en = ADVANCED_ACADEMY_SCENARIOS_EN[scenario.id];
  const item = localizeAcademyItem(scenario.item, ADVANCED_ACADEMY_ITEMS_EN, "en");
  if (!en) return { ...scenario, item };
  return {
    ...scenario,
    title: en.title,
    skill: en.skill,
    situation: en.situation,
    contract: { objective: en.contract.objective, protect: [...en.contract.protect], stop: en.contract.stop },
    question: en.question,
    explanation: en.explanation,
    lesson: en.lesson,
    gameSteps: [...en.gameSteps],
    item,
    facts: {
      ...scenario.facts,
      routes: scenario.facts.routes.map((route) => {
        const text = en.routes?.[route.id];
        return text ? { ...route, label: text.label, consequence: text.consequence } : route;
      }),
    },
    options: scenario.options.map((option) => {
      const text = en.options[option.id];
      return text ? { ...option, label: text.label, hint: text.hint } : option;
    }),
  };
}

const ADVANCED_SCENARIOS_EN: readonly AdvancedAcademyScenario[] =
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS.map(localizeAdvancedScenario);

/** Casos del nivel avanzado en el idioma pedido (el español es el original). */
export function craftingAdvancedAcademyScenarios(
  lang: AcademyLang = "es",
): readonly AdvancedAcademyScenario[] {
  return lang === "en" ? ADVANCED_SCENARIOS_EN : CRAFTING_ADVANCED_ACADEMY_SCENARIOS;
}

export function craftingAdvancedAcademyEvidence(lang: AcademyLang = "es"): string {
  return lang === "en" ? CRAFTING_ADVANCED_ACADEMY_EVIDENCE_EN : CRAFTING_ADVANCED_ACADEMY_EVIDENCE;
}

