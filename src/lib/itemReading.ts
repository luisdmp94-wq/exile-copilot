import type { Item, Modifier } from "@shared/domain.js";
import { assessObservedModifierRoll, type ObservedRollBand } from "@shared/craftingRollQuality.js";
import { levellingItemLevel } from "@shared/craftingCoach.js";

/**
 * «Lo que tiene esta pieza»: la respuesta inmediata al pegar un objeto.
 *
 * No juzga si la pieza es buena o mala para una build (eso exigiría conocerla
 * entera). Dice, en palabras normales, qué da cada línea y para qué sirve, y
 * si sus números son altos o bajos cuando el texto copiado trae los rangos.
 * Todo sale del texto del propio objeto: no se inventa nada.
 */
export type ReadingLang = "es" | "en";

export type ReadingFamily =
  | "skills"
  | "move"
  | "life"
  | "res-fire"
  | "res-cold"
  | "res-lightning"
  | "res-chaos"
  | "res-all"
  | "energy-shield"
  | "armour"
  | "evasion"
  | "spirit"
  | "minions"
  | "spells"
  | "attacks"
  | "damage-type"
  | "critical"
  | "attributes"
  | "mana"
  | "other";

export interface ItemReadingLine {
  id: string;
  /** El texto del juego, tal cual. */
  text: string;
  family: ReadingFamily;
  /** Nombre corto de lo que da («Resistencia al fuego»). */
  label: string;
  /** Para qué sirve, en una frase. Vacío si no sabemos clasificar la línea. */
  meaning: string;
  /** Tirada dentro del rango visible; null si el texto no trae rangos. */
  roll: Extract<ObservedRollBand, "low" | "middle" | "high"> | null;
}

export interface ItemReading {
  /** «Da resistencia al fuego, vida y velocidad de movimiento.» */
  headline: string;
  lines: ItemReadingLine[];
  /** Avisos cortos (pieza de nivel bajo). Los huecos libres ya los dice la tarjeta de la pieza. */
  notes: string[];
  /**
   * Cómo copiarla para ver sus rangos; null si ya los trae o no hay líneas.
   * Va aparte porque quien la pinta puede estar diciéndolo ya en otro aviso.
   */
  copyTip: string | null;
  /** ¿Alguna línea trae rango para juzgar la tirada? */
  hasRolls: boolean;
}

interface FamilyText {
  label: string;
  /** Cómo se nombra dentro de la frase «Da …». */
  short: string;
  meaning: string;
}

const FAMILY_TEXT: Record<ReadingLang, Record<ReadingFamily, FamilyText>> = {
  es: {
    skills: { label: "Nivel de habilidades", short: "niveles de habilidad", meaning: "Sube el nivel de tus habilidades: de lo más valioso que puede tener una pieza." },
    move: { label: "Velocidad de movimiento", short: "velocidad de movimiento", meaning: "Te mueves más rápido. De lo mejor en unas botas." },
    life: { label: "Vida", short: "vida", meaning: "Aguantas más golpes." },
    "res-fire": { label: "Resistencia al fuego", short: "resistencia al fuego", meaning: "Recibes menos daño de fuego. El tope es 75 %." },
    "res-cold": { label: "Resistencia al hielo", short: "resistencia al hielo", meaning: "Recibes menos daño de hielo. El tope es 75 %." },
    "res-lightning": { label: "Resistencia al rayo", short: "resistencia al rayo", meaning: "Recibes menos daño de rayo. El tope es 75 %." },
    "res-chaos": { label: "Resistencia al caos", short: "resistencia al caos", meaning: "Recibes menos daño de caos." },
    "res-all": { label: "Resistencias elementales", short: "resistencias elementales", meaning: "Fuego, hielo y rayo a la vez. El tope es 75 %." },
    "energy-shield": { label: "Escudo de energía", short: "escudo de energía", meaning: "Una segunda barra de vida que se recarga sola." },
    armour: { label: "Armadura", short: "armadura", meaning: "Reduce el daño de los golpes físicos." },
    evasion: { label: "Evasión", short: "evasión", meaning: "Más probabilidad de esquivar golpes." },
    spirit: { label: "Espíritu", short: "espíritu", meaning: "Para mantener auras y esbirros." },
    minions: { label: "Esbirros", short: "mejoras de esbirros", meaning: "Solo sirve si llevas esbirros." },
    spells: { label: "Hechizos", short: "mejoras de hechizos", meaning: "Solo sirve si pegas con hechizos." },
    attacks: { label: "Ataque", short: "mejoras de ataque", meaning: "Solo sirve si pegas con armas." },
    "damage-type": { label: "Daño de un tipo", short: "daño de un tipo concreto", meaning: "Solo sirve si tu daño es de ese tipo." },
    critical: { label: "Golpe crítico", short: "golpe crítico", meaning: "Más daño cuando sale un crítico." },
    attributes: { label: "Atributos", short: "atributos", meaning: "Para cumplir requisitos de gemas y equipo." },
    mana: { label: "Maná", short: "maná", meaning: "Para lanzar habilidades más veces." },
    other: { label: "Otro", short: "otros efectos", meaning: "" },
  },
  en: {
    skills: { label: "Skill levels", short: "skill levels", meaning: "Raises the level of your skills: among the most valuable things an item can have." },
    move: { label: "Movement speed", short: "movement speed", meaning: "You move faster. Among the best things on boots." },
    life: { label: "Life", short: "life", meaning: "You survive more hits." },
    "res-fire": { label: "Fire resistance", short: "fire resistance", meaning: "You take less fire damage. The cap is 75%." },
    "res-cold": { label: "Cold resistance", short: "cold resistance", meaning: "You take less cold damage. The cap is 75%." },
    "res-lightning": { label: "Lightning resistance", short: "lightning resistance", meaning: "You take less lightning damage. The cap is 75%." },
    "res-chaos": { label: "Chaos resistance", short: "chaos resistance", meaning: "You take less chaos damage." },
    "res-all": { label: "Elemental resistances", short: "elemental resistances", meaning: "Fire, cold and lightning at once. The cap is 75%." },
    "energy-shield": { label: "Energy shield", short: "energy shield", meaning: "A second life bar that recharges by itself." },
    armour: { label: "Armour", short: "armour", meaning: "Reduces the damage of physical hits." },
    evasion: { label: "Evasion", short: "evasion", meaning: "More chance to dodge hits." },
    spirit: { label: "Spirit", short: "spirit", meaning: "For keeping auras and minions up." },
    minions: { label: "Minions", short: "minion bonuses", meaning: "Only useful if you play minions." },
    spells: { label: "Spells", short: "spell bonuses", meaning: "Only useful if you hit with spells." },
    attacks: { label: "Attacks", short: "attack bonuses", meaning: "Only useful if you hit with weapons." },
    "damage-type": { label: "Damage of one type", short: "damage of one type", meaning: "Only useful if your damage is of that type." },
    critical: { label: "Critical hits", short: "critical hits", meaning: "More damage when you land a critical hit." },
    attributes: { label: "Attributes", short: "attributes", meaning: "For meeting gem and gear requirements." },
    mana: { label: "Mana", short: "mana", meaning: "For using skills more often." },
    other: { label: "Other", short: "other effects", meaning: "" },
  },
};

/** Orden en que se nombran en la frase: primero lo que más le importa a un jugador nuevo. */
const HEADLINE_ORDER: ReadingFamily[] = [
  "skills",
  "move",
  "life",
  "res-all",
  "res-fire",
  "res-cold",
  "res-lightning",
  "res-chaos",
  "energy-shield",
  "armour",
  "evasion",
  "spirit",
  "minions",
  "spells",
  "attacks",
  "damage-type",
  "critical",
  "attributes",
  "mana",
  "other",
];

/**
 * Líneas que nombran algo conocido pero significan otra cosa: penetrar la
 * resistencia del enemigo no es tener resistencia, romper armadura no es tener
 * armadura. Antes de explicar mal una línea, se enseña tal cual.
 */
const NOT_WHAT_IT_SEEMS =
  /penetra|enemig|enem(?:y|ies)|presencia|presence|romp|break|como daño|as extra|convert|resistencia[^.]*máxim|máxim[^.]*resistencia|maximum[^.]*resistance/i;

const TESTS: Array<[ReadingFamily, RegExp]> = [
  ["skills", /al nivel de (?:todas las )?(?:gemas|habilidades)|to level of all/i],
  // Los esbirros van antes que vida, daño o resistencias: «vida de los esbirros» es de esbirros.
  ["minions", /esbirros?|minions?/i],
  ["move", /velocidad de movimiento|movement speed/i],
  ["res-all", /todas las resistencias|all elemental resistances|to all resistances/i],
  ["res-fire", /resistencia al fuego|fire resistance/i],
  ["res-cold", /resistencia al (?:hielo|frío)|cold resistance/i],
  ["res-lightning", /resistencia al rayo|lightning resistance/i],
  ["res-chaos", /resistencia al caos|chaos resistance/i],
  ["life", /vida máxima|maximum life|de vida por segundo|life per second|regeneración de vida|life regeneration/i],
  ["energy-shield", /escudo de energía|energy shield/i],
  ["armour", /armadura|armour|armor/i],
  ["evasion", /evasión|evasion/i],
  ["spirit", /espíritu|spirit/i],
  ["critical", /crítico|critical/i],
  ["spells", /hechizos?|spells?|velocidad de lanzamiento|cast speed/i],
  ["attacks", /ataques?|attacks?|daño físico|physical damage|precisión|accuracy|cuerpo a cuerpo|melee|proyectil|projectile/i],
  // «Agrega de 1 a 9 de daño de rayo» sin más es daño plano de arma: va con los ataques.
  ["attacks", /^(?:agrega de|adds \d)/i],
  [
    "damage-type",
    /(?:daño de (?:caos|fuego|hielo|frío|rayo)|daño elemental) aumentado|increased (?:chaos|fire|cold|lightning|elemental) damage/i,
  ],
  ["attributes", /a la (?:fuerza|destreza|inteligencia)|todos los atributos|to (?:strength|dexterity|intelligence)|all attributes/i],
  ["mana", /maná|mana/i],
];

function familyOf(text: string): ReadingFamily {
  if (NOT_WHAT_IT_SEEMS.test(text)) return "other";
  return TESTS.find(([, test]) => test.test(text))?.[0] ?? "other";
}

function joinList(parts: string[], lang: ReadingLang): string {
  if (parts.length <= 1) return parts.join("");
  const last = parts[parts.length - 1];
  const and = lang === "en" ? "and" : /^(?:i|hi)/i.test(last) ? "e" : "y";
  return `${parts.slice(0, -1).join(", ")} ${and} ${last}`;
}

function rollOf(modifier: Modifier, lang: ReadingLang): ItemReadingLine["roll"] {
  const band = assessObservedModifierRoll(modifier, lang).band;
  return band === "low" || band === "middle" || band === "high" ? band : null;
}

/** Cuántas familias nombra la frase antes de resumir el resto. */
const HEADLINE_LIMIT = 4;

export function readItemForPlayer(item: Item, lang: ReadingLang = "es"): ItemReading {
  const text = FAMILY_TEXT[lang];
  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const lines: ItemReadingLine[] = explicit.map((modifier) => {
    const family = familyOf(modifier.text);
    // En la propia arma, una línea de ataque no depende de cómo juegues: mejora esa arma.
    const ownWeapon = family === "attacks" && item.slot === "weapon";
    return {
      id: modifier.id,
      text: modifier.text,
      family,
      label: text[family].label,
      meaning: ownWeapon
        ? lang === "en"
          ? "Makes this weapon hit harder or better."
          : "Hace que esta arma pegue más o mejor."
        : text[family].meaning,
      roll: rollOf(modifier, lang),
    };
  });

  const families = HEADLINE_ORDER.filter((family) => lines.some((line) => line.family === family));
  const named = families.filter((family) => family !== "other").slice(0, HEADLINE_LIMIT);
  const rest = families.length - named.length;
  const parts = named.map((family) => text[family].short);
  if (rest > 0) parts.push(lang === "en" ? (parts.length === 0 ? "effects I can't classify" : "more") : parts.length === 0 ? "efectos que no sé clasificar" : "más cosas");
  const headline =
    lines.length === 0
      ? lang === "en"
        ? "It has no modifiers of its own yet."
        : "Todavía no tiene modificadores propios."
      : lang === "en"
        ? `It gives ${joinList(parts, lang)}.`
        : `Da ${joinList(parts, lang)}.`;

  const notes: string[] = [];
  const level = levellingItemLevel(item);
  if (level !== null) {
    notes.push(
      lang === "en"
        ? `It's level ${level}: you'll replace it soon. Don't spend expensive currency on it.`
        : `Es de nivel ${level}: la cambiarás pronto. No gastes monedas caras en ella.`,
    );
  }
  const hasRolls = lines.some((line) => line.roll !== null);
  const copyTip =
    lines.length > 0 && !hasRolls
      ? lang === "en"
        ? "Copy it with Ctrl+Alt+C and I'll tell you if its numbers are high or low."
        : "Cópiala con Ctrl+Alt+C y te digo si sus números son altos o bajos."
      : null;

  return { headline, lines, notes, copyTip, hasRolls };
}
