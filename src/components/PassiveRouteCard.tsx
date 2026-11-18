import { useState } from "react";
import { ExternalLink, Network } from "lucide-react";
import { readCharacterLevel, type CharacterProfile } from "@shared/domain.js";
import {
  PASSIVE_ROUTES,
  passivePointsFromLevel,
  stepsWithinPoints,
  type PassiveFamily,
} from "@/guides/passiveRoutes";
import { texts, useLang, useText } from "@/i18n/lang";
import { cn } from "@/lib/utils";

const TEXT = texts(
  {
    title: "Tus puntos del árbol",
    doneOf: (done: number, total: number) => `${done} de ${total} cogidos`,
    family: { hechizos: "Hechizos", defensa: "Defensa", caos: "Caos", esbirros: "Esbirros", mixto: "Caos + esbirros" },
    points: (count: number) => `${count} puntos`,
    reachNone: (level: number, points: number, first: number) =>
      `Con nivel ${level} tienes al menos ${points} puntos: el primer nodo llega a los ${first}.`,
    reach: (level: number, points: number, step: number, name: string) =>
      `Con nivel ${level} tienes al menos ${points} puntos (más los de misiones): te llega hasta el nodo ${step}, ${name}.`,
    reachAll: (level: number, points: number) =>
      `Con nivel ${level} tienes al menos ${points} puntos: te llega para toda la ruta.`,
    otherClass: (className: string) => `Esta ruta es de ${className}. Si llevas otra clase, quédate con la regla de abajo.`,
    ruleTitle: "Cómo saber si un nodo es para ti",
    rules: [
      "Lee el nodo antes de gastar el punto. Tiene que nombrar lo que usas (caos, hechizos, esbirros) o tu defensa (escudo de energía, vida).",
      "Si habla de algo que no llevas (fuego, hielo, ataques, un arma), no es para ti aunque esté cerca.",
      "Los nodos pequeños del camino también cuentan: elige el camino cuyos pequeños te sirvan.",
      "Cambiar un punto cuesta oro. Ve nodo a nodo en vez de rehacerlo todo.",
    ],
    source: (patch: string) =>
      `Ruta de ejemplo calculada sobre el árbol oficial de ${patch}. Los puntos son por el camino más corto; pueden variar en uno o dos según por dónde vayas. El texto de cada nodo es el de Grinding Gear Games, traducido por nosotros; el nombre en español es el del juego.`,
    plannerLead: "¿Quieres ver el árbol entero? Estos planificadores son webs externas y se abren en otra pestaña.",
    planners: [
      { href: "https://poe2db.tw/sp/passive-skill-tree", label: "Árbol en español (poe2db)" },
      { href: "https://maxroll.gg/poe2/passive-tree", label: "Planificador de Maxroll (en inglés)" },
    ],
  },
  {
    title: "Your passive tree points",
    doneOf: (done: number, total: number) => `${done} of ${total} taken`,
    family: { hechizos: "Spells", defensa: "Defence", caos: "Chaos", esbirros: "Minions", mixto: "Chaos + minions" },
    points: (count: number) => `${count} points`,
    reachNone: (level: number, points: number, first: number) =>
      `At level ${level} you have at least ${points} points: the first node needs ${first}.`,
    reach: (level: number, points: number, step: number, name: string) =>
      `At level ${level} you have at least ${points} points (plus quest rewards): that gets you to node ${step}, ${name}.`,
    reachAll: (level: number, points: number) =>
      `At level ${level} you have at least ${points} points: enough for the whole route.`,
    otherClass: (className: string) => `This route is for the ${className}. If you play another class, keep the rule below.`,
    ruleTitle: "How to tell whether a node is for you",
    rules: [
      "Read the node before spending the point. It has to name what you use (chaos, spells, minions) or your defence (energy shield, life).",
      "If it talks about something you don't use (fire, cold, attacks, a weapon), it isn't for you even if it's close.",
      "The small nodes on the way count too: pick the path whose small nodes help you.",
      "Changing a point costs gold. Go node by node instead of redoing everything.",
    ],
    source: (patch: string) =>
      `Example route worked out on the official ${patch} tree. Points follow the shortest path; they can vary by one or two depending on the way you take. Each node's text is Grinding Gear Games' own.`,
    plannerLead: "Want to see the whole tree? These planners are external sites and open in a new tab.",
    planners: [
      { href: "https://maxroll.gg/poe2/passive-tree", label: "Maxroll planner" },
      { href: "https://poe2db.tw/us/passive-skill-tree", label: "poe2db tree" },
    ],
  },
);

const STORAGE_PREFIX = "exile-copilot:arbol:";

const FAMILY_CLASS: Record<PassiveFamily, string> = {
  hechizos: "border-sky-400/40 text-sky-200",
  defensa: "border-emerald-400/40 text-emerald-200",
  caos: "border-fuchsia-400/45 text-fuchsia-200",
  esbirros: "border-amber-400/50 text-amber-200",
  mixto: "border-primary/50 text-primary",
};

function readTaken(routeId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + routeId) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** ¿El personaje es de la clase de la ruta? Vale el nombre en cualquiera de los dos idiomas. */
function sameClass(profileClass: string, classEs: string, classEn: string): boolean {
  const value = profileClass.trim().toLocaleLowerCase("es");
  return value === classEs.toLocaleLowerCase("es") || value === classEn.toLocaleLowerCase("en");
}

/**
 * «Tus puntos del árbol»: una ruta de pasivas en orden, con el texto real de
 * cada nodo. El jugador marca los que ya tiene; se recuerda en su navegador.
 */
export function PassiveRouteCard({ profile }: { profile: CharacterProfile | null }) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const route = PASSIVE_ROUTES[0];
  const [taken, setTaken] = useState<string[]>(() => readTaken(route.id));

  const toggle = (nodeId: string) => {
    const next = taken.includes(nodeId) ? taken.filter((id) => id !== nodeId) : [...taken, nodeId];
    setTaken(next);
    try {
      window.localStorage.setItem(STORAGE_PREFIX + route.id, JSON.stringify(next));
    } catch {
      // Sin almacenamiento (modo privado) la lista sigue funcionando en esta visita.
    }
  };

  const takenCount = route.steps.filter((step) => taken.includes(step.nodeId)).length;
  const levelReading = profile ? readCharacterLevel(profile) : null;
  const level = levelReading?.known ? levelReading.level : null;
  const className = lang === "en" ? route.classEn : route.classEs;
  const classMatches = profile ? sameClass(profile.characterClass, route.classEs, route.classEn) : true;

  let reach: string | null = null;
  if (level !== null && classMatches) {
    const points = passivePointsFromLevel(level);
    const within = stepsWithinPoints(route, points);
    if (within === 0) reach = t.reachNone(level, points, route.steps[0].points);
    else if (within === route.steps.length) reach = t.reachAll(level, points);
    else {
      const last = route.steps[within - 1];
      reach = t.reach(level, points, within, lang === "en" ? last.nameEn : last.nameEs);
    }
  }

  return (
    <section
      aria-labelledby="arbol-ruta-titulo"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      data-testid="arbol-ruta"
      data-route={route.id}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="arbol-ruta-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Network className="size-5 shrink-0 text-primary" aria-hidden="true" />
          {t.title}
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground" data-testid="arbol-ruta-progreso">
          {t.doneOf(takenCount, route.steps.length)}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground">{route.title[lang]}</p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{route.lead[lang]}</p>

      {reach !== null && (
        <p
          className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed text-foreground"
          data-testid="arbol-ruta-alcance"
        >
          {reach}
        </p>
      )}
      {!classMatches && (
        <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm leading-relaxed text-muted-foreground" data-testid="arbol-ruta-otra-clase">
          {t.otherClass(className)}
        </p>
      )}

      <ol className="mt-3 space-y-1">
        {route.steps.map((step, index) => {
          const checked = taken.includes(step.nodeId);
          const id = `arbol-ruta-${route.id}-${index}`;
          return (
            <li
              key={step.nodeId}
              className="flex gap-3 rounded-lg px-2 py-2 hover:bg-secondary/50"
              data-testid={`arbol-ruta-paso-${index}`}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={() => toggle(step.nodeId)}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <label htmlFor={id} className={cn("min-w-0 flex-1 cursor-pointer text-sm leading-relaxed", checked && "opacity-55")}>
                <span className="font-semibold text-foreground">
                  {index + 1}. {lang === "en" ? step.nameEn : step.nameEs}
                </span>
                {lang === "es" && <span className="ml-1.5 text-xs text-muted-foreground">({step.nameEn})</span>}
                <span className={cn("ml-2 rounded-full border px-1.5 py-px text-[11px]", FAMILY_CLASS[step.family])}>
                  {t.family[step.family]}
                </span>
                <span className="ml-1 rounded-full border border-border px-1.5 py-px text-[11px] tabular-nums text-muted-foreground">
                  {t.points(step.points)}
                </span>
                <span className="mt-0.5 block text-foreground/90" data-testid={`arbol-ruta-da-${index}`}>
                  {/* Espacio duro antes de «%»: sin él, el número y el signo se partían en dos líneas. */}
                  {lang === "en" ? step.official.join(" · ") : step.givesEs.replace(/ %/g, "\u00a0%")}
                </span>
                <span className="block text-muted-foreground">{step.why[lang]}</span>
              </label>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-lg border border-border/70 p-3">
        <h3 className="text-sm font-semibold text-foreground">{t.ruleTitle}</h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          {t.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground" data-testid="arbol-ruta-fuente">
        {t.source(route.checkedPatch)}
      </p>

      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t.plannerLead}</p>
      <ul className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {t.planners.map((link, index) => (
          <li key={link.href}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid={`guia-arbol-enlace-${index}`}
            >
              {link.label}
              <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
