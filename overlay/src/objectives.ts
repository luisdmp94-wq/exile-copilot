/**
 * Cómo se nota en Client.txt que un objetivo de la zona está hecho.
 *
 * Dos señales, las dos sacadas del Client.txt real de un jugador en español
 * (23-11-2026, 0.5.5) y comprobadas visita a visita:
 *
 * 1. Recompensas para siempre: el juego escribe un mensaje al recibirlas
 *    («Exiliada ha recibido +10% a la resistencia al [Resistances|hielo].»).
 *    Sale igual de claro en inglés («You have received…»).
 * 2. Jefes: el registro no dice «jefe muerto», pero algunos jefes (o alguien
 *    a su lado) dicen una frase SOLO al caer. Aquí van únicamente las que
 *    salen una vez por victoria y nunca antes. Los jefes que no hablan (o
 *    que solo gritan durante el combate) no están: no se puede saber. Esos
 *    van en `SILENT_BOSSES` y se marcan a mano.
 *    Las frases son las del juego en español; en otro idioma no se marcan.
 *
 * La clave es el texto `zone` del paso en la guía, como en `zones.ts`.
 */

export type RewardKind = "puntos" | "hielo" | "fuego" | "rayo" | "espiritu" | "vida" | "mana" | "otra" | "ascendencia";

/**
 * Las clases sin ascender, en español e inglés. La ascendencia no deja mensaje,
 * pero la línea de subida de nivel dice la clase: si pasa de una de estas a
 * otra que no lo es («Bruja» → «Liche»), el personaje ha ascendido. Una clase
 * que no esté aquí (las que traiga la 1.0) no marca nada: mejor a mano que mal.
 */
export const BASE_CLASSES: ReadonlySet<string> = new Set([
  ...["Guerrero", "Mercenario", "Bruja", "Hechicera", "Exploradora", "Monje", "Cazadora", "Druida"],
  ...["Warrior", "Mercenary", "Witch", "Sorceress", "Ranger", "Monk", "Huntress", "Druid"],
]);

export interface RewardRule {
  /** Tipos de mensaje que dan por cogida la recompensa del paso. */
  kinds?: RewardKind[];
  /** Zonas fuera del paso donde se suele recibir (el libro que te dan en el pueblo). */
  where?: string[];
  /** La recompensa se elige entre varias: vale cualquier mensaje recibido en estas zonas. */
  anyIn?: string[];
  /** La recompensa llega en varias entregas, un mensaje por cada una: hasta la última no está cogida. */
  times?: number;
}

export const REWARD_RULES: Record<number, Record<string, RewardRule>> = {
  1: {
    Sierraclara: { kinds: ["hielo"] },
    "Terrenos de caza": { kinds: ["puntos"] },
    Villafrey: { kinds: ["espiritu"] },
    "Tierras de cultivo de Ogham": { kinds: ["puntos"], where: ["G1_town"] },
    "Mansión de Ogham": { kinds: ["vida"] },
  },
  2: {
    // Sin mensaje: se nota en que la clase del personaje cambia.
    "Prueba de las sekhemas": { kinds: ["ascendencia"] },
    Keth: { kinds: ["puntos"] },
    // El medallón deja elegir: un espacio para viales u otra mejora.
    "Valle de los titanes": { anyIn: ["G2_6"] },
    Deshar: { kinds: ["puntos"], where: ["G2_town"] },
    "Las torres de Deshar": { kinds: ["rayo"] },
  },
  3: {
    "Ruinas de la jungla": { kinds: ["puntos"] },
    // Servi, en el pueblo, deja elegir la mejora.
    "Las criptas venenosas": { anyIn: ["G3_town", "G3_3", "G3_4"] },
    "Taller de máquinas de Jiquani": { kinds: ["fuego"] },
    "El pantano de los azak": { kinds: ["espiritu"] },
    "Aggorat (pasado)": { kinds: ["puntos"] },
  },
  4: {
    "El final del viaje": { kinds: ["puntos"], where: ["G4_town"] },
    // La lección de Kaom o la de Rakiata, con Kaimana.
    "Isla Whakapanu": { anyIn: ["G4_town", "G4_3_1", "G4_11_1a"] },
    "El ojo de Hinekora": { kinds: ["mana"] },
    // Tres pruebas, un tatuaje a elegir en cada una (lo normal: las tres
    // resistencias). El juego avisa de cada tatuaje por separado.
    "Salones de los muertos": { kinds: ["hielo", "fuego", "rayo"], anyIn: ["G4_4_2"], times: 3 },
    "La prueba de los ancestros": { kinds: ["puntos"] },
  },
  // Los interludios (por dentro, actos 5, 6 y 7). Dónde cae cada mensaje está
  // comprobado en el Client.txt de Luis (25-11-2026), con varios personajes.
  5: {
    // El Registro del carcelero se usa en el propio fuerte (P1_5).
    "Fuerte de los lobos": { kinds: ["puntos"] },
  },
  6: {
    // «Vida máxima aumentada un 5%.», en el cruce (P2_1).
    "El cruce de Khari": { kinds: ["vida"] },
    // Los puntos los da Risu en el pueblo.
    "El cruce de Khari (Akthi y Anundr)": { kinds: ["puntos"], where: ["P2_Town"] },
    // El texto cambia según el pilar elegido: vale cualquier mensaje recibido en Qimah.
    Qimah: { anyIn: ["P2_6"] },
  },
  7: {
    "Aldea de Kriar": { kinds: ["espiritu"] },
    // Los puntos los da Hilda en el pueblo.
    "Cavernas aulladoras": { kinds: ["puntos"], where: ["P3_Town"] },
    // Los da El Encapuchado en Marca del rey, que es del acto 4: `onReward` mira
    // los pasos de otros actos que se entregan en la zona donde estás.
    "La cámara Cuachic": { kinds: ["puntos"], where: ["G4_town"] },
  },
};

/**
 * Objetos que se recogen en un paso y hacen falta más adelante. El registro no
 * dice cuándo se cogen: se marcan a mano, con su casilla.
 *
 * Los cuatro Trozos de mapa rasgado del acto 4 abren Punta del botín: si falta
 * uno, la isla no aparece. La clave es el texto `zone` del paso en la guía.
 */
export interface Pickup {
  /** Lo que se coge, en pocas palabras. */
  text: string;
  /** Los pasos con el mismo grupo se cuentan juntos («llevas 2 de 4»). */
  group: string;
}

export const PICKUPS: Record<number, Record<string, Pickup>> = {
  4: {
    "Bahía de las anclas y El final del viaje": { text: "Trozo de mapa (1 de 4)", group: "mapa" },
    "Isla del clan y Madrigueras volcánicas": { text: "Trozo de mapa (2 de 4)", group: "mapa" },
    "Isla Whakapanu y Cavernas melodiosas": { text: "Trozo de mapa (3 de 4)", group: "mapa" },
    "Isla de los alcaudones": { text: "Trozo de mapa (4 de 4)", group: "mapa" },
  },
};

/** Pasos que piden tener ya todos los objetos de un grupo (la isla que abren los cuatro trozos). */
export const NEEDS_PICKUPS: Record<number, Record<string, string>> = {
  4: { "Punta del botín": "mapa" },
};

/**
 * Cosas fijas de una zona que el texto de la guía no cuenta. Solo las enseña
 * la ventanita: la guía de la web no se toca. Una frase por línea, corta.
 *
 * Ngakanu atacada (G4_11_1b) trae siempre una fosa de Profundidades abisales:
 * lo vio Luis jugando (25-11-2026) y poe2db lo lleva como propiedad fija de la
 * zona («contains abyss depths with no boss», https://poe2db.tw/sp/Ngakanu).
 * La versión en paz (G4_11_1a) no la tiene.
 */
export const ZONE_NOTES: Record<number, Record<string, string[]>> = {
  4: {
    "Ngakanu y El corazón de la tribu": [
      "Opcional: en Ngakanu hay siempre una fosa de Profundidades abisales. No tiene jefe y el botín cambia.",
    ],
  },
};

/** Clasifica el texto de un «… ha recibido X» / «You have received X». */
export function rewardKindOf(message: string): RewardKind | null {
  // Fuera de la campaña (atlas, árbol del génesis) no hay pasos que marcar.
  if (/atlas|génesis|genesis/i.test(message)) return null;
  if (/pasiva de set de armas|Weapon Set Passive/.test(message)) return "puntos";
  // El juego escribe además la misma entrega como «puntos de habilidades pasivas»: no se cuenta dos veces.
  if (/puntos de habilidades pasivas|^\d+ Passive Skill Points/.test(message)) return null;
  if (/\[Resistances\|(?:hielo|Cold Resistance)\]/.test(message)) return "hielo";
  if (/\[Resistances\|(?:fuego|Fire Resistance)\]/.test(message)) return "fuego";
  if (/\[Resistances\|(?:rayo|Lightning Resistance)\]/.test(message)) return "rayo";
  if (/\[Spirit\|/.test(message)) return "espiritu";
  // «+20 a la vida máxima» (acto 1) y «Vida máxima aumentada un 5%» (interludio 2).
  if (/a la vida máxima|Vida máxima aumentada|to maximum Life|increased maximum Life/.test(message)) return "vida";
  if (/Maná máximo aumentado|increased maximum Mana/.test(message)) return "mana";
  return "otra";
}

export interface BossSign {
  /** Cómo se llama el jefe en la ventanita. */
  boss: string;
  /**
   * Cuando lo que se acaba no es un jefe (el tesoro de una isla de Expedición),
   * cómo se llama su línea: «Objetivo». Sin esto, «Jefe».
   */
  label?: string;
  /** Quién lo dice y qué dice, tal cual sale en el registro (sin marcas). */
  lines: Array<[who: string, text: string]>;
}

export const BOSS_SIGNS: Record<number, Record<string, BossSign>> = {
  1: {
    "La orilla del río": {
      boss: "el molinero hinchado",
      lines: [["Mortimer", "¡Bien hecho! Por favor, pasa."]],
    },
    "Cementerio de los eternos": {
      boss: "Lachlann del lamento eterno",
      lines: [["Lachlann del lamento eterno", "Juntos… al fin…"]],
    },
    Villafrey: {
      boss: "el rey de las nieblas",
      lines: [["El rey de las nieblas", "Nos volveremos a encontrar..."]],
    },
    "Mansión de Ogham": {
      boss: "el conde Geonor",
      lines: [
        ["Geonor, el Lobo pútrido", "Sí… encuéntrala. Mátala… Pero primero, por favor ponle fin a la locura."],
        ["El encapuchado", "Debemos apresurarnos. Regresemos a Sierraclara para prepararnos."],
      ],
    },
  },
  2: {
    "Cantera y mina Mawdun": {
      boss: "Rudja, Ingeniera del terror",
      // Risu solo pide que rompas el candado, y da las gracias, con Rudja ya muerta.
      lines: [
        ["Risu, Desertora faridun", "¡Rápido, rompe el candado!"],
        ["Risu, Desertora faridun", "¡Que el viento te bendiga!"],
      ],
    },
    "Las puertas de Halani": {
      boss: "Jamanra, el Rey ascendido",
      lines: [["Jamanra, el Rey ascendido", "Acabaremos con esto, pero no hoy."]],
    },
    "La ciudad perdida y Santuarios enterrados": {
      boss: "Azarian, el Hijo abandonado",
      lines: [["Azarian, el Hijo abandonado", "Ella no… me quería…"]],
    },
    "El Acorazado": {
      boss: "Jamanra, la Abominación",
      lines: [
        ["Jamanra, la Abominación", "No has logrado nada… Oriana prevalecerá… y los faridun gobernarán el Vastiri."],
        ["Sekhema Asala", "Se ha terminado."],
      ],
    },
  },
  3: {
    "Templo de Kopec": {
      boss: "Ketzuli, Sumo sacerdote del sol",
      // Alva entra en la sala y habla solo con Ketzuli ya vencido.
      lines: [["Alva", "La ingenuidad vaal nunca deja de sorprenderme…"]],
    },
    "Las cámaras negras (pasado)": {
      boss: "Doryani, Taumaturgo real",
      lines: [
        ["Doryani", "¿Cómo pudo haber pasado esto? Todo lo que he hecho. Todo lo que he sacrificado…"],
        ["Doryani", "Mmm… El legado de los vaal debe ser protegido... Conozco un modo de contener a la Bestia."],
      ],
    },
  },
  4: {
    "Bahía de las anclas y El final del viaje": {
      boss: "el capitán Hartlin",
      lines: [["Capitán Hartlin", "No... creas sus mentiras..."]],
    },
    "Isla Whakapanu y Cavernas melodiosas": {
      boss: "Diamora, Canción de muerte",
      lines: [["Diamora, la Canción de la muerte", "Podríamos haber sido... mucho más."]],
    },
    "Salones de los muertos": {
      boss: "Yama, el Blanco",
      lines: [
        ["Yama el Blanco", "¡Ahhh! Bien, bien. Yama puede verte. Eres digno."],
        ["Yama el Blanco", "¡Ahhh! Bien, bien. Yama puede verte. Eres digna."],
      ],
    },
    // No hay jefe: Dannig detona, salen criaturas y Farrow se lleva lo que
    // aparece. Esta frase es la última de la isla. En el registro de Luis
    // (25-11-2026): 15 entradas a la isla, la frase sale 2 veces, una por isla
    // terminada, y nunca en otra zona.
    "Punta del botín": {
      boss: "el tesoro enterrado (Farrow)",
      label: "Objetivo",
      lines: [["Farrow", "No tengo dudas de que podremos usar esto. Lo llevaré a Marca del rey."]],
    },
    "La excavación": {
      boss: "Benedictus, Primer heraldo de Utopía",
      // Tras vencerlo, Makoru y Tavakai ajustan cuentas con Kanu.
      lines: [
        ["Makoru", "La traición no tiene perdón."],
        ["Tavakai", "Que los ancestros lo juzguen."],
      ],
    },
    "Ngakanu y El corazón de la tribu": {
      boss: "Tavakai, el Jefe de guerra",
      lines: [
        ["El encapuchado", "Se ha terminado, Tavakai."],
        ["Tavakai", "Haz lo que debas hacer..."],
      ],
    },
  },
  // Interludio 1. En el registro de Luis (26-11-2026): 15 entradas a Las piedras
  // de Serle con cinco personajes. «La niebla permanece...» sale 8 veces, una por
  // victoria, y nunca en los intentos perdidos (ahí dice «La niebla te
  // envuelve...»). Siete segundos después habla Una, solo en esta zona. Un jefe
  // de mapas (Thariel) repite la frase de Siora: por eso se casa quién la dice.
  5: {
    "Las piedras de Serle": {
      boss: "Siora, la Cuchilla de las nieblas",
      lines: [
        ["Siora, la Cuchilla de las nieblas", "La niebla permanece..."],
        ["Una", "¡Los espíritus feéricos! ¿Qué están haciendo?"],
      ],
    },
  },
};

/**
 * Jefes que no dicen nada al caer: el registro no deja saber si han muerto.
 * Tienen casilla igual, pero se marca a mano (clic o tecla Fin). Sin eso, sus
 * zonas nunca decían «Zona hecha».
 *
 * Solo van los jefes de la zona que el paso nombra. No están los opcionales
 * (el Horror de espinas, la bestia ciega…) ni los que sueltan la recompensa
 * para siempre del paso (Beira, el cuervo repicador, Kabala, Quijada negra…):
 * de esos ya avisa la recompensa al recibirla.
 *
 * El nombre es el del texto del paso; la clave, su `zone`, como arriba.
 */
export const SILENT_BOSSES: Record<number, Record<string, string>> = {
  1: {
    Lodazal: "el devorador",
    "El valle rojo": "el rey del óxido",
    "Pueblo de Ogham": "el verdugo",
  },
  2: {
    "Alrededores del Vastiri": "Matajefes",
    "El pasaje de la traidora": "Balbala, la Traidora",
    "Páramo de los mastodontes y La llanura de huesos": "Ekbab, Montura ancestral",
    "La gruta del titán": "Zalmarath, el Coloso",
    "Las torres de Deshar": "Tor Gul, el Profanador",
  },
  3: {
    "Yermo infestado y Humedales de las quimerinas": "Xyclucian, la Quimera",
    "Santuario de Jiquani": "Zicoatl, Guardián del núcleo",
    "La cámara fundida": "Mektul, el Maestro de la forja",
    "Ápice de la inmundicia": "la reina de la inmundicia",
    "Utzaal (pasado)": "Napuatzi la Víbora",
  },
  4: {
    "Isla del clan y Madrigueras volcánicas": "Krutog, Señor del clan",
    "Prisión abandonada y Confinamiento solitario": "el prisionero",
    "Isla de los alcaudones": "el azote de los cielos",
    Arastas: "Torvian, la Mano del Salvador",
  },
  // Interludios: ocho zonas con jefe de la historia que van a mano. Siora (Las
  // piedras de Serle) se marca sola: está en `BOSS_SIGNS`. Oswin (Fuerte de los
  // lobos) y Lythara (Aldea de Kriar) no están: sueltan la recompensa del paso.
  // Isolde y Heldra están buscadas (26-11-2026, 19 entradas a la zona en el
  // registro de Luis): no dicen nada al caer, y el juego tampoco escribe nada.
  // La última línea de cada victoria es un grito de combate cualquiera.
  // De las otras siete no se han buscado frases todavía.
  5: {
    "Tierras de cultivo calcinadas": "Isolde y Heldra",
    "Finca de Holten": "Wulfric y Elswyth",
  },
  6: {
    "Santuario de Sel Khari": "Elzarah, el Señor de las cobras",
    "Las puertas de Galai": "Vornas, la Llama caída",
    "Reservorio de Qimah": "Azmadi, el Príncipe faridun",
  },
  7: {
    "Lago glacial": "Rakkar, la Garra helada",
    "Desfiladero erosionado": "Crúor de la tormenta",
    "La cámara Cuachic": "Zelina y Zolin",
  },
};

/**
 * El jefe de un paso, si tiene casilla. `auto`: el registro lo marca solo al
 * oír su frase; si no, se marca a mano.
 */
export function bossOf(act: number, zone: string): { name: string; auto: boolean; label: string } | null {
  const sign = BOSS_SIGNS[act]?.[zone];
  if (sign) return { name: sign.boss, auto: true, label: sign.label ?? "Jefe" };
  const silent = SILENT_BOSSES[act]?.[zone];
  return silent ? { name: silent, auto: false, label: "Jefe" } : null;
}

/**
 * Quita las marcas del juego de una frase del registro:
 * «<<set:F>>…», «<if:MS>{él}<elif:FS>{ella}» (se queda con la primera) y «<i>{cursiva}».
 */
export function cleanSpeech(text: string): string {
  return text
    .replace(/<<[^>]*>>/g, "")
    .replace(/<if:[^>]*>\{([^}]*)\}(?:<el(?:if:[^>]*|se)>\{[^}]*\})*/g, "$1")
    .replace(/<[^>]*>\{([^}]*)\}/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Los puntos suspensivos salen de las dos formas en el registro. */
const fold = (text: string) => text.replace(/…/g, "...").toLowerCase();

const SIGN_INDEX = new Map<string, { act: number; zone: string }>();
for (const [act, table] of Object.entries(BOSS_SIGNS)) {
  for (const [zone, sign] of Object.entries(table)) {
    for (const [who, text] of sign.lines) SIGN_INDEX.set(`${fold(who)}|${fold(text)}`, { act: Number(act), zone });
  }
}

/** ¿Esta frase es de las que solo se dicen con un jefe ya vencido? Dice de qué paso. */
export function bossSignOf(who: string, text: string): { act: number; zone: string } | null {
  return SIGN_INDEX.get(`${fold(who.trim())}|${fold(cleanSpeech(text))}`) ?? null;
}
