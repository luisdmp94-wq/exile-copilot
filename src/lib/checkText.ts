import type { ItemSlot, Resistances } from "@shared/domain.js";

/**
 * Todos los textos del chequeo de build, en español e inglés.
 *
 * Las reglas y la página reciben el idioma y toman de aquí cada frase: ningún
 * texto visible del chequeo vive fuera de este archivo, salvo el aviso legal
 * de GGG, que se muestra siempre en su inglés original.
 */

export type CheckLang = "es" | "en";

export const CHECK_LANGS: Array<{ id: CheckLang; label: string }> = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

type ElementKey = "fire" | "cold" | "lightning";

export interface CheckText {
  locale: string;
  noData: string;

  page: {
    kicker: string;
    title: string;
    intro: string;
    modeGroup: string;
    modePob: string;
    modeManual: string;
    codeLabel: string;
    codePlaceholder: string;
    read: string;
    reading: string;
    languageLabel: string;
    previousVersion: string;
  };

  importErrors: {
    emptyCode: string;
    isLink: string;
    notPob: string;
    poe1: string;
    broken: string;
    isPlan: string;
    generic: (code: string) => string;
  };

  readingView: {
    heading: string;
    unknownIdentity: string;
    level: (level: number) => string;
    firstSkill: (skill: string) => string;
    noSkills: string;
    items: (count: number) => string;
    noStats: string;
    defencesTitle: string;
    resistancesTitle: string;
    attributesTitle: string;
    pobNote: string;
  };

  stats: {
    life: string;
    energyShield: string;
    armour: string;
    evasion: string;
    str: string;
    dex: string;
    int: string;
  };

  resistanceLabels: Record<keyof Resistances, string>;
  /** Tipo de daño en minúsculas dentro de una frase: «daño de fuego» / «fire damage». */
  damageNames: Record<ElementKey | "chaos", string>;
  slots: Record<ItemSlot, string>;

  priorities: {
    heading: string;
    none: string;
    severity: { alta: string; media: string; baja: string };
    /** Daño extra frente al objetivo: «un 92% más» / «92% more», «6 veces más» / «6 times more». */
    extraDamage: (percentMore: number | null, times: string | null) => string;
    elementalTitle: string;
    elementalFact: (label: string, value: string, gap: number) => string;
    elementalWhy: (damage: string, value: string, extra: string) => string;
    chaosTitle: string;
    chaosFact: (value: string, gap: number) => string;
    chaosWhy: (value: string, extra: string) => string;
    slotsTitle: (count: number) => string;
    slotsFact: (slots: string) => string;
    slotsWhy: string;
  };

  manual: {
    resistancesLegend: string;
    resistancesHint: string;
    field: (label: string) => string;
    slotsLegend: string;
    slotsHint: string;
    submit: string;
    invalidNumber: (label: string, min: number, max: number) => string;
    needOneResistance: string;
  };
}

const ES_HOW_TO_COPY =
  "En PoB2 abre tu build, ve a Import/Export Build, pulsa Generate y copia el código entero.";
const EN_HOW_TO_COPY =
  "In PoB2 open your build, go to Import/Export Build, press Generate and copy the whole code.";

export const CHECK_TEXT: Record<CheckLang, CheckText> = {
  es: {
    locale: "es-ES",
    noData: "sin dato",
    page: {
      kicker: "Exile Copilot · Path of Exile 2",
      title: "Chequeo de build",
      intro: "Dame los datos de tu personaje y te digo qué arreglar primero.",
      modeGroup: "Cómo darme los datos",
      modePob: "Tengo Path of Building 2",
      modeManual: "Lo escribo a mano",
      codeLabel: "Código de Path of Building 2",
      codePlaceholder: "En PoB2: Import/Export Build → Generate → Copy, y pégalo aquí",
      read: "Leer mi build",
      reading: "Leyendo…",
      languageLabel: "Idioma",
      previousVersion: "Abrir la versión anterior de Exile Copilot",
    },
    importErrors: {
      emptyCode: "Pega primero el código de tu build.",
      isLink: `Eso es un enlace. De momento necesito el código, no el link. ${ES_HOW_TO_COPY}`,
      notPob: `Eso no parece un código de Path of Building 2. ${ES_HOW_TO_COPY}`,
      poe1: "Ese código es de Path of Building para PoE1. Necesito el de Path of Building 2.",
      broken: `El código está incompleto o dañado. ${ES_HOW_TO_COPY}`,
      isPlan:
        "Eso es un plan de build, no un personaje. Pega el código que da Path of Building 2 en Import/Export Build → Generate.",
      generic: (code) => `No he podido leer el código (${code}). Vuelve a intentarlo en un momento.`,
    },
    readingView: {
      heading: "Lo que he leído",
      unknownIdentity: "Clase y nivel sin dato",
      level: (level) => `nivel ${level}`,
      firstSkill: (skill) => `Primer grupo de habilidades: ${skill}`,
      noSkills: "Sin habilidades en el código",
      items: (count) => `${count} objeto${count === 1 ? "" : "s"} equipado${count === 1 ? "" : "s"}`,
      noStats:
        "El código no trae estadísticas calculadas. Abre la build en PoB2, comprueba que tiene equipo y vuelve a generar el código.",
      defencesTitle: "Defensa",
      resistancesTitle: "Resistencias",
      attributesTitle: "Atributos",
      pobNote:
        "Son los valores que calcula Path of Building. Si alguno no coincide con tu personaje en el juego, dímelo.",
    },
    stats: {
      life: "Vida",
      energyShield: "Escudo de energía",
      armour: "Armadura",
      evasion: "Evasión",
      str: "Fuerza",
      dex: "Destreza",
      int: "Inteligencia",
    },
    resistanceLabels: { fire: "Fuego", cold: "Frío", lightning: "Rayo", chaos: "Caos" },
    damageNames: { fire: "fuego", cold: "frío", lightning: "rayo", chaos: "caos" },
    slots: {
      weapon: "Arma",
      offhand: "Mano secundaria",
      helmet: "Casco",
      body: "Pecho",
      gloves: "Guantes",
      boots: "Botas",
      belt: "Cinturón",
      amulet: "Amuleto",
      ring1: "Anillo 1",
      ring2: "Anillo 2",
      flask: "Frasco",
      other: "Otro",
    },
    priorities: {
      heading: "Lo que arreglaría primero",
      none: "No veo nada urgente en lo que compruebo: resistencias, caos y huecos de equipo están bien.",
      severity: { alta: "Urgente", media: "Importante", baja: "Menor" },
      extraDamage: (percentMore, times) =>
        times !== null ? `${times} veces más` : `un ${percentMore}% más`,
      elementalTitle: "Sube tus resistencias elementales al 75%",
      elementalFact: (label, value, gap) => `${label} ${value} · te faltan ${gap} puntos`,
      elementalWhy: (damage, value, extra) =>
        `Con ${damage} al ${value} recibes ${extra} daño de ${damage} que con el 75%.`,
      chaosTitle: "Saca la resistencia al caos de negativo",
      chaosFact: (value, gap) => `Caos ${value} · te faltan ${gap} puntos para llegar a 0%`,
      chaosWhy: (value, extra) => `Con ${value} recibes ${extra} daño de caos que con 0%.`,
      slotsTitle: (count) =>
        count === 1 ? "Rellena el hueco de equipo vacío" : "Rellena los huecos de equipo vacíos",
      slotsFact: (slots) => `Vacío: ${slots}`,
      slotsWhy:
        "Cada hueco vacío es vida, resistencias o daño que no estás recibiendo. Hasta un objeto raro barato ayuda.",
    },
    manual: {
      resistancesLegend: "Resistencias",
      resistancesHint: "Cópialas de la hoja de personaje del juego. Deja en blanco las que no sepas.",
      field: (label) => `${label} (%)`,
      slotsLegend: "¿Qué huecos de equipo tienes vacíos?",
      slotsHint: "Si llevas todo puesto, no marques nada.",
      submit: "Ver qué arreglar",
      invalidNumber: (label, min, max) =>
        `${label}: escribe un número entero entre ${min} y ${max}, por ejemplo 52 o -30.`,
      needOneResistance: "Escribe al menos una resistencia de tu hoja de personaje.",
    },
  },

  en: {
    locale: "en-US",
    noData: "no data",
    page: {
      kicker: "Exile Copilot · Path of Exile 2",
      title: "Build check",
      intro: "Give me your character's numbers and I'll tell you what to fix first.",
      modeGroup: "How to give me your data",
      modePob: "I have Path of Building 2",
      modeManual: "I'll type it in",
      codeLabel: "Path of Building 2 code",
      codePlaceholder: "In PoB2: Import/Export Build → Generate → Copy, then paste it here",
      read: "Check my build",
      reading: "Reading…",
      languageLabel: "Language",
      previousVersion: "Open the previous version of Exile Copilot (Spanish)",
    },
    importErrors: {
      emptyCode: "Paste your build code first.",
      isLink: `That's a link. For now I need the code itself, not the link. ${EN_HOW_TO_COPY}`,
      notPob: `That doesn't look like a Path of Building 2 code. ${EN_HOW_TO_COPY}`,
      poe1: "That code is from Path of Building for PoE1. I need the Path of Building 2 one.",
      broken: `The code is incomplete or damaged. ${EN_HOW_TO_COPY}`,
      isPlan:
        "That's a build plan, not a character. Paste the code Path of Building 2 gives you under Import/Export Build → Generate.",
      generic: (code) => `I couldn't read the code (${code}). Please try again in a moment.`,
    },
    readingView: {
      heading: "What I read",
      unknownIdentity: "Class and level unknown",
      level: (level) => `level ${level}`,
      firstSkill: (skill) => `First skill group: ${skill}`,
      noSkills: "No skills in the code",
      items: (count) => `${count} item${count === 1 ? "" : "s"} equipped`,
      noStats:
        "The code has no calculated stats. Open the build in PoB2, check it has gear and generate the code again.",
      defencesTitle: "Defence",
      resistancesTitle: "Resistances",
      attributesTitle: "Attributes",
      pobNote:
        "These are the values Path of Building calculates. If any of them doesn't match your character in game, let me know.",
    },
    stats: {
      life: "Life",
      energyShield: "Energy Shield",
      armour: "Armour",
      evasion: "Evasion",
      str: "Strength",
      dex: "Dexterity",
      int: "Intelligence",
    },
    resistanceLabels: { fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" },
    damageNames: { fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" },
    slots: {
      weapon: "Weapon",
      offhand: "Off hand",
      helmet: "Helmet",
      body: "Body Armour",
      gloves: "Gloves",
      boots: "Boots",
      belt: "Belt",
      amulet: "Amulet",
      ring1: "Ring 1",
      ring2: "Ring 2",
      flask: "Flask",
      other: "Other",
    },
    priorities: {
      heading: "What I'd fix first",
      none: "Nothing urgent in what I check: resistances, chaos and gear slots look fine.",
      severity: { alta: "Urgent", media: "Important", baja: "Minor" },
      extraDamage: (percentMore, times) =>
        times !== null ? `${times} times more` : `${percentMore}% more`,
      elementalTitle: "Raise your elemental resistances to 75%",
      elementalFact: (label, value, gap) => `${label} ${value} · ${gap} points short`,
      elementalWhy: (damage, value, extra) =>
        `With ${damage} at ${value} you take ${extra} ${damage} damage than at 75%.`,
      chaosTitle: "Get your chaos resistance out of the negatives",
      chaosFact: (value, gap) => `Chaos ${value} · ${gap} points short of 0%`,
      chaosWhy: (value, extra) => `At ${value} you take ${extra} chaos damage than at 0%.`,
      slotsTitle: (count) => (count === 1 ? "Fill your empty gear slot" : "Fill your empty gear slots"),
      slotsFact: (slots) => `Empty: ${slots}`,
      slotsWhy:
        "Every empty slot is life, resistances or damage you're not getting. Even a cheap rare helps.",
    },
    manual: {
      resistancesLegend: "Resistances",
      resistancesHint: "Copy them from your character sheet in game. Leave blank any you don't know.",
      field: (label) => `${label} (%)`,
      slotsLegend: "Which gear slots are empty?",
      slotsHint: "If you have everything equipped, leave them all unticked.",
      submit: "Show what to fix",
      invalidNumber: (label, min, max) =>
        `${label}: enter a whole number between ${min} and ${max}, e.g. 52 or -30.`,
      needOneResistance: "Enter at least one resistance from your character sheet.",
    },
  },
};

/** Idioma inicial: ?lang= en la URL, luego la elección guardada, luego el navegador. */
export function initialCheckLang(
  search: string,
  stored: string | null,
  browserLanguages: readonly string[],
): CheckLang {
  const fromUrl = new URLSearchParams(search).get("lang");
  if (fromUrl === "es" || fromUrl === "en") return fromUrl;
  if (stored === "es" || stored === "en") return stored;
  return browserLanguages.some((language) => language.toLowerCase().startsWith("es")) ? "es" : "en";
}
