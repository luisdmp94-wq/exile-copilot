import { z } from "zod";

/**
 * «Pega una captura»: el jugador pega una captura del juego (la hoja del
 * personaje, tecla C, o la ventana de habilidades) y la IA saca los números
 * para rellenar la revisión rápida. La IA solo LEE lo que se ve; las reglas
 * de la revisión siguen siendo las mismas.
 */

/** Imagen como data URL. Unos 3 MB de texto como mucho (el navegador la reduce antes). */
export const ScreenshotReadRequestSchema = z
  .object({
    image: z
      .string()
      .max(3_500_000)
      .regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
  })
  .strict();
export type ScreenshotReadRequest = z.infer<typeof ScreenshotReadRequestSchema>;

const stat = (min: number, max: number) => z.number().int().min(min).max(max).nullable().default(null);

export const ScreenshotSheetSchema = z.object({
  level: stat(1, 100),
  /** Clase o ascendencia tal como sale en la hoja («Liche»). */
  className: z.string().trim().max(40).nullable().default(null),
  life: stat(1, 100_000),
  energyShield: stat(0, 100_000),
  mana: stat(0, 100_000),
  spirit: stat(0, 10_000),
  str: stat(0, 2_000),
  dex: stat(0, 2_000),
  int: stat(0, 2_000),
  fire: stat(-200, 100),
  cold: stat(-200, 100),
  lightning: stat(-200, 100),
  chaos: stat(-200, 100),
});
export type ScreenshotSheet = z.infer<typeof ScreenshotSheetSchema>;

export const ScreenshotSkillSchema = z.object({
  name: z.string().trim().min(1).max(60),
  level: z.number().int().min(1).max(40).nullable().default(null),
});
export type ScreenshotSkill = z.infer<typeof ScreenshotSkillSchema>;

export const ScreenshotReadResponseSchema = z.object({
  /** Qué pantalla ha reconocido. */
  screen: z.enum(["character", "skills", "other"]),
  sheet: ScreenshotSheetSchema.nullable(),
  skills: z.array(ScreenshotSkillSchema).max(24),
});
export type ScreenshotReadResponse = z.infer<typeof ScreenshotReadResponseSchema>;

/** «DESCARGA DE CAOS» → «Descarga de caos»: como lo escribiría el jugador. */
export function tidySkillName(name: string): string {
  const trimmed = name.replace(/\s+/g, " ").trim();
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  const lower = trimmed.toLocaleLowerCase("es");
  return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
}
