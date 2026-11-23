import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ClientLogTail, parseLine, type LogEvent } from "../../overlay/src/clientLog";
import {
  GUIDES,
  START,
  actOfCode,
  enterZone,
  moveStep,
  positionIn,
  routeOf,
  sanitize,
  skippedInFastRoute,
  stepsForCode,
  type Progress,
} from "../../overlay/src/progress";
import {
  NEW_RUN,
  levelState,
  missedRewards,
  onArea,
  onDismissNotice,
  onLevel,
  onBoss,
  onMove,
  onReward,
  onToggleBoss,
  onToggleReward,
  sanitizeRun,
  viewOf,
  type Run,
} from "../../overlay/src/run";
import { isGameExecutable, shouldBeVisible, type VisibilityInput } from "../../overlay/src/foreground";
import { BOSS_SIGNS, REWARD_RULES, bossSignOf, cleanSpeech, rewardKindOf } from "../../overlay/src/objectives";
import { keepInside } from "../../overlay/src/place";
import { DEFAULT_SETTINGS, sanitizeSettings } from "../../overlay/src/settings";
import { ZONE_CODES } from "../../overlay/src/zones";

// Líneas con el formato del Client.txt real (22-11-2026), sin datos de la cuenta.
const AREA_LINE = '2026/11/22 20:37:15 35998734 2caa22f9 [DEBUG Client 23036] Generating level 48 area "G4_5_1" with seed 1783999174';
const SCENE_LINE = "2026/11/22 20:37:16 35998921 7fbd1225 [INFO Client 23036] [SCENE] Set Source [Prisión abandonada]";
const LEVEL_LINE = "2026/11/22 20:39:35 36137968 3ef23348 [INFO Client 23036] : Exiliada (Liche) es ahora nivel 51";
const LEVEL_LINE_EN = "2026/08/03 14:47:03 444940046 3ef231e0 [INFO Client 70644] : Exiliada (Mercenary) is now level 2";
const area = (level: number, code: string) =>
  `2026/11/23 10:00:00 1 2caa22f9 [DEBUG Client 1] Generating level ${level} area "${code}" with seed 1`;

/** Recorre zonas como si el juego las escribiera, con su nivel. */
const play = (codes: Array<string | [string, number]>, from: Run = NEW_RUN) =>
  codes.reduce<Run>((run, item) => (Array.isArray(item) ? onArea(run, item[0], item[1]) : onArea(run, item, 10)), from);

describe("ventanita: leer Client.txt", () => {
  it("saca la zona con su nivel y la subida de nivel; ignora lo demás", () => {
    expect(parseLine(AREA_LINE)).toEqual({ kind: "area", level: 48, code: "G4_5_1" });
    expect(parseLine(LEVEL_LINE)).toEqual({ kind: "level", level: 51 });
    expect(parseLine(LEVEL_LINE_EN)).toEqual({ kind: "level", level: 2 });
    expect(parseLine(SCENE_LINE)).toBeNull();
    expect(parseLine("[INFO Client 1] : Exiliada ha muerto.")).toBeNull();
    expect(parseLine("[INFO Client 1] Balbala: Libérame… te lo ruego…")).toBeNull();
  });

  const dir = mkdtempSync(join(tmpdir(), "ventanita-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("repasa todo al arrancar, luego solo lo nuevo, y aguanta líneas a medias", () => {
    const path = join(dir, "Client.txt");
    writeFileSync(path, `${area(1, "G1_1")}\n${LEVEL_LINE}\n${area(15, "G1_town")}\n`);
    const seen: Array<[LogEvent, boolean]> = [];
    const tail = new ClientLogTail(path, (event, replaying) => seen.push([event, replaying]), 60_000);
    tail.start(null);
    tail.stop();
    expect(seen.map(([event, replaying]) => [event.kind, replaying])).toEqual([
      ["area", true],
      ["level", true],
      ["area", true],
    ]);

    const line = area(3, "G1_2");
    appendFileSync(path, line.slice(0, 40));
    tail.poll();
    expect(seen).toHaveLength(3);
    const before = tail.offset;
    appendFileSync(path, `${line.slice(40)}\r\n`);
    tail.poll();
    expect(seen[3]).toEqual([{ kind: "area", level: 3, code: "G1_2" }, false]);
    expect(tail.offset).toBeGreaterThan(before);

    // Si el archivo se vacía, empieza de nuevo sin perder la siguiente zona.
    writeFileSync(path, `${area(4, "G1_3")}\n`);
    tail.poll();
    expect(seen[4]).toEqual([{ kind: "area", level: 4, code: "G1_3" }, false]);
  });

  it("al volver sigue donde lo dejó: no repite lo ya leído", () => {
    const path = join(dir, "Client2.txt");
    writeFileSync(path, `${area(1, "G1_1")}\n${area(3, "G1_2")}\n`);
    const first = new ClientLogTail(path, () => undefined, 60_000);
    first.start(null);
    first.stop();
    appendFileSync(path, `${area(5, "G1_3")}\n`);
    const seen: LogEvent[] = [];
    const second = new ClientLogTail(path, (event) => seen.push(event), 60_000);
    second.start(first.offset);
    second.stop();
    expect(seen).toEqual([{ kind: "area", level: 5, code: "G1_3" }]);
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

  it("cada paso clave dice en dos o tres palabras qué da", () => {
    for (const guide of GUIDES) {
      for (const step of guide.route ?? []) if (step.priority === "clave") expect(step.reward, step.zone).toBeTruthy();
    }
  });
});

describe("ventanita: qué paso enseñar", () => {
  const walk = (codes: string[], from: Progress = START) => codes.reduce(enterZone, from);

  it("Ngakanu en paz es el paso de la aleta (Kaimana), no el jefe final", () => {
    const zoneOf = (progress: Progress) => routeOf(progress.act)[progress.index]!.zone;
    // Con la aleta del gran blanco vas a Ngakanu antes de que la historia te lleve.
    expect(zoneOf(walk(["G4_town", "G4_3_1", "G4_3_2", "G4_town", "G4_11_1a"]))).toBe("Isla Whakapanu");
    // También si ya ibas más adelante por otras islas.
    expect(zoneOf(walk(["G4_town", "G4_4_2", "G4_town", "G4_11_1a"]))).toBe("Isla Whakapanu");
    // Ngakanu atacada, tras La excavación, sí es el final.
    expect(zoneOf(walk(["G4_town", "G4_10", "G4_11_1b"]))).toBe("Ngakanu y El corazón de la tribu");
    expect(zoneOf(walk(["G4_town", "G4_10", "G4_11_1b", "G4_11_2"]))).toBe("Ngakanu y El corazón de la tribu");
  });

  it("sigue el acto 1 zona a zona y el pueblo no mueve la guía", () => {
    let progress = walk(["G1_1", "G1_town", "G1_2"]);
    expect(routeOf(1)[progress.index]!.zone).toBe("Sierraclara");
    progress = walk(["G1_town", "G1_3"], progress);
    expect(routeOf(1)[progress.index]!.zone).toBe("Lodazal");
    expect(routeOf(1)[walk(["G1_8"], progress).index]!.zone).toBe("Cementerio de los eternos");
  });

  it("cambia de acto al entrar en una zona de otro acto, aunque sea el pueblo", () => {
    expect(walk(["G1_15", "G2_town"])).toEqual({ act: 2, index: 0, outside: false });
  });

  it("una zona que sale en dos pasos elige el que aún no ha pasado", () => {
    const toBay = walk(["G4_town", "G4_2_2"]);
    expect(routeOf(4)[toBay.index]!.zone).toBe("Bahía de las anclas y El final del viaje");
    expect(routeOf(4)[walk(["G4_1_1", "G4_2_2"], toBay).index]!.zone).toBe("El final del viaje");
    expect(stepsForCode(4, "G4_3_1")).toEqual([5, 6]);
  });

  it("volver a una zona anterior enseña su paso (las islas del acto 4 van en cualquier orden)", () => {
    const prison = walk(["G4_town", "G4_5_1"]);
    expect(routeOf(4)[walk(["G4_1_1"], prison).index]!.zone).toBe("Isla del clan y Madrigueras volcánicas");
  });

  it("fuera de los actos 1-4 avisa sin perder el paso", () => {
    const before = walk(["G4_10"]);
    expect(walk(["P1_3"], before)).toEqual({ ...before, outside: true });
    expect(walk(["G4_town"], walk(["P1_3"], before)).outside).toBe(false);
  });

  it("Re Pág y Av Pág pasan de paso y de acto", () => {
    expect(moveStep(START, -1)).toEqual(START);
    const lastOfOne = { act: 1, index: routeOf(1).length - 1, outside: false };
    expect(moveStep(lastOfOne, 1)).toEqual({ act: 2, index: 0, outside: false });
    expect(moveStep({ act: 2, index: 0, outside: false }, -1)).toEqual(lastOfOne);
    const lastOfFour = { act: 4, index: routeOf(4).length - 1, outside: false };
    expect(moveStep(lastOfFour, 1)).toEqual(lastOfFour);
  });

  it("un estado guardado raro vuelve al principio", () => {
    expect(sanitize({ act: 2, index: 3 })).toEqual({ act: 2, index: 3, outside: false });
    expect(sanitize({ act: 9, index: 0 })).toEqual(START);
    expect(sanitize("basura")).toEqual(START);
  });
});

describe("ventanita: ruta rápida", () => {
  it("se salta solo lo opcional que no da nada para siempre", () => {
    const skipped = GUIDES.flatMap((guide) => (guide.route ?? []).filter(skippedInFastRoute).map((step) => step.zone));
    expect(skipped).toEqual(["Lodazal", "La cámara fundida", "Punta del botín"]);
  });

  it("Av Pág salta Lodazal en la rápida y no en la completa", () => {
    const clearfell = { act: 1, index: 1, outside: false };
    expect(routeOf(1)[moveStep(clearfell, 1, "rapida").index]!.zone).toBe("El bosque singular");
    expect(routeOf(1)[moveStep(clearfell, 1, "completa").index]!.zone).toBe("Lodazal");
    expect(positionIn(clearfell, "rapida")).toEqual({ number: 2, total: routeOf(1).length - 1 });
  });

  it("si entras igualmente en Lodazal, lo enseña y avisa de que esa ruta no lo hace", () => {
    const view = viewOf(play(["G1_1", "G1_2", "G1_3"]), "rapida");
    expect(view).toMatchObject({ zone: "Lodazal", offRoute: true });
    expect(view.next?.zone).toBe("El bosque singular");
  });

  it("dice qué jefe opcional tiene la zona y qué gemas fijas da", () => {
    const grelwood = viewOf(play(["G1_1", "G1_2", "G1_4"]), "completa");
    expect(grelwood.skip).toBe("el Horror de espinas");
    expect(grelwood.gems).toEqual(routeOf(1)[3]!.gems);
    const redVale = viewOf(play(["G1_1", "G1_2", "G1_4", "G1_5"]), "completa");
    expect(redVale).toMatchObject({ skip: null, gems: [] });
  });

  it("«Luego» dice la zona siguiente y su recompensa para siempre, si la tiene", () => {
    expect(viewOf(play(["G1_1"]), "completa").next).toEqual({ zone: "Sierraclara", reward: "+10 % de hielo" });
    expect(viewOf(play(["G1_1", "G1_2"]), "completa").next).toEqual({ zone: "Lodazal", reward: null });
  });
});

describe("ventanita: recompensas y lo que te dejas", () => {
  it("Fin marca y desmarca la recompensa del paso, solo si la tiene", () => {
    const clearfell = play(["G1_1", "G1_2"]);
    expect(viewOf(clearfell, "completa").reward).toEqual({ text: "+10 % de hielo", checked: false, auto: true });
    const marked = onToggleReward(clearfell);
    expect(viewOf(marked, "completa").reward?.checked).toBe(true);
    expect(viewOf(onToggleReward(marked), "completa").reward?.checked).toBe(false);
    const riverbank = play(["G1_1"]);
    expect(onToggleReward(riverbank)).toBe(riverbank);
  });

  // Acto 1 entero por el camino obligatorio, sin Villafrey (opcional, +30 de espíritu).
  const ACT_ONE_STORY = ["G1_1", "G1_2", "G1_4", "G1_5", "G1_6", "G1_7", "G1_8", "G1_9", "G1_11", "G1_13_1", "G1_13_2", "G1_14", "G1_15"];

  it("al pasar al acto 2 avisa de la zona clave que no pisaste", () => {
    const run = play([...ACT_ONE_STORY, "G2_town"]);
    expect(run.leftBehind).toEqual({
      act: 1,
      items: [{ zone: "Villafrey", reward: "+30 de espíritu" }],
      zonesLeft: 3,
    });
    expect(viewOf(run, "completa").leftBehind?.items).toHaveLength(1);
  });

  it("no avisa si la pisaste o la marcaste como cogida", () => {
    expect(play([...ACT_ONE_STORY.slice(0, 9), "G1_12", ...ACT_ONE_STORY.slice(9), "G2_town"]).leftBehind).toBeNull();
    const atFreythornStep = onMove(play(ACT_ONE_STORY.slice(0, 9)), 1, "completa");
    expect(routeOf(1)[atFreythornStep.progress.index]!.zone).toBe("Villafrey");
    const marked = onToggleReward(atFreythornStep);
    expect(missedRewards(marked, 1).map((item) => item.zone)).not.toContain("Villafrey");
    expect(missedRewards(atFreythornStep, 1).map((item) => item.zone)).toContain("Villafrey");
  });

  it("el aviso se va solo tras tres zonas, o con el resumen", () => {
    const warned = play([...ACT_ONE_STORY, "G2_town"]);
    expect(onDismissNotice(warned).leftBehind).toBeNull();
    expect(play(["G2_1", "G2_town"], warned).leftBehind?.zonesLeft).toBe(1);
    expect(play(["G2_1", "G2_town", "G2_10_1"], warned).leftBehind).toBeNull();
  });

  it("al salir del acto 4 a los interludios mira lo que quedó del acto 4", () => {
    const actFour = play(["G4_town", "G4_2_1", "G4_2_2", "G4_1_1", "G4_5_1", "G4_3_1", "G4_7", "G4_8a", "G4_10", "G4_11_2"]);
    const interlude = play(["P1_1"], actFour);
    const zones = interlude.leftBehind?.items.map((item) => item.zone);
    expect(zones).toEqual(["El ojo de Hinekora", "Salones de los muertos", "La prueba de los ancestros"]);
  });

  it("el resumen del acto distingue cogida, pisada, dejada y pendiente", () => {
    const run = onToggleReward(play(["G1_1", "G1_2"]));
    const rows = viewOf(play(["G1_11", "G1_13_1"], run), "completa").rewards;
    expect(rows.find((row) => row.zone === "Sierraclara")?.state).toBe("cogida");
    expect(rows.find((row) => row.zone === "Terrenos de caza")?.state).toBe("pisada");
    // Villafrey quedó atrás sin pisar; la Mansión aún está por llegar.
    expect(rows.find((row) => row.zone === "Villafrey")).toMatchObject({ state: "dejada", optional: true });
    expect(rows.find((row) => row.zone === "Mansión de Ogham")?.state).toBe("pendiente");
  });

  it("un personaje nuevo en la orilla del río empieza la partida de cero", () => {
    const old = onToggleReward(play([...ACT_ONE_STORY, ["G3_12", 40]]));
    const fresh = play(["G1_1"], old);
    expect(fresh).toMatchObject({ progress: START, visited: ["G1_1"], checked: [], charLevel: null });
  });
});

describe("ventanita: tu nivel contra el de la zona", () => {
  it("avisa a partir de 3 niveles por debajo, y mucho a partir de 6", () => {
    expect(levelState(10, 10)).toBe("ok");
    expect(levelState(10, 8)).toBe("ok");
    expect(levelState(10, 7)).toBe("bajo");
    expect(levelState(10, 4)).toBe("muy-bajo");
    expect(levelState(null, 4)).toBeNull();
    expect(levelState(10, null)).toBeNull();
    // Tan lejos, casi seguro es otro personaje: no se avisa.
    expect(levelState(49, 30)).toBeNull();
  });

  it("el nivel de la zona sale del registro; el de los pueblos no cuenta", () => {
    const run = onLevel(play([["G1_1", 1], ["G1_2", 3], ["G1_town", 15]]), 2);
    expect(viewOf(run, "completa")).toMatchObject({ areaLevel: 3, charLevel: 2, level: "ok" });
    expect(viewOf(onLevel(play([["G2_6", 26]], run), 20), "completa").level).toBe("muy-bajo");
  });
});

describe("ventanita: estado guardado", () => {
  it("una partida o unos ajustes raros no rompen nada", () => {
    expect(sanitizeRun(null)).toEqual(NEW_RUN);
    expect(sanitizeRun({ progress: { act: 1, index: 1 }, visited: ["G1_1", 3], checked: "x", charLevel: 900 })).toEqual({
      ...NEW_RUN,
      progress: { act: 1, index: 1, outside: false },
      visited: ["G1_1"],
    });
    expect(sanitizeSettings({ route: "rapida", size: "enorme", compact: "sí" })).toEqual({ ...DEFAULT_SETTINGS, route: "rapida" });
  });

  it("los textos son los de la guía, sin tocar", () => {
    expect(viewOf(play(["G1_1", "G1_2"]), "completa").text).toBe(routeOf(1)[1]!.text);
  });
});

describe("ventanita: solo con PoE2 delante", () => {
  it("reconoce los ejecutables de PoE2 de Steam y del cliente independiente", () => {
    expect(isGameExecutable(String.raw`C:\Program Files (x86)\Steam\steamapps\common\Path of Exile 2\PathOfExileSteam.exe`)).toBe(true);
    expect(isGameExecutable("D:/Juegos/PathOfExile_x64Steam.exe")).toBe(true);
    expect(isGameExecutable("C:/GGG/Path of Exile 2/PathOfExile.exe")).toBe(true);
    expect(isGameExecutable("C:/Windows/notepad.exe")).toBe(false);
    expect(isGameExecutable("C:/Windows/notepad.exe", "Notepad.exe")).toBe(true);
    expect(isGameExecutable(null)).toBe(false);
  });

  const base: VisibilityInput = {
    userHidden: false,
    onlyWithGame: true,
    dragging: false,
    starting: false,
    foreground: "C:/Steam/PathOfExileSteam.exe",
    ownExecutable: "C:/ventanita/electron.exe",
  };

  it("se ve con el juego delante y se esconde al cambiar de ventana", () => {
    expect(shouldBeVisible(base)).toBe(true);
    expect(shouldBeVisible({ ...base, foreground: "C:/Program Files/Google/Chrome/chrome.exe" })).toBe(false);
    expect(shouldBeVisible({ ...base, foreground: null })).toBe(false);
  });

  it("sigue viéndose mientras se arrastra, al tocar el asa y en el arranque", () => {
    const away = { ...base, foreground: "C:/x/discord.exe" };
    expect(shouldBeVisible({ ...away, dragging: true })).toBe(true);
    expect(shouldBeVisible({ ...away, starting: true })).toBe(true);
    expect(shouldBeVisible({ ...base, foreground: "c:/VENTANITA/Electron.exe" })).toBe(true);
  });

  it("ocultarla desde la bandeja manda; sin el ajuste o sin poder saberlo, siempre visible", () => {
    expect(shouldBeVisible({ ...base, userHidden: true })).toBe(false);
    expect(shouldBeVisible({ ...base, onlyWithGame: false, foreground: "C:/x/chrome.exe" })).toBe(true);
    expect(shouldBeVisible({ ...base, foreground: undefined })).toBe(true);
  });

  it("el ajuste viene activado y se puede quitar", () => {
    expect(DEFAULT_SETTINGS.onlyWithGame).toBe(true);
    expect(sanitizeSettings({ onlyWithGame: false }).onlyWithGame).toBe(false);
    expect(sanitizeSettings({}).onlyWithGame).toBe(true);
  });
});

describe("ventanita: siempre dentro de la pantalla", () => {
  const screen = { x: 0, y: 0, width: 1536, height: 960 };
  const box = { width: 340, height: 120 };

  it("dentro de la pantalla se queda donde la dejaste", () => {
    expect(keepInside({ x: 1100, y: 260, ...box }, screen)).toEqual({ x: 1100, y: 260 });
  });

  it("si se sale por un borde, vuelve entera", () => {
    expect(keepInside({ x: 1400, y: 900, ...box }, screen)).toEqual({ x: 1196, y: 840 });
    expect(keepInside({ x: -80, y: -15, ...box }, screen)).toEqual({ x: 0, y: 0 });
  });

  it("en una segunda pantalla a la izquierda respeta sus bordes", () => {
    const left = { x: -1920, y: 0, width: 1920, height: 1080 };
    expect(keepInside({ x: -2000, y: 1000, ...box }, left)).toEqual({ x: -1920, y: 960 });
  });

  it("si no cabe, manda la esquina del asa", () => {
    expect(keepInside({ x: 50, y: 50, width: 400, height: 300 }, { x: 0, y: 0, width: 300, height: 200 })).toEqual({ x: 0, y: 0 });
  });
});

// Líneas con el formato del Client.txt real (23-11-2026), con el nombre del personaje cambiado.
const info = (text: string) => `2026/11/23 21:06:17 1 3ef23348 [INFO Client 25188] ${text}`;
const MARKS = "<<set:F>><<set:S>><<set:FS>>";

describe("ventanita: objetivos que se marcan solos", () => {
  it("lee el mensaje de una recompensa para siempre, en español y en inglés", () => {
    const kind = (text: string) => parseLine(info(text));
    expect(kind(": Exiliada ha recibido +10% a la resistencia al [Resistances|hielo].")).toEqual({ kind: "reward", reward: "hielo" });
    expect(kind(": Exiliados han recibido +30 al [Spirit|espíritu].")).toEqual({ kind: "reward", reward: "espiritu" });
    expect(kind(": Has recibido 2 puntos de habilidad pasiva de set de armas.")).toEqual({ kind: "reward", reward: "puntos" });
    expect(kind(": You have received +10% to [Resistances|Cold Resistance].")).toEqual({ kind: "reward", reward: "hielo" });
    expect(kind(": You have received 2 Weapon Set Passive Skill Points.")).toEqual({ kind: "reward", reward: "puntos" });
    expect(kind(": Exiliada ha recibido +20 a la vida máxima.")).toEqual({ kind: "reward", reward: "vida" });
    expect(kind(": Exiliada ha recibido Maná máximo aumentado un 5%.")).toEqual({ kind: "reward", reward: "mana" });
    expect(kind(": Exiliada ha recibido +1 espacio para [Charm|viales].")).toEqual({ kind: "reward", reward: "otra" });
  });

  it("no cuenta dos veces los puntos ni lo de fuera de la campaña", () => {
    expect(parseLine(info(": Has recibido 2 puntos de habilidades pasivas."))).toBeNull();
    expect(parseLine(info(": You have received 2 Passive Skill Points."))).toBeNull();
    expect(parseLine(info(": Has recibido 2 puntos de habilidad del atlas de expedición."))).toBeNull();
    expect(rewardKindOf("un punto de habilidad de anillos del árbol del génesis.")).toBeNull();
  });

  it("reconoce la frase de un jefe al caer, con marcas o sin ellas", () => {
    const villafrey = { kind: "boss", act: 1, zone: "Villafrey" };
    expect(parseLine(info(`El rey de las nieblas: ${MARKS}Nos volveremos a encontrar...`))).toEqual(villafrey);
    expect(parseLine(info("El rey de las nieblas: Nos volveremos a encontrar..."))).toEqual(villafrey);
    expect(parseLine(info(`Lachlann del lamento eterno: ${MARKS}Juntos… al fin…`))).toMatchObject({ zone: "Cementerio de los eternos" });
    const yama = `Yama el Blanco: ${MARKS}<if:MS>{¡Ahhh! Bien, bien. Yama puede verte. Eres digno.}<elif:FS>{¡Ahhh! Bien, bien. Yama puede verte. Eres digna.}`;
    expect(parseLine(info(yama))).toMatchObject({ act: 4, zone: "Salones de los muertos" });
    expect(parseLine(info("Yama el Blanco: ¡Ahhh! Bien, bien. Yama puede verte. Eres digna."))).toMatchObject({ act: 4 });
  });

  it("no se fía de otro que diga lo mismo, ni de los gritos del combate, ni del chat", () => {
    // Otros jefes repiten las frases de estos: solo vale si lo dice el de verdad.
    expect(parseLine(info(`Connal, el Atormentado: ${MARKS}Juntos… al fin…`))).toBeNull();
    expect(parseLine(info(`Malgor, el Señor náutico: ${MARKS}No... creas sus mentiras...`))).toBeNull();
    expect(parseLine(info(`El rey de las nieblas: ${MARKS}¡Prisión de espinas!`))).toBeNull();
    expect(parseLine(info("#Alguien: Nos volveremos a encontrar..."))).toBeNull();
    expect(parseLine(info("@De Alguien: El rey de las nieblas: Nos volveremos a encontrar..."))).toBeNull();
    expect(bossSignOf("Mortimer", "¡Tú, allí! ¡Por favor, ayúdanos!")).toBeNull();
  });

  it("quita las marcas del juego de una frase", () => {
    expect(cleanSpeech(`${MARKS}¡Debo hacer que <i>{sufran}!`)).toBe("¡Debo hacer que sufran!");
    expect(cleanSpeech("<if:MS>{¡Usurpador!}<elif:FS>{¡Usurpadora!}")).toBe("¡Usurpador!");
  });

  it("las tablas hablan de pasos que existen y de zonas de su acto", () => {
    for (const guide of GUIDES) {
      const steps = new Map((guide.route ?? []).map((step) => [step.zone, step]));
      for (const [zone, rule] of Object.entries(REWARD_RULES[guide.act] ?? {})) {
        expect(steps.get(zone)?.reward, zone).toBeTruthy();
        for (const code of [...(rule.where ?? []), ...(rule.anyIn ?? [])]) expect(actOfCode(code), code).toBe(guide.act);
      }
      for (const [zone, sign] of Object.entries(BOSS_SIGNS[guide.act] ?? {})) {
        expect(steps.has(zone), zone).toBe(true);
        expect(sign.lines.length).toBeGreaterThan(0);
        for (const [who, text] of sign.lines) {
          expect(cleanSpeech(text)).toBe(text);
          expect(bossSignOf(who, text)).toEqual({ act: guide.act, zone });
        }
      }
    }
  });

  it("toda recompensa para siempre se marca sola, menos las dos ascendencias", () => {
    const byHand = GUIDES.flatMap((guide) =>
      (guide.route ?? []).filter((step) => step.reward && !REWARD_RULES[guide.act]?.[step.zone]).map((step) => step.zone),
    );
    expect(byHand).toEqual(["Prueba de las sekhemas", "Prueba de Caos"]);
  });

  it("marca la recompensa del paso al recibirla, y solo una vez", () => {
    const clearfell = onReward(play(["G1_1", "G1_2"]), "hielo");
    expect(viewOf(clearfell, "completa")).toMatchObject({ reward: { checked: true, auto: true }, boss: null, ready: true });
    expect(onReward(clearfell, "hielo")).toBe(clearfell);
    // Una recompensa que no es de este paso no lo marca.
    expect(onReward(play(["G1_1", "G1_2"]), "fuego").checked).toEqual([]);
  });

  it("con dos libros de puntos en el acto, marca el de donde estás", () => {
    const hunting = play(["G1_1", "G1_2", "G1_11", "G1_13_1", "G1_town"]);
    // En el pueblo: el libro de Una (Tierras de cultivo), no el del cuervo.
    const lute = onReward(hunting, "puntos");
    expect(lute.checked).toEqual(["1:9"]);
    // El otro libro, usado más tarde también en el pueblo, marca el que queda.
    expect(onReward(lute, "puntos").checked).toEqual(["1:9", "1:7"]);
    // En Terrenos de caza, el del cuervo.
    expect(onReward(play(["G1_1", "G1_11"]), "puntos").checked).toEqual(["1:7"]);
  });

  it("si la recompensa se elige entre varias, vale cualquiera recibida en su zona", () => {
    const titans = play(["G2_1", "G2_6"]);
    expect(onReward(titans, "otra").checked).toEqual(["2:8"]);
    // Los puntos nunca cuentan como «cualquiera»: son de un libro, y marcan el primer libro del acto.
    expect(onReward(titans, "puntos").checked).toEqual(["2:5"]);
    // Los tres tatuajes de Salones de los muertos: el primero marca, los otros no repiten.
    const halls = onReward(onReward(play(["G4_town", "G4_4_2"]), "hielo"), "fuego");
    expect(halls.checked).toEqual(["4:8"]);
  });

  it("fuera de los actos 1-4 no marca nada", () => {
    const interlude = play(["G4_10", "P3_2"]);
    expect(onReward(interlude, "espiritu")).toBe(interlude);
    expect(onReward(NEW_RUN, "hielo")).toBe(NEW_RUN);
  });

  it("da por muerto al jefe solo si estás en su zona", () => {
    const freythorn = play(["G1_1", "G1_12"]);
    expect(viewOf(freythorn, "completa")).toMatchObject({ boss: { name: "el rey de las nieblas", dead: false }, ready: false });
    const dead = onBoss(freythorn, 1, "Villafrey");
    expect(viewOf(dead, "completa")).toMatchObject({ boss: { dead: true }, ready: false });
    // Con el jefe muerto y el espíritu recibido, la zona está hecha.
    expect(viewOf(onReward(dead, "espiritu"), "completa").ready).toBe(true);
    const elsewhere = play(["G1_1", "G1_2"]);
    expect(onBoss(elsewhere, 1, "Villafrey")).toBe(elsewhere);
  });

  it("una zona sin nada que comprobar no dice ni que sí ni que no", () => {
    expect(viewOf(play(["G1_1", "G1_2", "G1_4", "G1_5"]), "completa")).toMatchObject({ reward: null, boss: null, ready: null });
  });

  it("el jefe también se puede marcar a mano, solo donde hay jefe que marcar", () => {
    const riverbank = play(["G1_1"]);
    const byHand = onToggleBoss(riverbank);
    expect(viewOf(byHand, "completa")).toMatchObject({ boss: { dead: true }, ready: true });
    expect(onToggleBoss(byHand).bosses).toEqual([]);
    const redVale = play(["G1_1", "G1_2", "G1_4", "G1_5"]);
    expect(onToggleBoss(redVale)).toBe(redVale);
  });

  it("un personaje nuevo empieza sin nada marcado", () => {
    const old = onBoss(onReward(play(["G1_1", "G1_12"]), "espiritu"), 1, "Villafrey");
    const fresh = play(["G2_1", "G1_1"], old);
    expect(fresh).toMatchObject({ checked: [], bosses: [], area: "G1_1" });
  });
});
