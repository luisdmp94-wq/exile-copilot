import { readCharacterLevel, type CharacterProfile } from "@shared/domain.js";
import { CHECK_TEXT, type CheckLang } from "./checkText";

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

function formatPercent(value: number | null | undefined): string | null {
  return typeof value === "number" ? `${value}%` : null;
}

/**
 * Mensaje para el jugador cuando lo pegado no sirve. Devuelve null si el texto
 * puede enviarse; si no, explica qué falta sin códigos internos.
 */
export function checkPastedCode(content: string, lang: CheckLang): string | null {
  const t = CHECK_TEXT[lang].importErrors;
  if (!content) return t.emptyCode;
  if (/^(https?:\/\/)?(www\.)?pobb\.in\//i.test(content)) return t.isPobbinLink;
  if (/^https?:\/\//i.test(content)) return t.isLink;
  return null;
}

/** Traduce el error de /import/build (código y detalle del servidor) a lenguaje claro. */
export function explainImportError(
  code: string,
  detail: string | undefined,
  lang: CheckLang,
): string {
  const t = CHECK_TEXT[lang].importErrors;
  if (code === "formato-desconocido") return t.notPob;
  if (code === "pob-code-invalido") {
    return detail && /PoE1/.test(detail) ? t.poe1 : t.broken;
  }
  // El detalle del servidor está en español: en inglés se muestra un mensaje propio.
  return lang === "es" && detail ? detail : t.generic(code);
}

export function readBuildForCheck(profile: CharacterProfile, lang: CheckLang): BuildCheckReading {
  const text = CHECK_TEXT[lang];
  const formatNumber = (value: number | null | undefined): string | null =>
    typeof value === "number" ? value.toLocaleString(text.locale) : null;

  const level = readCharacterLevel(profile);
  const characterClass = profile.characterClass.trim();
  const ascendancy = profile.ascendancy?.trim() ?? "";
  const identity = [
    UNKNOWN_CLASS.test(characterClass) ? null : characterClass,
    NO_ASCENDANCY.test(ascendancy) ? null : ascendancy,
    level.known ? text.readingView.level(level.level) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" · ");

  const defences: BuildCheckRow[] = [
    { label: text.stats.life, value: formatNumber(profile.life) },
    { label: text.stats.energyShield, value: formatNumber(profile.energyShield) },
    { label: text.stats.armour, value: formatNumber(profile.armour) },
    { label: text.stats.evasion, value: formatNumber(profile.evasion) },
  ];
  const resistances: BuildCheckRow[] = (["fire", "cold", "lightning", "chaos"] as const).map(
    (key) => ({ label: text.resistanceLabels[key], value: formatPercent(profile.resistances[key]) }),
  );
  const attributes: BuildCheckRow[] = [
    { label: text.stats.str, value: formatNumber(profile.attributes.str) },
    { label: text.stats.dex, value: formatNumber(profile.attributes.dex) },
    { label: text.stats.int, value: formatNumber(profile.attributes.int) },
  ];

  const knownStats = [...defences, ...resistances, ...attributes].filter(
    (row) => row.value !== null,
  ).length;

  return {
    identity: identity || text.readingView.unknownIdentity,
    defences,
    resistances,
    attributes,
    mainSkill: profile.skills[0]?.mainSkill ?? null,
    itemCount: profile.items.length,
    knownStats,
  };
}
