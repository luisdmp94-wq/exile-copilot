import { readCharacterLevel, type CharacterProfile, type ItemSlot } from "@shared/domain.js";
import { REQUIRED_SLOTS, type BuildCheckInput, type BuildPriority } from "./buildPriorities";
import { CHECK_TEXT, type CheckLang } from "./checkText";

/**
 * Memoria del mentor: cada chequeo se guarda en el navegador del jugador y el
 * siguiente se compara con él («fuego 52% → 70%», «resuelto: huecos vacíos»).
 *
 * Solo se guardan datos (resistencias, huecos, prioridades), nunca frases, para
 * que la comparación salga en el idioma que se esté usando. No sale del
 * navegador: ni cuentas ni servidor.
 */

export interface CheckSnapshot {
  version: 1;
  checkedAt: string;
  /** Clase y ascendencia leídas de PoB2; null en el modo manual. */
  characterKey: string | null;
  level: number | null;
  input: BuildCheckInput;
  priorityIds: Array<BuildPriority["id"]>;
}

export type ChangeDirection = "better" | "worse" | "info";

export interface CheckComparison {
  trend: "better" | "worse" | "mixed" | "same";
  headline: string;
  changes: Array<{ text: string; direction: ChangeDirection }>;
}

const STORAGE_KEY = "exile-copilot.check.history";
const MAX_SNAPSHOTS = 20;
const RESISTANCE_KEYS = ["fire", "cold", "lightning", "chaos"] as const;

export function snapshotForCheck(
  input: BuildCheckInput,
  priorities: BuildPriority[],
  profile: CharacterProfile | null,
  checkedAt: Date,
): CheckSnapshot {
  const level = profile ? readCharacterLevel(profile) : null;
  return {
    version: 1,
    checkedAt: checkedAt.toISOString(),
    characterKey: profile
      ? `${profile.characterClass.trim()}|${profile.ascendancy?.trim() ?? ""}`.toLowerCase()
      : null,
    level: level?.known ? level.level : null,
    input,
    priorityIds: priorities.map((priority) => priority.id),
  };
}

/** Dos chequeos de PoB2 con distinta clase o ascendencia son personajes distintos. */
export function isSameCharacter(previous: CheckSnapshot, current: CheckSnapshot): boolean {
  return (
    previous.characterKey === null ||
    current.characterKey === null ||
    previous.characterKey === current.characterKey
  );
}

/** «hace 2 días» / «2 days ago», con la escala más grande que tenga sentido. */
export function timeSince(from: Date, now: Date, lang: CheckLang): string {
  const format = new Intl.RelativeTimeFormat(CHECK_TEXT[lang].locale, { numeric: "auto" });
  const seconds = Math.round((from.getTime() - now.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (Math.abs(seconds) < 60) return CHECK_TEXT[lang].history.justNow;
  if (Math.abs(minutes) < 60) return format.format(minutes, "minute");
  if (Math.abs(hours) < 24) return format.format(hours, "hour");
  return format.format(days, "day");
}

function formatResistance(value: number): string {
  return `${value < 0 ? "−" : ""}${Math.abs(value)}%`;
}

export function compareChecks(
  previous: CheckSnapshot,
  current: CheckSnapshot,
  now: Date,
  lang: CheckLang,
): CheckComparison {
  const text = CHECK_TEXT[lang];
  const changes: CheckComparison["changes"] = [];

  if (previous.level !== null && current.level !== null && previous.level !== current.level) {
    changes.push({ text: text.history.levelChange(previous.level, current.level), direction: "info" });
  }

  for (const key of RESISTANCE_KEYS) {
    const before = previous.input.resistances[key];
    const after = current.input.resistances[key];
    if (before === null || after === null || before === after) continue;
    changes.push({
      text: text.history.resistanceChange(
        text.resistanceLabels[key],
        formatResistance(before),
        formatResistance(after),
        after - before,
      ),
      direction: after > before ? "better" : "worse",
    });
  }

  if (previous.input.equippedSlots !== null && current.input.equippedSlots !== null) {
    const before = new Set(previous.input.equippedSlots);
    const after = new Set(current.input.equippedSlots);
    const names = (slots: ItemSlot[]) => slots.map((slot) => text.slots[slot]).join(", ");
    const filled = REQUIRED_SLOTS.filter((slot) => !before.has(slot) && after.has(slot));
    const emptied = REQUIRED_SLOTS.filter((slot) => before.has(slot) && !after.has(slot));
    if (filled.length > 0) changes.push({ text: text.history.slotsFilled(names(filled)), direction: "better" });
    if (emptied.length > 0) changes.push({ text: text.history.slotsEmptied(names(emptied)), direction: "worse" });
  }

  for (const id of previous.priorityIds) {
    if (!current.priorityIds.includes(id)) {
      changes.push({ text: text.history.resolved(text.history.priorityNames[id]), direction: "better" });
    }
  }

  const better = changes.some((change) => change.direction === "better");
  const worse = changes.some((change) => change.direction === "worse");
  const trend = better && worse ? "mixed" : better ? "better" : worse ? "worse" : "same";
  return {
    trend,
    headline: text.history.headline(trend, timeSince(new Date(previous.checkedAt), now, lang)),
    changes,
  };
}

function isSnapshot(value: unknown): value is CheckSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CheckSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.checkedAt === "string" &&
    typeof candidate.input === "object" &&
    candidate.input !== null &&
    typeof candidate.input.resistances === "object" &&
    Array.isArray(candidate.priorityIds)
  );
}

/** Chequeos guardados, del más reciente al más antiguo. Lo ilegible se ignora. */
export function loadCheckHistory(storage: Pick<Storage, "getItem"> | null): CheckSnapshot[] {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSnapshot) : [];
  } catch {
    return [];
  }
}

export function saveCheck(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  snapshot: CheckSnapshot,
): void {
  try {
    const history = [snapshot, ...loadCheckHistory(storage)].slice(0, MAX_SNAPSHOTS);
    storage?.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Sin almacenamiento (modo privado o lleno): el chequeo funciona igual, sin memoria.
  }
}

export function clearCheckHistory(storage: Pick<Storage, "removeItem"> | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // Nada que borrar si el almacenamiento no está disponible.
  }
}
