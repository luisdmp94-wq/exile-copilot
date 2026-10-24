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
  summary:
    "Los jefes que más atascan, qué pasa con tus resistencias al cambiar de acto y las mejoras que casi no cuestan nada.",
  status: "borrador",
  checkedPatch: "0.5.5",
  checkedOn: "24-10-2026",
  readMinutes: 5,
  check: {
    elemental: 30,
    nextAct: "acto 2",
    focus: {
      element: "cold",
      minimum: 30,
      note: "El conde Geonor pega con frío: es la que más importa antes de entrar.",
    },
  },
  blocks: [
    {
      id: "jefes",
      title: "Los jefes que más atascan",
      intro:
        "No hay datos oficiales de qué jefe mata más. En los foros, el que más se nombra es el conde Geonor, el jefe final del acto, en la mansión de Ogham. Detrás vienen el verdugo y el rey de las nieblas.",
      cards: [
        {
          title: "Geonor · fase 1, con espada",
          text: "Su estocada helada (destello rojo) congela mucho: apártate. Si su embestida falla, sigue un tajo enorme a su espalda: no te quedes detrás. Con dos muros de hielo en V golpea por el medio: sal rodando a un lado.",
        },
        {
          title: "Desde el 75 % · forma de lobo",
          text: "Clava la espada y la rodea de runas de escarcha: no pises ese círculo, te congela. Invoca hombres lobo: mátalos o aléjate de ellos.",
        },
        {
          title: "Al 50 % · lobo pútrido",
          text: "Se cura entero: es normal. Su golpe de sangre no se puede bloquear, esquívalo. Sal de las manchas de hielo antes de que salgan los pinchos. Desde el 25 % caen rayos de luna hasta el final: no dejes de moverte. En la niebla no recibe daño y sale embistiendo seis veces: esquiva, no ataques.",
        },
      ],
      tips: [
        {
          lead: "Antes de entrar a por Geonor:",
          text: "pega con daño físico y de frío. La guía de Maxroll dice que muchos jugadores sufren con menos de un 30–40 % de resistencia al frío.",
          sourceIds: ["wiki-geonor", "maxroll-subida"],
        },
        {
          text: "El parche 0.5.3 le bajó el daño a sus rayos de luna y a sus tajos hacia atrás: si leíste que era imposible, ahora es algo más amable.",
          sourceIds: ["ggg-053"],
        },
        {
          lead: "El verdugo (pueblo de Ogham, obligatorio):",
          text: "una ráfaga de viento marca dónde caerá su guillotina; apártate de esa marca. Su golpe cargado cubre mucho terreno y su grieta avanza en línea recta: muévete de lado. Mata a los esbirros para que no te rodeen.",
          sourceIds: ["wiki-verdugo"],
        },
        {
          lead: "El rey de las nieblas (Villafrey, opcional):",
          text: "uno de sus efectos te aturde si te quedas quieto y el otro si te mueves: fíjate en cuál llevas. Mata rápido sus tótems, tienen poca vida y cada onda te hace recibir más daño físico. Merece la pena: da +30 de espíritu para siempre.",
          sourceIds: ["wiki-rey-nieblas", "maxroll-subida"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistencias al llegar al acto 2",
      intro:
        "En el acto 1 el juego no te quita resistencia. Desde el acto 2 empieza la penalización a fuego, frío y rayo, y crece en cada acto: la cifra de tu hoja de personaje baja aunque no cambies nada.",
      cards: [
        { title: "Acto 1", text: "Sin penalización." },
        { title: "Acto 2", text: "−10 %" },
        { title: "Acto 3", text: "−20 %" },
        { title: "Acto 4", text: "−30 %" },
        { title: "Interludios", text: "−40 % a −50 %, según el nivel de la zona." },
        { title: "Mapas", text: "−60 %" },
      ],
      tips: [
        {
          lead: "El tope normal es un 75 %.",
          text: "Por encima no sirve de nada, salvo que algo te suba el máximo.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          lead: "Para el acto 2, apunta al menos a un 30 % en las tres.",
          text: "No es una cifra oficial: es la referencia que dan las guías de la comunidad, y la que usa la comprobación de abajo.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Beira, de la manada putrefacta (Sierraclara), suelta un trofeo que da +10 % de resistencia al frío para siempre. No te lo saltes.",
          sourceIds: ["wiki-resistencias"],
        },
        {
          text: "Maxroll aconseja tener un anillo de zafiro (resistencia al frío) hacia el nivel 15, justo antes de Geonor.",
          sourceIds: ["maxroll-subida"],
        },
      ],
    },
    {
      id: "mejoras",
      title: "Mejoras baratas",
      intro:
        "Orden que aconseja Maxroll para el equipo durante la campaña: velocidad de movimiento, después resistencias, después vida y por último daño.",
      tips: [
        {
          lead: "Mira al vendedor cada vez que vuelvas al campamento.",
          text: "En el acto 1 venden piezas de hasta nivel de objeto 15.",
          sourceIds: ["maxroll-subida"],
        },
        {
          lead: "Orbes de transmutación en botas, sin miedo:",
          text: "buscas velocidad de movimiento. Un orbe de aumento añade un modificador a un objeto mágico que solo tiene uno. Guarda los orbes regios para tus mejores piezas.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Un arma blanca con buen daño base vale la pena: transmútala y auméntala antes de seguir buscando otra.",
          sourceIds: ["wiki-consejos"],
        },
        {
          lead: "Frascos gratis:",
          text: "en el bosque singular, el caldero de la cabaña de la bruja da frascos medianos. Una vende frascos mayores por 80–500 de oro.",
          sourceIds: ["maxroll-subida"],
        },
        {
          lead: "Recompensas para siempre que no conviene saltarse:",
          text: "el cuervo repicador y el laúd de Una dan 2 puntos de pasiva cada uno; Cirio, el Ritual viviente, +20 de vida máxima; el rey de las nieblas, +30 de espíritu.",
          sourceIds: ["maxroll-subida", "wiki-cuervo"],
        },
        {
          text: "Engarza runas de resistencia en tu equipo: es la forma más barata de tapar la que te falte.",
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
