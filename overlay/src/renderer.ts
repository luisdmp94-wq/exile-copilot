import type { StepView } from "./progress";

interface OverlayState {
  view: StepView;
  moving: boolean;
  problem: string | null;
  keys: { prev: string; next: string; move: string };
}

declare global {
  interface Window {
    ventanita: {
      onState: (callback: (state: OverlayState) => void) => void;
      reportHeight: (height: number) => void;
    };
  }
}

const TAGS: Record<StepView["priority"], string> = {
  clave: "clave",
  recomendable: "recomendable",
  historia: "historia",
};

const KEY_NAMES: Record<string, string> = { PageUp: "Re Pág", PageDown: "Av Pág" };

const byId = (id: string) => document.getElementById(id)!;

function draw(state: OverlayState): void {
  const { view } = state;
  document.body.classList.toggle("moviendo", state.moving);
  byId("pos").textContent = `Acto ${view.act} · ${view.number}/${view.total}`;
  byId("zona").textContent = view.zone;
  const tag = byId("tag");
  tag.textContent = view.optional ? "opcional" : TAGS[view.priority];
  tag.className = `tag ${view.optional ? "opcional" : view.priority}`;
  byId("ahora").textContent = view.text;
  byId("luego").textContent = view.next ? `Luego: ${view.next.zone} — ${view.next.text}` : "Fin de las guías (actos 1-4)";
  byId("k-prev").textContent = KEY_NAMES[state.keys.prev] ?? state.keys.prev;
  byId("k-next").textContent = KEY_NAMES[state.keys.next] ?? state.keys.next;

  const notice = byId("aviso");
  const text = state.problem
    ? state.problem
    : state.moving
      ? "Arrastra para colocarla. Ctrl+Alt+M para fijarla."
      : view.outside
        ? "Esta zona no está en las guías. Sigues aquí:"
        : "";
  notice.textContent = text;
  notice.hidden = text === "";
  window.ventanita.reportHeight(document.body.scrollHeight);
}

window.ventanita.onState(draw);
