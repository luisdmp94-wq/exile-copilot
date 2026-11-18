/**
 * ACADEMIA DE CRAFTING — NIVEL BÁSICO EN INGLÉS.
 *
 * El contenido español de `craftingAcademy.ts` es la fuente: este archivo solo
 * sustituye los textos por id. Las opciones, sus comprobaciones, las respuestas
 * correctas y la estructura de cada objeto de ejercicio son las mismas; por eso
 * el motor resuelve igual en los dos idiomas.
 */

import type { CraftingActionId } from "./craftingActions.js";
import {
  ACADEMY_CONCEPTS,
  CRAFTING_ACADEMY_EVIDENCE,
  CRAFTING_ACADEMY_EXAM,
  CRAFTING_ACADEMY_EXERCISE_NOTICE,
  CRAFTING_ACADEMY_LESSONS,
  type AcademyConceptId,
  type AcademyLesson,
  type AcademyOption,
  type AcademyScenario,
} from "./craftingAcademy.js";
import type { Item } from "./domain.js";

export type AcademyLang = "es" | "en";

// ---------------------------------------------------------------------------
// Objetos de ejercicio: texto inglés del juego, misma estructura
// ---------------------------------------------------------------------------

export interface AcademyItemTextEn {
  name: string;
  baseType: string;
  /** Texto inglés de cada modificador, por id del modificador. */
  modifiers?: Record<string, string>;
}

/**
 * Cambia solo nombre, base y texto de los modificadores. Rareza, nivel, hueco,
 * familia de cada afijo, estado y procedencia se conservan tal cual.
 */
export function localizeAcademyItem(
  item: Item,
  table: Readonly<Record<string, AcademyItemTextEn>>,
  lang: AcademyLang,
): Item {
  if (lang === "es") return item;
  const en = table[item.id];
  if (!en) return item;
  return {
    ...item,
    name: en.name,
    baseType: en.baseType,
    modifiers: item.modifiers.map((modifier) => ({
      ...modifier,
      text: en.modifiers?.[modifier.id] ?? modifier.text,
    })),
  };
}

export const ACADEMY_ITEMS_EN: Readonly<Record<string, AcademyItemTextEn>> = {
  "academia-yelmo-raro": {
    name: "Practice Helm",
    baseType: "Scale Helm",
    modifiers: {
      "aca-y1": "+68 to maximum Life",
      "aca-y2": "21% increased Armour",
      "aca-y3": "+28% to Fire Resistance",
    },
  },
  "academia-guantes-normales": { name: "Practice Gloves", baseType: "Hardened Leather Gloves" },
  "academia-anillo-magico-1": {
    name: "Practice Ring",
    baseType: "Sapphire Ring",
    modifiers: { "aca-a1": "+24% to Cold Resistance" },
  },
  "academia-anillo-magico-2": {
    name: "Full Practice Ring",
    baseType: "Sapphire Ring",
    modifiers: {
      "aca-a2": "+31 to maximum Life",
      "aca-a3": "+24% to Cold Resistance",
    },
  },
  "academia-cinturon-sin-datos": {
    name: "Half-Copied Belt",
    baseType: "Leather Belt",
    modifiers: { "aca-c1": "+42 to maximum Life" },
  },
  "academia-botas-raras": {
    name: "Practice Boots",
    baseType: "Mail Boots",
    modifiers: {
      "aca-b1": "+55 to maximum Life",
      "aca-b2": "18% increased Evasion Rating",
      "aca-b3": "25% increased Movement Speed",
    },
  },
  "academia-pecho-lleno": {
    name: "Complete Practice Cuirass",
    baseType: "Plate Cuirass",
    modifiers: {
      "aca-p1": "+110 to maximum Life",
      "aca-p2": "+240 to Armour",
      "aca-p3": "12% increased maximum Life",
      "aca-p4": "+31% to Fire Resistance",
      "aca-p5": "+28% to Lightning Resistance",
      "aca-p6": "+17% to Chaos Resistance",
    },
  },
  "academia-amuleto-normal": { name: "Challenge Amulet", baseType: "Amber Amulet" },
  "academia-arma-magica": {
    name: "Challenge Mace",
    baseType: "Iron Mace",
    modifiers: { "aca-w1": "37% increased Physical Damage" },
  },
  "academia-anillo-examen": {
    name: "Challenge Seal",
    baseType: "Gold Ring",
    modifiers: {
      "aca-r1": "+29 to maximum Life",
      "aca-r2": "+19% to Lightning Resistance",
    },
  },
  "academia-escudo-examen": {
    name: "Challenge Shield",
    baseType: "Tower Shield",
    modifiers: {
      "aca-e1": "+92 to maximum Life",
      "aca-e2": "+180 to Armour",
      "aca-e3": "+26% to Cold Resistance",
      "aca-e4": "+22% to Chaos Resistance",
    },
  },
  "academia-casco-examen": {
    name: "Challenge Helm, Complete",
    baseType: "War Helm",
    modifiers: {
      "aca-h1": "+84 to maximum Life",
      "aca-h2": "+150 to Evasion Rating",
      "aca-h3": "9% increased maximum Life",
      "aca-h4": "+30% to Fire Resistance",
      "aca-h5": "+27% to Cold Resistance",
      "aca-h6": "+15 to Dexterity",
    },
  },
  "academia-botas-examen-sin-datos": {
    name: "Half-Copied Boots",
    baseType: "Leather Boots",
    modifiers: { "aca-x1": "18% increased Movement Speed" },
  },
};

// ---------------------------------------------------------------------------
// Textos generales y conceptos
// ---------------------------------------------------------------------------

export const CRAFTING_ACADEMY_EVIDENCE_EN =
  "Based on what the game showed on 22 Aug 2026. It doesn't include the odds of each modifier.";

export const CRAFTING_ACADEMY_EXERCISE_NOTICE_EN =
  "Visual example, not interactive. Here you learn to read and decide; currency and crafting happen inside Path of Exile 2.";

export const ACADEMY_CONCEPTS_EN: Record<AcademyConceptId, { label: string; recap: string }> = {
  rareza: {
    label: "Reading rarity",
    recap: "Normal, magic and rare aren't just colors: they decide which currency works on the item.",
  },
  afijos: {
    label: "Prefixes and suffixes",
    recap: "Explicit modifiers belong to two separate groups, and the game shows them apart.",
  },
  huecos: {
    label: "Open slots",
    recap: "An open slot means something else fits, never that what you get will be useful.",
  },
  transmutacion: {
    label: "When to use Transmutation",
    recap: "It's how you turn a normal item into a magic one with 1 modifier.",
  },
  aumento: {
    label: "When to use Augmentation",
    recap: "It adds 1 modifier to a magic item without changing its rarity.",
  },
  "limite-magico": {
    label: "The magic item limit",
    recap: "The tooltip says magic items can have at most 2 modifiers.",
  },
  regio: {
    label: "When to use Regal",
    recap: "It turns a magic item into a rare one, keeps what it already has and adds 1 modifier.",
  },
  "parar-datos": {
    label: "Stopping when data is missing",
    recap: "If the text doesn't confirm the item's state, the right answer is not to spend yet.",
  },
  exaltado: {
    label: "When to use Exalted",
    recap: "It adds 1 modifier to a rare item; the total limit is 6.",
  },
  "parar-limite": {
    label: "Stopping at the limit",
    recap: "With no open slots under the limit, none of these currencies can be used.",
  },
};

// ---------------------------------------------------------------------------
// Opciones
// ---------------------------------------------------------------------------

export const ACADEMY_CURRENCY_LABELS_EN: Record<CraftingActionId, string> = {
  transmutation: "Orb of Transmutation",
  augmentation: "Orb of Augmentation",
  regal: "Regal Orb",
  exalted: "Exalted Orb",
};

export const ACADEMY_CURRENCY_HINTS_EN: Record<CraftingActionId, string> = {
  transmutation: "Normal → magic, with 1 modifier",
  augmentation: "Adds 1 modifier to a magic item",
  regal: "Magic → rare, keeping what's there",
  exalted: "Adds 1 modifier to a rare item",
};

export interface AcademyOptionTextEn {
  label: string;
  hint?: string;
}

const STOP_LABEL_EN = "Stop and don't spend";
const stop = (hint: string): AcademyOptionTextEn => ({ label: STOP_LABEL_EN, hint });

// ---------------------------------------------------------------------------
// Lecciones y desafío
// ---------------------------------------------------------------------------

export interface AcademyScenarioTextEn {
  situation: string;
  question: string;
  explanation: string;
  why: string[];
  misconception: string;
  /** Opciones que no son una moneda; las monedas usan su nombre oficial. */
  options?: Record<string, AcademyOptionTextEn>;
}

export const ACADEMY_LESSONS_EN: Record<string, { title: string; goal: string }> = {
  "leccion-1": { title: "Reading an item", goal: "Know what you're looking at before you spend anything." },
  "leccion-2": { title: "From normal to magic", goal: "Take the first step when the item has nothing yet." },
  "leccion-3": { title: "Filling a magic item", goal: "Add without changing rarity, and know when nothing more fits." },
  "leccion-4": { title: "Going rare", goal: "Raise the rarity while keeping what you have, and know when to wait." },
  "leccion-5": { title: "Adding to a rare", goal: "Use Exalted with judgement and recognise when to stop." },
};

const WHICH_ACTION = "Which action can be used on this item?";
const WHAT_DO_YOU_DO = "What do you do?";

export const ACADEMY_SCENARIOS_EN: Record<string, AcademyScenarioTextEn> = {
  "l1-rareza": {
    situation:
      "You just picked up this helmet. In the game, the colour of its name and its number of modifiers tell you its rarity.",
    question: "What rarity is this item?",
    options: {
      normal: { label: "Normal", hint: "No explicit modifiers" },
      magic: { label: "Magic", hint: "Up to 2 modifiers" },
      rare: { label: "Rare", hint: "Up to 6 modifiers" },
    },
    explanation:
      "It's a rare item. It has 3 explicit modifiers, and the total limit for a rare is 6. A magic item couldn't go past 2.",
    why: [
      "The Orb of Augmentation tooltip says magic items can have up to two random modifiers.",
      "The Exalted Orb tooltip says rare items can have up to six.",
      "Rarity decides which currencies can even be used: each one needs a specific starting rarity.",
    ],
    misconception:
      "Counting modifiers is the quick way to check: with 3 explicit ones it can't be normal or magic.",
  },
  "l1-afijos": {
    situation:
      "The same helmet, copied with Ctrl+Alt+C: the game splits its modifiers into prefixes and suffixes.",
    question: "How many prefixes does this helmet have?",
    options: {
      uno: { label: "1 prefix" },
      dos: { label: "2 prefixes" },
      tres: { label: "3 prefixes" },
    },
    explanation:
      "Two prefixes and one suffix. Life and armour sit in the prefix group; fire resistance sits in the suffix group.",
    why: [
      "Exile Copilot only splits prefixes from suffixes when the copied text says so. If it doesn't, it tells you instead of guessing.",
      "An unclassified modifier blocks the diagnosis: the bench asks you to copy the item again with Ctrl+Alt+C.",
      "Exile Copilot has no verified list of possible modifiers: it only reads the ones already on your item.",
    ],
    misconception:
      "Prefixes and suffixes aren't split half and half: it depends on which modifiers rolled, and here it's 2 and 1.",
  },
  "l1-huecos": {
    situation:
      "That rare helmet has 3 explicit modifiers, and the total limit for a rare is 6.",
    question: "What exactly does it mean that it has 3 open slots left?",
    options: {
      caben: { label: "That up to 3 more modifiers fit", hint: "Based on the total limit" },
      "seran-buenos": { label: "That the next 3 will be useful for my build" },
      "no-falla": { label: "That the currency I use can't fail" },
    },
    explanation:
      "A slot is space, not quality. It tells you how many modifiers still fit; it doesn't say which one you'll get or whether it will help.",
    why: [
      "This is the limit the bench repeats in every diagnosis: an open slot doesn't guarantee that a given currency can or should be used.",
      "Exile Copilot doesn't show odds, weights or costs because they can't be verified with the local sources available.",
      "The total limit (2 on magic items, 6 on rares) comes from the in-game tooltips and may change with a patch.",
    ],
    misconception:
      "Mixing up “there's room” with “it will turn out well” is the fastest way to spend currency for no reason.",
  },
  "l2-transmutacion": {
    situation:
      "These gloves are normal: they have no explicit modifiers. You want to start working on them.",
    question: WHICH_ACTION,
    options: { stop: stop("There's nothing to do yet") },
    explanation:
      "Transmutation is the one you can use: it turns a normal item into a magic one and gives it 1 modifier. The other two need an item that's already magic.",
    why: [
      "Observed Transmutation effect: upgrades a normal item to magic and gives it 1 modifier.",
      "Augmentation and Regal start from a magic item, so on a normal one they're blocked by rarity.",
      "Which modifier you'll get can't be predicted here: there's no verified pool or weights in the local sources.",
    ],
    misconception:
      "Each currency needs a starting rarity. Picking the currency before checking the rarity is the most common beginner mistake.",
  },
  "l3-aumento": {
    situation:
      "The ring is already magic and has 1 modifier. You want another one without changing its rarity yet.",
    question: WHICH_ACTION,
    options: { stop: stop("It's full, nothing fits") },
    explanation:
      "Augmentation adds 1 random modifier to a magic item and keeps it magic. Transmutation needs a normal item and Exalted needs a rare one.",
    why: [
      "Observed Augmentation effect: upgrades a magic item by adding a new random modifier.",
      "Adding a modifier and changing rarity are different things: Augmentation does the first, Regal does both at once.",
      "With 1 of the 2 modifiers allowed by the limit, there's still one open slot.",
    ],
    misconception:
      "Augmentation doesn't raise the rarity. If you want to go rare, Augmentation isn't the action.",
  },
  "l3-limite": {
    situation:
      "This other ring is also magic, but it already has 2 modifiers: one prefix and one suffix.",
    question: "Can you use another Orb of Augmentation on it?",
    options: {
      "no-limite": { label: "No: a magic item can have at most 2 modifiers", hint: "No open slots left" },
      "si-siempre": { label: "Yes: one more always fits if the item level is high" },
      "si-reemplaza": { label: "Yes: it will replace the worse of the two" },
    },
    explanation:
      "There are no open slots. The tooltip says magic items can have at most 2 modifiers, and this one already has them.",
    why: [
      "The total limit is 2 for magic items and 6 for rares. Both come from the tooltips as of 22 Aug 2026.",
      "Augmentation ADDS a modifier; no local evidence says it replaces an existing one.",
      "Item level doesn't appear in any local source as a way to go past that limit.",
    ],
    misconception:
      "When a currency “does nothing”, it's almost always because the item's state doesn't allow it, not because it failed.",
  },
  "l4-regio": {
    situation:
      "The magic ring is full: 2 of 2 modifiers. You want to keep improving it.",
    question: "Which action can be used now?",
    options: { stop: stop("There's nothing more to do with it") },
    explanation:
      "Regal turns the item from magic to rare, keeps the modifiers it already has and adds 1. It's the way forward when a magic item runs out of slots.",
    why: [
      "Observed Regal effect: upgrades a magic item to rare and adds 1 modifier; current modifiers are kept.",
      "Augmentation is blocked because the item already hit the total limit of 2.",
      "Exalted needs the item to be rare already, so it doesn't apply yet.",
    ],
    misconception:
      "Augmentation being blocked doesn't mean the item is finished: the action changes, not the item.",
  },
  "l4-todavia-no": {
    situation:
      "This belt is magic and has one open slot, but the text you pasted doesn't confirm whether it's corrupted, split or unidentified.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Copy the full item again before spending") },
    explanation:
      "Not yet. Without confirming the item's state, you can't say any currency is legal on it. Copy it again with Ctrl+Alt+C.",
    why: [
      "A corrupted, mirrored or sanctified item blocks these currencies; if the text doesn't say, the app doesn't rule it out.",
      "“Not shown” never means “no restriction”. It's the same rule the real bench uses.",
      "Stopping here isn't losing a turn: it avoids spending currency on an item that might not accept it.",
    ],
    misconception:
      "An item that looks fine and has a slot isn't enough. If information is missing, the careful answer is to get it, not to spend.",
  },
  "l5-exaltado": {
    situation:
      "These boots are already rare: 3 modifiers out of the limit of 6. You want one more resistance.",
    question: WHICH_ACTION,
    options: { stop: stop("No open slot left") },
    explanation:
      "Exalted is the one you can use: it adds 1 random modifier to a rare item. There's room, but that doesn't mean you'll get the resistance you want.",
    why: [
      "Observed Exalted effect: upgrades a rare item by adding a new random modifier.",
      "Regal and Augmentation both start from a magic item, so on a rare they're blocked by rarity.",
      "The app can't tell you which modifier will appear: there's no verified pool or weights. Having room and getting lucky are different things.",
    ],
    misconception:
      "“Can be used” means the action is legal on this item, not that it will give you what you're after.",
  },
  "l5-parar": {
    situation:
      "This rare chest has 6 modifiers: 3 prefixes and 3 suffixes. That's exactly the total limit.",
    question: "What do you do with it?",
    options: { stop: stop("Keep it and don't spend any more on it") },
    explanation:
      "Stop. There are no open slots under the limit, so Exalted can't be used, and Regal needs a magic item. Adding anything would mean replacing what you already have.",
    why: [
      "With 6 explicit modifiers, the bench blocks actions that add another until a legal route is verified.",
      "Replacing a modifier is a different, risky operation: it can take away something that was already useful.",
      "Stopping is a valid and common decision. None of these four currencies improves an item that's already full.",
    ],
    misconception:
      "A full item isn't a half-done item: if it works for you, spending more can only take away what you have.",
  },
  "examen-1": {
    situation: "Normal amulet with no explicit modifiers.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Leave it alone") },
    explanation: "Normal with 0 modifiers: Transmutation makes it magic with 1 modifier.",
    why: ["Augmentation and Regal need an item that's already magic."],
    misconception: "Review which rarity each currency needs before choosing it.",
  },
  "examen-2": {
    situation: "Magic mace with 1 modifier and 1 open slot.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Leave it alone") },
    explanation: "Magic with an open slot: Augmentation adds 1 modifier and keeps it magic.",
    why: ["Transmutation starts from a normal item; Exalted, from a rare one."],
    misconception: "Augmentation is the action for a magic item with an open slot.",
  },
  "examen-3": {
    situation: "Magic ring with 2 modifiers: it has hit the limit.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Leave it alone") },
    explanation: "Full magic item: Regal makes it rare, keeps both modifiers and adds 1.",
    why: ["Augmentation is blocked by the limit of 2; Exalted needs a rare item."],
    misconception: "When a magic item fills up, the way forward is Regal.",
  },
  "examen-4": {
    situation: "Rare shield with 4 of the 6 modifiers the limit allows.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Leave it alone") },
    explanation: "Rare with an open slot: Exalted adds 1 modifier. Which one you'll get still can't be predicted.",
    why: ["Regal starts from a magic item; Transmutation, from a normal one."],
    misconception: "Exalted is the action for a rare item with an open slot.",
  },
  "examen-5": {
    situation: "Rare helmet with 6 modifiers: 3 prefixes and 3 suffixes.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Keep it as it is") },
    explanation: "No open slots under the limit, so none of these currencies can be used. Stopping is the answer.",
    why: ["Adding would mean replacing, which is a different operation and carries risk."],
    misconception: "A full item isn't improved by these four currencies.",
  },
  "examen-6": {
    situation: "Magic boots with an open slot, but the copied text doesn't confirm their state.",
    question: WHAT_DO_YOU_DO,
    options: { stop: stop("Copy the item again before spending") },
    explanation: "Information about corruption, splitting or identification is missing. Without it, you can't say the currency is legal.",
    why: ["“Not shown” never means “no restriction”."],
    misconception: "When data is missing, the careful answer is to get it, not to spend.",
  },
};

// ---------------------------------------------------------------------------
// Ensamblado
// ---------------------------------------------------------------------------

function localizeOption(option: AcademyOption, text: AcademyScenarioTextEn | undefined): AcademyOption {
  if (option.check.kind === "action") {
    const actionId = option.check.actionId;
    return {
      ...option,
      label: ACADEMY_CURRENCY_LABELS_EN[actionId],
      hint: ACADEMY_CURRENCY_HINTS_EN[actionId],
    };
  }
  const en = text?.options?.[option.id];
  if (!en) return option;
  const localized: AcademyOption = { ...option, label: en.label };
  if (en.hint === undefined) delete localized.hint;
  else localized.hint = en.hint;
  return localized;
}

function localizeScenario(scenario: AcademyScenario): AcademyScenario {
  const en = ACADEMY_SCENARIOS_EN[scenario.id];
  return {
    ...scenario,
    ...(en
      ? {
          situation: en.situation,
          question: en.question,
          explanation: en.explanation,
          why: [...en.why],
          misconception: en.misconception,
        }
      : {}),
    item: localizeAcademyItem(scenario.item, ACADEMY_ITEMS_EN, "en"),
    options: scenario.options.map((option) => localizeOption(option, en)),
  };
}

const LESSONS_EN: readonly AcademyLesson[] = CRAFTING_ACADEMY_LESSONS.map((lesson) => ({
  ...lesson,
  ...(ACADEMY_LESSONS_EN[lesson.id] ?? {}),
  scenarios: lesson.scenarios.map(localizeScenario),
}));

const EXAM_EN: readonly AcademyScenario[] = CRAFTING_ACADEMY_EXAM.map(localizeScenario);

/** Lecciones del nivel básico en el idioma pedido (el español es el original). */
export function craftingAcademyLessons(lang: AcademyLang = "es"): readonly AcademyLesson[] {
  return lang === "en" ? LESSONS_EN : CRAFTING_ACADEMY_LESSONS;
}

/** Desafío final del nivel básico en el idioma pedido. */
export function craftingAcademyExam(lang: AcademyLang = "es"): readonly AcademyScenario[] {
  return lang === "en" ? EXAM_EN : CRAFTING_ACADEMY_EXAM;
}

/** Todos los escenarios del nivel básico, en orden, en el idioma pedido. */
export function craftingAcademyScenarios(lang: AcademyLang = "es"): AcademyScenario[] {
  return [
    ...craftingAcademyLessons(lang).flatMap((lesson) => lesson.scenarios),
    ...craftingAcademyExam(lang),
  ];
}

export function academyConcepts(
  lang: AcademyLang = "es",
): Record<AcademyConceptId, { label: string; recap: string }> {
  return lang === "en" ? ACADEMY_CONCEPTS_EN : ACADEMY_CONCEPTS;
}

export function craftingAcademyEvidence(lang: AcademyLang = "es"): string {
  return lang === "en" ? CRAFTING_ACADEMY_EVIDENCE_EN : CRAFTING_ACADEMY_EVIDENCE;
}

export function craftingAcademyExerciseNotice(lang: AcademyLang = "es"): string {
  return lang === "en" ? CRAFTING_ACADEMY_EXERCISE_NOTICE_EN : CRAFTING_ACADEMY_EXERCISE_NOTICE;
}
