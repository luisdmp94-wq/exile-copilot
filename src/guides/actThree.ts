import type { ActGuide } from "./guide";

/**
 * Guía de supervivencia del acto 3 (BORRADOR, pendiente de revisión de Luis
 * jugando).
 *
 * Redactada el 17-11-2026 a partir de las fuentes de `sources`. Dudas que se
 * dicen tal cual en vez de esconderlas:
 *  - Ninguna fuente da una cifra de resistencia para el acto 4: se usa la
 *    misma referencia de la comunidad (30 %) que en los actos 1 y 2, y se
 *    añade lo que sí dice Maxroll (acercarse al 75 %).
 *  - Las tácticas de jefes salen de la guía de Maxroll del 0.2: se cuentan
 *    los ataques, no números. El 0.5.0 reordenó las zonas del acto; el orden
 *    de la ruta es el de Maxroll (actualizada para 0.5.5) y las conexiones de
 *    poe2db (El pantano de los azak sale de Los canales de Matlan).
 *  - poe2db no coincide consigo mismo en el nombre de la calavera de
 *    Ignagduk: no se nombra el objeto, solo los +30 de espíritu.
 *  - No hay nombre en español del autómata de Doryani: se describe sin nombre.
 * Nombres en español según poe2db.tw/sp. Revisar entera al salir la 1.0.
 */
export const ACT_THREE_GUIDE: ActGuide = {
  slug: "acto-3",
  act: 3,
  actLabel: "acto 3",
  title: "Acto 3: cómo salir vivo de la jungla vaal",
  description:
    "Guía en español del acto 3 de Path of Exile 2 para novatos: Doryani, resistencias para el acto 4 y recompensas permanentes que no debes saltarte.",
  summary: "Lo justo para llegar vivo al acto 4. Si no tienes tiempo, lee solo el recuadro de abajo.",
  status: "borrador",
  checkedPatch: "0.5.5",
  checkedOn: "17-11-2026",
  readMinutes: 4,
  check: {
    elemental: 30,
    nextAct: "acto 4",
    focus: {
      element: "lightning",
      minimum: 30,
      note: "Doryani, el jefe final, usa mucho el rayo (y también fuego): súbela antes de entrar.",
    },
  },
  essentials: [
    {
      text: "No te saltes a Quijada negra (+10 % de fuego para siempre) ni a Ignagduk (+30 de espíritu para siempre).",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      text: "Hay 4 puntos de pasiva de set de arma: Puñoplateado poderoso y el Corazón sacrificial de Aggorat.",
      sourceIds: ["poe2db-acto3", "poe2db-corazon"],
    },
    {
      text: "El jefe final, Doryani, Taumaturgo real, pega con rayo, fuego y algo de hielo. A media vida se sube a un autómata: no te quedes quieto.",
      sourceIds: ["poe2db-doryani", "maxroll-jefes"],
    },
    {
      text: "Al pasar al acto 4 la penalización sube a −30 %. Apunta a un 30 % o más en las tres antes de salir.",
      sourceIds: ["wiki-resistencias", "maxroll-subida"],
    },
  ],
  // Orden de Maxroll (actualizada para 0.5.5); zonas, jefes y recompensas
  // según poe2db (consultado el 17-11-2026).
  route: [
    {
      zone: "Ciénaga de arena y Campamento del zigurat",
      text: "Llegas al pueblo del acto. Dregaraíces es opcional: solo suelta una gema.",
      priority: "historia",
      skip: "Dregaraíces",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Ruinas de la jungla",
      text: "Puñoplateado poderoso, entre las ruinas de piedra: 2 puntos de pasiva de set de arma.",
      optional: true,
      priority: "clave",
      reward: "2 puntos de pasiva",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Las criptas venenosas",
      text: "Sale de las Ruinas de la jungla. Lleva el veneno a Servi y elige una mejora para siempre: no se puede cambiar.",
      optional: true,
      priority: "clave",
      reward: "mejora permanente",
      proof: { kind: "manual", question: "¿Elegiste la mejora de Servi en Las criptas venenosas?" },
      sourceIds: ["poe2db-criptas", "maxroll-subida"],
    },
    {
      zone: "Yermo infestado y Humedales de las quimerinas",
      text: "Xyclucian, la Quimera. Tras vencer a Xyclucian puedes hacer la Prueba de Caos.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Taller de máquinas de Jiquani",
      text: "Quijada negra, el Remanente, es opcional pero da +10 % de resistencia al fuego para siempre.",
      optional: true,
      priority: "clave",
      reward: "+10 % de fuego",
      proof: { kind: "resistance", element: "fire", amount: 10 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Santuario de Jiquani",
      text: "Zicoatl, Guardián del núcleo. Pega con rayo.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Los canales de Matlan",
      text: "De aquí sale El pantano de los azak. Coge el punto de ruta: tendrás que volver.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "El pantano de los azak",
      text: "Zona opcional. Ignagduk, la Bruja del pantano, da +30 de espíritu para siempre.",
      optional: true,
      priority: "clave",
      reward: "+30 de espíritu",
      proof: { kind: "spirit", amount: 30 },
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "Prueba de Caos",
      text: "En el templo de Caos. Da los puntos de ascendencia 3 y 4. Si se te atraganta, vuelve con más nivel.",
      optional: true,
      priority: "clave",
      reward: "2 puntos de ascendencia",
      proof: { kind: "manual", question: "¿Has hecho ya la Prueba de Caos (puntos de ascendencia 3 y 4)?" },
      sourceIds: ["maxroll-subida", "poe2db-acto3"],
    },
    {
      zone: "La ciudad sumergida",
      text: "Coge sus puntos de ruta: de aquí salen La cámara fundida y el Ápice de la inmundicia.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-subida"],
    },
    {
      zone: "La cámara fundida",
      text: "Mektul, el Maestro de la forja, suelta El martillo de Kamasa: llévaselo a Oswald al pueblo y abres la Mesa de reforja (tres objetos iguales por uno nuevo). También da una gema de habilidad sin tallar de nivel 10. Es una carrera contra el reloj: si te falta daño, vuelve después del acto.",
      optional: true,
      priority: "recomendable",
      skip: "Mektul, el Maestro de la forja",
      sourceIds: ["maxroll-subida", "maxroll-jefes"],
    },
    {
      zone: "Ápice de la inmundicia",
      text: "La reina de la inmundicia. Pega con caos y llena el suelo de setas que explotan.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Templo de Kopec",
      text: "Ketzuli, Sumo sacerdote del sol. Pega con fuego.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Utzaal (pasado)",
      text: "Viajas al pasado. Napuatzi la Víbora espera al final.",
      priority: "historia",
      sourceIds: ["poe2db-acto3", "maxroll-jefes"],
    },
    {
      zone: "Aggorat (pasado)",
      text: "Mata vaal hasta que caiga el Corazón sacrificial y úsalo en el altar: 2 puntos de pasiva de set de arma.",
      optional: true,
      priority: "clave",
      reward: "2 puntos de pasiva",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["poe2db-corazon", "maxroll-subida"],
    },
    {
      zone: "Las cámaras negras (pasado)",
      text: "Doryani, Taumaturgo real, el jefe final.",
      priority: "historia",
      sourceIds: ["poe2db-doryani", "maxroll-jefes"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Doryani y otros jefes duros",
      intro: "Doryani, Taumaturgo real, al final, en Las cámaras negras.",
      cards: [
        {
          title: "Doryani · a pie",
          text: "Rayos, lanzallamas y bolas de fuego. Muévete sin parar.",
        },
        {
          title: "Doryani · desde el 50 %",
          text: "Se sube a un autómata. Su puño te persigue: corre por la sala y rueda cuando frene.",
        },
        {
          title: "Autómata al 50 %",
          text: "Doryani vuela un rato con ataques nuevos. Láser de hielo: rueda a través del jefe cuando pase de azul a rojo.",
        },
      ],
      tips: [],
      more: [
        {
          text: "Descarga estática: ponte dentro del círculo y no te hace daño. Pinchos en el suelo: no los pises.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Puñoplateado poderoso (Ruinas de la jungla):",
          text: "rueda hacia ti y aturde una y otra vez. Esquiva rodando; con poca armadura es letal.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Ignagduk, la Bruja del pantano:",
          text: "bajo el 75 % de vida pasa a hechizos de fuego. En el pasillo de huesos, ponte detrás de ella o lejos de la salida.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          text: "Si tu fuego va muy bajo (menos de 30–40 %), Maxroll aconseja el ritual opcional del pantano: da fuego por un rato.",
          sourceIds: ["maxroll-subida"],
        },
        {
          lead: "Mektul, el Maestro de la forja:",
          text: "tienes menos de 4 minutos antes de que el oro fundido cubra la sala. Es opcional.",
          sourceIds: ["maxroll-jefes", "maxroll-subida"],
        },
        {
          lead: "Ketzuli, Sumo sacerdote del sol:",
          text: "su rayo de luz quema más cuanto más rato estés dentro. Corre hacia él y rueda para pasarle.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Napuatzi la Víbora:",
          text: "su mordisco no se puede bloquear: esquiva de lado. La sala se encoge y al final te atacan por los dos lados.",
          sourceIds: ["maxroll-jefes"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistencias",
      intro: "Qué pega con cada cosa:",
      cards: [
        { title: "Fuego", text: "Ignagduk, Quijada negra, Mektul, Ketzuli y Doryani." },
        { title: "Rayo", text: "Zicoatl, Xyclucian, Napuatzi y Doryani." },
        { title: "Caos", text: "La reina de la inmundicia y Napuatzi." },
      ],
      tips: [
        {
          lead: "Apunta a un 30 % en las tres antes del acto 4.",
          text: "Es una referencia de la comunidad. Maxroll aconseja acercarte al 75 % todo lo que puedas.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "En el acto 3 el juego te quita un 20 %; en el acto 4, un 30 %.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Hacia el nivel 35 los vendedores pueden tener anillos prismáticos, con resistencia a las tres.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "El tope sigue siendo un 75 %.",
          sourceIds: ["wiki-resistencias"],
        },
      ],
    },
    {
      id: "mejoras",
      title: "Recompensas y mejoras baratas",
      intro: "Todas son opcionales y fáciles de pasar por alto.",
      tips: [
        {
          lead: "Las criptas venenosas:",
          text: "la mejora de Servi no se puede cambiar luego. Elige con calma.",
          sourceIds: ["maxroll-subida", "poe2db-criptas"],
        },
        {
          lead: "Botas:",
          text: "pasa a unas con 20 % de velocidad cuanto antes. Mira en los vendedores del Campamento del zigurat.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "Las mejoras de las criptas: +25 % de umbral de aturdimiento, +30 % de umbral de estados alterados elementales o +25 % de regeneración de maná.",
          sourceIds: ["poe2db-criptas"],
        },
        {
          text: "Ignagduk también suelta una gema de espíritu sin tallar.",
          sourceIds: ["poe2db-acto3"],
        },
        {
          text: "Hacia el nivel 40, en La ciudad sumergida, empieza a buscar frascos mejores.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "La Prueba de Caos se puede hacer cuando quieras después de vencer a Xyclucian.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Trampas del acto",
      intro: "Lo que más pilla a los novatos.",
      tips: [
        {
          lead: "El Corazón sacrificial:",
          text: "no da nada hasta que lo usas en el altar de Aggorat. Puede caer también en Utzaal.",
          sourceIds: ["poe2db-corazon", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "El parche 0.5.0 cambió el orden de zonas del acto 3: una guía antigua puede darte otra ruta.",
          sourceIds: ["ggg-050"],
        },
        {
          text: "Mektul y La cámara fundida no hacen falta para la historia: si te cuesta, vuelve más tarde.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
  ],
  sources: [
    {
      id: "ggg-050",
      label: "Grinding Gear Games — notas del parche 0.5.0 (22-05-2026)",
      url: "https://www.pathofexile.com/forum/view-thread/3932540",
    },
    {
      id: "wiki-resistencias",
      label: "PoE2 Wiki — Resistance",
      url: "https://www.poe2wiki.net/wiki/Resistance",
    },
    {
      id: "maxroll-subida",
      label: "Maxroll — Comprehensive League Start Leveling Guide (actualizada para 0.5.5)",
      url: "https://maxroll.gg/poe2/getting-started/comprehensive-league-start-leveling-guide",
    },
    {
      id: "maxroll-jefes",
      label: "Maxroll — Act 3 Boss Guide (de la versión 0.2: tácticas, no números)",
      url: "https://maxroll.gg/poe2/getting-started/act-3-boss-guide",
    },
    {
      id: "poe2db-acto3",
      label: "PoE2DB en español — Acto 3 (zonas, jefes y recompensas)",
      url: "https://poe2db.tw/sp/Act_3",
    },
    {
      id: "poe2db-criptas",
      label: "PoE2DB en español — Las criptas venenosas",
      url: "https://poe2db.tw/sp/The_Venom_Crypts",
    },
    {
      id: "poe2db-corazon",
      label: "PoE2DB en español — Corazón sacrificial",
      url: "https://poe2db.tw/sp/Sacrificial_Heart",
    },
    {
      id: "poe2db-doryani",
      label: "PoE2DB en español — Doryani, Taumaturgo real",
      url: "https://poe2db.tw/sp/Doryani%2C_Royal_Thaumaturge",
    },
  ],
};
