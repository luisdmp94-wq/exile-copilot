import { readCharacterLevel, type CharacterProfile } from "@shared/domain.js";

/**
 * Lectura de un personaje importado desde PoB2 para el chequeo de build.
 *
 * Solo traduce lo que trae el perfil a filas legibles: un dato ausente queda
 * como `null` y la página lo muestra como «sin dato», nunca como 0.
 */

export interface BuildCheckRow {
  label: string;
  value: string | null;
}

export interface BuildCheckReading {
  /** «Ranger · Deadeye · nivel 92»; las partes desconocidas se omiten. */
  identity: string;
  defences: BuildCheckRow[];
  resistances: BuildCheckRow[];
  attributes: BuildCheckRow[];
  mainSkill: string | null;
  itemCount: number;
  /** Cuántas filas tienen dato: 0 indica un código sin estadísticas útiles. */
  knownStats: number;
}

const UNKNOWN_CLASS = /^(desconocid[ao]|unknown)?$/i;
/** PoB2 escribe ascendClassName="None" en personajes sin ascendencia. */
const NO_ASCENDANCY = /^(none)?$/i;

function formatNumber(value: number | null | undefined): string | null {
  return typeof value === "number" ? value.toLocaleString("es-ES") : null;
}

function formatPercent(value: number | null | undefined): string | null {
  return typeof value === "number" ? `${value}%` : null;
}

const HOW_TO_COPY =
  "En PoB2 abre tu build, ve a Import/Export Build, pulsa Generate y copia el código entero.";

/**
 * Mensaje para el jugador cuando lo pegado no sirve. Devuelve null si el texto
 * puede enviarse; si no, explica qué falta sin códigos internos.
 */
export function checkPastedCode(content: string): string | null {
  if (!content) return "Pega primero el código de tu build.";
  if (/^https?:\/\//i.test(content)) {
    return `Eso es un enlace. De momento necesito el código, no el link. ${HOW_TO_COPY}`;
  }
  return null;
}

/** Traduce el error de /import/build (código y detalle del servidor) a lenguaje claro. */
export function explainImportError(code: string, detail: string | undefined): string {
  if (code === "formato-desconocido") {
    return `Eso no parece un código de Path of Building 2. ${HOW_TO_COPY}`;
  }
  if (code === "pob-code-invalido") {
    if (detail && /PoE1/.test(detail)) {
      return "Ese código es de Path of Building para PoE1. Necesito el de Path of Building 2.";
    }
    return `El código está incompleto o dañado. ${HOW_TO_COPY}`;
  }
  return detail ?? code;
}

export function readBuildForCheck(profile: CharacterProfile): BuildCheckReading {
  const level = readCharacterLevel(profile);
  const characterClass = profile.characterClass.trim();
  const ascendancy = profile.ascendancy?.trim() ?? "";
  const identity = [
    UNKNOWN_CLASS.test(characterClass) ? null : characterClass,
    NO_ASCENDANCY.test(ascendancy) ? null : ascendancy,
    level.known ? `nivel ${level.level}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  const defences: BuildCheckRow[] = [
    { label: "Vida", value: formatNumber(profile.life) },
    { label: "Escudo de energía", value: formatNumber(profile.energyShield) },
    { label: "Armadura", value: formatNumber(profile.armour) },
    { label: "Evasión", value: formatNumber(profile.evasion) },
  ];
  const resistances: BuildCheckRow[] = [
    { label: "Fuego", value: formatPercent(profile.resistances.fire) },
    { label: "Frío", value: formatPercent(profile.resistances.cold) },
    { label: "Rayo", value: formatPercent(profile.resistances.lightning) },
    { label: "Caos", value: formatPercent(profile.resistances.chaos) },
  ];
  const attributes: BuildCheckRow[] = [
    { label: "Fuerza", value: formatNumber(profile.attributes.str) },
    { label: "Destreza", value: formatNumber(profile.attributes.dex) },
    { label: "Inteligencia", value: formatNumber(profile.attributes.int) },
  ];

  const knownStats = [...defences, ...resistances, ...attributes].filter(
    (row) => row.value !== null,
  ).length;

  return {
    identity: identity || "Clase y nivel sin dato",
    defences,
    resistances,
    attributes,
    mainSkill: profile.skills[0]?.mainSkill ?? null,
    itemCount: profile.items.length,
    knownStats,
  };
}
