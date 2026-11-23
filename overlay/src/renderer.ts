import type { RewardRow, StepView } from "./run";
import type { Settings } from "./settings";

interface OverlayState {
  view: StepView;
  settings: Settings;
  showSummary: boolean;
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

function levelText(view: StepView): string | null {
  if (view.areaLevel === null) return null;
  const you = view.charLevel === null ? "" : ` · tú ${view.charLevel}`;
  return `zona nv ${view.areaLevel}${you}`;
}

function draw(state: OverlayState): void {
  const { view, settings } = state;
  const body = document.body;
  body.className = [
    settings.compact ? "compacta" : "",
    `fondo-${settings.opacity}`,
    view.outside && !state.showSummary ? "fuera" : "",
    state.showSummary ? "con-resumen" : "",
  ]
    .filter(Boolean)
    .join(" ");

  byId("pos").textContent = `Acto ${view.act} · ${view.number}/${view.total}`;
  byId("zona").textContent = view.zone;
  const tag = byId("tag");
  const tagName = view.offRoute ? "fuera de la ruta rápida" : view.optional ? "opcional" : view.priority;
  tag.textContent = tagName;
  tag.className = `tag ${view.offRoute || view.optional ? "opcional" : view.priority}`;
  if (settings.route === "rapida") byId("ruta").removeAttribute("hidden");
  else byId("ruta").setAttribute("hidden", "");

  // Avisos, de más a menos urgente: problema, arranque, lo que te dejaste, fuera de la campaña.
  const notice = state.problem
    ? state.problem
    : state.waitingForGame
      ? "Lista. Saldrá cuando tengas PoE2 delante."
      : view.leftBehind
        ? `Te dejaste en el acto ${view.leftBehind.act}: ${view.leftBehind.items.map((item) => `${item.zone} (${item.reward})`).join(", ")}.`
        : view.outside
          ? "Fuera de la campaña de las guías."
          : view.level === "muy-bajo" && view.areaLevel !== null && view.charLevel !== null
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
    byId("premio-nota").textContent = view.reward.checked ? "cogida" : "Fin al cogerla";
  }

  byId("ahora").textContent = view.text;
  setText("saltar", view.skipHint ? skipSentence(view.skipHint) : null);
  byId("luego").textContent = view.next ? `Luego: ${view.next.zone} — ${view.next.text}` : "Fin de las guías (actos 1-4)";

  const level = byId("nivel");
  const levelLabel = levelText(view);
  level.hidden = !levelLabel;
  level.textContent = levelLabel ?? "";
  level.className = `nivel ${view.level ?? ""}`;
  level.title = view.level === "muy-bajo" ? "Vas muy por debajo del nivel de la zona" : view.level === "bajo" ? "Vas algo bajo de nivel" : "";

  drawSummary(view);
}

window.ventanita.onState(draw);

// El asa: al pasar por encima la ventanita acepta el ratón; al pulsar, se arrastra.
const grip = byId("asa");
let gripActive = false;
let draggingNow = false;
const setGrip = (over: boolean) => {
  if (gripActive === over) return;
  gripActive = over;
  window.ventanita.grip(over);
};
grip.addEventListener("mousemove", () => setGrip(true));
grip.addEventListener("mouseleave", () => {
  if (!draggingNow) setGrip(false);
});
grip.addEventListener("pointerdown", (event) => {
  grip.setPointerCapture(event.pointerId);
  draggingNow = true;
  window.ventanita.drag("inicio");
});
const endDrag = () => {
  if (!draggingNow) return;
  draggingNow = false;
  // Tras soltar vuelve a dejar pasar los clics; si el ratón sigue encima, el siguiente movimiento lo nota.
  gripActive = false;
  window.ventanita.drag("fin");
};
grip.addEventListener("pointerup", endDrag);
grip.addEventListener("lostpointercapture", endDrag);
// La ventana mide lo que mide la caja, también cuando el texto termina de colocarse.
new ResizeObserver(() => window.ventanita.reportHeight(document.querySelector(".caja")!.getBoundingClientRect().height + 1)).observe(
  document.querySelector(".caja")!,
);
