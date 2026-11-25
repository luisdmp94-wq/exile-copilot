/**
 * Clases y ascendencias con el nombre del cliente en español.
 *
 * Un código de Path of Building 2 trae los nombres en inglés («Witch», «Lich»).
 * En la web en español se enseñan como en el juego en español («Bruja»,
 * «Liche»). Los nombres son los de poe2db/sp, los mismos que usa el Mentor
 * (`ASCENDANCY_FROM_SPANISH` en `pobBuild.ts`); una prueba vigila que las dos
 * tablas digan lo mismo.
 */

const CLASS_SPANISH: Record<string, string> = {
  witch: "Bruja",
  sorceress: "Hechicera",
  warrior: "Guerrero",
  monk: "Monje",
  mercenary: "Mercenario",
  ranger: "Exploradora",
  huntress: "Cazadora",
  druid: "Druida",
};

export const ASCENDANCY_SPANISH: Record<string, string> = {
  Infernalist: "Infernalista",
  "Blood Mage": "Maga de sangre",
  Lich: "Liche",
  "Abyssal Lich": "Liche abisal",
  Titan: "Titán",
  Warbringer: "Adalid de guerra",
  "Smith of Kitava": "Herrero de Kitava",
  Tactician: "Estratega",
  Witchhunter: "Cazador de brujas",
  "Gemling Legionnaire": "Legionario gemita",
  Stormweaver: "Tejetormentas",
  Chronomancer: "Cronomante",
  "Disciple of Varashta": "Discípula de Varashta",
  Amazon: "Amazona",
  "Spirit Walker": "Caminante espiritual",
  Ritualist: "Ritualista",
  Deadeye: "Tiradora",
  Pathfinder: "Rastreadora",
  "Martial Artist": "Artista marcial",
  Invoker: "Invocador",
  "Acolyte of Chayula": "Acólito de Chayula",
  Oracle: "Oráculo",
  Shaman: "Chamán",
};

const ASCENDANCY_BY_LOWER = new Map(Object.entries(ASCENDANCY_SPANISH).map(([english, spanish]) => [english.toLowerCase(), spanish]));

/** «Witch» → «Bruja». Lo que no se conoce (o ya está en español) se deja igual. */
export function classInSpanish(name: string): string {
  return CLASS_SPANISH[name.trim().toLowerCase()] ?? name;
}

/** «Lich» → «Liche». Lo que no se conoce (o ya está en español) se deja igual. */
export function ascendancyInSpanish(name: string): string {
  return ASCENDANCY_BY_LOWER.get(name.trim().toLowerCase()) ?? name;
}
