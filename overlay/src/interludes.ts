import type { GuideRouteStep, GuideSource } from "../../src/guides/guide";

/**
 * Ruta de los tres interludios (entre el acto 4 y el final del juego).
 * La ventanita los enseña como tres actos más (por dentro 5, 6 y 7; el
 * jugador ve «Interludio 1»): `progress.ts` los une a las guías de los actos,
 * y `objectives.ts` dice cómo se marcan sus recompensas y sus jefes.
 *
 * Vive solo aquí, en `overlay/`: la web no tiene guía de los interludios.
 *
 * Redactada el 25-11-2026 a partir de las fuentes de `INTERLUDE_SOURCES` y
 * del Client.txt de Luis (cinco personajes, 12-2025 a 09-2026). Dudas que se
 * dicen tal cual en vez de esconderlas:
 *  - La wiki (poe2wiki.net) no deja leer a programas: no se usó. Todo sale de
 *    poe2db y de Maxroll. Donde solo lo dice una de las dos, la ruta lleva
 *    solo esa fuente.
 *  - Las páginas de cada interludio en poe2db están en inglés; los nombres en
 *    español de zonas, jefes y objetos salen de poe2db.tw/sp (tabla «Acto 6»
 *    y la página de cada objeto). Tres nombres se toman del juego (el
 *    registro de Luis) porque poe2db dice otra cosa o nada: «Lythara, la
 *    lanza impredecible» (poe2db: «descarriada»), «Anciano Madox» y «Isolde,
 *    del velo blanco» / «Heldra, de la pira negra» (con coma).
 *  - Sin nombre en español comprobado: la zona lateral del cruce de Khari
 *    (Skullmaw Stairway), el interludio en sí («The Curse of Holten», «The
 *    Stolen Barya», «Doryani's Contingency») y el barquero de Holten. Se
 *    cuentan sin inventar el nombre.
 *  - Akthi y Anundr: poe2db no dice si la pelea es obligatoria. Su premio (2
 *    puntos de set de arma, vía Risu) es el de la misión «Despejar el
 *    camino», que poe2db marca como opcional: se cuenta como opcional.
 *  - Fuerte de los lobos: ninguna fuente dice si Oswin es obligatorio, pero en
 *    el registro de Luis dos personajes acabaron el interludio 1 sin entrar:
 *    va como opcional (y sigue «clave» por los 2 puntos).
 *  - El barquero: poe2db da «unos 2000 de oro» por runa; Maxroll dice que
 *    solo se compra una vez y que hacen falta 20 000. Se cuentan las dos.
 *  - Las dos baryas de Sel Khari: poe2db dice «2 premios de 3»; Maxroll, «una
 *    joya o joyería rara». Se cuenta sin número.
 *  - Niveles de zona: poe2db da 54-56 en los tres interludios; el registro de
 *    Luis da 54-56, 57-60 y 61-64. No se escriben: la ventanita los lee.
 *  - Daño de los jefes: solo poe2db («physical and cold themed boss»).
 *  - Los interludios son provisionales: poe2db dice que desaparecerán cuando
 *    lleguen los actos 5 y 6. Revisar entera al salir la 1.0.
 */

/** Una fuente de la ruta. El registro del juego no tiene dirección web. */
export type InterludeSource = Omit<GuideSource, "url"> & { url?: string };

export const INTERLUDE_SOURCES: InterludeSource[] = [
  {
    id: "poe2db-interludios",
    label: "PoE2DB en español — tabla de zonas y jefes de los interludios («Acto 6»)",
    url: "https://poe2db.tw/sp/Act_6",
  },
  {
    id: "poe2db-i1",
    label: "PoE2DB — Interlude 1: The Curse of Holten (zonas, jefes y recompensas)",
    url: "https://poe2db.tw/sp/Interlude_Curse_of_Holten",
  },
  {
    id: "poe2db-i2",
    label: "PoE2DB — Interlude 2: The Stolen Barya (zonas, jefes y recompensas)",
    url: "https://poe2db.tw/sp/Interlude_The_Stolen_Barya",
  },
  {
    id: "poe2db-i3",
    label: "PoE2DB — Interlude 3: Doryani's Contingency (zonas, jefes y recompensas)",
    url: "https://poe2db.tw/sp/Interlude_Doryanis_Contingency",
  },
  {
    id: "maxroll-subida",
    label: "Maxroll — Comprehensive League Start Leveling Guide (0.5.5, actualizada el 8-9-2026)",
    url: "https://maxroll.gg/poe2/getting-started/comprehensive-league-start-leveling-guide",
  },
  {
    id: "registro-luis",
    label: "Client.txt de Luis (12-2025 a 09-2026): mensajes «ha recibido…» y quién habla en cada zona",
  },
];

export interface InterludeRoute {
  /** 1, 2 o 3: el número de «P1_», «P2_», «P3_» en los códigos de zona. */
  interlude: 1 | 2 | 3;
  /** Nombre en inglés (el español no está comprobado). */
  englishName: string;
  /** El pueblo del interludio, en español, y su código. No es un paso. */
  town: string;
  townCode: string;
  route: GuideRouteStep[];
}

export const INTERLUDE_ROUTES: InterludeRoute[] = [
  {
    interlude: 1,
    englishName: "The Curse of Holten",
    town: "El refugio",
    townCode: "P1_Town",
    route: [
      {
        zone: "Tierras de cultivo calcinadas",
        text: "Dos jefas: Isolde, del velo blanco, pega con hielo y Heldra, de la pira negra, con fuego. Hay que vencer a las dos para seguir.",
        priority: "historia",
        sourceIds: ["poe2db-i1", "registro-luis"],
      },
      {
        zone: "Las piedras de Serle",
        text: "Activa los seis megalitos: entonces sale Siora, la Cuchilla de las nieblas. Pega con físico y rayo.",
        priority: "historia",
        sourceIds: ["poe2db-i1", "registro-luis"],
      },
      {
        zone: "El bosque negro",
        text: "Zona de paso: busca la entrada a Holten. Los altares de augurios (Augurios oscuros) dan un augurio al azar, de los que se usan al fabricar.",
        priority: "historia",
        sourceIds: ["poe2db-i1"],
      },
      {
        zone: "Holten",
        text: "Sigue el río del centro hasta el barquero: vende Runas mayores para tu equipo (unas 2000 de oro cada una; solo se le puede comprar una vez, lleva 20 000 de oro). Sigbert y Godwin son opcionales: no dan nada para siempre. En el pueblo están las entradas a Fuerte de los lobos y a Finca de Holten.",
        priority: "recomendable",
        skip: "Sigbert, del Juramento manchado, y Godwin, del Credo destrozado",
        sourceIds: ["poe2db-i1", "maxroll-subida"],
      },
      {
        zone: "Fuerte de los lobos",
        text: "Oswin, el Guardián de temor, pega con físico y hielo. Suelta el Registro del carcelero: úsalo y te da 2 puntos de pasiva de set de arma.",
        optional: true,
        priority: "clave",
        reward: "2 puntos de pasiva",
        proof: { kind: "weaponSetPoints", amount: 2 },
        sourceIds: ["poe2db-i1", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Finca de Holten",
        text: "El final del interludio: Thane Wulfric pega con físico y fuego, y Lady Elswyth con físico y caos. Después vuelve al pueblo y habla con El Encapuchado para pasar al siguiente interludio.",
        priority: "historia",
        sourceIds: ["poe2db-i1", "registro-luis"],
      },
    ],
  },
  {
    interlude: 2,
    englishName: "The Stolen Barya",
    town: "El bazar de Khari",
    townCode: "P2_Town",
    route: [
      {
        zone: "El cruce de Khari",
        text: "Zona muy grande, con varias salidas. Empieza por el norte: entra en la zona lateral (Skullmaw Stairway en inglés), límpiala y usa El regalo del Fundido en el Santuario fundido: +5 % de vida máxima para siempre.",
        priority: "clave",
        reward: "+5 % de vida",
        // `proof` es lo que se ve en la hoja del personaje, y un +5 % de vida no se ve ahí:
        // sigue «manual». En la ventanita se marca sola: el juego escribe «Vida máxima
        // aumentada un 5%.» en P2_1 (`REWARD_RULES` en objectives.ts).
        proof: { kind: "manual", question: "¿Usaste El regalo del Fundido en el Santuario fundido?" },
        sourceIds: ["poe2db-i2", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "El cruce de Khari (Akthi y Anundr)",
        text: "Misión opcional «Despejar el camino». Al este, tras un punto de control, hay una arena pequeña con Akthi, el Último aguijón, y Anundr, el Gusano de arena. Al vencerlos, habla con Risu en el pueblo: 2 puntos de pasiva de set de arma.",
        optional: true,
        priority: "clave",
        reward: "2 puntos de pasiva",
        proof: { kind: "weaponSetPoints", amount: 2 },
        sourceIds: ["poe2db-i2", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Estanques de Khatal",
        text: "Zona de paso, sin jefe. Coge su punto de ruta.",
        priority: "historia",
        sourceIds: ["poe2db-i2"],
      },
      {
        zone: "Santuario de Sel Khari",
        text: "Elzarah, el Señor de las cobras, pega con físico, fuego y caos. Opcional: busca la Barya de Yoon y la Barya de Rangeen y ponlas en los dos altares enfrentados. Liberas a los djinns y eliges premio: anillo, amuleto o joya raros.",
        priority: "recomendable",
        sourceIds: ["poe2db-i2", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Las puertas de Galai",
        text: "Vornas, la Llama caída, pega con físico y rayo. Coge el punto de ruta.",
        priority: "historia",
        sourceIds: ["poe2db-i2"],
      },
      {
        zone: "Qimah",
        text: "Busca en la muralla exterior un pasadizo estrecho: lleva a los Pilares de Orbala. Activa uno: es una mejora para siempre y se puede cambiar volviendo aquí. Para empezar, el Pilar de Tabana (+5 % a todas las resistencias elementales) es una apuesta segura. El Pilar de Alima es un castigo: lo baja todo a cambio de un 5 % más de experiencia.",
        priority: "clave",
        reward: "mejora a elegir",
        proof: { kind: "manual", question: "¿Activaste un Pilar de Orbala en Qimah?" },
        sourceIds: ["poe2db-i2", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Reservorio de Qimah",
        text: "El final del interludio: Azmadi, el Príncipe faridun, pega con físico. Opcional: llena un Pozo sagrado con un Vial de Agua sagrada y da un Orbe exaltado y un Orbe de alquimia seguros. Al acabar, toca la barya grande, habla con Jado y con la sekhema Asala, y luego con El Encapuchado para pasar al último interludio.",
        priority: "historia",
        sourceIds: ["poe2db-i2"],
      },
    ],
  },
  {
    interlude: 3,
    englishName: "Doryani's Contingency",
    town: "El claro",
    townCode: "P3_Town",
    route: [
      {
        zone: "Bosque ceniciento",
        gems: ["Habilidad nv. 14: en el Monumento antiguo (opcional)"],
        text: "Zona de paso hacia la Aldea de Kriar. Busca el Monumento antiguo: da una Gema de habilidad sin tallar de nivel 14.",
        priority: "historia",
        sourceIds: ["poe2db-i3"],
      },
      {
        zone: "Aldea de Kriar",
        gems: ["Espíritu nv. 14: al usar el cráneo de Lythara"],
        text: "Lythara, la lanza impredecible, es de la historia: no te la puedes saltar. Pega con todo: físico, fuego, hielo, rayo y caos. Suelta el Cráneo con costra de gemas: úsalo y te da +40 de espíritu para siempre.",
        priority: "clave",
        reward: "+40 de espíritu",
        proof: { kind: "spirit", amount: 40 },
        sourceIds: ["poe2db-i3", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Lago glacial",
        text: "Rakkar, la Garra helada, pega con físico y hielo. De aquí sale la zona lateral Cavernas aulladoras: no te la saltes.",
        priority: "historia",
        sourceIds: ["poe2db-i3", "maxroll-subida"],
      },
      {
        zone: "Cavernas aulladoras",
        text: "Zona lateral del Lago glacial, opcional. Mata a El abominable yeti, coge los Colmillos helados y llévaselos a Hilda al pueblo: 2 puntos de pasiva de set de arma.",
        optional: true,
        priority: "clave",
        reward: "2 puntos de pasiva",
        proof: { kind: "weaponSetPoints", amount: 2 },
        sourceIds: ["poe2db-i3", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Las cumbres de Kriar",
        text: "El Anciano Madox medita en lo alto de un risco: los espíritus de la zona te guían hasta él. Te deja elegir un objeto único de su ventana, y solo uno.",
        priority: "recomendable",
        sourceIds: ["poe2db-i3", "maxroll-subida", "registro-luis"],
      },
      {
        zone: "Desfiladero erosionado",
        text: "Crúor de la tormenta, el Guardián, pega con físico y rayo.",
        priority: "historia",
        sourceIds: ["poe2db-i3", "registro-luis"],
      },
      {
        zone: "La cámara Cuachic",
        text: "El final: Zelina, Sacerdotisa de sangre, y Zolin, Sacerdote de sangre, pegan con físico y hielo. Después invoca a Doryani y habla con él. Vuelve a Marca del rey y habla con El Encapuchado: 2 puntos de pasiva de set de arma. Con eso se acaban los interludios.",
        priority: "clave",
        reward: "2 puntos de pasiva",
        proof: { kind: "weaponSetPoints", amount: 2 },
        sourceIds: ["poe2db-i3", "registro-luis"],
      },
    ],
  },
];

/**
 * Códigos de zona de cada paso, del Client.txt de Luis («Generating level 56
 * area "P1_5"»). Los 19 están comprobados uno a uno: tras cada cambio de zona
 * el juego escribe su nombre («[SCENE] Set Source [Fuerte de los lobos]»), y
 * coincide con el nombre en español de poe2db. Además casan quién habla
 * dentro (Oswin en P1_5, Lythara en P3_2…) y la recompensa que cae (vida en
 * P2_1, los pilares en P2_6, el espíritu en P3_2).
 * No existe P2_4 en el registro. La zona lateral del cruce de Khari no tiene
 * código propio: el regalo del Fundido se recibe en P2_1.
 * Los 2 puntos de Risu y de Hilda se reciben en el pueblo (P2_Town, P3_Town);
 * los del final, en Marca del rey (G4_town). Cada vez el juego escribe dos
 * líneas: «2 puntos de habilidades pasivas» y «2 puntos de habilidad pasiva
 * de set de armas».
 */
export const INTERLUDE_ZONE_CODES: Record<InterludeRoute["interlude"], Record<string, string[]>> = {
  1: {
    "Tierras de cultivo calcinadas": ["P1_1"],
    "Las piedras de Serle": ["P1_2"],
    "El bosque negro": ["P1_3"],
    Holten: ["P1_4"],
    "Fuerte de los lobos": ["P1_5"],
    "Finca de Holten": ["P1_6"],
  },
  2: {
    "El cruce de Khari": ["P2_1"],
    "El cruce de Khari (Akthi y Anundr)": ["P2_1"],
    "Estanques de Khatal": ["P2_2"],
    "Santuario de Sel Khari": ["P2_3"],
    "Las puertas de Galai": ["P2_5"],
    Qimah: ["P2_6"],
    "Reservorio de Qimah": ["P2_7"],
  },
  3: {
    "Bosque ceniciento": ["P3_1"],
    "Aldea de Kriar": ["P3_2"],
    "Lago glacial": ["P3_3"],
    "Cavernas aulladoras": ["P3_4"],
    "Las cumbres de Kriar": ["P3_5"],
    "Desfiladero erosionado": ["P3_6"],
    "La cámara Cuachic": ["P3_7"],
  },
};
