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

export interface CraftingImportEvidenceSummary {
  recognized: string[];
  missing: string[];
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
      state?.desecrated ||
      state?.fractured ||
      item.modifiers.some(
        (modifier) => modifier.fractured || modifier.mutated || modifier.desecrated,
      ),
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
  lang: "es" | "en" = "es",
): CraftingImportIssue {
  const en = lang === "en";
  if (hasVerifiedLegalBlocker(item)) {
    return {
      kind: "verified-blocker",
      label: en ? "Verified block" : "Bloqueo verificado",
      title: en ? "This item can't take this craft" : "Esta pieza no admite este craft",
      summary: en
        ? "The tooltip was read fine, but it shows a state that blocks this route. Copying it again won't make it modifiable."
        : "El tooltip sí se ha leído, pero declara un estado que bloquea esta ruta. Volver a copiarlo no lo hará modificable.",
      retryCopy: false,
    };
  }

  if (hasUnverifiedSpecialState(item)) {
    return {
      kind: "mechanic-unverified",
      label: en ? "Unverified mechanic" : "Mecánica no verificada",
      title: en ? "This interaction isn't verified yet" : "Esta interacción aún no está verificada",
      summary: en
        ? "The item has a special state whose interaction isn't proven for this patch. Don't spend currency on it."
        : "La pieza tiene un estado especial cuya interacción no está demostrada para este parche. No gastes moneda sobre ella.",
      retryCopy: false,
    };
  }

  if (!["normal", "magic", "rare"].includes(item.rarity)) {
    return {
      kind: "unsupported-item",
      label: en ? "Item not covered" : "Objeto fuera de cobertura",
      title: en ? "This kind of item isn't covered yet" : "Este tipo de objeto todavía no está cubierto",
      summary: en
        ? "The first crafting reading is only verified for normal, magic and rare items."
        : "La lectura inicial de crafting solo está verificada para objetos normales, mágicos y raros.",
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
      label: en ? "Inconsistent reading" : "Lectura inconsistente",
      title: en ? "The copied structure doesn't add up" : "La estructura copiada no cuadra",
      summary: en
        ? "Rarity and modifiers contradict each other. Copy the full item again; if it keeps happening, keep the report so the importer can be checked."
        : "Rareza y modificadores se contradicen. Vuelve a copiar la pieza completa; si se repite, conserva el informe para revisar el importador.",
      retryCopy: true,
    };
  }

  if (
    diagnosis.unclassifiedExplicitCount > 0 &&
    ADVANCED_AFFIX_HEADER.test(item.rawText ?? "")
  ) {
    return {
      kind: "parser-gap",
      label: en ? "Importer limit" : "Límite del importador",
      title: en
        ? "The text looks complete, but one line isn't classified"
        : "El texto parece completo, pero falta clasificar una línea",
      summary: en
        ? "The tooltip has advanced headers and still one line wasn't classified. Copy the report so the case can be reproduced and fixed."
        : "El tooltip contiene cabeceras avanzadas y aun así una línea quedó sin clasificar. Copia el informe para poder reproducir y corregir el caso.",
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
      label: en ? "Incomplete copy" : "Copia incompleta",
      title: en ? "Advanced tooltip data is missing" : "Faltan datos del tooltip avanzado",
      summary: en
        ? "The copy doesn't have the full structure. Press Ctrl+Alt+C on the item again before spending more currency."
        : "La copia no contiene toda la estructura necesaria. Repite Ctrl+Alt+C sobre la pieza antes de gastar otra moneda.",
      retryCopy: true,
    };
  }

  return {
    kind: "parser-gap",
    label: en ? "Reading pending" : "Lectura pendiente",
    title: en ? "The importer needs to review this case" : "El importador necesita revisar este caso",
    summary: en
      ? "The item is still blocked even though no known field is missing. The report keeps the exact input so it can be reproduced."
      : "La pieza sigue bloqueada aunque no falta un dato reconocible. El informe conserva la entrada exacta para poder reproducirlo.",
    retryCopy: true,
  };
}

/**
 * Explica la lectura parcial sin confundir «conozco la base» con «puedo
 * recomendar un craft». Solo enumera campos presentes; no consulta una tabla
 * externa ni completa el tooltip por el nombre del objeto.
 */
export function summarizeCraftingImportEvidence(
  item: Item,
  diagnosis: CraftingItemDiagnosis = diagnoseCraftingItem(item),
  lang: "es" | "en" = "es",
): CraftingImportEvidenceSummary {
  const en = lang === "en";
  const recognized: string[] = [];
  const missing: string[] = [];

  if (item.baseType && !/^desconocid[oa]$/i.test(item.baseType)) {
    recognized.push(en ? `Base type: ${item.baseType}` : `Base: ${item.baseType}`);
  } else {
    missing.push(en ? "Base type" : "Tipo base");
  }

  if (item.itemClass) recognized.push(en ? `Class: ${item.itemClass}` : `Clase: ${item.itemClass}`);
  else missing.push(en ? "Item class" : "Clase de objeto");

  recognized.push(en ? `Rarity read: ${item.rarity}` : `Rareza leída: ${item.rarity}`);

  if (item.itemLevel !== undefined) {
    recognized.push(en ? `Item level: ${item.itemLevel}` : `Nivel de objeto: ${item.itemLevel}`);
  } else missing.push(en ? "Item level" : "Nivel de objeto");

  if (item.craftingState !== undefined) {
    recognized.push(en ? "Special states checked" : "Estados especiales comprobados");
  } else missing.push(en ? "Tooltip special states" : "Estados especiales del tooltip");

  if (diagnosis.unclassifiedExplicitCount > 0) {
    missing.push(
      en
        ? `Position of ${diagnosis.unclassifiedExplicitCount} modifier${diagnosis.unclassifiedExplicitCount === 1 ? "" : "s"}`
        : `Posición de ${diagnosis.unclassifiedExplicitCount} modificador(es)`,
    );
  } else if (item.modifiers.some((modifier) => modifier.kind === "explicit")) {
    recognized.push(
      en
        ? `Classified modifiers: ${diagnosis.prefixCount} ${diagnosis.prefixCount === 1 ? "prefix" : "prefixes"} · ${diagnosis.suffixCount} ${diagnosis.suffixCount === 1 ? "suffix" : "suffixes"}`
        : `Afijos clasificados: ${diagnosis.prefixCount} prefijo(s) · ${diagnosis.suffixCount} sufijo(s)`,
    );
  }

  return { recognized, missing };
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
}, lang: "es" | "en" = "es"): string {
  const en = lang === "en";
  const diagnosis = diagnoseCraftingItem(input.item, lang);
  const issue = assessCraftingImportIssue(input.item, diagnosis, lang);
  const evidence = summarizeCraftingImportEvidence(input.item, diagnosis, lang);
  const rawText = normalizeTooltip(input.item.rawText);
  const modifiers = input.item.modifiers.length > 0
    ? input.item.modifiers.map((modifier, index) =>
        en
          ? `${index + 1}. ${modifier.kind} · ${modifier.affix ?? "no position"} · ${
              modifier.verified ? "verified" : "not verified"
            } · ${modifier.text.replace(/\s+/g, " ").trim()}`
          : `${index + 1}. ${modifier.kind} · ${modifier.affix ?? "sin posición"} · ${
              modifier.verified ? "verificado" : "sin verificar"
            } · ${modifier.text.replace(/\s+/g, " ").trim()}`,
      )
    : [en ? "- None read" : "- Ninguno interpretado"];
  const blockers = diagnosis.blockers.length > 0
    ? diagnosis.blockers.map((blocker) => `- ${blocker}`)
    : [en ? "- None" : "- Ninguno"];

  if (en) {
    return [
      "EXILE COPILOT — LOCAL ITEM READING REPORT",
      `Format: ${CRAFTING_IMPORT_REPORT_VERSION}`,
      `Tooltip fingerprint: ${craftingTooltipFingerprint(input.item.rawText)}`,
      `Stated patch: ${input.patch.trim() || "Unknown"}`,
      `Category: ${issue.kind} · ${issue.label}`,
      `Diagnosis state: ${diagnosis.state}`,
      "",
      "ITEM AS READ",
      `Name: ${input.item.name || "Unknown"}`,
      `Class: ${input.item.itemClass ?? "Unknown"}`,
      `Base type: ${input.item.baseType || "Unknown"}`,
      `Rarity: ${input.item.rarity}`,
      `Slot: ${input.item.slot}`,
      `Item level: ${input.item.itemLevel ?? "Unknown"}`,
      `Structure: ${diagnosis.prefixCount} prefixes · ${diagnosis.suffixCount} suffixes · ${diagnosis.unclassifiedExplicitCount} unclassified`,
      "",
      "PARTIAL READING",
      ...evidence.recognized.map((fact) => `- Recognized: ${fact}`),
      ...(evidence.missing.length > 0
        ? evidence.missing.map((fact) => `- Missing: ${fact}`)
        : ["- Missing: block needs review, no known field is missing"]),
      "",
      "BLOCKS FOUND",
      ...blockers,
      `Next check: ${diagnosis.nextAction}`,
      "",
      "MODIFIERS AS READ",
      ...modifiers,
      "",
      "ORIGINAL TOOLTIP TEXT",
      "--- start ---",
      rawText || "[The saved item doesn't keep the original text]",
      "--- end ---",
      "",
      "PRIVACY",
      "Generated locally. It doesn't include your character, build or budget. Nothing has been sent.",
    ].join("\n");
  }

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
    "LECTURA PARCIAL",
    ...evidence.recognized.map((fact) => `- Reconocido: ${fact}`),
    ...(evidence.missing.length > 0
      ? evidence.missing.map((fact) => `- Falta: ${fact}`)
      : ["- Falta: revisión del bloqueo sin campo ausente reconocible"]),
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
