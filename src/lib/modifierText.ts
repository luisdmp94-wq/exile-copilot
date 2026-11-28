/** El texto avanzado escribe la tirada con su rango: `81(65-84)%`. Aquí se enseña solo lo que tiene. */
const ROLL_RANGE = /\((-?\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)\)/g;

export const withoutRollRange = (text: string): string => text.replace(ROLL_RANGE, "");
