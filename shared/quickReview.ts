/**
 * «Revisión rápida del personaje»: con unos pocos datos que el jugador ve en
 * el juego, encuentra los problemas que más frenan a un novato en la campaña
 * y devuelve los 3 más importantes, en orden, cada uno con qué hacer.
 *
 * Reglas fijas, a la vista y sin IA. Salen de casos reales (la Liche de Luis,
 * 17-11-2026): arma muy por detrás, gemas bajas para su nivel, Contagio sin
 * una habilidad que haga el daño, ascendencia que pide maldición sin llevarla,
 * resistencias cortas para el siguiente acto y puntos de ascendencia sin coger.
 *
 * Una regla sin sus datos no se aplica y no se inventa nada: la respuesta dice
 * qué no ha podido revisar.
 */

export type QuickReviewLang = "es" | "en";
export type QuickReviewAct = 1 | 2 | 3 | 4 | "maps";

export interface QuickReviewInput {
  /** Nivel del personaje. */
  level: number | null;
  /** Acto en el que está, o mapas. */
  act: QuickReviewAct | null;
  /** Habilidad con la que hace el daño. */
  mainSkill: string | null;
  /** Nivel de esa gema (sale en la ventana de habilidades). */
  mainSkillGemLevel: number | null;
  /** «Nivel de objeto» del arma. Vacío si es un único: entonces no se juzga. */
  weaponItemLevel: number | null;
  resistances: { fire: number | null; cold: number | null; lightning: number | null };
  /** Puntos de ascendencia ya cogidos (0, 2, 4…). */
  ascendancyPoints: number | null;
  /** Ascendencia, si la tiene («Liche», «Lich»…). */
  ascendancy: string | null;
  /** ¿Lleva alguna maldición? null = no lo ha dicho. */
  usesCurse: boolean | null;
  /** Otras habilidades que lleva (nombres), para ver si la principal tiene pareja. */
  otherSkills: string[];
}

export interface QuickReviewFinding {
  id: string;
  /** Cuánto frena, de 0 a 100: decide el orden. */
  severity: number;
  title: string;
  action: string;
  /** Pasos concretos para hacerlo, si el jugador quiere más detalle. */
  how?: string[];
}

export interface QuickReviewResult {
  /** Los 3 problemas más importantes, del que más frena al que menos. */
  top: QuickReviewFinding[];
  /** Cuántos problemas encontró en total (puede haber más de 3). */
  total: number;
  /** Los que no caben en los 3 primeros, por si el jugador quiere verlos. */
  rest: QuickReviewFinding[];
  /** Lo que no se pudo revisar por falta de datos, de lo que más pesa a lo que menos. */
  missing: string[];
  /** Lo mismo, como claves y en el mismo orden: sirve para llevar al jugador al campo. */
  missingKeys: QuickReviewGap[];
}

/** Datos que la revisión puede echar en falta. */
export type QuickReviewGap = "level" | "res" | "act" | "gem" | "weapon" | "asc";

/** De lo que más cambia el consejo a lo que menos. */
const GAP_ORDER: QuickReviewGap[] = ["level", "res", "act", "gem", "weapon", "asc"];

/**
 * Los datos sin los que «no veo nada grave» sería mentira: nivel, resistencias,
 * acto y nivel de la gema. El arma y la ascendencia afinan, pero no bloquean.
 */
const KEY_GAPS: readonly QuickReviewGap[] = ["level", "res", "act", "gem"];

/** Los dos datos clave que más conviene pedir primero; vacío si no falta ninguno. */
export function firstGapsToAsk(result: Pick<QuickReviewResult, "missingKeys">): QuickReviewGap[] {
  return result.missingKeys.filter((gap) => KEY_GAPS.includes(gap)).slice(0, 2);
}

/**
 * Nivel de personaje que pide cada nivel de gema de habilidad (igual en todas).
 * Fuente: tablas «Requires Level» de poe2db (Contagion, Essence Drain), 18-11-2026.
 */
export const GEM_LEVEL_REQUIREMENTS = [0, 3, 6, 10, 14, 18, 22, 26, 31, 36, 41, 46, 52, 58, 64, 66, 72, 78, 84, 90] as const;

/** El nivel de gema más alto que puede llevar un personaje de este nivel. */
export function maxGemLevelFor(characterLevel: number): number {
  let best = 1;
  GEM_LEVEL_REQUIREMENTS.forEach((required, index) => {
    if (characterLevel >= required) best = index + 1;
  });
  return best;
}

/**
 * Id de la habilidad principal que el jugador escribió en la revisión rápida y
 * que su perfil no tenía. De ella NO se sabe qué apoyos lleva: el motor no
 * puede decir «tiene 0 apoyos» de algo que nadie le ha contado.
 */
export const QUICK_REVIEW_SKILL_ID = "revision-rapida-habilidad";

/** Resistencia elemental orientativa: la de las guías en campaña, el tope en mapas. */
export function resistanceTargetFor(act: QuickReviewAct): number {
  return act === "maps" ? 75 : 30;
}

const WORDS = {
  es: {
    elements: { fire: "fuego", cold: "hielo", lightning: "rayo" },
    and: "y",
    weaponTitle: (gap: number) => `Tu arma va ${gap} niveles por detrás de ti`,
    weaponAction:
      "Mira lo que venden en el pueblo cada vez que subas de nivel y busca un arma de tu nivel. Si usas hechizos, que tenga «+ al nivel de las gemas de hechizo»: es lo que más daño da.",
    weaponHow: [
      "Los vendedores renuevan lo que venden cada vez que subes de nivel: vuelve a mirar en cada pueblo.",
      "Si encuentras un arma normal (blanca) de tu nivel, usa un Orbe de transmutación y uno de aumento: con suerte sale la línea que buscas.",
      "Un arma única barata también vale mientras subes: en el mercado muchas cuestan muy poco.",
    ],
    gemTitle: (gem: number, max: number) => `Tu gema principal está a nivel ${gem} y puedes llevarla a ${max}`,
    gemAction: (max: number) =>
      `Súbela con una gema sin tallar de nivel ${max} o más: pulsa la flecha ↑ junto a la habilidad. Es daño gratis.`,
    contagionTitle: "Contagio solo reparte el daño: le falta la habilidad que lo hace",
    contagionAction:
      "Lleva Drenar esencia. Lanza Contagio al grupo, luego Drenar esencia: al morir, los enemigos contagian el daño a los de al lado.",
    resTitle: (list: string, target: number) => `Resistencias bajas: ${list} (conviene llegar al ${target} %)`,
    resAction:
      "Cambia una pieza que no te dé resistencias (botas, cinturón, anillos) por otra que sí. Al principio, mejor resistencias que un poco más de daño.",
    resHow: [
      "Pon una runa de resistencia en cada engarce libre de tu armadura: son baratas y suben justo la que te falta.",
      "Mira lo que venden en el pueblo: los vendedores cambian sus objetos cada vez que subes de nivel. Busca piezas mágicas (azules) con la resistencia que te falta.",
      "¿Tienes una pieza normal (blanca) de tu nivel? Usa un Orbe de transmutación y luego uno de aumento. Si sale una resistencia, ya te sirve; si no, prueba con otra pieza blanca, que son baratas.",
      "Anillos, cinturón y botas son las piezas que más fácil traen resistencias: cambia primero la que no te dé ninguna.",
    ],
    ascFirstTitle: "Te faltan tus dos primeros puntos de ascendencia",
    ascFirstAction:
      "Haz la primera prueba de ascendencia (la de las Sekhemas en el acto 2 o la de Caos en el acto 3). Son de las mejoras más grandes de la campaña.",
    ascSecondTitle: "Tienes 2 puntos de ascendencia más esperándote",
    ascSecondAction:
      "Haz la Prueba de Caos (templo de Caos, tras vencer a Xyclucian en el acto 3): da los puntos 3 y 4. Si se te atraganta, vuelve con más nivel.",
    curseTitle: "Tu ascendencia Liche no hace nada sin una maldición",
    curseAction:
      "Lleva una maldición, por ejemplo Desesperación (baja la resistencia al caos) o Debilitar si aún no tienes la gema. Lánzala antes de atacar: además, los malditos explotan.",
    missing: {
      level: "tu nivel",
      act: "el acto",
      gem: "el nivel de tu gema principal",
      weapon: "el nivel de objeto de tu arma",
      res: "tus resistencias",
      asc: "tus puntos de ascendencia",
    },
  },
  en: {
    elements: { fire: "fire", cold: "cold", lightning: "lightning" },
    and: "and",
    weaponTitle: (gap: number) => `Your weapon is ${gap} levels behind you`,
    weaponAction:
      "Check the town vendors every time you level up and look for a weapon close to your level. If you cast spells, get one with \"+ to Level of all Spell Skills\": it's the biggest damage boost.",
    weaponHow: [
      "Vendors restock every time you level up: check again in every town.",
      "If you find a normal (white) weapon at your level, use an Orb of Transmutation and an Orb of Augmentation: with luck you get the line you want.",
      "A cheap unique weapon works too while levelling: many cost very little on trade.",
    ],
    gemTitle: (gem: number, max: number) => `Your main gem is level ${gem} and you can take it to ${max}`,
    gemAction: (max: number) =>
      `Level it up with an Uncut Skill Gem of level ${max} or higher: press the ↑ arrow next to the skill. It's free damage.`,
    contagionTitle: "Contagion only spreads damage: it's missing the skill that deals it",
    contagionAction:
      "Add Essence Drain. Cast Contagion on the pack, then Essence Drain: when enemies die they pass the damage to the ones next to them.",
    resTitle: (list: string, target: number) => `Low resistances: ${list} (aim for ${target}%)`,
    resAction:
      "Swap an item that gives no resistances (boots, belt, rings) for one that does. Early on, resistances beat a little extra damage.",
    resHow: [
      "Put a resistance rune in every free socket of your armour: they're cheap and add exactly the one you lack.",
      "Check the town vendors: they restock every time you level up. Look for magic (blue) items with the resistance you need.",
      "Got a normal (white) item at your level? Use an Orb of Transmutation, then an Orb of Augmentation. If a resistance rolls, it's useful; if not, try another white item, they're cheap.",
      "Rings, belt and boots are the easiest items to get resistances on: replace the one giving none first.",
    ],
    ascFirstTitle: "You're missing your first two ascendancy points",
    ascFirstAction:
      "Do your first ascendancy trial (the Trial of the Sekhemas in act 2 or the Trial of Chaos in act 3). It's one of the biggest upgrades in the campaign.",
    ascSecondTitle: "Two more ascendancy points are waiting for you",
    ascSecondAction:
      "Do the Trial of Chaos (Temple of Chaos, after beating Xyclucian in act 3): it gives points 3 and 4. If it's too hard, come back a few levels later.",
    curseTitle: "Your Lich ascendancy does nothing without a curse",
    curseAction:
      "Use a curse, for example Despair (lowers chaos resistance), or Enfeeble if you don't have that gem yet. Cast it before attacking: cursed enemies also explode.",
    missing: {
      level: "your level",
      act: "your act",
      gem: "your main gem's level",
      weapon: "your weapon's item level",
      res: "your resistances",
      asc: "your ascendancy points",
    },
  },
} as const;

const CONTAGION = /contagi(?:o|on)/i;
const ESSENCE_DRAIN = /drenar esencia|essence drain/i;
const LICH = /\b(?:liche|lich)\b/i;

function joinList(parts: string[], and: string): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} ${and} ${parts[parts.length - 1]}`;
}

export function reviewCharacter(input: QuickReviewInput, lang: QuickReviewLang = "es"): QuickReviewResult {
  const w = WORDS[lang];
  const findings: QuickReviewFinding[] = [];
  const gaps = new Set<QuickReviewGap>();
  const level = input.level !== null && input.level > 0 ? input.level : null;

  // 1. Arma atrasada respecto al personaje.
  if (level !== null && input.weaponItemLevel !== null && input.weaponItemLevel > 0) {
    const gap = level - input.weaponItemLevel;
    if (gap >= 10) {
      // Cuanto más atrasada, más frena: 10 niveles = 80, 14 = 84, tope 92.
      findings.push({
        id: "weapon",
        severity: Math.min(92, 70 + gap),
        title: w.weaponTitle(gap),
        action: w.weaponAction,
        how: [...w.weaponHow],
      });
    }
  } else if (input.weaponItemLevel === null) {
    gaps.add("weapon");
  }

  // 2. Gema principal por debajo de lo que permite el nivel.
  if (level !== null && input.mainSkillGemLevel !== null && input.mainSkillGemLevel > 0) {
    const max = maxGemLevelFor(level);
    const behind = max - input.mainSkillGemLevel;
    if (behind >= 2) {
      findings.push({
        id: "gem",
        severity: Math.min(85, 65 + behind * 5),
        title: w.gemTitle(input.mainSkillGemLevel, max),
        action: w.gemAction(max),
      });
    } else if (behind === 1) {
      findings.push({
        id: "gem",
        severity: 30,
        title: w.gemTitle(input.mainSkillGemLevel, max),
        action: w.gemAction(max),
      });
    }
  } else if (input.mainSkillGemLevel === null) {
    gaps.add("gem");
  }

  // 3. Habilidad que necesita pareja.
  const allSkills = [input.mainSkill ?? "", ...input.otherSkills].join(" | ");
  if (input.mainSkill !== null && CONTAGION.test(input.mainSkill) && !ESSENCE_DRAIN.test(allSkills)) {
    findings.push({ id: "contagion", severity: 80, title: w.contagionTitle, action: w.contagionAction });
  }

  // 4. Resistencias para el siguiente tramo.
  const res = input.resistances;
  const known = (["fire", "cold", "lightning"] as const).filter((element) => res[element] !== null);
  if (input.act !== null && known.length > 0) {
    const target = resistanceTargetFor(input.act);
    const low = known
      .filter((element) => (res[element] as number) < target)
      .sort((a, b) => (res[a] as number) - (res[b] as number));
    if (low.length > 0) {
      const worst = res[low[0]] as number;
      findings.push({
        id: "res",
        severity: Math.min(95, 55 + (target - worst)),
        title: w.resTitle(
          joinList(
            low.map((element) => `${w.elements[element]} ${res[element]}${lang === "en" ? "%" : " %"}`),
            w.and,
          ),
          target,
        ),
        action: w.resAction,
        how: [...w.resHow],
      });
    }
  } else if (known.length === 0) {
    gaps.add("res");
  }
  if (input.act === null) gaps.add("act");
  if (level === null) gaps.add("level");

  // 5. Puntos de ascendencia sin coger.
  if (input.ascendancyPoints !== null && input.act !== null) {
    const actNumber = input.act === "maps" ? 5 : input.act;
    if (input.ascendancyPoints === 0 && actNumber >= 3) {
      findings.push({ id: "asc-first", severity: 85, title: w.ascFirstTitle, action: w.ascFirstAction });
    } else if (input.ascendancyPoints === 2 && actNumber >= 3) {
      // La Prueba de Caos se abre en el acto 3 (tras Xyclucian): aviso suave.
      findings.push({ id: "asc-second", severity: actNumber >= 4 ? 60 : 45, title: w.ascSecondTitle, action: w.ascSecondAction });
    }
  } else if (input.ascendancyPoints === null) {
    gaps.add("asc");
  }

  // 6. Liche sin maldición.
  if (input.ascendancy !== null && LICH.test(input.ascendancy) && input.usesCurse === false) {
    findings.push({ id: "curse", severity: 70, title: w.curseTitle, action: w.curseAction });
  }

  findings.sort((a, b) => b.severity - a.severity);
  const missingKeys = GAP_ORDER.filter((gap) => gaps.has(gap));
  return {
    top: findings.slice(0, 3),
    rest: findings.slice(3),
    total: findings.length,
    missing: missingKeys.map((gap) => w.missing[gap]),
    missingKeys,
  };
}
