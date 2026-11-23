import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ClientLogTail, lastAreaIn, parseAreaLine, type AreaChange } from "../../overlay/src/clientLog";
import {
  GUIDES,
  START,
  actOfCode,
  enterZone,
  moveStep,
  sanitize,
  stepsForCode,
  viewOf,
  type Progress,
} from "../../overlay/src/progress";
import { ZONE_CODES } from "../../overlay/src/zones";

// Líneas copiadas del Client.txt real (22-11-2026), sin datos de la cuenta.
const AREA_LINE = '2026/11/22 20:37:15 35998734 2caa22f9 [DEBUG Client 23036] Generating level 48 area "G4_5_1" with seed 1783999174';
const SCENE_LINE = "2026/11/22 20:37:16 35998921 7fbd1225 [INFO Client 23036] [SCENE] Set Source [Prisión abandonada]";
const area = (level: number, code: string) =>
  `2026/11/23 10:00:00 1 2caa22f9 [DEBUG Client 1] Generating level ${level} area "${code}" with seed 1`;

describe("ventanita: leer la zona de Client.txt", () => {
  it("saca el código y el nivel de la línea de cambio de zona", () => {
    expect(parseAreaLine(AREA_LINE)).toEqual({ level: 48, code: "G4_5_1" });
    expect(parseAreaLine(SCENE_LINE)).toBeNull();
    expect(parseAreaLine("[INFO Client 1] : Tú: hola")).toBeNull();
  });

  it("encuentra la última zona en un trozo del registro", () => {
    expect(lastAreaIn([area(1, "G1_1"), SCENE_LINE, area(3, "G1_2"), "otra cosa"].join("\r\n"))).toEqual({
      level: 3,
      code: "G1_2",
    });
    expect(lastAreaIn("nada")).toBeNull();
  });

  const dir = mkdtempSync(join(tmpdir(), "ventanita-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("sigue el archivo: zona al arrancar, solo lo nuevo después y aguanta líneas a medias", () => {
    const path = join(dir, "Client.txt");
    writeFileSync(path, `${area(1, "G1_1")}\n${area(2, "G1_town")}\n`);
    const seen: Array<[AreaChange, boolean]> = [];
    const tail = new ClientLogTail(path, (change, fromStartup) => seen.push([change, fromStartup]), 60_000);
    tail.start();
    tail.stop();
    expect(seen).toEqual([[{ level: 2, code: "G1_town" }, true]]);

    // El juego escribe la línea en dos veces.
    const line = area(3, "G1_2");
    appendFileSync(path, line.slice(0, 40));
    tail.poll();
    expect(seen).toHaveLength(1);
    appendFileSync(path, `${line.slice(40)}\r\n${SCENE_LINE}\r\n`);
    tail.poll();
    expect(seen[1]).toEqual([{ level: 3, code: "G1_2" }, false]);

    // Si el archivo se vacía, empieza de nuevo sin perder la siguiente zona.
    writeFileSync(path, `${area(4, "G1_3")}\n`);
    tail.poll();
    expect(seen[2]).toEqual([{ level: 4, code: "G1_3" }, false]);
  });
});

describe("ventanita: tabla de zonas", () => {
  it("cada paso de las guías de los actos 1-4 tiene sus códigos, y no sobra ninguno", () => {
    for (const guide of GUIDES) {
      const zones = (guide.route ?? []).map((step) => step.zone);
      expect(Object.keys(ZONE_CODES[guide.act] ?? {}).sort()).toEqual([...new Set(zones)].sort());
      for (const zone of zones) expect(ZONE_CODES[guide.act]![zone]!.length).toBeGreaterThan(0);
    }
  });

  it("los códigos de cada acto son de ese acto", () => {
    for (const [act, table] of Object.entries(ZONE_CODES)) {
      for (const code of Object.values(table).flat()) expect(actOfCode(code)).toBe(Number(act));
    }
  });
});

describe("ventanita: qué paso enseñar", () => {
  const walk = (codes: string[], from: Progress = START) => codes.reduce(enterZone, from);

  it("sigue el acto 1 zona a zona y el pueblo no mueve la guía", () => {
    let progress = walk(["G1_1", "G1_town", "G1_2"]);
    expect(viewOf(progress)).toMatchObject({ act: 1, number: 2, zone: "Sierraclara", priority: "clave" });
    expect(viewOf(progress).next?.zone).toBe("Lodazal");
    progress = walk(["G1_town", "G1_3"], progress);
    expect(viewOf(progress).zone).toBe("Lodazal");
    // El mausoleo y la tumba son del paso del cementerio.
    expect(viewOf(walk(["G1_8"], progress)).zone).toBe("Cementerio de los eternos");
  });

  it("el último paso de un acto anuncia el primero del siguiente", () => {
    const progress = walk(["G1_15"]);
    expect(viewOf(progress)).toMatchObject({ zone: "Mansión de Ogham" });
    expect(viewOf(progress).next?.zone).toBe("Alrededores del Vastiri");
  });

  it("cambia de acto al entrar en una zona de otro acto, aunque sea el pueblo", () => {
    expect(walk(["G1_15", "G2_town"])).toEqual({ act: 2, index: 0, outside: false });
    expect(viewOf(walk(["G1_15", "G2_2"])).zone).toBe("El pasaje de la traidora");
  });

  it("una zona que sale en dos pasos elige el que aún no ha pasado", () => {
    const toBay = walk(["G4_town", "G4_2_2"]);
    expect(viewOf(toBay).zone).toBe("Bahía de las anclas y El final del viaje");
    const back = walk(["G4_1_1", "G4_2_2"], toBay);
    expect(viewOf(back).zone).toBe("El final del viaje");
    expect(stepsForCode(4, "G4_3_1")).toEqual([5, 6]);
  });

  it("volver a una zona anterior enseña su paso (las islas del acto 4 van en cualquier orden)", () => {
    const prison = walk(["G4_town", "G4_5_1"]);
    expect(viewOf(walk(["G4_1_1"], prison)).zone).toBe("Isla del clan y Madrigueras volcánicas");
  });

  it("un personaje nuevo en la orilla del río vuelve al acto 1", () => {
    expect(walk(["G3_12", "G1_1"])).toEqual({ act: 1, index: 0, outside: false });
  });

  it("C_G1_2 es la misma zona que G1_2", () => {
    expect(viewOf(walk(["C_G1_2"])).zone).toBe("Sierraclara");
  });

  it("fuera de los actos 1-4 avisa sin perder el paso", () => {
    const before = walk(["G4_10"]);
    const outside = walk(["P1_3"], before);
    expect(outside).toEqual({ ...before, outside: true });
    expect(walk(["MapUberBoss_Monolith"], before).outside).toBe(true);
    expect(walk(["G4_town"], outside).outside).toBe(false);
  });

  it("Re Pág y Av Pág pasan de paso y de acto", () => {
    expect(moveStep(START, -1)).toEqual(START);
    expect(moveStep(START, 1)).toEqual({ act: 1, index: 1, outside: false });
    const lastOfOne = { act: 1, index: (GUIDES[0]!.route ?? []).length - 1, outside: false };
    expect(moveStep(lastOfOne, 1)).toEqual({ act: 2, index: 0, outside: false });
    expect(moveStep({ act: 2, index: 0, outside: false }, -1)).toEqual(lastOfOne);
  });

  it("un estado guardado raro vuelve al principio", () => {
    expect(sanitize({ act: 2, index: 3 })).toEqual({ act: 2, index: 3, outside: false });
    expect(sanitize({ act: 9, index: 0 })).toEqual(START);
    expect(sanitize("basura")).toEqual(START);
    expect(sanitize(null)).toEqual(START);
  });

  it("los textos son los de la guía, sin tocar", () => {
    const step = GUIDES[0]!.route![1]!;
    expect(viewOf(walk(["G1_2"])).text).toBe(step.text);
  });
});
