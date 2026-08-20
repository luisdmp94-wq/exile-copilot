import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_BADGE_CLASSES,
  CONFIDENCE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_LABELS,
} from "../../src/lib/format.js";

/**
 * Semántica visual de los badges de nivel.
 *
 * Riesgo y confianza comparten los valores estructurados `low`/`medium`/`high`,
 * pero NO su lectura: en riesgo lo alto es malo y en confianza lo alto es bueno.
 * Cuando ambos compartían un único mapa, «Confianza Alta» se pintaba de rojo,
 * como si fuese una alarma. Estas regresiones fijan las dos escalas.
 */

const VERDE = "emerald";
const AMBAR = "amber";
const ROJO = "red";

function paleta(clases: string): string {
  for (const color of [VERDE, AMBAR, ROJO]) {
    if (clases.includes(color)) return color;
  }
  return "desconocida";
}

describe("badges de riesgo", () => {
  it("bajo verde, medio ámbar, alto rojo", () => {
    expect(paleta(RISK_BADGE_CLASSES.low)).toBe(VERDE);
    expect(paleta(RISK_BADGE_CLASSES.medium)).toBe(AMBAR);
    expect(paleta(RISK_BADGE_CLASSES.high)).toBe(ROJO);
  });

  it("riesgo alto sigue siendo rojo", () => {
    expect(RISK_BADGE_CLASSES.high).toContain("text-red-300");
    expect(RISK_LABELS.high).toBe("Alto");
  });
});

describe("badges de confianza", () => {
  it("alta verde, media ámbar, baja roja (escala invertida respecto al riesgo)", () => {
    expect(paleta(CONFIDENCE_BADGE_CLASSES.high)).toBe(VERDE);
    expect(paleta(CONFIDENCE_BADGE_CLASSES.medium)).toBe(AMBAR);
    expect(paleta(CONFIDENCE_BADGE_CLASSES.low)).toBe(ROJO);
  });

  it("confianza alta usa las clases positivas, NUNCA las del riesgo alto", () => {
    expect(CONFIDENCE_BADGE_CLASSES.high).toContain("text-emerald-300");
    expect(CONFIDENCE_BADGE_CLASSES.high).not.toContain("red");
    expect(CONFIDENCE_BADGE_CLASSES.high).not.toBe(RISK_BADGE_CLASSES.high);
    expect(CONFIDENCE_LABELS.high).toBe("Alta");
  });

  it("riesgo y confianza no comparten un único mapa", () => {
    // Si alguien volviese a unificarlos, los extremos coincidirían.
    expect(CONFIDENCE_BADGE_CLASSES.high).toBe(RISK_BADGE_CLASSES.low);
    expect(CONFIDENCE_BADGE_CLASSES.low).toBe(RISK_BADGE_CLASSES.high);
  });
});
