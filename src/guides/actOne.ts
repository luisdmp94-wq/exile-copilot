import type { ActGuide } from "./guide";

/**
 * Guía de supervivencia del acto 1 (BORRADOR, pendiente de revisión de Luis).
 *
 * Redactada el 24-10-2026 a partir de las fuentes de `sources`. Lo que las
 * fuentes no confirman no se afirma: no hay datos oficiales de qué jefe mata
 * más, así que se dice «el que más se nombra». Nombres en español según
 * poe2db.tw/sp. Revisar entera al salir la 1.0 (11-12-2026).
 */
export const ACT_ONE_GUIDE: ActGuide = {
  slug: "acto-1",
  actLabel: "acto 1",
  title: "Acto 1: cómo no morir antes del acto 2",
  summary: "Lo justo para llegar vivo al acto 2. Si no tienes tiempo, lee solo el recuadro de abajo.",
  status: "borrador",
  checkedPatch: "0.5.5",
  checkedOn: "24-10-2026",
  readMinutes: 2,
  check: {
    elemental: 30,
    nextAct: "acto 2",
    focus: {
      element: "cold",
      minimum: 30,
      note: "El conde Geonor pega con frío: es la que más importa antes de entrar.",
    },
  },
  essentials: [
    {
      text: "El jefe final, el conde Geonor, es el muro más nombrado: entra con al menos un 30 % de resistencia al frío.",
      sourceIds: ["maxroll-subida"],
    },
    {
      text: "Al pasar al acto 2 pierdes un 10 % de resistencia a fuego, frío y rayo.",
      sourceIds: ["wiki-resistencias"],
    },
    {
      text: "Mejora el equipo en este orden: velocidad de movimiento, resistencias, vida y daño.",
      sourceIds: ["maxroll-subida"],
    },
    {
      text: "No te saltes las recompensas para siempre: puntos de pasiva, vida y espíritu.",
      sourceIds: ["maxroll-subida"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "El conde Geonor",
      intro: "Jefe final del acto, en la mansión de Ogham. Pega con daño físico y de frío.",
      cards: [
        { title: "Fase 1", text: "No te quedes a su espalda. Sal rodando de los muros de hielo." },
        { title: "Desde el 75 %", text: "Se vuelve lobo. No pises el círculo de runas: congela." },
        { title: "Desde el 50 %", text: "Se cura entero. Muévete sin parar y, en la niebla, solo esquiva." },
      ],
      tips: [
        {
          lead: "Antes de entrar:",
          text: "30–40 % de resistencia al frío.",
          sourceIds: ["wiki-geonor", "maxroll-subida"],
        },
      ],
      more: [
        {
          lead: "Fase 1, golpe a golpe:",
          text: "su estocada helada (destello rojo) congela mucho. Si su embestida falla, sigue un tajo enorme a su espalda. Con los dos muros de hielo en V golpea por el medio.",
          sourceIds: ["wiki-geonor"],
        },
        {
          lead: "Fase de lobo:",
          text: "clava la espada rodeada de runas de escarcha e invoca hombres lobo: mátalos o aléjate. Al 50 % se cura entero; su golpe de sangre no se puede bloquear. Sal de las manchas de hielo antes de que salgan los pinchos. Desde el 25 % caen rayos de luna hasta el final. En la niebla no recibe daño y sale embistiendo seis veces.",
          sourceIds: ["wiki-geonor"],
        },
        {
          text: "El parche 0.5.3 le bajó el daño a sus rayos de luna y a sus tajos hacia atrás.",
          sourceIds: ["ggg-053"],
        },
        {
          lead: "El verdugo (pueblo de Ogham):",
          text: "una ráfaga de viento marca dónde caerá su guillotina; apártate. Su grieta avanza en línea recta: muévete de lado. Mata a los esbirros para que no te rodeen.",
          sourceIds: ["wiki-verdugo"],
        },
        {
          lead: "El rey de las nieblas (Villafrey, opcional):",
          text: "un efecto te aturde si te quedas quieto y el otro si te mueves: mira cuál llevas. Mata rápido sus tótems. Da +30 de espíritu para siempre.",
          sourceIds: ["wiki-rey-nieblas", "maxroll-subida"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistencias",
      intro: "En el acto 1 no pierdes nada. Desde el acto 2, cada acto te quita más:",
      cards: [
        { title: "Acto 2", text: "−10 %" },
        { title: "Acto 3", text: "−20 %" },
        { title: "Acto 4", text: "−30 %" },
        { title: "Interludios", text: "−40 % a −50 %" },
        { title: "Mapas", text: "−60 %" },
      ],
      tips: [
        {
          lead: "Apunta a un 30 % en las tres.",
          text: "Es la referencia de las guías de la comunidad, no una cifra oficial.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "El tope normal es un 75 %: por encima no sirve, salvo que algo te suba el máximo.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Beira, de la manada putrefacta (Sierraclara), suelta un trofeo que da +10 % de resistencia al frío para siempre.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Maxroll aconseja tener un anillo de zafiro (frío) hacia el nivel 15, antes de Geonor.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
    {
      id: "mejoras",
      title: "Mejoras baratas",
      intro: "Velocidad de movimiento → resistencias → vida → daño.",
      tips: [
        {
          text: "Mira al vendedor cada vez que vuelvas al campamento.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Usa orbes de transmutación en botas sin miedo: buscas velocidad.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Recoge siempre: el cuervo repicador y el laúd de Una (2 puntos de pasiva cada uno), Cirio (+20 de vida) y el rey de las nieblas (+30 de espíritu).",
          sourceIds: ["maxroll-subida", "wiki-cuervo"],
        },
      ],
      more: [
        {
          text: "En el acto 1 los vendedores llegan hasta nivel de objeto 15.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Un orbe de aumento añade un modificador a un objeto mágico que solo tiene uno. Guarda los orbes regios para tus mejores piezas.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Un arma blanca con buen daño base vale la pena: transmútala y auméntala.",
          sourceIds: ["wiki-consejos"],
        },
        {
          text: "Frascos: el caldero de la cabaña de la bruja, en el bosque singular, da frascos medianos gratis. Una vende frascos mayores por 80–500 de oro.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Engarza runas de resistencia en tu equipo para tapar la que te falte.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
  ],
  sources: [
    {
      id: "ggg-053",
      label: "Grinding Gear Games — notas del parche 0.5.3",
      url: "https://www.pathofexile.com/forum/view-thread/3968601",
    },
    {
      id: "wiki-geonor",
      label: "PoE2 Wiki — Count Geonor",
      url: "https://www.poe2wiki.net/wiki/Count_Geonor",
    },
    {
      id: "wiki-verdugo",
      label: "PoE2 Wiki — The Executioner",
      url: "https://www.poe2wiki.net/wiki/The_Executioner",
    },
    {
      id: "wiki-rey-nieblas",
      label: "PoE2 Wiki — The King in the Mists (Freythorn)",
      url: "https://www.poe2wiki.net/wiki/The_King_in_the_Mists_(Freythorn)",
    },
    {
      id: "wiki-resistencias",
      label: "PoE2 Wiki — Resistance",
      url: "https://www.poe2wiki.net/wiki/Resistance",
    },
    {
      id: "wiki-cuervo",
      label: "PoE2 Wiki — The Crowbell",
      url: "https://www.poe2wiki.net/wiki/The_Crowbell",
    },
    {
      id: "wiki-consejos",
      label: "PoE2 Wiki — Guide: PoE2 tips",
      url: "https://poe2wiki.net/wiki/Guide:PoE2_tips",
    },
    {
      id: "maxroll-subida",
      label: "Maxroll — Comprehensive League Start Leveling Guide (actualizada para 0.5.5)",
      url: "https://maxroll.gg/poe2/getting-started/comprehensive-league-start-leveling-guide",
    },
    {
      id: "poe2db-acto1",
      label: "PoE2DB en español — Acto 1 (nombres de jefes y zonas)",
      url: "https://poe2db.tw/sp/Act_1",
    },
  ],
};
