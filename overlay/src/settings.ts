import type { RouteMode } from "./progress";

/** Cómo quiere ver el jugador la ventanita. Se cambia desde el icono de la bandeja. */
export interface Settings {
  route: RouteMode;
  size: "pequena" | "normal" | "grande";
  /** Compacta: solo el paso actual, sin «Luego» ni recompensa. */
  compact: boolean;
  opacity: "clara" | "normal" | "opaca";
  /** Solo se ve con PoE2 delante; al cambiar de ventana se esconde. */
  onlyWithGame: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  route: "completa",
  size: "normal",
  compact: false,
  opacity: "normal",
  onlyWithGame: true,
};

export const SIZE_SCALE: Record<Settings["size"], number> = { pequena: 0.9, normal: 1, grande: 1.15 };

export function sanitizeSettings(value: unknown): Settings {
  const raw = (value ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const pick = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(candidate as T) ? (candidate as T) : fallback;
  return {
    route: pick(raw.route, ["completa", "rapida"] as const, DEFAULT_SETTINGS.route),
    size: pick(raw.size, ["pequena", "normal", "grande"] as const, DEFAULT_SETTINGS.size),
    compact: raw.compact === true,
    opacity: pick(raw.opacity, ["clara", "normal", "opaca"] as const, DEFAULT_SETTINGS.opacity),
    onlyWithGame: raw.onlyWithGame !== false,
  };
}
