import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
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

function names(skillName: string, options: { maxGrade?: number; attributes?: GemAttribute[]; socketed?: string[] } = {}) {
  const skill = findSkill(data, skillName);
  if (!skill) throw new Error(`No existe la habilidad ${skillName}`);
  return supportCandidates(data, {
    skill,
    maxGrade: options.maxGrade ?? 1,
    attributes: options.attributes ?? ALL,
    socketed: options.socketed,
  }).map((candidate) => candidate.support.name);
}

describe("datos de gemas", () => {
  it("trae habilidades y asistencias con nombre, grado y descripción", () => {
    expect(data.skills.length).toBeGreaterThan(150);
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
    expect(offeredTo("Atracón")).toEqual(["Descomposición", "Festín de carne", "Muertos volátiles", "Levantar zombi", "Ritual profano"]);
    expect(offeredTo("Mecha larga II")).toEqual(["Lanza explosiva", "Flechas de punta helada", "Crecimiento tóxico", "Bomba de escarcha"]);
    expect(offeredTo("Perfección")).toEqual(["Golpe perfecto", "Disparo certero"]);
    expect(offeredTo("Durabilidad")).toEqual(["Muro protector", "Campo de lanzas", "Muro de hielo"]);
  });

  it("las que miran etiquetas del juego las respetan: nova, condición, activación", () => {
    const tagged = (tag: string) => data.skills.filter((skill) => skill.tags.includes(tag)).map((skill) => skill.name);
    expect(offeredTo("Proyección astral")).toEqual(tagged("Nova"));
    expect(offeredTo("Gratificación demorada")).toEqual(tagged("Condicional"));
    expect(offeredTo("Condensador de energía")).toEqual(["Lanzahechizos"]);
    for (const name of offeredTo("Casualidad")) expect(tagged("Activación")).toContain(name);
  });

  it("las de cargas piden cargas de poder, frenesí o aguante, no «recarga»", () => {
    expect(offeredTo("Cargas potenciadas")).toContain("Tormenta de huesos");
    expect(offeredTo("Cargas potenciadas")).not.toContain("Contagio");
    expect(offeredTo("Cargas potenciadas").length).toBeLessThan(25);
    expect(offeredTo("Profusión de cargas II")).toContain("Robo de poder");
    expect(offeredTo("Profusión de cargas II").length).toBeLessThan(10);
  });

  it("lo que no se sabe por los datos no se propone: usar andando", () => {
    expect(offeredTo("Movilidad")).toEqual([]);
    expect(offeredTo("Deliberación")).toEqual([]);
  });

  it("«de escudo» es la que se usa con escudo, no la que crea uno ni la de escudo de energía", () => {
    expect(offeredTo("Vanguardia II")).toEqual(["Carga con escudo", "Barrera de magma", "Escudo resonante", "Muro protector", "Grito fortificador"]);
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
    expect(names("Contagio", { maxGrade: 5 })).toContain("Aflicción veloz III");
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
