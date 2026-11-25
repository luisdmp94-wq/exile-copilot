import { unseenSentence, type RewardRow, type StepView } from "./run";
import type { Settings } from "./settings";
import { stepLines, withoutBossName } from "./stepText";

interface OverlayState {
  view: StepView;
  settings: Settings;
  showSummary: boolean;
  showSettings: boolean;
  /** El personaje al que se le apunta la partida, si el registro ya lo ha nombrado. */
  character: string | null;
  problem: string | null;
  waitingForGame: boolean;
}

declare global {
  interface Window {
    ventanita: {
      onState: (callback: (state: OverlayState) => void) => void;
      reportSize: (height: number, width: number) => void;
      grip: (over: boolean) => void;
      drag: (phase: "inicio" | "fin") => void;
      action: (name: string, value?: string) => void;
    };
  }
}

const byId = (id: string) => document.getElementById(id)!;

/**
 * El texto del paso, una frase por línea: se lee de un vistazo en mitad de una
 * pelea. El tipo de daño del jefe va de su color. Con una sola frase no hay
 * nada que partir y se queda como siempre.
 */
function drawStepText(text: string): void {
  const lines = stepLines(text);
  const box = byId("ahora");
  box.classList.toggle("frases", lines.length > 1);
  box.replaceChildren(
    ...lines.map((pieces) => {
      const line = document.createElement("div");
      line.className = "frase";
      for (const piece of pieces) {
        if (!piece.element) {
          line.append(piece.text);
          continue;
        }
        const mark = document.createElement("span");
        mark.className = `dano ${piece.element}`;
        mark.textContent = piece.text;
        line.append(mark);
      }
      // Un espacio al final: en la vista compacta las frases van seguidas.
      line.append(" ");
      return line;
    }),
  );
}

function setText(id: string, text: string | null): void {
  const element = byId(id);
  element.textContent = text ?? "";
  element.hidden = !text;
}

const ROW_MARK: Record<RewardRow["state"], string> = { cogida: "✓", falta: "○", pisada: "?", dejada: "○", pendiente: "·" };
const ROW_NOTE: Record<RewardRow["state"], string> = {
  cogida: "",
  falta: "aún no la tienes",
  pisada: "",
  dejada: "te la dejaste",
  pendiente: "más adelante",
};

function rewardLine(state: RewardRow["state"], rewardText: string, where: string): HTMLLIElement {
  const item = document.createElement("li");
  item.className = state;
  const mark = document.createElement("span");
  mark.className = "marca";
  mark.textContent = ROW_MARK[state];
  const reward = document.createElement("span");
  reward.className = "premio";
  reward.textContent = rewardText;
  const zone = document.createElement("span");
  zone.className = "donde";
  zone.textContent = where;
  item.append(mark, reward, zone);
  return item;
}

/** «sáltate a el Horror» → «sáltate al Horror». */
function skipSentence(target: string): string {
  return target.startsWith("el ") ? `Ruta rápida: sáltate al ${target.slice(3)}.` : `Ruta rápida: sáltate a ${target}.`;
}

function line(mark: string, text: string, className = ""): HTMLLIElement {
  const item = document.createElement("li");
  item.className = className;
  const sign = document.createElement("span");
  sign.className = "marca";
  sign.textContent = mark;
  const body = document.createElement("span");
  body.textContent = text;
  item.append(sign, body);
  return item;
}

/** «Habilidad nv. 5: tras el verdugo» → «Gema de habilidad nv. 5: tras el verdugo». */
function gemSentence(gem: string): string {
  return /^(Habilidad|Asistencia|Espíritu)/.test(gem) ? `Gema de ${gem.charAt(0).toLowerCase()}${gem.slice(1)}` : `Gema: ${gem}`;
}

/** Lo que la zona da de más: sus gemas fijas y el jefe que te puedes saltar. */
function drawExtras(view: StepView, route: Settings["route"]): void {
  const gems = view.gems.map((gem) => line("◆", gemSentence(gem)));
  // En una zona que ya es opcional entera, repetir «opcional» para su jefe no dice nada.
  const skip = !view.skip
    ? []
    : route === "rapida"
      ? [line("»", skipSentence(view.skip), "saltar")]
      : view.optional
        ? []
        : [line("○", `Opcional: ${view.skip}.`)];
  const needs = view.needs ? [line("!", view.needs, "falta")] : [];
  byId("extras").replaceChildren(...needs, ...gems, ...skip);
}

function drawSummary(view: StepView): void {
  byId("lista").replaceChildren(
    ...view.rewards.map((row) =>
      rewardLine(
        row.state,
        row.reward,
        [row.zone, row.optional ? "opcional" : "", row.partial ? `llevas ${row.partial}` : ROW_NOTE[row.state]].filter(Boolean).join(" · "),
      ),
    ),
  );
  byId("resumen-titulo").textContent = `Acto ${view.act}: lo que da algo para siempre`;
  // Lo que quedó sin coger en los actos de antes: sigue ahí, se puede volver a por ello.
  // La lista se corta para que la ventana no se salga de su alto: lo primero es lo más antiguo.
  const shown = view.missedBefore.slice(0, MAX_MISSED_ROWS);
  const hidden = view.missedBefore.length - shown.length;
  byId("antes-titulo").hidden = view.missedBefore.length === 0;
  byId("antes").replaceChildren(
    ...shown.map((item) => rewardLine("dejada", item.reward, `${item.zone} · acto ${item.act}`)),
    ...(hidden > 0 ? [line("…", `y ${hidden} más`, "resto")] : []),
  );
  const unseen = byId("sin-ver");
  unseen.hidden = view.unseenActs.length === 0;
  unseen.textContent = unseenSentence(view.unseenActs);
}

const MAX_MISSED_ROWS = 6;

/** Los ajustes: se marca lo elegido para que se vea de un vistazo. */
function drawSettings(settings: Settings): void {
  const chosen: Record<string, string> = { ruta: settings.route, tamano: settings.size, fondo: settings.opacity };
  document.querySelectorAll<HTMLElement>("[data-ajuste]").forEach((group) => {
    group.querySelectorAll<HTMLElement>("[data-valor]").forEach((button) => {
      button.classList.toggle("activo", button.dataset.valor === chosen[group.dataset.ajuste ?? ""]);
    });
  });
  const toggle = (id: string, label: string, on: boolean) => {
    byId(id).classList.toggle("activo", on);
    byId(id).textContent = on ? `✓ ${label}` : label;
  };
  toggle("ajuste-compacta", "Compacta", settings.compact);
  toggle("ajuste-solo-juego", "Solo con PoE2 delante", settings.onlyWithGame);
}

function levelText(view: StepView, character: string | null): string | null {
  if (view.areaLevel === null) return null;
  const you = view.charLevel === null ? "" : ` · ${character ?? "tú"} ${view.charLevel}`;
  return `zona nv ${view.areaLevel}${you}`;
}

function draw(state: OverlayState): void {
  const { view, settings } = state;
  const outside = view.outside && !state.showSummary;
  /** Todo lo comprobable de la zona está hecho: lo que importa ya es adónde vas. */
  const done = !outside && view.ready === true;
  const body = document.body;
  body.className = [
    settings.compact ? "compacta" : "",
    `fondo-${settings.opacity}`,
    outside ? "fuera" : "",
    state.showSummary ? "con-resumen" : "",
    state.showSettings ? "con-ajustes" : "",
    settings.minimized ? "minimizada" : "",
    done ? "hecha" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Minimizada: lo justo para saber dónde estás. Con la zona hecha, adónde vas:
  // «✓ La excavación → Ngakanu». Si no cabe, se recorta la zona hecha, no la siguiente.
  const pos = byId("pos");
  const goingTo = settings.minimized && done ? view.next : null;
  if (goingTo) {
    const here = document.createElement("span");
    here.className = "ya";
    here.textContent = `✓ ${view.zone}`;
    const there = document.createElement("span");
    there.className = "va";
    there.textContent = `→ ${goingTo.zone}`;
    pos.replaceChildren(here, there);
  } else {
    pos.textContent = outside
      ? view.outsideText
      : settings.minimized
        ? `${view.ready ? "✓ " : ""}${view.zone} · ${view.number}/${view.total}`
        : `Acto ${view.act} · paso ${view.number} de ${view.total}`;
  }
  pos.className = goingTo ? "listo con-luego" : settings.minimized && done ? "listo" : "";
  const minimize = byId("minimizar");
  minimize.textContent = settings.minimized ? "▢" : "–";
  minimize.title = settings.minimized ? "Desplegar" : "Minimizar";
  byId("zona").textContent = view.zone;
  const tag = byId("tag");
  const tagName = view.offRoute ? "fuera de la ruta rápida" : view.optional ? "opcional" : view.priority;
  tag.textContent = tagName;
  tag.className = `tag ${view.offRoute || view.optional ? "opcional" : view.priority}`;
  byId("ruta").hidden = settings.route !== "rapida" || view.offRoute;

  // Avisos, de más a menos urgente: problema, arranque, lo que te dejaste, nivel bajo.
  const notice = state.problem
    ? state.problem
    : state.waitingForGame
      ? "Lista. Saldrá cuando tengas PoE2 delante."
      : view.leftBehind
        ? `Te dejaste en el acto ${view.leftBehind.act}: ${view.leftBehind.items.map((item) => `${item.zone} (${item.reward})`).join(", ")}.`
        : !outside && view.level === "muy-bajo" && view.areaLevel !== null && view.charLevel !== null
          ? `Vas ${view.areaLevel - view.charLevel} niveles por debajo de la zona: sube alguno antes del jefe.`
          : null;
  const leftBehindShown = Boolean(view.leftBehind) && !state.problem && !state.waitingForGame;
  byId("aviso-texto").textContent = notice ?? "";
  byId("aviso").hidden = !notice;
  byId("aviso").className = leftBehindShown ? "aviso importante" : "aviso";
  // Solo «te dejaste…» se puede quitar a mano: los demás se van solos al arreglarse.
  byId("aviso-cerrar").hidden = !leftBehindShown;
  // Recién cambiado de acto: cuánto baja la resistencia. Va aparte, para que no lo tape otro aviso.
  const resistNotice = state.problem || state.waitingForGame ? null : view.resistances;
  byId("aviso-res-texto").textContent = resistNotice ?? "";
  byId("aviso-res").hidden = !resistNotice;

  // Los objetivos que el registro deja comprobar: la recompensa para siempre y el jefe.
  const goal = (row: string, box: string, done: boolean) => {
    byId(row).className = done ? "objetivo hecho" : "objetivo";
    byId(box).textContent = done ? "✓" : "";
    byId(box).className = done ? "casilla hecha" : "casilla";
  };
  byId("recompensa").hidden = !view.reward;
  if (view.reward) {
    goal("recompensa", "casilla", view.reward.checked);
    byId("premio").textContent = view.reward.text;
    byId("premio-nota").textContent = view.reward.checked
      ? "cogida"
      : view.reward.partial
        ? `llevas ${view.reward.partial}`
        : view.reward.auto
          ? "se marca sola"
          : "pulsa Fin al cogerla";
  }
  byId("jefe").hidden = !view.boss;
  if (view.boss) {
    goal("jefe", "jefe-casilla", view.boss.dead);
    byId("jefe-nombre").textContent = view.boss.name;
    byId("jefe-nota").textContent = view.boss.dead ? "muerto" : view.boss.auto ? "se marca solo" : "pulsa Fin al matarlo";
  }
  byId("objeto").hidden = !view.pickup;
  if (view.pickup) {
    goal("objeto", "objeto-casilla", view.pickup.got);
    byId("objeto-nombre").textContent = view.pickup.text;
    byId("objeto-nota").textContent = view.pickup.got ? `cogido · llevas ${view.pickup.count}` : "pulsa la casilla al cogerlo";
  }
  setText(
    "hecho",
    view.ready !== true ? null : view.boss ? "✓ Zona hecha: puedes seguir." : "✓ Ya tienes lo de esta zona: puedes seguir.",
  );

  // Con la línea «Jefe:» a la vista, la frase que solo repite su nombre sobra.
  // En la vista compacta esa línea no sale: ahí el texto va entero.
  drawStepText(view.boss && !settings.compact ? withoutBossName(view.text, view.boss.name) : view.text);
  drawExtras(view, settings.route);
  // Zona hecha: la siguiente pasa de la letra pequeña del pie a una línea grande.
  const nextBig = done ? view.next : null;
  byId("sigue").hidden = !nextBig;
  byId("sigue-zona").textContent = nextBig?.zone ?? "";
  byId("sigue-premio").textContent = nextBig?.reward ? `(${nextBig.reward})` : "";
  byId("luego").hidden = Boolean(nextBig);
  byId("luego").textContent = view.next
    ? `Luego: ${view.next.zone}${view.next.reward ? ` (${view.next.reward})` : ""}`
    : "Fin de las guías (actos 1-4)";

  const level = byId("nivel");
  const levelLabel = levelText(view, state.character);
  level.hidden = !levelLabel;
  level.textContent = levelLabel ?? "";
  level.className = `nivel ${view.level ?? ""}`;

  drawSummary(view);
  drawSettings(settings);
}

window.ventanita.onState(draw);

// La ventanita deja pasar los clics al juego salvo en sus zonas de ratón
// (asa, engranaje, casilla y ajustes): al pasar por encima, los coge ella.
let mouseActive = false;
let draggingNow = false;
const setMouse = (over: boolean) => {
  if (mouseActive === over) return;
  mouseActive = over;
  window.ventanita.grip(over);
};
const isMouseZone = (target: EventTarget | null) => target instanceof Element && target.closest("[data-raton]") !== null;
document.addEventListener("mousemove", (event) => {
  if (!draggingNow) setMouse(isMouseZone(event.target));
});
document.documentElement.addEventListener("mouseleave", () => {
  if (!draggingNow) setMouse(false);
});

// El asa: al pulsar, se arrastra.
const grip = byId("asa");
grip.addEventListener("pointerdown", (event) => {
  grip.setPointerCapture(event.pointerId);
  draggingNow = true;
  window.ventanita.drag("inicio");
});
const endDrag = () => {
  if (!draggingNow) return;
  draggingNow = false;
  // Tras soltar vuelve a dejar pasar los clics; si el ratón sigue encima, el siguiente movimiento lo nota.
  mouseActive = false;
  window.ventanita.drag("fin");
};
grip.addEventListener("pointerup", endDrag);
grip.addEventListener("lostpointercapture", endDrag);

// «Empezar de cero» borra la partida: pide un segundo clic.
let resetArmed: number | null = null;
function confirmReset(button: HTMLElement): boolean {
  const disarm = () => {
    if (resetArmed !== null) window.clearTimeout(resetArmed);
    resetArmed = null;
    button.textContent = "Empezar de cero";
    button.classList.remove("confirmar");
  };
  if (resetArmed !== null) {
    disarm();
    return true;
  }
  button.textContent = "¿Seguro? Pulsa otra vez";
  button.classList.add("confirmar");
  resetArmed = window.setTimeout(disarm, 4000);
  return false;
}

// Los botones: el engranaje, la casilla de la recompensa y los ajustes.
document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const value = target?.closest<HTMLElement>("[data-valor]");
  const group = value?.closest<HTMLElement>("[data-ajuste]");
  if (value && group) {
    window.ventanita.action(group.dataset.ajuste ?? "", value.dataset.valor);
    return;
  }
  const action = target?.closest<HTMLElement>("[data-accion]");
  if (!action) return;
  const name = action.dataset.accion ?? "";
  if (name === "cero" && !confirmReset(action)) return;
  window.ventanita.action(name);
});

// La ventana mide lo que mide la caja, también cuando el texto termina de colocarse.
// El ancho solo cuenta minimizada: ahí la caja ocupa lo que ocupa su línea.
const box = document.querySelector(".caja")!;
new ResizeObserver(() => {
  const size = box.getBoundingClientRect();
  window.ventanita.reportSize(size.height + 1, size.width + 1);
}).observe(box);
