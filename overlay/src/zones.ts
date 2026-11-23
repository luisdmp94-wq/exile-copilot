/**
 * Códigos internos de zona que escribe PoE2 en Client.txt («Generating level
 * 48 area "G1_2"»), unidos a cada paso de las guías de `src/guides`.
 *
 * Los códigos no cambian con el idioma del juego; el nombre de la zona sí.
 * Salen del Client.txt real de un jugador en español (22-11-2026, 0.5.5).
 * La clave es el texto `zone` del paso en la guía: si una guía cambia una
 * zona, el test de la ventanita avisa de que falta su código.
 *
 * Un paso puede tener varias zonas («Yermo infestado y Humedales de las
 * quimerinas»). Los pueblos no se ponen salvo que sean un paso: entrar en el
 * pueblo no debe mover la guía.
 */
export const ZONE_CODES: Record<number, Record<string, string[]>> = {
  1: {
    "La orilla del río": ["G1_1"],
    Sierraclara: ["G1_2"],
    Lodazal: ["G1_3"],
    "El bosque singular": ["G1_4"],
    "El valle rojo": ["G1_5"],
    "El enredo sombrío": ["G1_6"],
    // El paso habla también del Mausoleo del pretor y de la Tumba de la consorte.
    "Cementerio de los eternos": ["G1_7", "G1_8", "G1_9"],
    "Terrenos de caza": ["G1_11"],
    Villafrey: ["G1_12"],
    "Tierras de cultivo de Ogham": ["G1_13_1"],
    "Pueblo de Ogham": ["G1_13_2"],
    // Las murallas de la mansión llevan a la mansión.
    "Mansión de Ogham": ["G1_14", "G1_15"],
  },
  2: {
    "Alrededores del Vastiri": ["G2_1"],
    "Cantera y mina Mawdun": ["G2_10_1", "G2_10_2"],
    "El pasaje de la traidora": ["G2_2"],
    "Prueba de las sekhemas": ["G2_13"],
    "Las puertas de Halani": ["G2_3", "G2_3a"],
    Keth: ["G2_4_1"],
    "La ciudad perdida y Santuarios enterrados": ["G2_4_2", "G2_4_3"],
    "Páramo de los mastodontes y La llanura de huesos": ["G2_5_1", "G2_5_2"],
    "Valle de los titanes": ["G2_6"],
    "La gruta del titán": ["G2_7"],
    Deshar: ["G2_8"],
    // El camino del luto lleva a las torres.
    "Las torres de Deshar": ["G2_9_1", "G2_9_2"],
    "El Acorazado": ["G2_12", "G2_12_1", "G2_12_2"],
  },
  3: {
    "Ciénaga de arena y Campamento del zigurat": ["G3_1"],
    "Ruinas de la jungla": ["G3_3"],
    "Las criptas venenosas": ["G3_4"],
    "Yermo infestado y Humedales de las quimerinas": ["G3_2_1", "G3_5"],
    "Taller de máquinas de Jiquani": ["G3_6_1"],
    "Santuario de Jiquani": ["G3_6_2"],
    "Los canales de Matlan": ["G3_2_2"],
    "El pantano de los azak": ["G3_7"],
    "Prueba de Caos": ["G3_10", "G3_10_Airlock"],
    "La ciudad sumergida": ["G3_8"],
    "La cámara fundida": ["G3_9"],
    "Ápice de la inmundicia": ["G3_11"],
    "Templo de Kopec": ["G3_12"],
    "Utzaal (pasado)": ["G3_14"],
    "Aggorat (pasado)": ["G3_16"],
    "Las cámaras negras (pasado)": ["G3_17"],
  },
  4: {
    "Marca del rey": ["G4_town"],
    "Bahía de las anclas y El final del viaje": ["G4_2_1", "G4_2_2"],
    "Isla del clan y Madrigueras volcánicas": ["G4_1_1", "G4_1_2"],
    // Segunda visita, opcional: se elige si ya pasaste el paso de Bahía.
    "El final del viaje": ["G4_2_2"],
    "Prisión abandonada y Confinamiento solitario": ["G4_5_1", "G4_5_2"],
    "Isla Whakapanu y Cavernas melodiosas": ["G4_3_1", "G4_3_2"],
    // La aleta del gran blanco se entrega a Kaimana en Ngakanu, en su versión
    // en paz (G4_11_1a): se visita antes de que la historia te lleve allí.
    "Isla Whakapanu": ["G4_3_1", "G4_11_1a"],
    "El ojo de Hinekora": ["G4_4_1"],
    "Salones de los muertos": ["G4_4_2"],
    "La prueba de los ancestros": ["G4_4_3"],
    "Isla de los alcaudones": ["G4_7"],
    "Punta del botín": ["G4_13"],
    Arastas: ["G4_8a", "G4_8b"],
    "La excavación": ["G4_10"],
    // Ngakanu atacada (G4_11_1b), tras La excavación; la versión en paz es del paso de la aleta.
    "Ngakanu y El corazón de la tribu": ["G4_11_1b", "G4_11_2"],
  },
};
