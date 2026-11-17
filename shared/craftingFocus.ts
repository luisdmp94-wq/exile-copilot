import type { Modifier } from "./domain.js";

/**
 * Objetivo primario observable del guía sencillo. Es deliberadamente más
 * preciso que la categoría general «daño/defensa»: una etiqueta genérica de
 * daño no demuestra que fuego sirva a una build física, ni «vida» demuestra
 * vida máxima.
 */
export const COACH_FOCUSES = [
  "physical",
  "fire",
  "cold",
  "lightning",
  "chaos",
  "attack-speed",
  "critical",
  "projectile-levels",
  "maximum-life",
  "resistances",
  "armour",
  "evasion",
  "energy-shield",
] as const;
export type CoachFocus = (typeof COACH_FOCUSES)[number];

export const COACH_FOCUS_LABELS: Record<CoachFocus, string> = {
  physical: "daño físico",
  fire: "daño de fuego",
  cold: "daño de hielo",
  lightning: "daño de rayo",
  chaos: "daño de caos",
  "attack-speed": "velocidad de ataque",
  critical: "crítico",
  "projectile-levels": "niveles de habilidades de proyectiles",
  "maximum-life": "vida máxima",
  resistances: "resistencias",
  armour: "armadura",
  evasion: "evasión",
  "energy-shield": "escudo de energía",
};

export const COACH_FOCUS_LABELS_EN: Record<CoachFocus, string> = {
  physical: "physical damage",
  fire: "fire damage",
  cold: "cold damage",
  lightning: "lightning damage",
  chaos: "chaos damage",
  "attack-speed": "attack speed",
  critical: "critical hits",
  "projectile-levels": "projectile skill levels",
  "maximum-life": "maximum life",
  resistances: "resistances",
  armour: "armour",
  evasion: "evasion",
  "energy-shield": "energy shield",
};

export type CoachFocusDirection = "damage" | "defence";

export const COACH_FOCUS_DIRECTION: Record<CoachFocus, CoachFocusDirection> = {
  physical: "damage",
  fire: "damage",
  cold: "damage",
  lightning: "damage",
  chaos: "damage",
  "attack-speed": "damage",
  critical: "damage",
  "projectile-levels": "damage",
  "maximum-life": "defence",
  resistances: "defence",
  armour: "defence",
  evasion: "defence",
  "energy-shield": "defence",
};

export const DAMAGE_COACH_FOCUSES: readonly CoachFocus[] = [
  "physical",
  "fire",
  "cold",
  "lightning",
  "chaos",
  "attack-speed",
  "critical",
  "projectile-levels",
];

export const DEFENCE_COACH_FOCUSES: readonly CoachFocus[] = [
  "maximum-life",
  "resistances",
  "armour",
  "evasion",
  "energy-shield",
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

/** Solo reconoce una intención que el jugador haya escrito de forma explícita. */
export function inferCoachFocus(value: string): CoachFocus | null {
  const text = normalize(value);
  // Español e inglés a la vez: el jugador puede escribir en cualquiera de los
  // dos, y las palabras inglesas cortas van como palabra completa (\b).
  if (/vida maxima|maximum life|\bmax life\b/.test(text)) return "maximum-life";
  if (/resistencia|resistencias|\bresist(?:s|ance|ances)?\b|\bres\b/.test(text)) return "resistances";
  if (/escudo de energia|energy shield/.test(text)) return "energy-shield";
  if (/armadura|armour|\barmor\b/.test(text)) return "armour";
  if (/evasion/.test(text)) return "evasion";
  if (/velocidad de ataque|attack speed/.test(text)) return "attack-speed";
  if (/critico|critical|crit\b|\bcrits\b/.test(text)) return "critical";
  if (
    /(?:nivel|niveles|\blevels?\b).*(?:proyectil|projectile)|habilidades? de proyectiles?|\bprojectile skills?\b/.test(
      text,
    )
  ) {
    return "projectile-levels";
  }
  if (/fisico|physical/.test(text)) return "physical";
  if (/fuego|fire/.test(text)) return "fire";
  if (/hielo|cold/.test(text)) return "cold";
  if (/rayo|lightning/.test(text)) return "lightning";
  if (/caos|chaos/.test(text)) return "chaos";
  return null;
}

export type CoachFocusSignalStatus = "direct" | "no-direct-signal" | "unknown";

export interface CoachFocusSignal {
  status: CoachFocusSignalStatus;
  title: string;
  summary: string;
  matchedTags: string[];
  observedTags: string[];
}

function modifierCorpus(modifier: Modifier): { text: string; tags: Set<string> } {
  return {
    text: normalize([modifier.text, modifier.name].filter(Boolean).join(" ")),
    tags: new Set((modifier.tags ?? []).map(normalize)),
  };
}

function matchesFocus(focus: CoachFocus, modifier: Modifier): boolean {
  const { text, tags } = modifierCorpus(modifier);
  const has = (...values: string[]) => values.some((value) => tags.has(normalize(value)));
  switch (focus) {
    case "physical": return has("physical", "físico") || /\bfisico\b|\bphysical\b/.test(text);
    case "fire": return has("fire", "fuego") || /\bfuego\b|\bfire\b/.test(text);
    case "cold": return has("cold", "hielo") || /\bhielo\b|\bcold\b/.test(text);
    case "lightning": return has("lightning", "rayo") || /\brayo\b|\blightning\b/.test(text);
    case "chaos": return has("chaos", "caos") || /\bcaos\b|\bchaos\b/.test(text);
    case "attack-speed":
      return /velocidad de ataque|attack speed/.test(text) ||
        ((has("attack", "ataque")) && has("speed", "velocidad"));
    case "critical": return has("critical", "crítico") || /critico|critical/.test(text);
    case "projectile-levels":
      return /(?:nivel|niveles).*(?:proyectil|projectile)|habilidades? de proyectiles?/.test(text);
    case "maximum-life": return /vida maxima|maximum life/.test(text);
    case "resistances": return has("resistance", "resistencias") || /resistencia/.test(text);
    case "armour": return has("armour", "armadura") || /armadura|armour/.test(text);
    case "evasion": return has("evasion", "evasión") || /evasion/.test(text);
    case "energy-shield":
      return has("energy shield", "escudo de energía") || /escudo de energia|energy shield/.test(text);
  }
}

/**
 * Comprueba el objetivo exacto contra texto y etiquetas observados. No puntúa
 * tiers, magnitud, DPS ni sinergias indirectas.
 */
export function evaluateCoachFocus(
  focus: CoachFocus | null,
  modifiers: readonly Modifier[],
  lang: "es" | "en" = "es",
): CoachFocusSignal {
  const en = lang === "en";
  const observedTags = [...new Set(
    modifiers.flatMap((modifier) => modifier.tags ?? []).map(normalize),
  )];
  if (focus === null) {
    return {
      status: "unknown",
      title: en ? "Your goal isn't specific yet" : "Falta concretar el objetivo",
      summary: en
        ? "Damage or defence is too broad to tell whether an affix helps."
        : "Daño o defensa es demasiado amplio para decidir si un afijo sirve.",
      matchedTags: [],
      observedTags,
    };
  }
  const matches = modifiers.filter((modifier) => matchesFocus(focus, modifier));
  if (matches.length > 0) {
    return {
      status: "direct",
      title: en
        ? `Matches ${COACH_FOCUS_LABELS_EN[focus]}`
        : `Coincide con ${COACH_FOCUS_LABELS[focus]}`,
      summary: en
        ? "The text matches your main goal. This doesn't rate how strong it is."
        : "El texto observado coincide con tu objetivo principal. Esto no puntúa su magnitud.",
      matchedTags: [...new Set(matches.flatMap((modifier) => modifier.tags ?? []).map(normalize))],
      observedTags,
    };
  }
  if (modifiers.length === 0 || (observedTags.length === 0 && modifiers.every((modifier) => !modifier.text.trim()))) {
    return {
      status: "unknown",
      title: en ? "No text to compare" : "Sin texto comparable",
      summary: en
        ? "The result doesn't have enough text to check your goal."
        : "El resultado no aporta texto suficiente para comprobar el objetivo.",
      matchedTags: [],
      observedTags,
    };
  }
  return {
    status: "no-direct-signal",
    title: en
      ? `Doesn't match ${COACH_FOCUS_LABELS_EN[focus]}`
      : `No coincide con ${COACH_FOCUS_LABELS[focus]}`,
    summary: en
      ? "The new affix doesn't literally match the main goal you picked."
      : "El afijo nuevo no coincide de forma literal con el objetivo principal elegido.",
    matchedTags: [],
    observedTags,
  };
}
