import type { ActGuide } from "./guide";

/**
 * Guía de supervivencia del acto 4 (BORRADOR, pendiente de revisión de Luis
 * jugando).
 *
 * Redactada el 21-11-2026 a partir de las fuentes de `sources`. Dudas que se
 * dicen tal cual en vez de esconderlas:
 *  - El acto es de islas y el orden es libre: la ruta sigue el orden que
 *    poe2db da «solo como sugerencia», con el consejo de Maxroll de dejar
 *    Arastas y Ngakanu para el final. El primer viaje NO es libre: Luis lo
 *    comprobó jugando (0.5.5, 22-11-2026) y el juego manda primero a Bahía
 *    de las anclas y luego a El final del viaje.
 *  - Dónde está Matiki y las tres piezas del arma precursora cambia cada liga
 *    (tabla de versiones de la wiki): la guía no nombra la zona.
 *  - poe2db da gemas de habilidad de nivel 12 en varias islas; las páginas de
 *    misión de la wiki dicen que no dan nada. No se publican como seguras.
 *    Tampoco las gemas de asistencia de nivel 4 de bestias raras (solo
 *    poe2db, y a ese nivel ya no importan).
 *  - La gema de espíritu de nivel 12 del cofre tras la cascada de El ojo de
 *    Hinekora sale solo de la wiki: se cuenta, con esa fuente.
 *  - Las tácticas de jefes son de la guía de Maxroll escrita para el 0.3 y
 *    de PoE-Vault (sin fecha): se cuentan ataques, no números. Las guías no
 *    coinciden del todo en los tipos de daño; se pone lo que dicen dos.
 *  - No hay cifra de la comunidad para salir del acto 4: se usa la misma
 *    referencia (30 %) que en los actos anteriores y lo que dice Maxroll.
 * Nombres en español según poe2db.tw/sp (zonas, jefes y objetos comprobados
 * el 21-11-2026). Revisar entera al salir la 1.0.
 */
export const ACT_FOUR_GUIDE: ActGuide = {
  slug: "acto-4",
  act: 4,
  actLabel: "acto 4",
  title: "Acto 4: las islas sin perderte nada",
  description:
    "Guía en español del acto 4 de Path of Exile 2 para novatos: los tatuajes de resistencia, los puntos de set de arma, Tavakai y cómo llegar vivo a los interludios.",
  summary: "Lo justo para cruzar las islas sin dejarte nada. Si no tienes tiempo, lee solo el recuadro de abajo.",
  status: "borrador",
  checkedPatch: "0.5.5",
  checkedOn: "21-11-2026",
  readMinutes: 4,
  check: {
    elemental: 30,
    nextAct: "los interludios",
  },
  essentials: [
    {
      text: "El juego te manda primero a Bahía de las anclas y a El final del viaje. Después, haz las islas en el orden que quieras y deja Arastas y Ngakanu para el final.",
      sourceIds: ["poe2db-acto4", "maxroll-subida"],
    },
    {
      text: "En Salones de los muertos elige los tres tatuajes de resistencia (+5 % cada uno), no los de atributo: no se puede cambiar.",
      sourceIds: ["wiki-salones", "wiki-resistencias"],
    },
    {
      text: "Hay 4 puntos de pasiva de set de arma: el Tomo envuelto en niebla (tras vencer a Omnifobia) y el Tatuaje de Hinekora (La prueba de los ancestros).",
      sourceIds: ["wiki-nieblas", "wiki-ancestros", "maxroll-subida"],
    },
    {
      text: "Tavakai, el jefe final, pega con fuego, hielo y rayo. En los interludios la penalización sube a −40 %: sube las tres antes de salir.",
      sourceIds: ["wiki-tavakai", "maxroll-jefes", "wiki-resistencias"],
    },
  ],
  // Orden sugerido por poe2db (consultado el 21-11-2026); niveles y
  // recompensas según poe2db y la wiki.
  route: [
    {
      zone: "Marca del rey",
      text: "El pueblo del acto. Desde aquí navegas a las islas: primero a Bahía de las anclas y, después, a las demás en el orden que quieras.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-acto4"],
    },
    {
      zone: "Bahía de las anclas y El final del viaje",
      text: "Tu primer viaje: el juego te manda aquí antes que a ninguna otra isla. El capitán Hartlin espera en El final del viaje.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Isla del clan y Madrigueras volcánicas",
      text: "Krutog, Señor del clan, pega con rayo. La bestia ciega es opcional: suelta una runa que Dannig te cambia por otra.",
      priority: "historia",
      skip: "La bestia ciega",
      sourceIds: ["poe2db-acto4", "maxroll-jefes", "wiki-acto4"],
    },
    {
      zone: "El final del viaje",
      gems: ["Habilidad nv. 13: al vencer a Omnifobia y hablar con Tujen"],
      text: "Misión opcional: hay que volver con Dannig y luego pelear contra Omnifobia, Miedo manifiesto. Tujen te da el Tomo envuelto en niebla: 2 puntos de pasiva de set de arma.",
      optional: true,
      priority: "clave",
      reward: "2 puntos de pasiva",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-nieblas", "maxroll-subida"],
    },
    {
      zone: "Prisión abandonada y Confinamiento solitario",
      text: "El prisionero se cura al 50 %, al 25 % y al 10 % de vida: dispárale con la balista para cortarlo. En la capilla, la Diosa de la justicia te deja elegir +30 % de recuperación de vida o de maná con frascos (se puede cambiar).",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-prision", "maxroll-jefes"],
    },
    {
      zone: "Isla Whakapanu y Cavernas melodiosas",
      text: "Diamora, Canción de muerte: mientras canta, no la mires de frente (petrifica). Después habla con Ange: abre el intercambio de monedas y el escondite.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes", "maxroll-subida"],
    },
    {
      zone: "Isla Whakapanu",
      text: "El gran blanco es un jefe opcional. Lleva su Aleta de tiburón a Kaimana y elige una mejora para siempre: Lección de Kaom (+30 % de armadura, evasión y escudo de energía) o Lección de Rakiata.",
      optional: true,
      priority: "clave",
      reward: "mejora de defensa",
      proof: { kind: "manual", question: "¿Llevaste la Aleta de tiburón a Kaimana y elegiste tu lección?" },
      sourceIds: ["wiki-medicina", "poe2db-acto4"],
    },
    {
      zone: "El ojo de Hinekora",
      gems: ["Espíritu nv. 12: cofre tras la cascada, entre dos de las pruebas"],
      text: "Se abre al rescatar a Matiki. Haz sus tres pruebas y presenta tus respetos a Navali: +5 % de maná máximo para siempre y una Runa de la mente mayor.",
      optional: true,
      priority: "clave",
      reward: "+5 % de maná",
      proof: { kind: "manual", question: "¿Hiciste las pruebas de El ojo de Hinekora y hablaste con Navali?" },
      sourceIds: ["wiki-hinekora", "poe2db-acto4", "ggg-050"],
    },
    {
      zone: "Salones de los muertos",
      text: "Tres pruebas opcionales, cada una con un tatuaje a elegir. Coge los de resistencia: +5 % de fuego, +5 % de hielo y +5 % de rayo. Al final, Yama, el Blanco, pega con caos.",
      optional: true,
      priority: "clave",
      reward: "+5 % a las tres",
      proof: { kind: "manual", question: "¿Elegiste los tres tatuajes de resistencia en Salones de los muertos?" },
      sourceIds: ["wiki-salones", "wiki-resistencias", "maxroll-jefes"],
    },
    {
      zone: "La prueba de los ancestros",
      text: "Después de Yama. Habla con Navali arriba del todo y te da el Tatuaje de Hinekora: 2 puntos de pasiva de set de arma.",
      optional: true,
      priority: "clave",
      reward: "2 puntos de pasiva",
      proof: { kind: "weaponSetPoints", amount: 2 },
      sourceIds: ["wiki-ancestros", "maxroll-subida"],
    },
    {
      zone: "Isla de los alcaudones",
      text: "El azote de los cielos: quédate delante de él y rueda para esquivar sus morteros de sangre.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Arastas",
      text: "Torvian, la Mano del Salvador. Toca las Campanas doradas: dan orbes regios y exaltados.",
      priority: "recomendable",
      sourceIds: ["poe2db-acto4", "maxroll-subida", "maxroll-jefes"],
    },
    {
      zone: "La excavación",
      text: "Benedictus, Primer heraldo de Utopía. Busca el hueco seguro en los anillos de explosiones.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "maxroll-jefes"],
    },
    {
      zone: "Ngakanu y El corazón de la tribu",
      text: "Tavakai, el Jefe de guerra, el jefe final.",
      priority: "historia",
      sourceIds: ["poe2db-acto4", "wiki-tavakai"],
    },
  ],
  blocks: [
    {
      id: "jefes",
      title: "Tavakai y otros jefes duros",
      intro: "Tavakai, el Jefe de guerra, al final, en El corazón de la tribu. Tiene tres fases.",
      cards: [
        {
          title: "Tavakai · al principio",
          text: "Te lanza un gancho: rueda para esquivarlo.",
        },
        {
          title: "Al 50 % y al 25 %",
          text: "Cambia de fase y suma fuego, hielo y rayo. Muévete sin parar.",
        },
        {
          title: "Marca de Kitava",
          text: "Se cura con el daño que te hace. Cuanto menos te pegue, antes cae.",
        },
      ],
      tips: [],
      more: [
        {
          lead: "El prisionero (Confinamiento solitario):",
          text: "se cura al 50 %, al 25 % y al 10 % de vida. Cada vez, dispárale con la balista para cortarlo.",
          sourceIds: ["maxroll-jefes", "poe2db-acto4"],
        },
        {
          lead: "Yama, el Blanco:",
          text: "pega con caos. Usa los pilares para cubrirte y busca al Yama de verdad entre sus copias. Maxroll aconseja botas con velocidad de movimiento.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Diamora, Canción de muerte:",
          text: "esquiva sus olas. Cuando canta, su mirada petrifica: no la mires de frente.",
          sourceIds: ["maxroll-jefes", "poevault-jefes"],
        },
        {
          lead: "Torvian, la Mano del Salvador:",
          text: "corta a los sacerdotes que le ayudan. No cruces sus muros sagrados: te frenan y te hacen más fácil de criticar.",
          sourceIds: ["maxroll-jefes"],
        },
        {
          lead: "Capitán Hartlin:",
          text: "sal del área del ancla espectral y esquiva los círculos de sus cañonazos.",
          sourceIds: ["maxroll-jefes", "poevault-jefes"],
        },
      ],
    },
    {
      id: "resistencias",
      title: "Resistencias",
      intro: "Qué pega con cada cosa:",
      cards: [
        { title: "Fuego", text: "Torvian y Tavakai." },
        { title: "Hielo", text: "Hartlin, Diamora, El prisionero y Tavakai." },
        { title: "Rayo", text: "Krutog, La bestia ciega, Benedictus y Tavakai." },
        { title: "Caos", text: "Yama, el Blanco." },
      ],
      tips: [
        {
          lead: "Los tres tatuajes de Salones de los muertos son +15 % gratis.",
          text: "Apunta a un 30 % en las tres antes de los interludios. Maxroll aconseja acercarte al 75 % todo lo que puedas.",
          sourceIds: ["wiki-salones", "maxroll-subida"],
        },
      ],
      more: [
        {
          text: "En el acto 4 el juego te quita un 30 %. En los interludios, un 40 %, y un 50 % en sus zonas de nivel 60 o más.",
          sourceIds: ["wiki-resistencias"],
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
      intro: "Casi todas están en zonas opcionales y son fáciles de pasar por alto.",
      tips: [
        {
          lead: "Omnifobia:",
          text: "si te saltas esa misión pierdes 2 puntos de set de arma y una gema de habilidad de nivel 13.",
          sourceIds: ["wiki-nieblas"],
        },
        {
          lead: "Kaimana:",
          text: "la Lección de Kaom es la sencilla: +30 % a armadura, evasión y escudo de energía.",
          sourceIds: ["wiki-medicina", "poe2db-acto4"],
        },
      ],
      more: [
        {
          text: "La Lección de Rakiata: el 15 % de tu armadura también vale contra daño elemental, desvío igual al 12 % de tu evasión y el escudo de energía empieza a recargarse un 12 % antes.",
          sourceIds: ["wiki-medicina"],
        },
        {
          text: "Punta del botín es una isla opcional de Expedición. No se abre hasta que entregues los cuatro Trozos de mapa rasgado: Isla del clan, Bahía de las anclas, Isla Whakapanu e Isla de los alcaudones.",
          sourceIds: ["wiki-acto4", "ggg-050"],
        },
        {
          text: "Arastas y Ngakanu tienen tiendas (hechizos y herrero) que puedes visitar antes de hacerlas.",
          sourceIds: ["poe2db-acto4"],
        },
      ],
    },
    {
      id: "trampas",
      title: "Trampas del acto",
      intro: "Lo que más pilla a los novatos.",
      tips: [
        {
          lead: "Los tatuajes no se pueden cambiar.",
          text: "Si eliges +5 a un atributo en vez de +5 % de resistencia, se queda así para siempre.",
          sourceIds: ["wiki-salones", "poe2db-acto4"],
        },
      ],
      more: [
        {
          text: "Dónde está Matiki cambia de una liga a otra. Una guía antigua puede mandarte a otra isla.",
          sourceIds: ["wiki-acto4"],
        },
        {
          text: "La elección de frascos de la Diosa de la justicia sí se puede cambiar: vuelve a la estatua.",
          sourceIds: ["wiki-prision"],
        },
        {
          text: "Después del acto 4 vienen tres interludios antes de los mapas. Cada tramo te quita más resistencia.",
          sourceIds: ["wiki-resistencias", "maxroll-subida"],
        },
      ],
    },
  ],
  sources: [
    {
      id: "poe2db-acto4",
      label: "PoE2DB en español — Acto 4 (zonas, jefes y recompensas)",
      url: "https://poe2db.tw/sp/Act_4",
    },
    {
      id: "wiki-acto4",
      label: "PoE2 Wiki — Act 4 (orden libre, Matiki y Punta del botín)",
      url: "https://www.poe2wiki.net/wiki/Act_4",
    },
    {
      id: "maxroll-subida",
      label: "Maxroll — Comprehensive League Start Leveling Guide (actualizada para 0.5.5)",
      url: "https://maxroll.gg/poe2/getting-started/comprehensive-league-start-leveling-guide",
    },
    {
      id: "maxroll-jefes",
      label: "Maxroll — Act 4 Boss Guide (de la versión 0.3: tácticas, no números)",
      url: "https://maxroll.gg/poe2/getting-started/act-4-boss-guide",
    },
    {
      id: "poevault-jefes",
      label: "PoE-Vault — Act 4 Boss Guide (sin fecha)",
      url: "https://www.poe-vault.com/poe2/guides/act-4-boss-guide",
    },
    {
      id: "wiki-resistencias",
      label: "PoE2 Wiki — Resistance",
      url: "https://www.poe2wiki.net/wiki/Resistance",
    },
    {
      id: "wiki-nieblas",
      label: "PoE2 Wiki — Dark Mists (Omnifobia y el Tomo envuelto en niebla)",
      url: "https://www.poe2wiki.net/wiki/Dark_Mists",
    },
    {
      id: "wiki-ancestros",
      label: "PoE2 Wiki — Trial of the Ancestors (misión)",
      url: "https://www.poe2wiki.net/wiki/Trial_of_the_Ancestors_(quest)",
    },
    {
      id: "wiki-salones",
      label: "PoE2 Wiki — Halls of the Dead (tatuajes)",
      url: "https://www.poe2wiki.net/wiki/Halls_of_the_Dead",
    },
    {
      id: "wiki-hinekora",
      label: "PoE2 Wiki — Eye of Hinekora",
      url: "https://www.poe2wiki.net/wiki/Eye_of_Hinekora",
    },
    {
      id: "wiki-medicina",
      label: "PoE2 Wiki — Tribal Medicine (Kaimana)",
      url: "https://www.poe2wiki.net/wiki/Tribal_Medicine",
    },
    {
      id: "wiki-prision",
      label: "PoE2 Wiki — Abandoned Prison",
      url: "https://www.poe2wiki.net/wiki/Abandoned_Prison",
    },
    {
      id: "wiki-tavakai",
      label: "PoE2 Wiki — Tavakai, the Chieftain",
      url: "https://www.poe2wiki.net/wiki/Tavakai,_the_Chieftain",
    },
    {
      id: "ggg-050",
      label: "Grinding Gear Games — notas del parche 0.5.0 (22-05-2026)",
      url: "https://www.pathofexile.com/forum/view-thread/3932540",
    },
  ],
};
