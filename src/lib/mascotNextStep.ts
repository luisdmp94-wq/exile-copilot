/**
 * El «siguiente paso» que la mascota propone al abrir su bocadillo. Sale de
 * reglas fijas sobre lo que la web ya sabe del personaje, sin IA: un solo
 * consejo cada vez, con un botón que lleva.
 */
export type MascotNextStepKind = "create" | "review" | "gear" | "plan";

export interface MascotNextStepInput {
  hasProfile: boolean;
  /** Piezas de equipo guardadas en el personaje. */
  itemCount: number;
  /** La revisión rápida ya tiene el acto y alguna resistencia. */
  reviewKnowsBasics: boolean;
}

export function mascotNextStep(input: MascotNextStepInput): MascotNextStepKind {
  if (!input.hasProfile) return "create";
  // Con equipo, la web ya puede decir qué mejorar: eso manda.
  if (input.itemCount > 0) return "plan";
  // Sin equipo: primero lo que se contesta mirando el juego, luego una pieza.
  return input.reviewKnowsBasics ? "gear" : "review";
}

/**
 * ¿La revisión rápida guardada de ese personaje ya sabe lo básico? Hace falta
 * el acto y al menos una resistencia (escrita ahí o conocida del personaje).
 */
export function reviewKnowsBasics(
  form: Readonly<Record<string, string>>,
  profileResistances?: { fire: number | null; cold: number | null; lightning: number | null } | null,
): boolean {
  const filled = (key: string) => (form[key] ?? "").trim() !== "";
  const anyResistance =
    filled("fire") ||
    filled("cold") ||
    filled("lightning") ||
    [profileResistances?.fire, profileResistances?.cold, profileResistances?.lightning].some(
      (value) => value !== null && value !== undefined,
    );
  return filled("act") && anyResistance;
}
