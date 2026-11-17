import { describe, expect, it } from "vitest";
import {
  ACADEMY_CONCEPT_IDS,
  ACADEMY_CONCEPTS,
  CRAFTING_ACADEMY_EVIDENCE,
  CRAFTING_ACADEMY_EXAM,
  CRAFTING_ACADEMY_EXERCISE_NOTICE,
  CRAFTING_ACADEMY_LESSONS,
  resolveAcademyAnswer,
  type AcademyScenario,
} from "../../shared/craftingAcademy.js";
import {
  ACADEMY_CONCEPTS_EN,
  ACADEMY_ITEMS_EN,
  ACADEMY_LESSONS_EN,
  ACADEMY_SCENARIOS_EN,
  academyConcepts,
  craftingAcademyEvidence,
  craftingAcademyExam,
  craftingAcademyExerciseNotice,
  craftingAcademyLessons,
  craftingAcademyScenarios,
  localizeAcademyItem,
  type AcademyItemTextEn,
} from "../../shared/craftingAcademyEn.js";
import {
  CRAFTING_ADVANCED_ACADEMY_EVIDENCE,
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  concealAdvancedAcademyItemReading,
  resolveAdvancedAcademyDecision,
  validateAdvancedAcademyScenario,
} from "../../shared/craftingAdvancedAcademy.js";
import {
  ADVANCED_ACADEMY_ITEMS_EN,
  ADVANCED_ACADEMY_SCENARIOS_EN,
  craftingAdvancedAcademyEvidence,
  craftingAdvancedAcademyScenarios,
} from "../../shared/craftingAdvancedAcademyEn.js";
import {
  CRAFTING_MEDIUM_ACADEMY_EVIDENCE,
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  CRAFTING_MEDIUM_BASE_READING_HELP,
  resolveMediumAcademyDecision,
  validateMediumAcademyScenario,
} from "../../shared/craftingMediumAcademy.js";
import {
  MEDIUM_ACADEMY_ITEMS_EN,
  MEDIUM_ACADEMY_SCENARIOS_EN,
  craftingMediumAcademyEvidence,
  craftingMediumAcademyScenarios,
  craftingMediumBaseReadingHelp,
} from "../../shared/craftingMediumAcademyEn.js";
import { diagnoseCraftingItem } from "../../shared/craftingDiagnosis.js";
import type { Item } from "../../shared/domain.js";
import { parseItemText } from "../../server/importers/itemTextParser.js";

/** Rastro claro de español: tildes, eñes y signos de apertura. */
const SPANISH_MARKS = /[áéíóúñ¿¡«»]/i;

function basicText(scenario: AcademyScenario): string[] {
  return [
    scenario.situation,
    scenario.question,
    scenario.explanation,
    scenario.misconception,
    ...scenario.why,
    ...scenario.options.flatMap((option) => [option.label, option.hint ?? ""]),
  ].filter((value) => value.length > 0);
}

function itemText(item: Item): string[] {
  return [item.name, item.baseType, ...item.modifiers.map((modifier) => modifier.text)];
}

const BASIC_ES = craftingAcademyScenarios("es");
const BASIC_EN = craftingAcademyScenarios("en");
const MEDIUM_EN = craftingMediumAcademyScenarios("en");
const ADVANCED_EN = craftingAdvancedAcademyScenarios("en");

describe("Academia en español: no cambia nada", () => {
  it("con «es» devuelve exactamente el contenido original", () => {
    expect(craftingAcademyLessons("es")).toBe(CRAFTING_ACADEMY_LESSONS);
    expect(craftingAcademyLessons()).toBe(CRAFTING_ACADEMY_LESSONS);
    expect(craftingAcademyExam("es")).toBe(CRAFTING_ACADEMY_EXAM);
    expect(academyConcepts("es")).toBe(ACADEMY_CONCEPTS);
    expect(craftingAcademyEvidence("es")).toBe(CRAFTING_ACADEMY_EVIDENCE);
    expect(craftingAcademyExerciseNotice("es")).toBe(CRAFTING_ACADEMY_EXERCISE_NOTICE);
    expect(craftingMediumAcademyScenarios("es")).toBe(CRAFTING_MEDIUM_ACADEMY_SCENARIOS);
    expect(craftingMediumAcademyEvidence("es")).toBe(CRAFTING_MEDIUM_ACADEMY_EVIDENCE);
    expect(craftingMediumBaseReadingHelp("es")).toBe(CRAFTING_MEDIUM_BASE_READING_HELP);
    expect(craftingAdvancedAcademyScenarios("es")).toBe(CRAFTING_ADVANCED_ACADEMY_SCENARIOS);
    expect(craftingAdvancedAcademyEvidence("es")).toBe(CRAFTING_ADVANCED_ACADEMY_EVIDENCE);
  });

  it("traducir no altera los objetos españoles compartidos", () => {
    const helmet = CRAFTING_ACADEMY_LESSONS[0]!.scenarios[0]!.item;
    expect(helmet.name).toBe("Yelmo de prácticas");
    expect(helmet.modifiers[0]?.text).toBe("+68 a la vida máxima");
  });
});

describe("Academy in English — basic level", () => {
  it("has English text for every lesson, scenario, concept and option", () => {
    for (const lesson of CRAFTING_ACADEMY_LESSONS) {
      expect(ACADEMY_LESSONS_EN[lesson.id], lesson.id).toBeDefined();
    }
    for (const id of ACADEMY_CONCEPT_IDS) {
      expect(ACADEMY_CONCEPTS_EN[id].label.trim(), id).not.toBe("");
      expect(ACADEMY_CONCEPTS_EN[id].recap.trim(), id).not.toBe("");
    }
    for (const scenario of BASIC_ES) {
      const en = ACADEMY_SCENARIOS_EN[scenario.id];
      expect(en, scenario.id).toBeDefined();
      expect(en?.why, scenario.id).toHaveLength(scenario.why.length);
      for (const option of scenario.options) {
        if (option.check.kind === "action") continue;
        expect(en?.options?.[option.id], `${scenario.id}/${option.id}`).toBeDefined();
      }
    }
  });

  it("keeps the same lessons, options, checks and answers", () => {
    expect(BASIC_EN.map((scenario) => scenario.id)).toEqual(BASIC_ES.map((scenario) => scenario.id));
    const lessonsEn = craftingAcademyLessons("en");
    expect(lessonsEn.map((lesson) => [lesson.id, lesson.order, lesson.scenarios.length])).toEqual(
      CRAFTING_ACADEMY_LESSONS.map((lesson) => [lesson.id, lesson.order, lesson.scenarios.length]),
    );
    BASIC_EN.forEach((scenario, index) => {
      const original = BASIC_ES[index]!;
      expect(scenario.conceptId).toBe(original.conceptId);
      expect(scenario.expectedOptionId).toBe(original.expectedOptionId);
      expect(scenario.options.map((option) => [option.id, option.check])).toEqual(
        original.options.map((option) => [option.id, option.check]),
      );
      // Las pistas aparecen en las mismas opciones en los dos idiomas.
      expect(scenario.options.map((option) => option.hint === undefined)).toEqual(
        original.options.map((option) => option.hint === undefined),
      );
      expect(resolveAcademyAnswer(scenario).correctOptionIds, scenario.id).toEqual([
        scenario.expectedOptionId,
      ]);
    });
  });

  it("leaves nothing in Spanish", () => {
    for (const scenario of BASIC_EN) {
      for (const text of [...basicText(scenario), ...itemText(scenario.item)]) {
        expect(text, scenario.id).not.toMatch(SPANISH_MARKS);
      }
    }
    for (const lesson of craftingAcademyLessons("en")) {
      expect(`${lesson.title} ${lesson.goal}`).not.toMatch(SPANISH_MARKS);
    }
    for (const concept of Object.values(ACADEMY_CONCEPTS_EN)) {
      expect(`${concept.label} ${concept.recap}`).not.toMatch(SPANISH_MARKS);
    }
    expect(craftingAcademyEvidence("en")).not.toMatch(SPANISH_MARKS);
    expect(craftingAcademyExerciseNotice("en")).not.toMatch(SPANISH_MARKS);
  });

  it("uses the official currency names", () => {
    const labels = new Set(
      BASIC_EN.flatMap((scenario) =>
        scenario.options.filter((option) => option.check.kind === "action").map((option) => option.label),
      ),
    );
    expect([...labels].sort()).toEqual(
      ["Exalted Orb", "Orb of Augmentation", "Orb of Transmutation", "Regal Orb"].sort(),
    );
  });

  it("never states a chance, price or DPS in the prose", () => {
    const forbidden = /\d+\s?%|\d+\s?(?:exalted|divine|chaos)s?\b|\bDPS\b/i;
    for (const scenario of BASIC_EN) {
      expect(basicText(scenario).join(" "), scenario.id).not.toMatch(forbidden);
    }
  });
});

describe("Academy in English — medium level", () => {
  it("has English text for every situation and option, with the same decisions", () => {
    expect(MEDIUM_EN.map((scenario) => scenario.id)).toEqual(
      CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map((scenario) => scenario.id),
    );
    MEDIUM_EN.forEach((scenario, index) => {
      const original = CRAFTING_MEDIUM_ACADEMY_SCENARIOS[index]!;
      const en = MEDIUM_ACADEMY_SCENARIOS_EN[scenario.id];
      expect(en, scenario.id).toBeDefined();
      for (const option of original.options) {
        expect(en?.options[option.id], `${scenario.id}/${option.id}`).toBeDefined();
      }
      expect(scenario.gameSteps).toHaveLength(original.gameSteps.length);
      expect(scenario.options.map((option) => [option.id, option.decision])).toEqual(
        original.options.map((option) => [option.id, option.decision]),
      );
      expect(scenario.facts).toEqual(original.facts);
      expect(resolveMediumAcademyDecision(scenario.facts)).toBe(scenario.expectedDecision);
      expect(validateMediumAcademyScenario(scenario), scenario.id).toBe(true);
    });
  });

  it("leaves nothing in Spanish and talks about the game, not the site", () => {
    for (const scenario of MEDIUM_EN) {
      const visible = [
        scenario.title,
        scenario.situation,
        scenario.gameState,
        scenario.playerGoal,
        scenario.question,
        scenario.explanation,
        scenario.takeaway,
        scenario.stopCondition,
        ...scenario.gameSteps,
        ...scenario.options.flatMap((option) => [option.label, option.hint]),
        ...itemText(scenario.item),
      ];
      for (const text of visible) expect(text, scenario.id).not.toMatch(SPANISH_MARKS);
      expect(visible.join(" "), scenario.id).not.toMatch(/Exile Copilot|paste|tooltip|DPS|\d+\s?%/i);
    }
    expect(craftingMediumAcademyEvidence("en")).not.toMatch(SPANISH_MARKS);
    expect(craftingMediumBaseReadingHelp("en")).not.toMatch(SPANISH_MARKS);
  });
});

describe("Academy in English — advanced level", () => {
  it("has English text for every case, route and option, with the same decisions", () => {
    expect(ADVANCED_EN.map((scenario) => scenario.id)).toEqual(
      CRAFTING_ADVANCED_ACADEMY_SCENARIOS.map((scenario) => scenario.id),
    );
    ADVANCED_EN.forEach((scenario, index) => {
      const original = CRAFTING_ADVANCED_ACADEMY_SCENARIOS[index]!;
      const en = ADVANCED_ACADEMY_SCENARIOS_EN[scenario.id];
      expect(en, scenario.id).toBeDefined();
      for (const option of original.options) {
        expect(en?.options[option.id], `${scenario.id}/${option.id}`).toBeDefined();
      }
      for (const route of original.facts.routes) {
        expect(en?.routes?.[route.id], `${scenario.id}/${route.id}`).toBeDefined();
      }
      expect(scenario.contract.protect).toHaveLength(original.contract.protect.length);
      expect(scenario.gameSteps).toHaveLength(original.gameSteps.length);
      expect(scenario.options.map((option) => [option.id, option.decision])).toEqual(
        original.options.map((option) => [option.id, option.decision]),
      );
      // Mismos hechos salvo el texto de las rutas.
      const stripRouteText = (facts: typeof scenario.facts) => ({
        ...facts,
        routes: facts.routes.map(({ id, legal, risk, tooltipVerified }) => ({ id, legal, risk, tooltipVerified })),
      });
      expect(stripRouteText(scenario.facts)).toEqual(stripRouteText(original.facts));
      expect(resolveAdvancedAcademyDecision(scenario.facts)).toBe(scenario.expectedDecision);
      expect(concealAdvancedAcademyItemReading(scenario)).toBe(concealAdvancedAcademyItemReading(original));
      expect(validateAdvancedAcademyScenario(scenario), scenario.id).toBe(true);
    });
  });

  it("leaves nothing in Spanish and teaches game actions, not site operations", () => {
    for (const scenario of ADVANCED_EN) {
      const visible = [
        scenario.title,
        scenario.skill,
        scenario.situation,
        scenario.question,
        scenario.explanation,
        scenario.lesson,
        scenario.contract.objective,
        scenario.contract.stop,
        ...scenario.contract.protect,
        ...scenario.gameSteps,
        ...scenario.options.flatMap((option) => [option.label, option.hint]),
        ...scenario.facts.routes.flatMap((route) => [route.label, route.consequence]),
        ...itemText(scenario.item),
      ];
      for (const text of visible) expect(text, scenario.id).not.toMatch(SPANISH_MARKS);
      const prose = visible.slice(0, visible.length - itemText(scenario.item).length).join(" ");
      expect(prose, scenario.id).not.toMatch(/Exile Copilot|paste|Ctrl\+Alt\+C|tooltip|\bDPS\b|\d+\s?%/i);
    }
    expect(craftingAdvancedAcademyEvidence("en")).not.toMatch(SPANISH_MARKS);
  });

  it("the protected lines match the item the player is looking at", () => {
    const replacement = ADVANCED_EN.find((scenario) => scenario.id === "avanzado-reemplazo-no-demostrado");
    const lines = replacement?.item.modifiers.map((modifier) => modifier.text) ?? [];
    for (const protectedLine of replacement?.contract.protect ?? []) {
      expect(lines).toContain(protectedLine);
    }
  });
});

// ---------------------------------------------------------------------------
// Objetos de ejemplo: misma estructura en los dos idiomas
// ---------------------------------------------------------------------------

interface ItemPair {
  es: Item;
  en: Item;
  table: Readonly<Record<string, AcademyItemTextEn>>;
}

function uniqueById(items: Item[]): Item[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

const ITEM_PAIRS: ItemPair[] = [
  ...uniqueById(BASIC_ES.map((scenario) => scenario.item)).map((es) => ({
    es,
    en: localizeAcademyItem(es, ACADEMY_ITEMS_EN, "en"),
    table: ACADEMY_ITEMS_EN,
  })),
  ...uniqueById(CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map((scenario) => scenario.item)).map((es) => ({
    es,
    en: localizeAcademyItem(es, MEDIUM_ACADEMY_ITEMS_EN, "en"),
    table: MEDIUM_ACADEMY_ITEMS_EN,
  })),
  ...uniqueById(CRAFTING_ADVANCED_ACADEMY_SCENARIOS.map((scenario) => scenario.item)).map((es) => ({
    es,
    en: localizeAcademyItem(es, ADVANCED_ACADEMY_ITEMS_EN, "en"),
    table: ADVANCED_ACADEMY_ITEMS_EN,
  })),
];

/** Clase de objeto tal como la escribe el cliente en cada idioma. */
const ITEM_CLASS: Record<string, { es: string; en: string }> = {
  helmet: { es: "Yelmos", en: "Helmets" },
  gloves: { es: "Guantes", en: "Gloves" },
  boots: { es: "Botas", en: "Boots" },
  body: { es: "Armaduras corporales", en: "Body Armours" },
  belt: { es: "Cinturones", en: "Belts" },
  amulet: { es: "Amuletos", en: "Amulets" },
  ring1: { es: "Anillos", en: "Rings" },
  ring2: { es: "Anillos", en: "Rings" },
  offhand: { es: "Escudos", en: "Shields" },
};

function itemClass(item: Item, lang: "es" | "en"): string {
  if (item.slot !== "weapon") return ITEM_CLASS[item.slot]![lang];
  const bow = /\b(?:arco|bow)\b/i.test(item.baseType);
  if (lang === "es") return bow ? "Arcos" : "Mazas a una mano";
  return bow ? "Bows" : "One Hand Maces";
}

const RARITY_TEXT = {
  es: { normal: "Normal", magic: "Mágico", rare: "Raro" },
  en: { normal: "Normal", magic: "Magic", rare: "Rare" },
} as const;

/** El objeto como lo copiaría el juego con Ctrl+Alt+C en cada idioma. */
function advancedCopy(item: Item, lang: "es" | "en"): string {
  const rarity = item.rarity as "normal" | "magic" | "rare";
  const header = [
    `${lang === "es" ? "Clase de objeto" : "Item Class"}: ${itemClass(item, lang)}`,
    `${lang === "es" ? "Rareza" : "Rarity"}: ${RARITY_TEXT[lang][rarity]}`,
    item.name,
    ...(rarity === "rare" ? [item.baseType] : []),
  ];
  const modifiers = item.modifiers.flatMap((modifier, index) => {
    const family = modifier.affix === "prefix" ? (lang === "es" ? "prefijo" : "Prefix") : lang === "es" ? "sufijo" : "Suffix";
    const head =
      lang === "es"
        ? `{ Mod. de ${family} "" (Grado: ${index + 1}) }`
        : `{ ${family} Modifier "" (Tier: ${index + 1}) }`;
    return [head, modifier.text];
  });
  return [
    ...header,
    "--------",
    `${lang === "es" ? "Nivel de objeto" : "Item Level"}: ${item.itemLevel}`,
    ...(modifiers.length > 0 ? ["--------", ...modifiers] : []),
  ].join("\n");
}

function structure(item: Item) {
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  return {
    rarity: item.rarity,
    // El juego no distingue el primer anillo del segundo.
    slot: item.slot === "ring2" ? "ring1" : item.slot,
    itemLevel: item.itemLevel,
    explicit: explicit.length,
    prefixes: explicit.filter((modifier) => modifier.affix === "prefix").length,
    suffixes: explicit.filter((modifier) => modifier.affix === "suffix").length,
  };
}

describe("Academy example items in English", () => {
  it("every example item and modifier has English game text", () => {
    expect(ITEM_PAIRS.length).toBeGreaterThan(20);
    for (const { es, table } of ITEM_PAIRS) {
      const en = table[es.id];
      expect(en, es.id).toBeDefined();
      for (const modifier of es.modifiers) {
        expect(en?.modifiers?.[modifier.id], `${es.id}/${modifier.id}`).toBeDefined();
      }
    }
  });

  it("only the words change: rarity, slot, level, affixes and state are the same", () => {
    for (const { es, en } of ITEM_PAIRS) {
      expect(en.id).toBe(es.id);
      expect(en.slot).toBe(es.slot);
      expect(en.rarity).toBe(es.rarity);
      expect(en.itemLevel).toBe(es.itemLevel);
      expect(en.craftingState).toEqual(es.craftingState);
      expect(en.sources).toEqual(es.sources);
      expect(en.modifiers.map(({ id, kind, affix, tags }) => ({ id, kind, affix, tags }))).toEqual(
        es.modifiers.map(({ id, kind, affix, tags }) => ({ id, kind, affix, tags })),
      );
      expect(diagnoseCraftingItem(en)).toEqual(diagnoseCraftingItem(es));
      for (const text of itemText(en)) expect(text, es.id).not.toMatch(SPANISH_MARKS);
      expect(en.name).not.toBe(es.name);
    }
  });

  it("the English game text parses to the same item as the Spanish one", () => {
    for (const { es, en } of ITEM_PAIRS) {
      const parsedEs = parseItemText(advancedCopy(es, "es"));
      const parsedEn = parseItemText(advancedCopy(en, "en"));
      expect(parsedEs.recognized, es.id).toBe(true);
      expect(parsedEn.recognized, es.id).toBe(true);
      expect(structure(parsedEs.item), `${es.id} (es)`).toEqual(structure(es));
      expect(structure(parsedEn.item), `${es.id} (en)`).toEqual(structure(parsedEs.item));
      expect(parsedEn.item.modifiers.map((modifier) => modifier.text)).toEqual(
        en.modifiers.map((modifier) => modifier.text),
      );
      expect(parsedEn.item.name).toBe(en.name);
      if (en.rarity === "rare") expect(parsedEn.item.baseType).toBe(en.baseType);
    }
  });
});
