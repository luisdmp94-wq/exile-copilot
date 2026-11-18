import { describe, expect, it } from "vitest";
import { parseReaderOutput } from "../../server/advice/screenshotReader";

const reply = (value: unknown) => JSON.stringify(value);

describe("lectura de capturas: un dato raro no tira toda la lectura", () => {
  it("lee una hoja normal", () => {
    const read = parseReaderOutput(
      reply({ screen: "character", sheet: { level: 45, className: "Liche", life: 1200, fire: 30, cold: -12, lightning: 75 }, skills: [] }),
    );
    expect(read.screen).toBe("character");
    expect(read.sheet).toMatchObject({ level: 45, className: "Liche", life: 1200, fire: 30, cold: -12, lightning: 75, chaos: null });
  });

  it("acepta números que la IA devuelve como texto", () => {
    const read = parseReaderOutput(
      reply({ screen: "character", sheet: { level: "45", fire: "30%", cold: " -12 % ", lightning: "+75", life: "1200" }, skills: [] }),
    );
    expect(read.sheet).toMatchObject({ level: 45, fire: 30, cold: -12, lightning: 75, life: 1200 });
  });

  it("un número fuera de rango o ilegible se queda vacío y el resto se conserva", () => {
    const read = parseReaderOutput(
      reply({
        screen: "character",
        sheet: { level: 45, fire: 135, cold: "135 (75)", lightning: 40, life: 0, mana: 12.5, spirit: "mucho", className: 7 },
        skills: [],
      }),
    );
    expect(read.sheet).toMatchObject({
      level: 45,
      lightning: 40,
      fire: null,
      cold: null,
      life: null,
      mana: null,
      spirit: null,
      className: null,
    });
  });

  it("una habilidad mal leída se salta sin perder las demás", () => {
    const read = parseReaderOutput(
      reply({
        screen: "skills",
        sheet: null,
        skills: [{ name: "CONTAGIO", level: "12" }, { name: "", level: 3 }, { level: 5 }, "Drenar esencia", { name: "Drenar esencia", level: 99 }],
      }),
    );
    expect(read.skills).toEqual([
      { name: "Contagio", level: 12 },
      { name: "Drenar esencia", level: null },
    ]);
  });

  it("nunca devuelve más de 24 habilidades", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ name: `Habilidad ${index + 1}`, level: 1 }));
    expect(parseReaderOutput(reply({ screen: "skills", sheet: null, skills: many })).skills).toHaveLength(24);
  });

  it("una pantalla o una hoja con forma rara cuentan como «no reconocida»", () => {
    const read = parseReaderOutput(reply({ screen: "inventory", sheet: "nada", skills: "ninguna" }));
    expect(read).toEqual({ screen: "other", sheet: null, skills: [] });
  });

  it("quita el envoltorio ```json y sigue fallando si no hay JSON", () => {
    expect(parseReaderOutput('```json\n{"screen":"other","sheet":null,"skills":[]}\n```').screen).toBe("other");
    expect(() => parseReaderOutput("No veo ninguna captura.")).toThrow();
  });
});
