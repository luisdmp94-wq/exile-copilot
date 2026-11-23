import type { RewardRow, StepView } from "./run";
import type { Settings } from "./settings";

interface OverlayState {
  view: StepView;
  settings: Settings;
  showSummary: boolean;
  showSettings: boolean;
  problem: string | null;
  waitingForGame: boolean;
}

declare global {
  interface Window {
    ventanita: {
      onState: (callback: (state: OverlayState) => void) => void;
      reportHeight: (height: number) => void;
      grip: (over: boolean) => void;
      drag: (phase: "inicio" | "fin") => void;
      action: (name: string, value?: string) => void;
    };
  }
}

const byId = (id: string) => document.getElementById(id)!;

function setText(id: string, text: string | null): void {
  const element = byId(id);
  element.textContent = text ?? "";
  element.hidden = !text;
}

const ROW_MARK: Record<RewardRow["state"], string> = { cogida: "✓", pisada: "?", dejada: "○", pendiente: "·" };
const ROW_NOTE: Record<RewardRow["state"], string> = {
  cogida: "",
  pisada: "",
  dejada: "te la dejaste",
  pendiente: "más adelante",
};

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
  byId("extras").replaceChildren(...gems, ...skip);
}

function drawSummary(view: StepView): void {
  const list = byId("lista");
  list.replaceChildren(
    ...view.rewards.map((row) => {
      const item = document.createElement("li");
      item.className = row.state;
      const mark = document.createElement("span");
      mark.className = "marca";
      mark.textContent = ROW_MARK[row.state];
      const reward = document.createElement("span");
      reward.className = "premio";
      reward.textContent = row.reward;
      const zone = document.createElement("span");
      zone.className = "donde";
      zone.textContent = [row.zone, row.optional ? "opcional" : "", ROW_NOTE[row.state]].filter(Boolean).join(" · ");
      item.append(mark, reward, zone);
      return item;
    }),
  );
  byId("resumen-titulo").textContent = `Acto ${view.act}: lo que da algo para siempre`;
}

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

function levelText(view: StepView): string | null {
  if (view.areaLevel === null) return null;
  const you = view.charLevel === null ? "" : ` · tú ${view.charLevel}`;
  return `zona nv ${view.areaLevel}${you}`;
}

function draw(state: OverlayState): void {
  const { view, settings } = state;
  const outside = view.outside && !state.showSummary;
  const body = document.body;
  body.className = [
    settings.compact ? "compacta" : "",
    `fondo-${settings.opacity}`,
    outside ? "fuera" : "",
    state.showSummary ? "con-resumen" : "",
    state.showSettings ? "con-ajustes" : "",
  ]
    .filter(Boolean)
    .join(" ");

  byId("pos").textContent = outside ? "Fuera de la campaña (guarida, mapas…)" : `Acto ${view.act} · paso ${view.number} de ${view.total}`;
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
  setText("aviso", notice);
  byId("aviso").className = view.leftBehind && !state.problem && !state.waitingForGame ? "aviso importante" : "aviso";

  const reward = byId("recompensa");
  reward.hidden = !view.reward;
  if (view.reward) {
    byId("casilla").textContent = view.reward.checked ? "✓" : "";
    byId("casilla").className = view.reward.checked ? "casilla hecha" : "casilla";
    byId("premio").textContent = view.reward.text;
    byId("premio-nota").textContent = view.reward.checked ? "cogida" : "pulsa Fin al cogerla";
  }

  byId("ahora").textContent = view.text;
  drawExtras(view, settings.route);
  byId("luego").textContent = view.next
    ? `Luego: ${view.next.zone}${view.next.reward ? ` (${view.next.reward})` : ""}`
    : "Fin de las guías (actos 1-4)";

  const level = byId("nivel");
  const levelLabel = levelText(view);
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
new ResizeObserver(() => window.ventanita.reportHeight(document.querySelector(".caja")!.getBoundingClientRect().height + 1)).observe(
  document.querySelector(".caja")!,
);
