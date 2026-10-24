import type { ActGuide } from "./guide";

/**
 * Guía de supervivencia del acto 2 (BORRADOR, pendiente de revisión de Luis).
 *
 * Redactada el 24-10-2026 a partir de las fuentes de `sources`. Dudas que se
 * dicen tal cual en el texto en vez de esconderlas:
 *  - Ninguna fuente da una cifra de resistencia para el acto 3: se usa la
 *    misma referencia de la comunidad que en el acto 1 y se avisa.
 *  - Wiki y Maxroll no coinciden en si Jamanra, la Abominación, pega también
 *    con fuego: solo se afirma el rayo, que dicen las dos.
 *  - La guía de jefes de Maxroll es del 0.2; los ataques de Rudja salen de
 *    la wiki. La «vanguardia del Acorazado» que aún cita Maxroll se quitó en
 *    el 0.5.0 y no se menciona como zona.
 * Nombres en español según poe2db.tw/sp. Revisar entera al salir la 1.0.
 */
export const ACT_TWO_GUIDE: ActGuide = {
  slug: "acto-2",
  actLabel: "acto 2",
  title: "Acto 2: cómo cruzar el desierto sin morir",
  description:
    "Guía en español del acto 2 de Path of Exile 2 para novatos: Rudja y Jamanra, resistencias al fuego y al rayo, y recompensas que no debes saltarte.",
  summary: "Lo justo para llegar vivo al acto 3. Si no tienes tiempo, lee solo el recuadro de abajo.",
  status: "borrador",
  checkedPatch: "0.5.5",
  checkedOn: "24-10-2026",
  readMinutes: 2,
  check: {
    elemental: 30,
    nextAct: "acto 3",
    focus: {
      element: "lightning",
      minimum: 30,
      note: "Jamanra, la Abominación, el jefe final, pega con rayo: es la que más importa antes de entrar.",
    },
  },
  essentials: [
    {
      text: "Rudja, Ingeniera del terror (mina Mawdun), es el primer muro: sube la resistencia al fuego y sal del alquitrán antes de que lo encienda.",
      sourceIds: ["wiki-rudja", "maxroll-subida"],
    },
    {
      text: "El jefe final, Jamanra, la Abominación, pega con rayo. En la tormenta de arena, quédate detrás del escudo de la sekhema Asala.",
      sourceIds: ["wiki-jamanra", "maxroll-jefes"],
    },
    {
      text: "Fuego y rayo son las resistencias que importan aquí. Al pasar al acto 3 la penalización sube a −20 %.",
      sourceIds: ["wiki-resistencias"],
    },
    {
      text: "No te saltes las Hermanas de Garukhan (+10 % de rayo para siempre) ni las Promesas antiguas (+1 espacio para viales).",
      sourceIds: ["maxroll-subida", "wiki-promesas"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Rudja y Jamanra",
      intro: "Rudja, en la mina Mawdun. Jamanra, la Abominación, al final, en El Acorazado.",
      cards: [
        {
          title: "Rudja",
          text: "Lanza alquitrán que te frena y luego lo prende con su lanzallamas. Sal del alquitrán enseguida.",
        },
        {
          title: "Jamanra · fase 1",
          text: "Rayos y pilares eléctricos. En la tormenta de arena, quédate en la zona del escudo de Asala.",
        },
        {
          title: "Jamanra · desde el 66 %",
          text: "Tornados, lanzas y orbes de rayo. No te quedes quieto.",
        },
      ],
      tips: [],
      more: [
        {
          lead: "Antes de Rudja:",
          text: "fuego lo más alto posible. Según Maxroll, una o dos runas desérticas marcan la diferencia.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Rudja también tiene una embestida que no se puede bloquear y un gas venenoso que explota si lo toca su fuego.",
          sourceIds: ["wiki-rudja"],
        },
        {
          text: "Salir de la zona segura durante la tormenta de arena mata muy rápido. Mata a los esbirros que aparezcan.",
          sourceIds: ["wiki-jamanra", "maxroll-jefes"],
        },
        {
          text: "El parche 0.5.2 le bajó a Jamanra, la Abominación, alrededor de un 17 % de vida. Desde el 0.5.0 está en El Acorazado: si una guía antigua habla de una «vanguardia», ya no existe.",
          sourceIds: ["ggg-052", "ggg-050"],
        },
        {
          lead: "Azarian, el Hijo abandonado (Santuarios enterrados):",
          text: "pega con fuego y deja el suelo ardiendo. En la Ofrenda elemental, si vas corto de fuego, elige fuego: da un anillo de rubí.",
          sourceIds: ["wiki-azarian", "maxroll-subida"],
        },
        {
          lead: "Balbala, la Traidora (El pasaje de la traidora, opcional):",
          text: "se hace invisible y suelta gas venenoso. Tus efectos sobre ella siguen viéndose y la delatan. Solo hace falta para la ascendencia.",
          sourceIds: ["wiki-balbala"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistencias",
      intro: "Qué pega con cada cosa:",
      cards: [
        { title: "Fuego", text: "Rudja, Azarian, Balbala y Tor Gul." },
        { title: "Rayo", text: "Jamanra, la Abominación (jefe final)." },
      ],
      tips: [
        {
          lead: "Apunta a un 30 % en las tres antes del acto 3.",
          text: "Es una referencia de la comunidad, no una cifra oficial.",
          sourceIds: ["maxroll-subida"],
        },
      ],
      more: [
        {
          text: "La runa desértica da resistencia al fuego (+10 %, +14 % o +18 % según su nivel) engarzada en una armadura.",
          sourceIds: ["ggg-050"],
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
          lead: "Promesas antiguas:",
          text: "lleva las reliquias de los clanes de Kabala y del sol al medallón del Valle de los titanes. Ganas un espacio más para viales.",
          sourceIds: ["wiki-promesas"],
        },
        {
          lead: "Hermanas de Garukhan:",
          text: "su santuario está en Las torres de Deshar, antes del jefe final.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "Hacia el nivel 30, los vendedores pueden tener botas con 20 % de velocidad, frascos colosales y amuletos de espíritu.",
          sourceIds: ["maxroll-subida"],
        },
        {
          text: "Las Promesas antiguas también dan, a elegir, +30 % de cargas de viales o +30 % de duración de sus efectos. La elección se puede cambiar luego.",
          sourceIds: ["wiki-promesas"],
        },
        {
          lead: "Kabala, Reina constrictora (Keth):",
          text: "suelta un libro de especialización (2 puntos de pasiva de set de arma).",
          sourceIds: ["wiki-libro"],
        },
        {
          lead: "El rhoa abandonado (Deshar):",
          text: "busca la Última carta al pie de las torres y llévasela a Shambrin. Da otro libro de especialización.",
          sourceIds: ["wiki-tradicion"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Trampas del acto",
      intro: "Lo que más pilla a los novatos.",
      tips: [
        {
          lead: "Las tres rutas del desierto:",
          text: "la que dejes para el final sube de nivel. No guardes para luego la que peor llevas.",
          sourceIds: ["wiki-acto2"],
        },
      ],
      more: [
        {
          text: "Las tres rutas se abren tras enfrentarte a Jamanra, el Rey ascendido (no muere: huye), y las tres son obligatorias.",
          sourceIds: ["wiki-acto2"],
        },
        {
          lead: "La Prueba de las sekhemas (ascendencia):",
          text: "es dura si tu personaje es lento. Puedes volver más tarde, con más nivel.",
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
      id: "ggg-052",
      label: "Grinding Gear Games — notas del parche 0.5.2",
      url: "https://www.pathofexile.com/forum/view-thread/3960375",
    },
    {
      id: "wiki-acto2",
      label: "PoE2 Wiki — Act 2",
      url: "https://www.poe2wiki.net/wiki/Act_2",
    },
    {
      id: "wiki-rudja",
      label: "PoE2 Wiki — Rudja, the Dread Engineer",
      url: "https://www.poe2wiki.net/wiki/Rudja,_the_Dread_Engineer",
    },
    {
      id: "wiki-jamanra",
      label: "PoE2 Wiki — Jamanra, the Abomination",
      url: "https://www.poe2wiki.net/wiki/Jamanra,_the_Abomination",
    },
    {
      id: "wiki-azarian",
      label: "PoE2 Wiki — Azarian, the Forsaken Son",
      url: "https://www.poe2wiki.net/wiki/Azarian,_the_Forsaken_Son",
    },
    {
      id: "wiki-balbala",
      label: "PoE2 Wiki — Balbala, the Traitor",
      url: "https://www.poe2wiki.net/wiki/Balbala,_the_Traitor",
    },
    {
      id: "wiki-resistencias",
      label: "PoE2 Wiki — Resistance",
      url: "https://www.poe2wiki.net/wiki/Resistance",
    },
    {
      id: "wiki-promesas",
      label: "PoE2 Wiki — Ancient Vows",
      url: "https://www.poe2wiki.net/wiki/Ancient_Vows",
    },
    {
      id: "wiki-tradicion",
      label: "PoE2 Wiki — Tradition's Toll",
      url: "https://www.poe2wiki.net/wiki/Tradition%27s_Toll",
    },
    {
      id: "wiki-libro",
      label: "PoE2 Wiki — Book of Specialisation",
      url: "https://www.poe2wiki.net/wiki/Book_of_Specialisation",
    },
    {
      id: "maxroll-subida",
      label: "Maxroll — Comprehensive League Start Leveling Guide (actualizada para 0.5.5)",
      url: "https://maxroll.gg/poe2/getting-started/comprehensive-league-start-leveling-guide",
    },
    {
      id: "maxroll-jefes",
      label: "Maxroll — Act 2 Boss Guide (de la versión 0.2: tácticas, no números)",
      url: "https://maxroll.gg/poe2/getting-started/act-2-boss-guide",
    },
    {
      id: "poe2db-acto2",
      label: "PoE2DB en español — Acto 2 (nombres de jefes y zonas)",
      url: "https://poe2db.tw/sp/Act_2",
    },
  ],
};
