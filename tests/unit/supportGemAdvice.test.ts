import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isPlaceholderGemName, isRealGem } from "../../shared/gemCatalog";
import {
  GemDataSchema,
  findSkill,
  supportCandidates,
  type GemAttribute,
} from "../../shared/supportGemAdvice.js";

// Datos reales del cliente en español (se regeneran con `npm run data:gems`).
// Si un parche cambia estas gemas, estas pruebas avisan de que hay que revisarlas.
const data = GemDataSchema.parse(
  JSON.parse(readFileSync(fileURLToPath(new URL("../../server/data/gems.es.json", import.meta.url)), "utf8")),
);

const ALL: GemAttribute[] = ["Fue", "Des", "Int"];

function names(
  skillName: string,
  options: { maxGrade?: number; attributes?: GemAttribute[]; socketed?: string[]; note?: string } = {},
) {
  const skill = findSkill(data, skillName);
  if (!skill) throw new Error(`No existe la habilidad ${skillName}`);
  return supportCandidates(data, {
    skill,
    maxGrade: options.maxGrade ?? 1,
    attributes: options.attributes ?? ALL,
    socketed: options.socketed,
    note: options.note,
  }).map((candidate) => candidate.support.name);
}

describe("datos de gemas", () => {
  it("trae habilidades y asistencias con nombre, grado y descripción", () => {
    // 399 desde el 19-11-2026: antes el script se saltaba las gemas de dos
    // atributos (ballesta, bastón, formas del druida) y solo traía 184.
    expect(data.skills.length).toBeGreaterThan(380);
    for (const name of ["Esquirlas galvánicas", "Granada explosiva", "Arrebato de tempestad", "Zarpazo", "Golpe de hielo"]) {
      expect(findSkill(data, name)?.name).toBe(name);
    }
    expect(data.supports.length).toBeGreaterThan(400);
    const usable = data.supports.filter((support) => !support.lineage);
    expect(usable.every((support) => support.grade !== null && support.category !== null)).toBe(true);
    expect(usable.filter((support) => support.description === "").length).toBeLessThanOrEqual(2);
  });

  it("encuentra una habilidad sin tildes ni mayúsculas", () => {
    expect(findSkill(data, "drenar esencia")?.name).toBe("Drenar esencia");
    expect(findSkill(data, "  CONTAGIO ")?.name).toBe("Contagio");
    expect(findSkill(data, "no existe")).toBeNull();
  });
});

describe("supportCandidates — casos de la partida del 11-11-2026", () => {
  it("Descarga de caos (hechizo de caos que impacta) admite Lanzamiento rápido y Obscenidad", () => {
    const found = names("Descarga de caos", { attributes: ["Int"] });
    expect(found).toContain("Lanzamiento rápido I");
    expect(found).toContain("Obscenidad I");
    expect(found).toContain("Toque marchitante");
  });

  it("Guerrero esqueleto solo admite asistencias de esbirros: Obscenidad no vale", () => {
    const found = names("Guerrero esqueleto", { attributes: ["Int"] });
    expect(found).toContain("Último aliento");
    expect(found).toContain("Ejército elemental");
    expect(found).not.toContain("Obscenidad I");
    expect(found).not.toContain("Lanzamiento rápido I");
  });

  it("Contagio no golpea: se descartan las asistencias que piden impactar", () => {
    const found = names("Contagio");
    expect(found).not.toContain("Toque marchitante");
    expect(found).toContain("Aflicción veloz I");
    expect(found).toContain("Lanzamiento rápido I");
    // «Área magnificada» dice que asiste embates, y Contagio no lo es.
    expect(found).not.toContain("Área magnificada I");
  });

  it("respeta el tope por atributo", () => {
    const onlyDex = names("Drenar esencia", { attributes: ["Des"] });
    expect(onlyDex).toContain("Aflicción veloz I");
    expect(onlyDex).not.toContain("Lanzamiento rápido I");
  });

  it("no repite una asistencia ya puesta ni otra de su misma familia", () => {
    const found = names("Descarga de caos", { maxGrade: 5, socketed: ["Lanzamiento rápido I"] });
    expect(found.some((name) => name.startsWith("Lanzamiento rápido"))).toBe(false);
  });

  it("de cada familia ofrece solo la versión más alta que permite la gema", () => {
    const grade1 = names("Descarga de caos", { maxGrade: 1 });
    expect(grade1).toContain("Lanzamiento rápido I");
    const grade5 = names("Descarga de caos", { maxGrade: 5 });
    expect(grade5).not.toContain("Lanzamiento rápido I");
    expect(grade5.some((name) => /^Lanzamiento rápido I[IV]+$/.test(name))).toBe(true);
  });

  it("nunca ofrece gemas de linaje ni de grado mayor al pedido", () => {
    for (const skillName of ["Contagio", "Guerrero esqueleto", "Drenar esencia"]) {
      const skill = findSkill(data, skillName)!;
      for (const { support } of supportCandidates(data, { skill, maxGrade: 2, attributes: ALL })) {
        expect(support.lineage).toBe(false);
        expect(support.grade).toBeLessThanOrEqual(2);
      }
    }
  });

  it("una eficiencia de coste no se ofrece a una habilidad que reserva espíritu", () => {
    expect(names("Presencia marchitante", { maxGrade: 5 })).not.toContain("Eficiencia I");
  });
});

// Auditoría del 18-11-2026: unas veinte asistencias se ofrecían a casi todas
// las habilidades porque su primera frase pide un tipo que ninguna regla miraba.
describe("supportCandidates — asistencias que piden un tipo concreto de habilidad", () => {
  // Una sola pasada por todas las habilidades: a cuáles se ofrece cada asistencia.
  const offered = new Map<string, string[]>();
  for (const skill of data.skills) {
    for (const candidate of supportCandidates(data, { skill, maxGrade: 5, attributes: ALL })) {
      offered.set(candidate.support.name, [...(offered.get(candidate.support.name) ?? []), skill.name]);
    }
  }
  const offeredTo = (supportName: string) => offered.get(supportName) ?? [];

  it("las de ofrendas, cadáveres, detonación y momento perfecto solo van a esas habilidades", () => {
    expect(offeredTo("Ofrenda sacrificial")).toEqual(["Ofrenda de dolor", "Ofrenda de hueso", "Ofrenda de almas"]);
    expect(offeredTo("Atracón").sort()).toEqual(
      ["Descomposición", "Devorar", "Festín de carne", "Muertos volátiles", "Levantar zombi", "Ritual profano"].sort(),
    );
    // Las de antes y, desde que están en los datos, las granadas (tienen tiempo de detonación).
    expect(offeredTo("Mecha larga II")).toEqual(
      expect.arrayContaining(["Lanza explosiva", "Flechas de punta helada", "Crecimiento tóxico", "Bomba de escarcha", "Granada explosiva", "Granada de gas"]),
    );
    expect(offeredTo("Mecha larga II").length).toBeLessThan(15);
    expect(offeredTo("Mecha larga II")).not.toContain("Contagio");
    expect(offeredTo("Perfección").sort()).toEqual(["Disparo certero", "Golpe perfecto", "Tormenta inminente"].sort());
    expect(offeredTo("Durabilidad").sort()).toEqual(
      ["Campo de lanzas", "Muro de hielo", "Muro protector", "Pilares sombríos", "Saeta glacial"].sort(),
    );
  });

  it("las que miran etiquetas del juego las respetan: nova, condición, activación", () => {
    const tagged = (tag: string) => data.skills.filter((skill) => skill.tags.includes(tag)).map((skill) => skill.name);
    expect(offeredTo("Proyección astral")).toEqual(tagged("Nova"));
    expect(offeredTo("Gratificación demorada")).toEqual(tagged("Condicional"));
    // Las conjuraciones que acumulan energía: Lanzahechizos y las tres que activan hechizos.
    expect(offeredTo("Condensador de energía").sort()).toEqual(
      ["Conjuración de barrera", "Conjuración de la parca", "Conjuración elemental", "Lanzahechizos"].sort(),
    );
    for (const name of offeredTo("Casualidad")) expect(tagged("Activación")).toContain(name);
  });

  it("las de cargas piden cargas de poder, frenesí o aguante, no «recarga»", () => {
    expect(offeredTo("Cargas potenciadas")).toContain("Tormenta de huesos");
    expect(offeredTo("Cargas potenciadas")).not.toContain("Contagio");
    // Con las 399 habilidades son 33 las que gastan cargas; lo raro sería medio juego.
    expect(offeredTo("Cargas potenciadas").length).toBeLessThan(45);
    expect(offeredTo("Profusión de cargas II")).toContain("Robo de poder");
    expect(offeredTo("Profusión de cargas II").length).toBeLessThan(20);
  });

  it("lo que no se sabe por los datos no se propone: usar andando", () => {
    expect(offeredTo("Movilidad")).toEqual([]);
    expect(offeredTo("Deliberación")).toEqual([]);
  });

  it("«de escudo» es la que se usa con escudo, no la que crea uno ni la de escudo de energía", () => {
    expect(offeredTo("Vanguardia II").sort()).toEqual(
      ["Barrera de magma", "Carga con escudo", "Escudo resonante", "Grito fortificador", "Levantar escudo", "Muro protector", "Vuelo de medianoche"].sort(),
    );
  });

  it("potenciar otra habilidad no es potenciar una resistencia", () => {
    expect(offeredTo("Intención asesina")).toEqual(
      expect.arrayContaining(["Grito infernal", "Descarga", "Tempestad de maná"]),
    );
    expect(offeredTo("Intención asesina")).not.toContain("Pureza de fuego");
  });

  it("una maldición no hace daño: no recibe lo que solo da daño", () => {
    const curse = names("Desesperación", { maxGrade: 5 });
    for (const wrong of ["Área concentrada", "Tempestad creciente", "Acritud", "Enloquecer", "Impulso", "Agonía intensa", "Exposición potente"]) {
      expect(curse).not.toContain(wrong);
    }
    // Lo suyo sigue estando.
    expect(curse).toEqual(expect.arrayContaining(["Maldición mejorada", "Maldición ritualística", "Lanzamiento rápido III"]));
  });

  it("el daño degenerativo propio solo se mejora en habilidades que lo tienen", () => {
    expect(offeredTo("Agonía intensa")).toEqual(expect.arrayContaining(["Contagio", "Drenar esencia"]));
    expect(offeredTo("Agonía intensa").length).toBeLessThan(10);
    // Contagio dura 5 segundos: la III solo paga por debajo de uno. Le toca la II.
    expect(names("Contagio", { maxGrade: 5 })).toContain("Aflicción veloz II");
    expect(names("Contagio", { maxGrade: 5 })).not.toContain("Aflicción veloz III");
  });

  it("lo que se deja activo no «se usa»: un aura no recibe Ferocidad", () => {
    expect(offeredTo("Ferocidad")).not.toContain("Pureza de fuego");
    expect(offeredTo("Ferocidad")).not.toContain("Guerrero esqueleto");
    expect(offeredTo("Ferocidad")).toContain("Destrozahuesos");
  });

  it("ninguna asistencia sin etiquetas propias se ofrece ya a casi todo sin motivo", () => {
    // Las que de verdad valen para cualquiera («cualquier habilidad», «que usas tú mismo», «que hace daño»).
    const universal = /^asiste (?:cualquier habilidad|habilidades de ataque|habilidades que (?:usas|pueden infligir|infligen dano|impactan|pueden provocar))/;
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const suspicious = data.supports
      .filter((support) => !support.lineage && support.tags.length === 0 && !universal.test(normalize(support.description)))
      .filter((support) => offeredTo(support.name).length > 60)
      .map((support) => support.name);
    expect(suspicious).toEqual([]);
  });
});

// Visto en la web publicada el 18-11-2026: a «Ofrenda de dolor» se le
// recomendaba «Frenesí voraz», que mejora a los esbirros que crea una habilidad.
describe("supportCandidates — llevar la etiqueta de esbirro no es crear esbirros", () => {
  it("una ofrenda recibe lo de ofrendas, no lo de esbirros que pelean", () => {
    const offering = names("Ofrenda de dolor", { maxGrade: 5 });
    expect(offering.slice(0, 2).sort()).toEqual(["Danza macabra", "Ofrenda sacrificial"]);
    for (const wrong of ["Frenesí voraz II", "Congregación", "Pacto de esbirros II", "Ejército elemental", "Área concentrada", "Enloquecer"]) {
      expect(offering).not.toContain(wrong);
    }
  });

  it("una asistencia que te quita vida cada vez que usas la habilidad nunca es la primera", () => {
    // Caso real (20-11-2026): la web recomendó «Extracción» la primera para
    // Descarga de caos y el jugador, con 723 de vida, se mataba al lanzarla.
    for (const skill of ["Descarga de caos", "Contagio", "Drenar esencia", "Chispa"]) {
      const offered = names(skill, { maxGrade: 3 });
      expect(offered.slice(0, 3), skill).not.toContain("Extracción");
    }
    // Sigue entre las que valen: el jugador que sepa sostenerla la encuentra.
    expect(names("Descarga de caos", { maxGrade: 3 })).toContain("Extracción");
    // Las que cambian el coste de maná por vida tampoco van las primeras.
    expect(names("Descarga de caos", { maxGrade: 3 }).slice(0, 3)).not.toContain("Transfusión de vida");
  });

  it("una asistencia que solo da daño si llevas cargas o infusiones no es la primera para quien no las usa", () => {
    // Caso real (20-11-2026): «Inhibidor» salía la primera para Descarga de caos.
    for (const skill of ["Descarga de caos", "Cometa", "Descarga de escarcha", "Chispa", "Bola de fuego"]) {
      expect(names(skill, { maxGrade: 3 }).slice(0, 3), skill).not.toContain("Inhibidor");
    }
    // No desaparece: sigue entre las que valen.
    expect(names("Descarga de caos", { maxGrade: 3 })).toContain("Inhibidor");
  });

  it("una asistencia que encoge el área de la habilidad no es la respuesta automática", () => {
    // Caso real (20-11-2026): «Área concentrada» (un 50% menos de área) salía
    // la primera en casi tres de cada diez habilidades.
    for (const skill of ["Cometa", "Bola de fuego", "Nova de hielo", "Contagio", "Tormenta de huesos"]) {
      expect(names(skill, { maxGrade: 3 })[0], skill).not.toBe("Área concentrada");
    }
    // Quien pide daño contra jefes la vuelve a ver arriba: ahí sí compensa.
    expect(names("Cometa", { maxGrade: 1, note: "pega poco a los jefes" }).slice(0, 3)).toContain("Área concentrada");
    // Quien pide limpiar grupos no la ve entre las primeras.
    expect(names("Cometa", { maxGrade: 3, note: "quiero limpiar grupos" }).slice(0, 5)).not.toContain("Área concentrada");
    // Sigue entre las que valen.
    expect(names("Cometa", { maxGrade: 3 })).toContain("Área concentrada");
  });

  it("los efectos que solo tocan a los esbirros que ya tienes tampoco", () => {
    for (const skill of ["Sacrificio", "Festín sombrío", "Pacto oscuro"]) {
      const offered = names(skill, { maxGrade: 5 });
      expect(offered).not.toContain("Frenesí voraz II");
      expect(offered).not.toContain("Congregación");
    }
  });

  it("las que sí crean esbirros las conservan", () => {
    for (const skill of ["Guerrero esqueleto", "Levantar zombi", "Exhumar", "Espíritus encolerizados", "Vincular espectro"]) {
      expect(names(skill, { maxGrade: 5 })).toEqual(expect.arrayContaining(["Frenesí voraz II", "Congregación"]));
    }
  });

  it("una asistencia que no dice a qué asiste no se propone a nadie", () => {
    for (const skill of data.skills) {
      const offered = supportCandidates(data, { skill, maxGrade: 5, attributes: ALL }).map((candidate) => candidate.support.name);
      expect(offered).not.toContain("Metralla de hueso");
      expect(offered).not.toContain("Inscripción ardiente");
    }
  });

  it("«objetos de tierra» no se cuela a los esqueletos", () => {
    expect(names("Guerrero esqueleto", { maxGrade: 5 })).not.toContain("Roca escurridiza II");
  });
});

// Repaso a mano de las habilidades de arco, las señales y «Aluvión» (18-11-2026).
describe("supportCandidates — repaso de la arquera", () => {
  it("hace caso a lo que la asistencia dice que no asiste", () => {
    // «Alineación» y «Salva espectral»: no asisten habilidades de canalización.
    for (const skill of ["Disparo certero", "Flecha detonadora"]) {
      const offered = names(skill, { maxGrade: 5 });
      expect(offered).not.toContain("Alineación II");
      expect(offered).not.toContain("Alineación III");
      expect(offered).not.toContain("Salva espectral");
    }
    // «Proyectiles de nova» y «Disparo de azar»: no valen si los proyectiles caen desde arriba.
    for (const skill of ["Lluvia de flechas", "Pararrayos", "Disparo de tornado"]) {
      const offered = names(skill, { maxGrade: 5 });
      expect(offered).not.toContain("Proyectiles de nova I");
      expect(offered).not.toContain("Proyectiles de nova II");
      expect(offered).not.toContain("Disparo de azar");
    }
    // «Ferocidad»: no asiste habilidades que consuman cargas de frenesí.
    expect(names("Lluvia de flechas", { maxGrade: 5 })).not.toContain("Ferocidad");
    expect(names("Salva espiralada", { maxGrade: 5 })).not.toContain("Ferocidad");
    // «Escarcha cortante»: no asiste habilidades que consuman el congelamiento.
    expect(names("Disparo certero", { maxGrade: 5 })).not.toContain("Escarcha cortante II");
    // Las que sí encajan siguen ahí.
    expect(names("Flecha de rayo", { maxGrade: 5 })).toEqual(expect.arrayContaining(["Alineación II", "Proyectiles de nova I", "Ferocidad"]));
  });

  it("hace caso a lo que la propia habilidad no admite", () => {
    // «La cantidad de proyectiles no se puede modificar».
    const escape = names("Disparo de huida", { maxGrade: 5 });
    for (const wrong of ["Disparo múltiple II", "Salva", "Alineación III", "Proyectiles de nova II"]) expect(escape).not.toContain(wrong);
    // «No puedes perforar» y «No puede encadenarse».
    const paralysing = names("Flecha paralizante", { maxGrade: 5 });
    for (const wrong of ["Perforar III", "Rebote II", "Disparo de azar"]) expect(paralysing).not.toContain(wrong);
    // «No impacta, pero envenena»: fuera críticos, cegar y empujar; el veneno se queda.
    const poison = names("Flecha de estallido venenoso", { maxGrade: 5 });
    for (const wrong of ["Supercrítico", "Cegar II", "Empuje", "Detectar punto crítico"]) expect(poison).not.toContain(wrong);
    expect(poison).toEqual(expect.arrayContaining(["Veneno intensificado", "Veneno III", "Veneno mortífero II"]));
  });

  it("no propone a un arco lo que solo sirve cuerpo a cuerpo, con ballesta o con daño por segundo", () => {
    const tornado = names("Disparo de tornado", { maxGrade: 5 });
    expect(tornado).not.toContain("Sangrado IV");
    expect(tornado).not.toContain("Peine recargado II");
    // Dura 15 segundos: «Aflicción veloz III» pide menos de uno. Se queda la II.
    expect(tornado).not.toContain("Aflicción veloz III");
    expect(tornado).toContain("Aflicción veloz II");
    // «Enloquecer» y «Acritud» solo dan daño por segundo.
    for (const skill of ["Disparo de hielo", "Lluvia de flechas", "Flecha de rayo"]) {
      const offered = names(skill, { maxGrade: 5 });
      expect(offered).not.toContain("Enloquecer");
      expect(offered).not.toContain("Acritud");
    }
    expect(names("Contagio", { maxGrade: 5 })).toContain("Acritud");
  });

  it("no pone arriba lo que premia pegar de cerca ni lo que apaga lo que la habilidad hace", () => {
    const ice = names("Disparo de hielo", { maxGrade: 5 });
    const top = ice.slice(0, 10);
    for (const low of ["Combate cercano II", "Forjado con furia II", "Escarcha cortante II", "Armamento elemental III"]) {
      expect(ice).toContain(low);
      expect(top).not.toContain(low);
    }
    expect(top).toContain("Tiro largo II");
  });

  it("en una señal van primero las asistencias de señales", () => {
    for (const mark of ["Señal del tirador", "Señal voltaica", "Señal del sabueso"]) {
      const offered = names(mark, { maxGrade: 5 });
      expect(offered.slice(0, 4).sort()).toEqual(["Señal cargada", "Señal de absorción II", "Señal de muerte II", "Señal eterna"]);
    }
    // «Ferocidad» le quitaría a la señal la carga de frenesí que da.
    expect(names("Señal del tirador", { maxGrade: 5 })).not.toContain("Ferocidad");
    // Lo que «usas tú mismo» no vale para la explosión que desencadena la señal.
    const hound = names("Señal del sabueso", { maxGrade: 5 });
    for (const wrong of ["Hemocristales", "Sangrado IV", "Cadencia", "Estoicismo II"]) expect(hound).not.toContain(wrong);
  });

  it("«Aluvión» no hace daño: recibe lo de sus cargas y su enfriamiento", () => {
    const barrage = names("Aluvión", { maxGrade: 5 });
    for (const wrong of ["Reloj de arena", "Forjado con furia II", "Inhibidor", "Impulso", "Enloquecer"]) expect(barrage).not.toContain(wrong);
    expect(barrage.slice(0, 5).sort()).toEqual(
      ["Carga perpetua", "Cargas potenciadas", "Intención asesina", "Recuperación de enfriamiento II", "Segundo aliento III"].sort(),
    );
  });

  it("un efecto que solo nombra el enfriamiento no tiene enfriamiento", () => {
    expect(names("Momento de necesidad", { maxGrade: 5 })).not.toContain("Segundo aliento III");
    expect(names("Convalecencia", { maxGrade: 5 })).toContain("Segundo aliento III");
  });
});

// El listado en español de poe2db seguía enseñando gemas que el juego retiró
// en el parche 0.3.0 y alguna entrada que no es una gema (18-11-2026).
describe("datos de gemas — solo gemas que existen en el juego", () => {
  const english = JSON.parse(
    readFileSync(fileURLToPath(new URL("../../server/data/gems.en.json", import.meta.url)), "utf8"),
  ) as { skills: Array<{ slug: string; name: string }>; supports: Array<{ slug: string; name: string }> };
  const spanish = [...data.skills, ...data.supports];

  it("no trae gemas retiradas ni entradas de plantilla", () => {
    expect(spanish.filter((gem) => !isRealGem(gem)).map((gem) => gem.name)).toEqual([]);
    expect([...english.skills, ...english.supports].filter((gem) => !isRealGem(gem)).map((gem) => gem.name)).toEqual([]);
    expect(isPlaceholderGemName("Compañero: {0}")).toBe(true);
    expect(isPlaceholderGemName("[DNT] Crushing Earth")).toBe(true);
    expect(isPlaceholderGemName("Compañero rhoa")).toBe(false);
    for (const gone of ["Conductividad", "Inflamabilidad", "Hipotermia", "Lanzar al congelar"]) expect(findSkill(data, gone)).toBeNull();
    // Las que las sustituyen siguen ahí.
    expect(findSkill(data, "Debilidad elemental")).not.toBeNull();
    expect(findSkill(data, "Lanzar al infligir estado alterado elemental")).not.toBeNull();
  });

  it("cada gema en español tiene su versión en inglés", () => {
    // El listado inglés es el que sigue al juego: una gema solo en español es
    // una gema retirada (y además saldría sin traducir en la versión inglesa).
    const translated = new Set([...english.skills, ...english.supports].map((gem) => gem.slug));
    expect(spanish.filter((gem) => !translated.has(gem.slug)).map((gem) => gem.name)).toEqual([]);
  });
});

// Hasta el 19-11-2026 el script de datos se saltaba las gemas de dos atributos:
// ni ballestas, ni bastón del monje, ni formas del druida estaban en la web.
describe("supportCandidates — habilidades de dos atributos (ballesta, bastón, formas)", () => {
  it("una habilidad de ballesta recibe las asistencias de ballesta, y una de arco no", () => {
    const crossbow = names("Esquirlas galvánicas", { maxGrade: 5 });
    expect(crossbow).toEqual(expect.arrayContaining(["Conservación de munición III", "Peine recargado II", "Recarga veloz"]));
    const bow = names("Flecha de rayo", { maxGrade: 5 });
    for (const wrong of ["Conservación de munición III", "Peine recargado II", "Recarga veloz"]) expect(bow).not.toContain(wrong);
  });

  it("una granada recibe lo de granadas y lo de tiempo de detonación", () => {
    const grenade = names("Granada explosiva", { maxGrade: 5 });
    expect(grenade).toEqual(expect.arrayContaining(["Granadas adhesivas II", "Mecha larga II"]));
    expect(names("Flecha de rayo", { maxGrade: 5 })).not.toContain("Granadas adhesivas II");
  });

  it("las habilidades del monje y del druida existen y reciben asistencias", () => {
    for (const name of ["Arrebato de tempestad", "Golpe de hielo", "Palma mortal", "Zarpazo", "Embate furioso", "Despedazar"]) {
      expect(names(name, { maxGrade: 5 }).length).toBeGreaterThan(20);
    }
  });

  it("un golpe cuerpo a cuerpo no recibe primero una asistencia que lo deja sin poder usarse", () => {
    for (const name of ["Zarpazo", "Golpe de hielo", "Destrozahuesos", "Arrebato de tempestad"]) {
      const offered = names(name, { maxGrade: 5 });
      // «Finalizador de combo» exige 5 de combo para usar la habilidad: vale, pero no arriba.
      expect(offered).toContain("Finalizador de combo II");
      expect(offered.slice(0, 10)).not.toContain("Finalizador de combo II");
      expect(offered.slice(0, 10)).not.toContain("Culminación II");
    }
  });

  it("una asistencia de lanza no va a una ballesta ni a un efecto que no ataca", () => {
    expect(names("Esquirlas de hielo", { maxGrade: 5 })).not.toContain("Abrojos");
    expect(names("Rastro de abrojos", { maxGrade: 5 })).not.toContain("Abrojos");
  });
});

describe("supportCandidates — casos de la medición del 24-11-2026", () => {
  it("a una habilidad que no envenena ni hace sangrar no se le propone mejorar su veneno o su sangrado", () => {
    const bolt = names("Descarga de caos", { maxGrade: 5 });
    for (const wrong of ["Veneno intensificado", "Corrosion", "Veneno mortífero II", "Mixtura", "Padecimiento", "Plaga pustulosa"]) {
      expect(bolt, wrong).not.toContain(wrong);
    }
    const slam = names("Embate rodante", { maxGrade: 5 });
    for (const wrong of ["Cortes profundos II", "Elaboración de sustancias II", "Padecimiento"]) expect(slam, wrong).not.toContain(wrong);
    // La que da la probabilidad sigue valiendo, pero no entre las primeras.
    expect(names("Descarga de caos")).toContain("Veneno I");
    expect(names("Descarga de caos").slice(0, 3)).not.toContain("Veneno I");
  });

  it("si ya lleva la asistencia que envenena, las que mejoran el veneno vuelven a valer", () => {
    expect(names("Descarga de caos", { socketed: ["Veneno I"] })).toContain("Veneno intensificado");
    expect(names("Descarga de caos", { socketed: ["Lanzamiento rápido I"] })).not.toContain("Veneno intensificado");
  });

  it("un embate con mazo no recibe primero daño elemental ni lo que le quita el aturdimiento", () => {
    const top = names("Embate rodante").slice(0, 3);
    expect(top).not.toContain("Armamento elemental I");
    expect(top).not.toContain("Brío I");
    // Siguen entre las que valen.
    expect(names("Embate rodante")).toEqual(expect.arrayContaining(["Armamento elemental I", "Brío I"]));
  });
});
