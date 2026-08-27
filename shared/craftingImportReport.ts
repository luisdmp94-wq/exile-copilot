import { diagnoseCraftingItem, type CraftingItemDiagnosis } from "./craftingDiagnosis.js";
import type { Item } from "./domain.js";

export const CRAFTING_IMPORT_REPORT_VERSION = "EC-CRAFTING-IMPORT-1";

export type CraftingImportIssueKind =
  | "copy-incomplete"
  | "parser-gap"
  | "mechanic-unverified"
  | "verified-blocker"
  | "unsupported-item"
  | "inconsistent-reading";

export interface CraftingImportIssue {
  kind: CraftingImportIssueKind;
  label: string;
  title: string;
  summary: string;
  retryCopy: boolean;
}

const ADVANCED_AFFIX_HEADER =
  /\{\s*(?:mod\.|modifier)[^}\n]*(?:prefijo|sufijo|prefix|suffix)[^}\n]*\}/i;

function hasVerifiedLegalBlocker(item: Item): boolean {
  const state = item.craftingState;
  return Boolean(
    state?.corrupted ||
      state?.doubleCorrupted ||
      state?.mirrored ||
      state?.sanctified ||
      state?.unmodifiable ||
      state?.unmodifiableExceptChaos,
  );
}

function hasUnverifiedSpecialState(item: Item): boolean {
  const state = item.craftingState;
  return Boolean(
    state?.split ||
      state?.unidentified ||
      state?.mutated ||
      state?.desecrated,
  );
}

/**
 * Separa un fallo de copia, una limitación del parser y una mecánica sin
 * verificar. La clasificación solo usa datos presentes en el objeto; nunca
 * intenta deducir qué debería decir el tooltip.
 */
export function assessCraftingImportIssue(
  item: Item,
  diagnosis: CraftingItemDiagnosis = diagnoseCraftingItem(item),
): CraftingImportIssue {
  if (hasVerifiedLegalBlocker(item)) {
    return {
      kind: "verified-blocker",
      label: "Bloqueo verificado",
      title: "Esta pieza no admite este craft",
      summary:
        "El tooltip sí se ha leído, pero declara un estado que bloquea esta ruta. Volver a copiarlo no lo hará modificable.",
      retryCopy: false,
    };
  }

  if (hasUnverifiedSpecialState(item)) {
    return {
      kind: "mechanic-unverified",
      label: "Mecánica no verificada",
      title: "Esta interacción aún no está verificada",
      summary:
        "La pieza tiene un estado especial cuya interacción no está demostrada para este parche. No gastes moneda sobre ella.",
      retryCopy: false,
    };
  }

  if (!["normal", "magic", "rare"].includes(item.rarity)) {
    return {
      kind: "unsupported-item",
      label: "Objeto fuera de cobertura",
      title: "Este tipo de objeto todavía no está cubierto",
      summary:
        "La lectura inicial de crafting solo está verificada para objetos normales, mágicos y raros.",
      retryCopy: false,
    };
  }

  const explicit = item.modifiers.filter((modifier) => modifier.kind === "explicit");
  const inconsistentStructure =
    (item.rarity === "normal" && explicit.length > 0) ||
    (item.rarity !== "normal" && explicit.length === 0);
  if (inconsistentStructure) {
    return {
      kind: "inconsistent-reading",
      label: "Lectura inconsistente",
      title: "La estructura copiada no cuadra",
      summary:
        "Rareza y modificadores se contradicen. Vuelve a copiar la pieza completa; si se repite, conserva el informe para revisar el importador.",
      retryCopy: true,
    };
  }

  if (
    diagnosis.unclassifiedExplicitCount > 0 &&
    ADVANCED_AFFIX_HEADER.test(item.rawText ?? "")
  ) {
    return {
      kind: "parser-gap",
      label: "Límite del importador",
      title: "El texto parece completo, pero falta clasificar una línea",
      summary:
        "El tooltip contiene cabeceras avanzadas y aun así una línea quedó sin clasificar. Copia el informe para poder reproducir y corregir el caso.",
      retryCopy: true,
    };
  }

  if (
    item.itemLevel === undefined ||
    item.craftingState === undefined ||
    diagnosis.unclassifiedExplicitCount > 0
  ) {
    return {
      kind: "copy-incomplete",
      label: "Copia incompleta",
      title: "Faltan datos del tooltip avanzado",
      summary:
        "La copia no contiene toda la estructura necesaria. Repite Ctrl+Alt+C sobre la pieza antes de gastar otra moneda.",
      retryCopy: true,
    };
  }

  return {
    kind: "parser-gap",
    label: "Lectura pendiente",
    title: "El importador necesita revisar este caso",
    summary:
      "La pieza sigue bloqueada aunque no falta un dato reconocible. El informe conserva la entrada exacta para poder reproducirlo.",
    retryCopy: true,
  };
}

function normalizeTooltip(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

/** Huella local para reconocer duplicados sin enviar el tooltip. */
export function craftingTooltipFingerprint(value: string | undefined): string {
  const normalized = normalizeTooltip(value) || "[texto-no-disponible]";
  let hash = 0x811c9dc5;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Informe determinista y autocontenido. No incluye personaje, build,
 * presupuesto, ids internos ni marcas temporales. Solo sale del navegador si
 * el jugador decide copiarlo y compartirlo.
 */
export function buildCraftingImportReport(input: {
  item: Item;
  patch: string;
}): string {
  const diagnosis = diagnoseCraftingItem(input.item);
  const issue = assessCraftingImportIssue(input.item, diagnosis);
  const rawText = normalizeTooltip(input.item.rawText);
  const modifiers = input.item.modifiers.length > 0
    ? input.item.modifiers.map((modifier, index) =>
        `${index + 1}. ${modifier.kind} · ${modifier.affix ?? "sin posición"} · ${
          modifier.verified ? "verificado" : "sin verificar"
        } · ${modifier.text.replace(/\s+/g, " ").trim()}`,
      )
    : ["- Ninguno interpretado"];
  const blockers = diagnosis.blockers.length > 0
    ? diagnosis.blockers.map((blocker) => `- ${blocker}`)
    : ["- Ninguno"];

  return [
    "EXILE COPILOT — INFORME LOCAL DE LECTURA DE OBJETO",
    `Formato: ${CRAFTING_IMPORT_REPORT_VERSION}`,
    `Huella del tooltip: ${craftingTooltipFingerprint(input.item.rawText)}`,
    `Parche declarado: ${input.patch.trim() || "Desconocido"}`,
    `Categoría: ${issue.kind} · ${issue.label}`,
    `Estado del diagnóstico: ${diagnosis.state}`,
    "",
    "OBJETO INTERPRETADO",
    `Nombre: ${input.item.name || "Desconocido"}`,
    `Clase: ${input.item.itemClass ?? "Desconocida"}`,
    `Base: ${input.item.baseType || "Desconocida"}`,
    `Rareza: ${input.item.rarity}`,
    `Ranura: ${input.item.slot}`,
    `Nivel de objeto: ${input.item.itemLevel ?? "Desconocido"}`,
    `Estructura: ${diagnosis.prefixCount} prefijos · ${diagnosis.suffixCount} sufijos · ${diagnosis.unclassifiedExplicitCount} sin clasificar`,
    "",
    "BLOQUEOS OBSERVADOS",
    ...blockers,
    `Siguiente comprobación: ${diagnosis.nextAction}`,
    "",
    "MODIFICADORES INTERPRETADOS",
    ...modifiers,
    "",
    "TEXTO ORIGINAL DEL TOOLTIP",
    "--- inicio ---",
    rawText || "[El objeto guardado no conserva el texto original]",
    "--- fin ---",
    "",
    "PRIVACIDAD",
    "Generado localmente. No contiene el personaje, la build ni el presupuesto. No se ha enviado nada.",
  ].join("\n");
}
