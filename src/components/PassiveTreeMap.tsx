import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Expand, Loader2, LocateFixed, Minus, Plus, Shrink } from "lucide-react";
import skillsUrl from "@/assets/arbol/skills.webp";
import skillsOffUrl from "@/assets/arbol/skills-disabled.webp";
import frameUrl from "@/assets/arbol/frame.webp";
import {
  nodeName,
  nodeStats,
  treeForClass,
  type PassiveTreeData,
  type SpriteRect,
  type TreeNodeData,
} from "@shared/passiveTree.js";
import { Button } from "@/components/ui/button";
import { loadPassiveTree } from "@/lib/passiveTreeData";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    loading: "Cargando el árbol…",
    failed: "No se ha podido cargar el árbol. Recarga la página para intentarlo otra vez.",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
    center: "Volver a tu camino",
    expand: "Ver más grande",
    shrink: "Ver más pequeño",
    help: "Arrastra para moverte, rueda o pellizca para acercar. Toca un nodo para ver lo que da.",
    keyboard: "Con teclado: flechas para moverte, + y − para acercar, Intro para elegir el nodo del centro.",
    mapLabel: (taken: number, suggested: number) =>
      `Árbol de pasivas: ${taken} nodos cogidos en dorado y ${suggested} propuestos en verde.`,
    taken: "Ya lo tienes",
    planned: "En el camino que te propongo",
    free: "Sin coger",
    kinds: {
      small: "Nodo pequeño",
      attribute: "Atributo",
      notable: "Notable",
      keystone: "Clave",
      jewel: "Ranura de joya",
      start: "Inicio de clase",
    } as Record<TreeNodeData["kind"], string>,
    english: "(texto del juego en inglés)",
  },
  {
    loading: "Loading the tree…",
    failed: "The tree couldn't load. Reload the page to try again.",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    center: "Back to your path",
    expand: "Make it bigger",
    shrink: "Make it smaller",
    help: "Drag to move, scroll or pinch to zoom. Tap a node to see what it gives.",
    keyboard: "With the keyboard: arrows to move, + and − to zoom, Enter to pick the node in the middle.",
    mapLabel: (taken: number, suggested: number) =>
      `Passive tree: ${taken} allocated nodes in gold and ${suggested} suggested in green.`,
    taken: "You have it",
    planned: "On the path I suggest",
    free: "Not allocated",
    kinds: {
      small: "Small node",
      attribute: "Attribute",
      notable: "Notable",
      keystone: "Keystone",
      jewel: "Jewel socket",
      start: "Class start",
    } as Record<TreeNodeData["kind"], string>,
    english: "",
  },
);

export interface MapSuggestion {
  key: string;
  path: string[];
  /** Lo que se pinta en la etiqueta: «1», «2», «3» o un escudo para la defensa. */
  label: string;
}

interface PassiveTreeMapProps {
  characterClass: string | null;
  allocated: string[];
  suggestions: MapSuggestion[];
  /** Nodo al que ir (cambia `focusNonce` para repetir el mismo). */
  focusKey: string | null;
  focusNonce: number;
  /** Avisa de qué nodo ha tocado el jugador (null = ninguno). */
  onSelect?: (key: string | null) => void;
  /** Botones bajo la ficha del nodo tocado (el editor: coger, quitar…). */
  nodeActions?: (key: string) => ReactNode;
  /** Editando: el encuadre no salta cada vez que se coge un nodo. */
  keepView?: boolean;
  /** Texto del estado de un nodo cogido o propuesto (el editor dice otra cosa). */
  stateLabels?: Partial<Record<"taken" | "planned" | "free", string>>;
}

// ---------------------------------------------------------------------------
// Carga (una vez por visita)
// ---------------------------------------------------------------------------

interface Sheets {
  on: HTMLImageElement;
  off: HTMLImageElement;
  frame: HTMLImageElement;
}

let sheetsPromise: Promise<Sheets> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${url}`));
    image.src = url;
  });
}

function loadSheets(): Promise<Sheets> {
  sheetsPromise ??= Promise.all([loadImage(skillsUrl), loadImage(skillsOffUrl), loadImage(frameUrl)]).then(
    ([on, off, frame]) => ({ on, off, frame }),
  );
  sheetsPromise.catch(() => {
    sheetsPromise = null;
  });
  return sheetsPromise;
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------

type State = "taken" | "planned" | "free";

interface View {
  /** Centro de la vista, en unidades del árbol. */
  x: number;
  y: number;
  /** Píxeles por unidad del árbol. */
  scale: number;
}

const ICON_PREFIX: Record<TreeNodeData["kind"], string> = {
  small: "normal",
  attribute: "normal",
  jewel: "normal",
  start: "normal",
  notable: "notable",
  keystone: "keystone",
};

const FRAMES: Record<TreeNodeData["kind"], Record<State, string> | null> = {
  small: { free: "PSSkillFrame", planned: "PSSkillFrameHighlighted", taken: "PSSkillFrameActive" },
  attribute: { free: "PSSkillFrame", planned: "PSSkillFrameHighlighted", taken: "PSSkillFrameActive" },
  notable: { free: "NotableFrameUnallocated", planned: "NotableFrameCanAllocate", taken: "NotableFrameAllocated" },
  keystone: { free: "KeystoneFrameUnallocated", planned: "KeystoneFrameCanAllocate", taken: "KeystoneFrameAllocated" },
  jewel: { free: "JewelFrameUnallocated", planned: "JewelFrameCanAllocate", taken: "JewelFrameAllocated" },
  start: null,
};

/** Tamaño del marco en unidades del árbol: el de la hoja oficial, que ya viene a escala. */
const FRAME_UNITS: Record<TreeNodeData["kind"], number> = {
  small: 78,
  attribute: 78,
  jewel: 110,
  notable: 116,
  keystone: 165,
  start: 150,
};

const COLORS = {
  background: "#07080b",
  edge: "rgba(122, 110, 86, 0.55)",
  edgeTaken: "#d4a94e",
  edgePlanned: "#3ee08f",
  start: "rgba(212, 169, 78, 0.35)",
  label: "#3ee08f",
  labelText: "#04140b",
  dot: "rgba(150, 140, 120, 0.7)",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface Prepared {
  data: PassiveTreeData;
  keys: string[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function prepare(data: PassiveTreeData): Prepared {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const keys = Object.keys(data.nodes);
  for (const key of keys) {
    const node = data.nodes[key];
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  return { data, keys, bounds: { minX, minY, maxX, maxY } };
}

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  view: View,
  prepared: Prepared,
  sheets: Sheets | null,
  stateOf: (key: string) => State,
  suggestions: MapSuggestion[],
  selected: string | null,
  lang: "es" | "en",
): void {
  const { data } = prepared;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);

  const toX = (x: number) => (x - view.x) * view.scale + width / 2;
  const toY = (y: number) => (y - view.y) * view.scale + height / 2;
  const margin = 140 / view.scale;
  const left = view.x - width / 2 / view.scale - margin;
  const right = view.x + width / 2 / view.scale + margin;
  const top = view.y - height / 2 / view.scale - margin;
  const bottom = view.y + height / 2 / view.scale + margin;
  const visible = (node: TreeNodeData) => node.x >= left && node.x <= right && node.y >= top && node.y <= bottom;

  // Conexiones: arco si van por la misma órbita del mismo grupo, recta si no.
  const paths: Record<State, Path2D> = { free: new Path2D(), taken: new Path2D(), planned: new Path2D() };
  for (const [a, b] of data.edges) {
    const from = data.nodes[a];
    const to = data.nodes[b];
    if (!from || !to || (!visible(from) && !visible(to))) continue;
    if (from.kind === "start" || to.kind === "start") {
      if (stateOf(a) !== "taken" && stateOf(b) !== "taken") continue;
    }
    const sa = stateOf(a);
    const sb = stateOf(b);
    const state: State = sa === "taken" && sb === "taken" ? "taken" : sa !== "free" && sb !== "free" ? "planned" : "free";
    const path = paths[state];
    const center = data.groups[String(from.group)];
    if (from.group === to.group && from.orbit === to.orbit && from.orbit > 0 && center) {
      const [gx, gy] = center;
      const radius = Math.hypot(from.x - gx, from.y - gy) * view.scale;
      const start = Math.atan2(from.y - gy, from.x - gx);
      const end = Math.atan2(to.y - gy, to.x - gx);
      let delta = end - start;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      path.moveTo(toX(from.x), toY(from.y));
      path.arc(toX(gx), toY(gy), radius, start, start + delta, delta < 0);
    } else {
      path.moveTo(toX(from.x), toY(from.y));
      path.lineTo(toX(to.x), toY(to.y));
    }
  }
  ctx.lineCap = "round";
  const lineWidth = Math.max(1, 9 * view.scale);
  ctx.strokeStyle = COLORS.edge;
  ctx.lineWidth = lineWidth * 0.8;
  ctx.stroke(paths.free);
  ctx.strokeStyle = COLORS.edgeTaken;
  ctx.lineWidth = lineWidth * 1.2;
  ctx.stroke(paths.taken);
  ctx.strokeStyle = COLORS.edgePlanned;
  ctx.lineWidth = lineWidth * 1.4;
  ctx.stroke(paths.planned);

  // Nodos.
  const detailed = sheets !== null && FRAME_UNITS.small * view.scale >= 9;
  for (const key of prepared.keys) {
    const node = data.nodes[key];
    if (!visible(node)) continue;
    const state = stateOf(key);
    const x = toX(node.x);
    const y = toY(node.y);
    if (node.kind === "start") {
      ctx.strokeStyle = state === "taken" ? COLORS.edgeTaken : COLORS.start;
      ctx.lineWidth = Math.max(1.5, 10 * view.scale);
      ctx.beginPath();
      ctx.arc(x, y, FRAME_UNITS.start * view.scale, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const size = FRAME_UNITS[node.kind] * view.scale;
    if (!detailed) {
      ctx.fillStyle = state === "taken" ? COLORS.edgeTaken : state === "planned" ? COLORS.edgePlanned : COLORS.dot;
      const radius = Math.max(state === "free" ? 1 : 1.8, size * 0.32);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    const icon = data.icons[`${ICON_PREFIX[node.kind]}:${node.icon}`];
    const iconSize = size * (node.kind === "small" || node.kind === "attribute" ? 0.68 : 0.62);
    if (icon && sheets) {
      const rect: SpriteRect = state === "free" ? icon.off : icon.on;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, iconSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(state === "free" ? sheets.off : sheets.on, rect[0], rect[1], rect[2], rect[3], x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
      ctx.restore();
    } else {
      ctx.fillStyle = COLORS.dot;
      ctx.beginPath();
      ctx.arc(x, y, iconSize / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const frameName = FRAMES[node.kind]?.[state];
    const frame = frameName ? data.frames[frameName] : undefined;
    if (frame && sheets) {
      ctx.drawImage(sheets.frame, frame[0], frame[1], frame[2], frame[3], x - size / 2, y - size / 2, size, size);
    }
  }

  // Lo elegido con el dedo: un anillo.
  if (selected && data.nodes[selected]) {
    const node = data.nodes[selected];
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(toX(node.x), toY(node.y), Math.max(10, (FRAME_UNITS[node.kind] * view.scale) / 2 + 4), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Etiquetas de los notables propuestos: número y nombre, siempre legibles.
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.textBaseline = "middle";
  for (const suggestion of suggestions) {
    const node = data.nodes[suggestion.key];
    if (!node) continue;
    const x = toX(node.x);
    const y = toY(node.y) - Math.max(16, (FRAME_UNITS[node.kind] * view.scale) / 2 + 12);
    const text = `${suggestion.label} · ${nodeName(node, lang)}`;
    const width = ctx.measureText(text).width + 14;
    ctx.fillStyle = COLORS.label;
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 10, width, 20, 10);
    ctx.fill();
    ctx.fillStyle = COLORS.labelText;
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 0.5);
  }
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

const MIN_SCALE = 0.012;
const MAX_SCALE = 0.9;

/**
 * El árbol oficial dibujado con sus imágenes: lo cogido en dorado, el camino
 * propuesto en verde y cada notable propuesto con su número y su nombre.
 */
export default function PassiveTreeMap({
  characterClass,
  allocated,
  suggestions,
  focusKey,
  focusNonce,
  onSelect,
  nodeActions,
  keepView = false,
  stateLabels,
}: PassiveTreeMapProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseData, setBaseData] = useState<PassiveTreeData | null>(null);
  const [sheets, setSheets] = useState<Sheets | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<View | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tall, setTall] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPassiveTree()
      .then((data) => {
        if (!cancelled) setBaseData(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    // Sin imágenes el árbol se sigue viendo, con puntos.
    loadSheets()
      .then((loaded) => {
        if (!cancelled) setSheets(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const prepared = useMemo(() => (baseData ? prepare(treeForClass(baseData, characterClass)) : null), [baseData, characterClass]);

  const taken = useMemo(() => new Set(allocated), [allocated]);
  const planned = useMemo(() => new Set(suggestions.flatMap((suggestion) => suggestion.path)), [suggestions]);
  const stateOf = useCallback(
    (key: string): State => (taken.has(key) ? "taken" : planned.has(key) ? "planned" : "free"),
    [taken, planned],
  );

  // Encuadre: lo cogido y lo propuesto, con aire alrededor.
  const fitView = useCallback((): View | null => {
    if (!prepared || size.width === 0) return null;
    const keys = [...allocated, ...suggestions.flatMap((suggestion) => suggestion.path)].filter((key) => prepared.data.nodes[key]);
    const box = keys.length > 0
      ? keys.reduce(
          (acc, key) => {
            const node = prepared.data.nodes[key];
            return {
              minX: Math.min(acc.minX, node.x),
              minY: Math.min(acc.minY, node.y),
              maxX: Math.max(acc.maxX, node.x),
              maxY: Math.max(acc.maxY, node.y),
            };
          },
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        )
      : prepared.bounds;
    const pad = 500;
    const width = box.maxX - box.minX + pad * 2;
    const height = box.maxY - box.minY + pad * 2;
    const scale = clamp(Math.min(size.width / width, size.height / height), MIN_SCALE, 0.35);
    return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, scale };
  }, [prepared, size.width, size.height, allocated, suggestions]);

  // Primer encuadre, y otra vez si cambia lo que se enseña.
  const fitKey = keepView
    ? `editando|${prepared ? 1 : 0}|${size.width > 0 ? 1 : 0}`
    : `${allocated.length}|${suggestions.map((suggestion) => suggestion.key).join(",")}|${prepared ? 1 : 0}|${size.width > 0 ? 1 : 0}`;
  // Se ajusta durante el render (como `viewRequest` en las guías): así no hay
  // un pintado intermedio con el encuadre viejo.
  const [fittedFor, setFittedFor] = useState("");
  if (fittedFor !== fitKey) {
    const next = fitView();
    if (next) {
      setFittedFor(fitKey);
      setView(next);
    }
  }

  // Ir a un notable desde la lista («Ver en el árbol»).
  const focusId = `${focusKey ?? ""}|${focusNonce}|${prepared ? 1 : 0}`;
  const [focusedFor, setFocusedFor] = useState("");
  if (focusKey && prepared && focusedFor !== focusId) {
    setFocusedFor(focusId);
    const node = prepared.data.nodes[focusKey];
    if (node) {
      setSelected(focusKey);
      setView((current) => ({ x: node.x, y: node.y, scale: Math.max(current?.scale ?? 0.2, 0.22) }));
    }
  }

  // Tamaño del lienzo: se mide al montar y al cambiar (el observador solo
  // avisa cuando el navegador pinta; la medida directa no espera a eso).
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const measure = () => {
      const box = wrapper.getBoundingClientRect();
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(wrapper);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [tall]);

  // Pintar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !prepared || !view || size.width === 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, size.width, size.height, view, prepared, sheets, stateOf, suggestions, selected, lang);
  }, [prepared, view, size, sheets, stateOf, suggestions, selected, lang]);

  const zoomAt = useCallback(
    (factor: number, screenX?: number, screenY?: number) => {
      setView((current) => {
        if (!current) return current;
        const scale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
        if (screenX === undefined || screenY === undefined) return { ...current, scale };
        // El punto bajo el ratón se queda quieto.
        const dx = screenX - size.width / 2;
        const dy = screenY - size.height / 2;
        const worldX = current.x + dx / current.scale;
        const worldY = current.y + dy / current.scale;
        return { x: worldX - dx / scale, y: worldY - dy / scale, scale };
      });
    },
    [size.width, size.height],
  );

  // La rueda acerca el árbol (y no mueve la página mientras el ratón está encima).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - rect.left, event.clientY - rect.top);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Arrastrar, pellizcar y tocar.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: number; pinch: number | null }>({ moved: 0, pinch: null });

  const hitTest = (screenX: number, screenY: number): string | null => {
    if (!prepared || !view) return null;
    const worldX = view.x + (screenX - size.width / 2) / view.scale;
    const worldY = view.y + (screenY - size.height / 2) / view.scale;
    let best: string | null = null;
    let bestDistance = Infinity;
    for (const key of prepared.keys) {
      const node = prepared.data.nodes[key];
      if (node.kind === "start") continue;
      const distance = Math.hypot(node.x - worldX, node.y - worldY);
      const reach = Math.max(FRAME_UNITS[node.kind] / 2, 16 / view.scale);
      if (distance <= reach && distance < bestDistance) {
        best = key;
        bestDistance = distance;
      }
    }
    return best;
  };

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    gesture.current = { moved: 0, pinch: null };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const last = gesture.current.pinch;
      gesture.current.pinch = distance;
      gesture.current.moved += 10;
      if (last !== null && last > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        zoomAt(distance / last, (a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top);
      }
      return;
    }
    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    setView((view) => (view ? { ...view, x: view.x - dx / view.scale, y: view.y - dy / view.scale } : view));
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const wasTap = pointers.current.size === 1 && gesture.current.moved < 6;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current.pinch = null;
    if (!wasTap) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = hitTest(event.clientX - rect.left, event.clientY - rect.top);
    setSelected(hit);
  };

  useEffect(() => {
    onSelect?.(selected);
  }, [selected, onSelect]);

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const step = 120;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setView((view) => (view ? { ...view, x: view.x + move[0] / view.scale, y: view.y + move[1] / view.scale } : view));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomAt(1.3);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomAt(1 / 1.3);
    } else if (event.key === "Enter" || event.key === " ") {
      // Con teclado: elige el nodo más cercano al centro de la vista.
      event.preventDefault();
      if (!prepared || !view) return;
      let best: string | null = null;
      let bestDistance = 60 / view.scale;
      for (const key of prepared.keys) {
        const node = prepared.data.nodes[key];
        if (node.kind === "start") continue;
        const distance = Math.hypot(node.x - view.x, node.y - view.y);
        if (distance < bestDistance) {
          best = key;
          bestDistance = distance;
        }
      }
      setSelected(best);
    } else if (event.key === "Escape") {
      setSelected(null);
    }
  };

  const selectedNode = selected && prepared ? prepared.data.nodes[selected] : null;
  const selectedState = selected ? stateOf(selected) : null;
  const selectedStats = selectedNode ? nodeStats(selectedNode, lang) : [];
  const statsInEnglish = selectedNode !== null && lang === "es" && selectedNode.statsEs === null && selectedStats.length > 0;

  if (failed) {
    return (
      <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground" role="status">
        {t.failed}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" data-testid="arbol-mapa">
      <div
        ref={wrapperRef}
        className={cn(
          "relative w-full overflow-hidden rounded-lg border border-border bg-[#07080b]",
          tall ? "h-[78vh] min-h-[420px]" : "h-[360px] sm:h-[440px]",
        )}
      >
        <canvas
          ref={canvasRef}
          className="block size-full touch-none cursor-grab active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-primary"
          role="img"
          aria-label={`${t.mapLabel(allocated.length, planned.size)} ${t.keyboard}`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          data-testid="arbol-lienzo"
        />
        {(!prepared || !view) && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.loading}
          </div>
        )}
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => zoomAt(1.4)} aria-label={t.zoomIn} title={t.zoomIn}>
            <Plus className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" size="icon" variant="secondary" className="size-8" onClick={() => zoomAt(1 / 1.4)} aria-label={t.zoomOut} title={t.zoomOut}>
            <Minus className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-8"
            onClick={() => {
              const next = fitView();
              if (next) setView(next);
              setSelected(null);
            }}
            aria-label={t.center}
            title={t.center}
            data-testid="arbol-centrar"
          >
            <LocateFixed className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="size-8"
            onClick={() => setTall((value) => !value)}
            aria-label={tall ? t.shrink : t.expand}
            title={tall ? t.shrink : t.expand}
            aria-pressed={tall}
          >
            {tall ? <Shrink className="size-4" aria-hidden="true" /> : <Expand className="size-4" aria-hidden="true" />}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.help}</p>
      {selectedNode && selectedState && (
        <div className="rounded-lg border border-border bg-secondary/40 p-3 text-sm" aria-live="polite" data-testid="arbol-nodo">
          <p className="font-semibold text-foreground">
            {selectedNode.kind === "notable" || selectedNode.kind === "keystone" || selectedNode.kind === "attribute"
              ? nodeName(selectedNode, lang)
              : t.kinds[selectedNode.kind]}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t.kinds[selectedNode.kind]} · {stateLabels?.[selectedState] ?? (selectedState === "taken" ? t.taken : selectedState === "planned" ? t.planned : t.free)}
            </span>
          </p>
          {selectedStats.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {selectedStats.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {statsInEnglish && t.english && <p className="mt-1 text-xs text-muted-foreground/80">{t.english}</p>}
          {selected && nodeActions ? nodeActions(selected) : null}
        </div>
      )}
    </div>
  );
}
