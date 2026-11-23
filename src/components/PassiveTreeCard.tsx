import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, MapPin, Network, Pencil, ShieldPlus, Undo2 } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { GGG_AFFILIATION_NOTICE, GGG_AFFILIATION_NOTICE_ES } from "@shared/passiveRegistry.js";
import {
  classStartFor,
  exportClassName,
  nodeName,
  nodeStats,
  readAllocated,
  treeForClass,
  type TreeGraph,
} from "@shared/passiveTree.js";
import {
  allocateNode,
  deallocateNode,
  defaultAttribute,
  maxPassivePoints,
  pointsSpent,
  previewPath,
} from "@shared/passiveTreeEdit.js";
import { onTheWayGroups, orderStepsByGain, standalonePaths } from "@shared/passiveTreeOrder.js";
import { findPobGem, pobCodeFromDeflated, pobXmlForProfile } from "@shared/pobBuild.js";
import {
  treeRequestFromProfile,
  type PassiveTreeAdviceResponse,
} from "@shared/passiveTreeRequest.js";
import { api } from "@/lib/api";
import { loadPassiveGraph } from "@/lib/passiveTreeData";
import { Button } from "@/components/ui/button";
import { PobPanel, type PobPick } from "@/components/PobPanel";
import { cn } from "@/lib/utils";
import { sendUseBeacon } from "@/lib/visitBeacon";
import { texts, useLang, useText } from "@/i18n/lang";
import type { MapSuggestion } from "@/components/PassiveTreeMap";
import { pobClient, pobOptedIn, rememberPobOptIn } from "@/pob/pobClient";
import { loadPobData } from "@/pob/pobData";
import type { PobAnalysis, PobSummary } from "@/pob/pobTypes";
import { usePobAnalysis, usePobData, usePobStatus, type PobRequest } from "@/pob/usePob";

const PassiveTreeMap = lazy(() => import("@/components/PassiveTreeMap"));

type Suggestion = PassiveTreeAdviceResponse["offence"][number];
type Attribute = "str" | "dex" | "int";

const TEXT = texts(
  {
    title: "Tu árbol de pasivas",
    emptyLead: "Pega tu código de Path of Building 2, o márcalo tú en el árbol del juego, y te digo tus próximos notables con el camino dibujado.",
    emptyHow: "En Path of Building 2: Importar/Exportar → Generar → Copiar.",
    pasteCode: "Pegar mi código de PoB2",
    markByHand: "Marcarlo yo en el árbol",
    needClass: "Para marcarlo a mano necesito tu clase: ponla en «Editar personaje».",
    loading: "Leyendo tu árbol…",
    failed: "No he podido leer tu árbol ahora. Prueba otra vez en un momento.",
    retry: "Reintentar",
    summary: (taken: number, version: string) => `Tienes ${taken} ${taken === 1 ? "pasiva" : "pasivas"} en el árbol ${version}.`,
    forSkills: (skills: string) => `Lo que más ayuda a ${skills}, en el orden en que se coge:`,
    noSkill: "Tengo tu árbol, pero no sé qué habilidad usas para hacer daño. Dímela y te digo qué notables le sirven.",
    setSkill: "Decir mi habilidad",
    nothing: "No veo ningún notable cerca que ayude a lo que usas. Mira el árbol: lo tienes dibujado abajo.",
    points: (points: number, first: boolean) => `${first ? "" : "+"}${points} ${points === 1 ? "punto" : "puntos"}`,
    gives: "Da",
    why: "Por qué",
    pob: "PoB2",
    pobDamage: (gain: string) => `${gain} % daño`,
    pobDefence: (gain: string) => `${gain} % aguante`,
    orderedByPob: "Ordenados por lo que más daño te da por punto según PoB2.",
    defenceByPob: "Según PoB2, es lo que más aguante te da por punto cerca de tu árbol.",
    onTheWay: (count: number) => `Lo que coges por el camino (${count} ${count === 1 ? "nodo" : "nodos"})`,
    search: "En el juego, escribe el nombre en «Busca aquí» del árbol y te lo marca.",
    copy: "Copiar el nombre",
    copied: "Copiado",
    show: "Ver en el árbol",
    defenceTitle: "Si mueres mucho",
    defenceLead: (points: number) => `${points} ${points === 1 ? "punto" : "puntos"} desde tu árbol de hoy.`,
    mismatch: (code: string, tree: string) =>
      `Tu código es del árbol ${code} y la web usa el ${tree}: algún nodo puede no casar. Vuelve a exportarlo desde Path of Building 2 actualizado.`,
    unknown: (count: number) => `${count} ${count === 1 ? "nodo de tu código no está" : "nodos de tu código no están"} en este árbol.`,
    rules: "Lo eligen reglas con el árbol oficial y tus habilidades, sin IA. Tú decides.",
    source: (version: string) => `Árbol oficial de Grinding Gear Games (${version}); nombres en español de poe2db.`,
    notice: GGG_AFFILIATION_NOTICE_ES,
    edit: "Editar mi árbol",
    editingTitle: "Editando tu árbol",
    editingHelp: "Toca un nodo para ver lo que da, y coge o quita desde su ficha. Coger un nodo coge el camino hasta él.",
    pointsUsed: (used: number, max: number, level: number) => `${used} puntos de unos ${max} que puedes tener a nivel ${level}`,
    pointsOver: "Te pasas de los puntos que se pueden tener a tu nivel: revisa si sobra algo.",
    undo: "Deshacer",
    cancel: "Cancelar",
    save: "Guardar mi árbol",
    saving: "Guardando…",
    take: (points: number) => `Coger (${points === 1 ? "1 punto" : `${points} puntos`})`,
    remove: (count: number) => (count > 1 ? `Quitar ${count} nodos` : "Quitar"),
    removeHelp: (count: number) => `Los ${count - 1} de detrás se quedan sin camino y se quitan también.`,
    attributeGroup: "Atributo que da este nodo",
    discard: "¿Tirar los cambios?",
    cantTake: "No se llega desde tu árbol.",
    locked: "Este nodo lo abre otra cosa (una ascendencia o un objeto): no se coge con puntos.",
    choiceFirst: "Primero coge el nodo del que sale esta opción.",
    attribute: "Da",
    attributes: { str: "Fuerza", dex: "Destreza", int: "Inteligencia" } as Record<Attribute, string>,
    preview: "Lo que costaría",
    ascendancyKept: (count: number) => `Tus ${count} nodos de ascendencia se quedan como estaban.`,
  },
  {
    title: "Your passive tree",
    emptyLead: "Paste your Path of Building 2 code, or mark it yourself on the game's tree, and I'll show your next notables with the path drawn.",
    emptyHow: "In Path of Building 2: Import/Export → Generate → Copy.",
    pasteCode: "Paste my PoB2 code",
    markByHand: "Mark it myself on the tree",
    needClass: "To mark it by hand I need your class: set it in “Edit character”.",
    loading: "Reading your tree…",
    failed: "I couldn't read your tree right now. Try again in a moment.",
    retry: "Try again",
    summary: (taken: number, version: string) => `You have ${taken} ${taken === 1 ? "passive" : "passives"} on the ${version} tree.`,
    forSkills: (skills: string) => `What helps ${skills} most, in the order you take it:`,
    noSkill: "I have your tree, but I don't know which skill does your damage. Tell me and I'll show which notables help it.",
    setSkill: "Tell you my skill",
    nothing: "I don't see any nearby notable that helps what you use. Look at the tree below.",
    points: (points: number, first: boolean) => `${first ? "" : "+"}${points} ${points === 1 ? "point" : "points"}`,
    gives: "Gives",
    why: "Why",
    pob: "PoB2",
    pobDamage: (gain: string) => `${gain}% damage`,
    pobDefence: (gain: string) => `${gain}% toughness`,
    orderedByPob: "Ordered by what gives you most damage per point according to PoB2.",
    defenceByPob: "According to PoB2, it's what gives you most toughness per point near your tree.",
    onTheWay: (count: number) => `What you take on the way (${count} ${count === 1 ? "node" : "nodes"})`,
    search: "In the game, type the name in the tree's search box and it gets highlighted.",
    copy: "Copy the name",
    copied: "Copied",
    show: "Show on the tree",
    defenceTitle: "If you die a lot",
    defenceLead: (points: number) => `${points} ${points === 1 ? "point" : "points"} from your tree today.`,
    mismatch: (code: string, tree: string) =>
      `Your code is from tree ${code} and the site uses ${tree}: some nodes may not match. Export it again from an updated Path of Building 2.`,
    unknown: (count: number) => `${count} ${count === 1 ? "node from your code isn't" : "nodes from your code aren't"} on this tree.`,
    rules: "Picked by rules with the official tree and your skills, no AI. You decide.",
    source: (version: string) => `Official tree by Grinding Gear Games (${version}); Spanish names from poe2db.`,
    notice: GGG_AFFILIATION_NOTICE,
    edit: "Edit my tree",
    editingTitle: "Editing your tree",
    editingHelp: "Tap a node to see what it gives, then take or remove it from its card. Taking a node takes the path to it.",
    pointsUsed: (used: number, max: number, level: number) => `${used} points of about ${max} you can have at level ${level}`,
    pointsOver: "That's more points than you can have at your level: check if something is extra.",
    undo: "Undo",
    cancel: "Cancel",
    save: "Save my tree",
    saving: "Saving…",
    take: (points: number) => `Take (${points === 1 ? "1 point" : `${points} points`})`,
    remove: (count: number) => (count > 1 ? `Remove ${count} nodes` : "Remove"),
    removeHelp: (count: number) => `The ${count - 1} behind it lose their path and go too.`,
    attributeGroup: "Attribute this node gives",
    discard: "Throw away the changes?",
    cantTake: "It can't be reached from your tree.",
    locked: "Something else opens this node (an ascendancy or an item): it isn't taken with points.",
    choiceFirst: "Take the node this option comes from first.",
    attribute: "Gives",
    attributes: { str: "Strength", dex: "Dexterity", int: "Intelligence" } as Record<Attribute, string>,
    preview: "What it would cost",
    ascendancyKept: (count: number) => `Your ${count} ascendancy nodes stay as they were.`,
  },
);

interface PassiveTreeCardProps {
  /** El personaje que ven el motor y el Mentor (con la revisión rápida). */
  profile: CharacterProfile;
  /** Abre el editor en «Rellénalo rápido» → código de PoB2. */
  onPasteCode: () => void;
  /** Abre la revisión rápida para decir la habilidad principal. */
  onSetSkill: () => void;
  /** Guarda el árbol marcado a mano. */
  onSavePassives: (refs: string[], attributeChoices: Record<string, Attribute>, treeVersion: string | null) => Promise<boolean>;
}

function joinNames(names: string[], lang: "es" | "en"): string {
  const list = names.slice(0, 2);
  if (list.length <= 1) return list[0] ?? "";
  return `${list[0]} ${lang === "es" ? "y" : "and"} ${list[1]}`;
}

function damageOf(summary: PobSummary): number {
  return summary.dps > 0 ? summary.dps : summary.minionDps;
}

function percentGain(before: number, after: number): number {
  return before > 0 ? ((after - before) / before) * 100 : 0;
}

function CopyName({ name }: { name: string }) {
  const t = useText(TEXT);
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(name)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
      aria-label={`${t.copy}: ${name}`}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? t.copied : t.copy}
    </Button>
  );
}

interface StepPob {
  damage: number;
  defence: number;
  /** Puntos de su camino desde el árbol de hoy. */
  points: number;
}

function Step({
  step,
  label,
  first,
  onShow,
  pob,
}: {
  step: Suggestion;
  label: string;
  first: boolean;
  onShow: () => void;
  pob: StepPob | null;
}) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const wayCount = step.onTheWay.reduce((total, group) => total + group.count, 0);
  const number = new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: 1, signDisplay: "always" });
  return (
    <li className="rounded-lg border border-border bg-background/40 p-3" data-testid="arbol-paso">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-base font-semibold text-foreground">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-emerald-950">
            {label}
          </span>
          {step.name}
        </p>
        <span className="flex flex-wrap items-center gap-1.5">
          {pob && (Math.abs(pob.damage) >= 0.05 || Math.abs(pob.defence) >= 0.05) && (
            <span className="rounded-full border border-primary/40 px-2 py-0.5 text-xs tabular-nums text-primary" data-testid="arbol-paso-pob">
              {t.pob}:{" "}
              {[
                Math.abs(pob.damage) >= 0.05 ? t.pobDamage(number.format(pob.damage)) : null,
                Math.abs(pob.defence) >= 0.05 ? t.pobDefence(number.format(pob.defence)) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
          <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-xs tabular-nums text-emerald-200">
            {t.points(step.points, first)}
          </span>
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold">{t.gives}:</span> {step.stats.join(" · ")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground/90">{t.why}:</span> {step.reasons.join(" ")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onShow} data-testid="arbol-ver-nodo">
          <MapPin className="size-3.5" aria-hidden="true" />
          {t.show}
        </Button>
        <CopyName name={step.search} />
      </div>
      {wayCount > 0 && (
        <details className="mt-2 text-xs text-muted-foreground" data-testid="arbol-camino">
          <summary className="cursor-pointer select-none hover:text-foreground">{t.onTheWay(wayCount)}</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {step.onTheWay.map((group) => (
              <li key={group.text} className="list-disc">
                {group.count > 1 ? `${group.count} × ` : ""}
                {group.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

interface Draft {
  /** Lo que el editor no toca y se guarda tal cual: ascendencia y nodos de otra versión del árbol. */
  keep: string[];
  /** Inicio de la clase en este árbol (de lo guardado o de la clase). */
  origin: string;
  allocated: Set<string>;
  choices: Record<string, Attribute>;
  history: Array<{ allocated: Set<string>; choices: Record<string, Attribute> }>;
}

/** Lo que gana cada notable cercano que probó PoB2 (clave del notable → % de daño y de aguante). */
function exploreGains(analysis: PobAnalysis | null): Map<string, { damage: number; defence: number; points: number; path: string[] }> {
  const gains = new Map<string, { damage: number; defence: number; points: number; path: string[] }>();
  if (!analysis) return gains;
  for (const entry of analysis.explore) {
    gains.set(entry.id, {
      damage: percentGain(damageOf(analysis.main), damageOf(entry.after)),
      defence: percentGain(analysis.main.ehp, entry.after.ehp),
      points: entry.points,
      path: entry.path,
    });
  }
  return gains;
}

/** Mejores notables cercanos según PoB2: más daño o más aguante por punto. */
function picksFrom(
  gains: ReturnType<typeof exploreGains>,
  describe: (key: string) => { name: string; stats: string[] },
): PobPick[] {
  const scored = [...gains.entries()].map(([key, gain]) => ({ key, ...gain }));
  const pick = (entry: (typeof scored)[number], kind: PobPick["kind"]): PobPick => ({
    key: entry.key,
    ...describe(entry.key),
    points: entry.points,
    path: entry.path,
    gain: kind === "damage" ? entry.damage : entry.defence,
    kind,
  });
  const damage = scored
    .filter((entry) => entry.damage >= 0.5)
    .sort((a, b) => b.damage / b.points - a.damage / a.points)
    .slice(0, 3)
    .map((entry) => pick(entry, "damage"));
  const taken = new Set(damage.map((entry) => entry.key));
  const defence = scored
    .filter((entry) => entry.defence >= 0.5 && !taken.has(entry.key))
    .sort((a, b) => b.defence / b.points - a.defence / a.points)
    .slice(0, 2)
    .map((entry) => pick(entry, "defence"));
  return [...damage, ...defence];
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * «Tu árbol de pasivas»: con el árbol del jugador (de su código de PoB2 o
 * marcado a mano aquí), los próximos notables (reglas, sin IA), el árbol
 * oficial dibujado, un editor como el de PoB y los números de PoB2.
 */
export function PassiveTreeCard({ profile, onPasteCode, onSetSkill, onSavePassives }: PassiveTreeCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const request = useMemo(() => treeRequestFromProfile(profile, lang), [profile, lang]);
  const requestKey = JSON.stringify(request);
  const hasTree = request.passives.length > 0;
  const [answer, setAnswer] = useState<{ key: string; data: PassiveTreeAdviceResponse } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [focus, setFocus] = useState<{ key: string | null; nonce: number }>({ key: null, nonce: 0 });
  const [graph, setGraph] = useState<TreeGraph | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pobEnabled, setPobEnabled] = useState(pobOptedIn);
  const [pobSkill, setPobSkill] = useState<string | null>(null);
  const [pobRetry, setPobRetry] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pobStatus = usePobStatus();
  // PoB2 (4 MB y bastante memoria) arranca cuando el jugador llega a la
  // tarjeta, no al abrir la web: quien solo mira las guías no lo paga.
  const sectionRef = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const section = sectionRef.current;
    if (seen || !section) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
    });
    observer.observe(section);
    return () => observer.disconnect();
  }, [seen]);

  useEffect(() => {
    if (!hasTree) return;
    let cancelled = false;
    api
      .passiveTreeAdvice(JSON.parse(requestKey) as typeof request)
      .then((data) => {
        if (!cancelled) setAnswer({ key: requestKey, data });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // `request` se lee a través de su clave: así no se pide dos veces lo mismo.
  }, [requestKey, hasTree, attempt]);

  // El grafo (el mismo árbol que pinta el mapa) hace falta para editar y para
  // nombrar lo que propone PoB2.
  useEffect(() => {
    if (graph) return;
    let cancelled = false;
    loadPassiveGraph()
      .then((loaded) => {
        if (!cancelled) setGraph(loaded);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [graph]);

  const data = answer?.key === requestKey ? answer.data : null;
  const classTree = useMemo(() => (graph ? treeForClass(graph.data, profile.characterClass) : null), [graph, profile.characterClass]);
  const start = useMemo(() => (graph ? classStartFor(graph, profile.characterClass) : null), [graph, profile.characterClass]);
  const savedRefs = useMemo(() => profile.passives.allocated.map((node) => node.ref), [profile.passives.allocated]);
  const ascendancyRefs = useMemo(
    () => (graph ? savedRefs.filter((ref) => graph.ascendancy.has(ref)) : []),
    [graph, savedRefs],
  );
  const describeNode = useCallback(
    (key: string) => {
      const node = classTree?.nodes[key];
      return node ? { name: nodeName(node, lang), stats: nodeStats(node, lang) } : { name: key, stats: [] };
    },
    [classTree, lang],
  );

  // Un notable de «Lo mejor cerca» que el jugador ha pedido ver: su camino en el mapa.
  const [pickPreview, setPickPreview] = useState<{ key: string; path: string[] } | null>(null);

  const show = (key: string) => {
    setFocus((current) => ({ key, nonce: current.nonce + 1 }));
    document.getElementById("arbol-pasivas-mapa")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  // ---------------------------------------------------------------------------
  // Editor
  // ---------------------------------------------------------------------------

  const canMarkByHand = exportClassName(profile.characterClass) !== null;

  const beginEditing = () => {
    if (!graph || !start) return;
    const read = readAllocated(graph, savedRefs, profile.characterClass);
    // El inicio que trae el árbol manda: si no casa con la clase, quitar un
    // nodo no debe soltar el árbol entero.
    const origin = read.start ?? start;
    const allocated = new Set(read.allocated);
    allocated.add(origin);
    const keep = savedRefs.filter((ref) => !(ref in graph.data.nodes) && !graph.keyById.has(ref));
    setDraft({ keep, origin, allocated, choices: { ...(profile.passives.attributeChoices ?? {}) }, history: [] });
    setSelected(null);
    setConfirmCancel(false);
  };

  const pushDraft = (allocated: Set<string>, choices: Record<string, Attribute>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            allocated,
            choices,
            history: [...current.history.slice(-40), { allocated: current.allocated, choices: current.choices }],
          }
        : current,
    );
  };

  const take = (key: string) => {
    if (!graph || !draft) return;
    const result = allocateNode(graph, draft.allocated, draft.origin, key);
    if (!result.ok) return;
    const choices = { ...draft.choices };
    const attribute = defaultAttribute(profile.characterClass);
    for (const added of result.added) {
      if (graph.data.nodes[added]?.kind === "attribute" && !choices[added]) choices[added] = attribute;
    }
    pushDraft(result.allocated, choices);
  };

  const remove = (key: string) => {
    if (!graph || !draft) return;
    const result = deallocateNode(graph, draft.allocated, draft.origin, key);
    if (!result.ok) return;
    const choices = Object.fromEntries(Object.entries(draft.choices).filter(([node]) => result.allocated.has(node)));
    pushDraft(result.allocated, choices);
  };

  const chooseAttribute = (key: string, attribute: Attribute) => {
    if (!draft) return;
    pushDraft(draft.allocated, { ...draft.choices, [key]: attribute });
  };

  const undo = () => {
    setDraft((current) => {
      if (!current || current.history.length === 0) return current;
      const previous = current.history[current.history.length - 1];
      return { ...current, allocated: previous.allocated, choices: previous.choices, history: current.history.slice(0, -1) };
    });
  };

  const draftRefs = useMemo(() => {
    if (!draft) return null;
    // PoB2 cuenta el inicio de la clase solo si hay algo más cogido.
    const main = draft.allocated.size > 1 ? [...draft.allocated] : [];
    return [...main, ...draft.keep];
  }, [draft]);

  const save = async () => {
    if (!draft || !draftRefs) return;
    setSaving(true);
    const choices = Object.fromEntries(Object.entries(draft.choices).filter(([key]) => draft.allocated.has(key)));
    const ok = await onSavePassives(draftRefs, choices, data?.tree.version ?? null);
    setSaving(false);
    if (ok) {
      setDraft(null);
      setSelected(null);
    }
  };

  const editPreview: MapSuggestion[] = useMemo(() => {
    if (!draft || !graph || !selected || draft.allocated.has(selected)) return [];
    const path = previewPath(graph, draft.allocated, draft.origin, selected);
    return path && path.length > 0 ? [{ key: selected, path, label: `+${path.length}` }] : [];
  }, [draft, graph, selected]);

  // ---------------------------------------------------------------------------
  // Path of Building 2
  // ---------------------------------------------------------------------------

  const damageSkills = useMemo(() => {
    const fromAdvice = data?.skills ?? [];
    if (fromAdvice.length > 0) return fromAdvice.slice(0, 4);
    return [...new Set(profile.skills.map((skill) => skill.mainSkill))].slice(0, 4);
  }, [data, profile.skills]);
  // Sin elegir, la habilidad principal del personaje (la de la revisión rápida va la primera).
  const plainName = (name: string) => name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const declaredMain = profile.skills[0]?.mainSkill ?? "";
  const defaultSkill = damageSkills.find((name) => plainName(name) === plainName(declaredMain)) ?? damageSkills[0] ?? null;
  const mainSkill = pobSkill && damageSkills.includes(pobSkill) ? pobSkill : defaultSkill;

  // Lo que gana cada paso se mide con su camino desde el árbol de hoy (el
  // segundo paso de las reglas cuenta desde el primero): así se pueden comparar.
  const ownPaths = useMemo(
    () =>
      data && graph && start
        ? standalonePaths(graph, data.allocated, start, [...data.offence, ...(data.defence ? [data.defence] : [])].map((step) => step.key))
        : null,
    [data, graph, start],
  );
  const candidates = useMemo(
    () =>
      data
        ? [...data.offence, ...(data.defence ? [data.defence] : [])].map((step) => ({ id: step.key, path: ownPaths?.get(step.key) ?? step.path }))
        : [],
    [data, ownPaths],
  );
  const pobProfile = useMemo(
    () =>
      draft
        ? {
            ...profile,
            passives: {
              ...profile.passives,
              attributeChoices: Object.fromEntries(Object.entries(draft.choices).filter(([key]) => draft.allocated.has(key))),
            },
          }
        : profile,
    [profile, draft],
  );
  // Con árbol guardado se espera a las sugerencias: así se calcula una vez, con sus caminos.
  const adviceSettled = !hasTree || (data !== null && graph !== null) || failedKey === requestKey;
  const currentRequest: PobRequest | null = useMemo(
    () =>
      draftRefs || (hasTree && adviceSettled)
        ? {
            profile: pobProfile,
            mainSkill,
            ...(draftRefs ? { passives: draftRefs } : {}),
            candidates: draftRefs ? [] : candidates,
            explorePoints: 6,
          }
        : null,
    [hasTree, adviceSettled, draftRefs, pobProfile, mainSkill, candidates],
  );
  const baselineRequest: PobRequest | null = useMemo(
    () => (draft && hasTree ? { profile, mainSkill } : null),
    [draft, hasTree, profile, mainSkill],
  );
  const pobActive = pobEnabled && (seen || draft !== null);
  const current = usePobAnalysis(currentRequest, pobActive, pobRetry);
  const baseline = usePobAnalysis(baselineRequest, pobActive && draft !== null, pobRetry, "baseline");

  const stepPob = useMemo(() => {
    const result = new Map<string, StepPob>();
    const analysis = current.result?.analysis;
    if (!analysis || draft) return result;
    for (const candidate of analysis.candidates) {
      result.set(candidate.id, {
        damage: percentGain(damageOf(analysis.main), damageOf(candidate.after)),
        defence: percentGain(analysis.main.ehp, candidate.after.ehp),
        points: candidate.points,
      });
    }
    return result;
  }, [current.result, draft]);

  const gains = useMemo(() => exploreGains(current.result?.analysis ?? null), [current.result]);

  // Con los números de PoB2, primero lo que más daño da por punto.
  const classGraph = useMemo(() => (graph && classTree ? { ...graph, data: classTree } : graph), [graph, classTree]);
  const ordered = useMemo(() => {
    const steps = data?.offence ?? [];
    if (!data || !classGraph || !start || stepPob.size === 0) return { steps, reordered: false };
    return orderStepsByGain(steps, stepPob, classGraph, data.allocated, start, lang);
  }, [data, classGraph, start, stepPob, lang]);

  // «Si mueres mucho»: si PoB2 encuentra cerca algo que da bastante más aguante
  // por punto que lo que eligen las reglas, se propone eso (y se dice por qué).
  const defence = useMemo((): { step: Suggestion | null; pob: StepPob | null } => {
    const rules = data?.defence ?? null;
    const rulesPob = rules ? (stepPob.get(rules.key) ?? null) : null;
    if (!data || draft || !classGraph) return { step: rules, pob: rulesPob };
    const taken = new Set(ordered.steps.map((step) => step.key));
    const best = [...gains.entries()]
      .filter(([key, gain]) => gain.defence >= 3 && !taken.has(key))
      .sort((a, b) => b[1].defence / b[1].points - a[1].defence / a[1].points)[0];
    if (!best) return { step: rules, pob: rulesPob };
    const [key, gain] = best;
    const rulesPerPoint = rulesPob ? rulesPob.defence / Math.max(1, rulesPob.points) : 0;
    if (rules && (rulesPob === null || rules.key === key || gain.defence / gain.points <= rulesPerPoint * 2)) {
      return { step: rules, pob: rulesPob };
    }
    const node = describeNode(key);
    return {
      step: {
        key,
        name: node.name,
        search: node.name,
        stats: node.stats,
        points: gain.points,
        path: gain.path,
        onTheWay: onTheWayGroups(classGraph, gain.path, lang),
        reasons: [t.defenceByPob],
        kind: "defence",
      },
      pob: { damage: gain.damage, defence: gain.defence, points: gain.points },
    };
  }, [data, draft, classGraph, ordered, gains, stepPob, describeNode, lang, t.defenceByPob]);

  // «Lo mejor cerca» no repite lo que ya está en la lista de arriba.
  const picks = useMemo(() => {
    const shown = new Set([...ordered.steps.map((step) => step.key), ...(defence.step ? [defence.step.key] : [])]);
    return picksFrom(new Map([...gains].filter(([key]) => draft !== null || !shown.has(key))), describeNode);
  }, [gains, describeNode, ordered, defence, draft]);

  const suggestions: MapSuggestion[] = useMemo(() => {
    if (!data) return [];
    const list = ordered.steps.map((step, index) => ({ key: step.key, path: step.path, label: String(index + 1) }));
    if (defence.step) list.push({ key: defence.step.key, path: defence.step.path, label: lang === "es" ? "Defensa" : "Defence" });
    if (pickPreview && !list.some((step) => step.key === pickPreview.key)) {
      list.push({ key: pickPreview.key, path: pickPreview.path, label: t.pob });
    }
    return list;
  }, [data, ordered, defence, lang, pickPreview, t.pob]);


  const nodeActions = (key: string) => {
    if (!draft || !graph) return null;
    const node = graph.data.nodes[key];
    if (!node || node.kind === "start") return null;
    if (draft.allocated.has(key)) {
      const removal = deallocateNode(graph, draft.allocated, draft.origin, key);
      const count = removal.ok ? removal.removed.length : 1;
      return (
        <div className="mt-2 flex flex-col gap-2" data-testid="arbol-editar-nodo">
          {node.kind === "attribute" && (
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.attributeGroup}>
              <span className="text-xs text-muted-foreground">{t.attribute}:</span>
              {(["str", "dex", "int"] as const).map((attribute) => (
                <button
                  key={attribute}
                  type="button"
                  onClick={() => chooseAttribute(key, attribute)}
                  aria-pressed={(draft.choices[key] ?? defaultAttribute(profile.characterClass)) === attribute}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs",
                    (draft.choices[key] ?? defaultAttribute(profile.characterClass)) === attribute
                      ? "border-primary bg-primary/20 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.attributes[attribute]}
                </button>
              ))}
            </div>
          )}
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => remove(key)} data-testid="arbol-quitar">
            {t.remove(count)}
          </Button>
          {count > 1 && <p className="text-xs text-muted-foreground">{t.removeHelp(count)}</p>}
        </div>
      );
    }
    if (node.locked) return <p className="mt-2 text-xs text-muted-foreground">{t.locked}</p>;
    const path = previewPath(graph, draft.allocated, draft.origin, key);
    if (path === null) {
      return <p className="mt-2 text-xs text-muted-foreground">{node.choiceOf !== undefined ? t.choiceFirst : t.cantTake}</p>;
    }
    const gain = gains.get(key);
    const number = new Intl.NumberFormat(lang === "es" ? "es-ES" : "en-GB", { maximumFractionDigits: 1, signDisplay: "always" });
    const pobLine = gain
      ? [
          Math.abs(gain.damage) >= 0.05 ? t.pobDamage(number.format(gain.damage)) : null,
          Math.abs(gain.defence) >= 0.05 ? t.pobDefence(number.format(gain.defence)) : null,
        ].filter(Boolean)
      : [];
    return (
      <div className="mt-2 flex flex-col items-start gap-1.5">
        {pobLine.length > 0 && (
          <p className="text-xs tabular-nums text-primary" data-testid="arbol-nodo-pob">
            {t.pob}: {pobLine.join(" · ")}
          </p>
        )}
        <Button type="button" size="sm" onClick={() => take(key)} data-testid="arbol-coger">
          {t.take(path.length)}
        </Button>
      </div>
    );
  };

  // PoB2 nombra la habilidad en inglés: en español se enseña como en el juego.
  const { data: pobData } = usePobData(pobActive);
  const computedSkill = useMemo(() => {
    const skill = current.result?.analysis.skill;
    if (!skill?.name) return null;
    if (!pobData) return { name: skill.name, level: skill.level };
    // El nombre tal como lo enseña la web (el de los botones de habilidad), si es esa.
    const shown = [...damageSkills, ...profile.skills.map((setup) => setup.mainSkill)].find(
      (name) => findPobGem(pobData, name)?.name === skill.name,
    );
    return { name: shown ?? skill.name, level: skill.level };
  }, [current.result, pobData, damageSkills, profile.skills]);

  const enablePob = () => {
    rememberPobOptIn();
    setPobEnabled(true);
    setSeen(true);
    pobClient.start();
    if (import.meta.env.PROD) sendUseBeacon("calculo-pob");
  };

  // Lo que cambiaría el código de exportar: si cambia, el código viejo se borra.
  const exportKey = useMemo(
    () => JSON.stringify([profile.id, profile.level, draftRefs ?? savedRefs, draft?.choices ?? profile.passives.attributeChoices ?? null, mainSkill]),
    [profile.id, profile.level, draftRefs, savedRefs, draft, profile.passives.attributeChoices, mainSkill],
  );

  const makeCode = async () => {
    const pobData = await loadPobData();
    const built = pobXmlForProfile(pobProfile, pobData, { mainSkill, ...(draftRefs ? { passives: draftRefs } : {}) });
    const code = pobCodeFromDeflated(await deflate(built.xml));
    if (import.meta.env.PROD) sendUseBeacon("exportar-pob");
    return code;
  };

  const takePick = (key: string) => {
    take(key);
    show(key);
  };

  // «Ver» en «Lo mejor cerca»: fuera del editor, el camino del notable se pinta en el mapa.
  const showPick = (key: string) => {
    const gain = gains.get(key);
    if (!draft && gain) setPickPreview({ key, path: gain.path });
    show(key);
  };

  // ---------------------------------------------------------------------------
  // Pintar
  // ---------------------------------------------------------------------------

  const editing = draft !== null;
  const level = profile.level || 1;
  const used = draft && graph ? pointsSpent(graph, draft.allocated) : 0;
  const maxPoints = maxPassivePoints(level);

  const map = (allocated: string[], mapSuggestions: MapSuggestion[]) => (
    <div id="arbol-pasivas-mapa">
      <Suspense
        fallback={<div className="h-[360px] rounded-lg border border-border bg-[#07080b] sm:h-[440px]" aria-hidden="true" />}
      >
        <PassiveTreeMap
          characterClass={profile.characterClass || null}
          allocated={allocated}
          suggestions={mapSuggestions}
          focusKey={focus.key}
          focusNonce={focus.nonce}
          onSelect={setSelected}
          {...(editing ? { nodeActions, keepView: true, stateLabels: { planned: t.preview } } : {})}
        />
      </Suspense>
    </div>
  );

  const pobPanel = (
    <PobPanel
      status={pobStatus}
      enabled={pobEnabled}
      onEnable={enablePob}
      onRetry={() => {
        pobClient.start();
        setPobRetry((value) => value + 1);
      }}
      busy={current.busy}
      stale={current.stale}
      error={current.error}
      analysis={current.result?.analysis ?? null}
      baseline={baseline.stale ? null : (baseline.result?.analysis ?? null)}
      notes={current.result?.notes ?? null}
      skills={damageSkills}
      skill={mainSkill}
      onSkill={setPobSkill}
      computedSkill={computedSkill}
      picks={picks}
      editing={editing}
      onShowNode={showPick}
      onTakeNode={takePick}
      makeCode={makeCode}
      exportKey={exportKey}
      version={pobStatus.state === "ready" ? pobStatus.meta.pobVersion : null}
    />
  );

  const editor = draft && (
    <div className="flex flex-col gap-3" data-testid="arbol-editor">
      <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/5 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Pencil className="size-4 text-emerald-300" aria-hidden="true" />
          {t.editingTitle}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{t.editingHelp}</p>
        {ascendancyRefs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t.ascendancyKept(ascendancyRefs.length)}</p>}
      </div>
      {map([...draft.allocated], editPreview)}
      {pobPanel}
      {/* Siempre a mano: en el móvil el editor es largo y guardar no puede quedarse arriba. */}
      <div
        className="sticky bottom-3 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-400/40 bg-card/95 p-2.5 shadow-lg backdrop-blur"
        data-testid="arbol-barra"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm tabular-nums text-foreground" data-testid="arbol-puntos">
            {t.pointsUsed(used, maxPoints, level)}
          </p>
          {used > maxPoints && <p className="text-xs text-amber-200">{t.pointsOver}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving} data-testid="arbol-guardar">
            {saving ? t.saving : t.save}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={draft.history.length === 0}>
            <Undo2 className="size-4" aria-hidden="true" />
            {t.undo}
          </Button>
          <Button
            type="button"
            variant={confirmCancel ? "destructive" : "ghost"}
            size="sm"
            onClick={() => {
              // Con cambios hechos, el primer toque pregunta y el segundo los tira.
              if (draft.history.length > 0 && !confirmCancel) {
                setConfirmCancel(true);
                return;
              }
              setDraft(null);
              setSelected(null);
              setConfirmCancel(false);
            }}
            onBlur={() => setConfirmCancel(false)}
          >
            {confirmCancel ? t.discard : t.cancel}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="arbol-pasivas"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="arbol-pasivas-titulo"
      data-testid="arbol-pasivas"
    >
      <h2 id="arbol-pasivas-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Network className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>

      {editing ? (
        <div className="mt-2">{editor}</div>
      ) : !hasTree ? (
        <div className="mt-2 flex flex-col items-start gap-2" data-testid="arbol-vacio">
          <p className="text-sm leading-relaxed text-muted-foreground">{t.emptyLead}</p>
          <p className="text-xs text-muted-foreground">{t.emptyHow}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={onPasteCode} data-testid="arbol-pegar-codigo">
              {t.pasteCode}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={beginEditing}
              disabled={!canMarkByHand || !graph || !start}
              data-testid="arbol-marcar"
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t.markByHand}
            </Button>
          </div>
          {!canMarkByHand && <p className="text-xs text-muted-foreground">{t.needClass}</p>}
        </div>
      ) : failedKey === requestKey ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground" role="status">
            {t.failed}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFailedKey(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : data === null ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {/* El nodo de inicio de la clase viene en la lista (el mapa lo pinta), pero no es un punto gastado. */}
            {t.summary(data.allocated.filter((key) => key !== data.start).length, data.tree.version)}{" "}
            {data.unknownCount > 0 && data.versionMismatch === null ? t.unknown(data.unknownCount) : null}
          </p>
          {data.versionMismatch && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-amber-100" data-testid="arbol-version">
              {t.mismatch(data.versionMismatch.code, data.versionMismatch.tree)}
            </p>
          )}

          {data.skills.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">{t.noSkill}</p>
              <Button type="button" variant="outline" size="sm" onClick={onSetSkill}>
                {t.setSkill}
              </Button>
            </div>
          ) : data.offence.length === 0 && defence.step === null ? (
            <p className="text-sm text-muted-foreground">{t.nothing}</p>
          ) : (
            <>
              {data.offence.length > 0 && (
                <>
                  <p className="text-sm text-foreground/90">{t.forSkills(joinNames(data.skills, lang))}</p>
                  {ordered.reordered && (
                    <p className="text-xs text-primary" data-testid="arbol-orden-pob">
                      {t.orderedByPob}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t.search}</p>
                  <ol className="flex flex-col gap-2">
                    {ordered.steps.map((step, index) => (
                      <Step
                        key={step.key}
                        step={step}
                        label={String(index + 1)}
                        first={index === 0}
                        onShow={() => show(step.key)}
                        pob={stepPob.get(step.key) ?? null}
                      />
                    ))}
                  </ol>
                </>
              )}
              {defence.step && (
                <div data-testid="arbol-defensa">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ShieldPlus className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    {t.defenceTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.defenceLead(defence.step.points)}</p>
                  <ol className="mt-2">
                    <Step step={defence.step} label="D" first onShow={() => show(defence.step!.key)} pob={defence.pob} />
                  </ol>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t.rules}</p>
            </>
          )}

          {pobPanel}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={beginEditing}
              disabled={!graph || !start}
              data-testid="arbol-editar"
            >
              <Pencil className="size-4" aria-hidden="true" />
              {t.edit}
            </Button>
          </div>
          {map(data.allocated, suggestions)}
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {t.source(data.tree.version)} {t.notice}
          </p>
        </div>
      )}
      {editing && data && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
          {t.source(data.tree.version)} {t.notice}
        </p>
      )}
    </section>
  );
}
