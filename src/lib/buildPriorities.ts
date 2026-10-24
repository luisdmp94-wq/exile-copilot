import type { CharacterProfile, ItemSlot } from "@shared/domain.js";

/**
 * Prioridades del chequeo de build: qué arreglar primero, en lenguaje claro.
 *
 * Solo se incluyen comprobaciones que se pueden justificar con el dato leído
 * y aritmética, sin umbrales inventados:
 *  - resistencias elementales por debajo del máximo por defecto (75%);
 *  - resistencia al caos negativa;
 *  - huecos de equipo vacíos.
 * El daño recibido de un tipo es proporcional a (100 − resistencia), así que
 * comparar ese factor con el del objetivo da el «cuánto más daño recibes».
 */

export type PrioritySeverity = "alta" | "media" | "baja";

export interface BuildPriority {
  id: "resistencias-elementales" | "huecos-equipo" | "resistencia-caos";
  severity: PrioritySeverity;
  title: string;
  /** Una línea por dato leído, p. ej. «Fuego 52% · te faltan 23 puntos». */
  facts: string[];
  why: string;
}

/** Máximo por defecto de las resistencias elementales en PoE2. */
export const ELEMENTAL_RESISTANCE_TARGET = 75;
/** Mínimo razonable para el caos: por debajo de 0 se recibe daño extra. */
export const CHAOS_RESISTANCE_TARGET = 0;

const ELEMENTS = [
  { key: "fire", label: "Fuego", damage: "fuego" },
  { key: "cold", label: "Frío", damage: "frío" },
  { key: "lightning", label: "Rayo", damage: "rayo" },
] as const;

/** Huecos que toda build lleva ocupados; la mano secundaria depende del arma. */
const REQUIRED_SLOTS: Array<{ slot: ItemSlot; label: string }> = [
  { slot: "weapon", label: "Arma" },
  { slot: "helmet", label: "Casco" },
  { slot: "body", label: "Pecho" },
  { slot: "gloves", label: "Guantes" },
  { slot: "boots", label: "Botas" },
  { slot: "belt", label: "Cinturón" },
  { slot: "amulet", label: "Amuleto" },
  { slot: "ring1", label: "Anillo 1" },
  { slot: "ring2", label: "Anillo 2" },
];

const SEVERITY_ORDER: Record<PrioritySeverity, number> = { alta: 0, media: 1, baja: 2 };

/** «un 92% más» o «6 veces más» de daño recibido frente al objetivo. */
export function extraDamageTaken(resistance: number, target: number): string {
  const ratio = (100 - resistance) / (100 - target);
  if (ratio >= 2) {
    const times = Math.round(ratio * 10) / 10;
    return `${times.toLocaleString("es-ES")} veces más`;
  }
  return `un ${Math.round((ratio - 1) * 100)}% más`;
}

function formatResistance(value: number): string {
  return `${value < 0 ? "−" : ""}${Math.abs(value)}%`;
}

function elementalPriority(profile: CharacterProfile): BuildPriority | null {
  const low = ELEMENTS.flatMap((element) => {
    const value = profile.resistances[element.key];
    return value !== null && value < ELEMENTAL_RESISTANCE_TARGET ? [{ ...element, value }] : [];
  });
  if (low.length === 0) return null;

  const worst = low.reduce((a, b) => (b.value < a.value ? b : a));
  const worstGap = ELEMENTAL_RESISTANCE_TARGET - worst.value;
  return {
    id: "resistencias-elementales",
    severity: worstGap >= 20 ? "alta" : worstGap >= 8 ? "media" : "baja",
    title: "Sube tus resistencias elementales al 75%",
    facts: low.map(
      (element) =>
        `${element.label} ${formatResistance(element.value)} · te faltan ${ELEMENTAL_RESISTANCE_TARGET - element.value} puntos`,
    ),
    why: `Con ${worst.label.toLowerCase()} al ${formatResistance(worst.value)} recibes ${extraDamageTaken(worst.value, ELEMENTAL_RESISTANCE_TARGET)} daño de ${worst.damage} que con el 75%.`,
  };
}

function chaosPriority(profile: CharacterProfile): BuildPriority | null {
  const chaos = profile.resistances.chaos;
  if (chaos === null || chaos >= CHAOS_RESISTANCE_TARGET) return null;
  return {
    id: "resistencia-caos",
    severity: chaos <= -20 ? "media" : "baja",
    title: "Saca la resistencia al caos de negativo",
    facts: [`Caos ${formatResistance(chaos)} · te faltan ${-chaos} puntos para llegar a 0%`],
    why: `Con ${formatResistance(chaos)} recibes ${extraDamageTaken(chaos, CHAOS_RESISTANCE_TARGET)} daño de caos que con 0%.`,
  };
}

function emptySlotsPriority(profile: CharacterProfile): BuildPriority | null {
  // Un código sin ningún objeto es un árbol sin equipo, no nueve huecos vacíos.
  if (profile.items.length === 0) return null;
  const occupied = new Set(profile.items.map((item) => item.slot));
  const empty = REQUIRED_SLOTS.filter(({ slot }) => !occupied.has(slot));
  if (empty.length === 0) return null;

  const missingCore = empty.some(({ slot }) => slot === "weapon" || slot === "body");
  return {
    id: "huecos-equipo",
    severity: missingCore || empty.length >= 3 ? "alta" : "media",
    title: empty.length === 1 ? "Rellena el hueco de equipo vacío" : "Rellena los huecos de equipo vacíos",
    facts: [`Vacío: ${empty.map(({ label }) => label).join(", ")}`],
    why: "Cada hueco vacío es vida, resistencias o daño que no estás recibiendo. Hasta un objeto raro barato ayuda.",
  };
}

/** Hasta 3 prioridades, de la más grave a la menos. Lista vacía = nada urgente. */
export function findBuildPriorities(profile: CharacterProfile): BuildPriority[] {
  return [elementalPriority(profile), emptySlotsPriority(profile), chaosPriority(profile)]
    .filter((priority): priority is BuildPriority => priority !== null)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 3);
}
