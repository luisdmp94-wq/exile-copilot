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
