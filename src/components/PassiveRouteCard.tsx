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
    next: "Tu siguiente nodo",
    have: (name: string) => `Ya tengo ${name}`,
    allTaken: "Ruta completa. Ya tienes los nueve nodos.",
    reachNone: (level: number, points: number, first: number) =>
      `Nivel ${level}: al menos ${points} puntos. El primer nodo pide ${first}.`,
    reach: (level: number, points: number, step: number, name: string) =>
      `Nivel ${level}: al menos ${points} puntos. Te llega hasta el nodo ${step}, ${name}.`,
    reachAll: (level: number, points: number) => `Nivel ${level}: al menos ${points} puntos. Te llega para toda la ruta.`,
    otherClass: (className: string) => `Ruta de ${className}. Con otra clase, usa la regla de abajo.`,
    ruleTitle: "Cómo saber si un nodo es para ti",
    rules: [
      "Lee el nodo antes de gastar el punto. Tiene que nombrar lo que usas (caos, hechizos, esbirros) o tu defensa (escudo de energía, vida).",
      "Si habla de algo que no llevas (fuego, hielo, ataques, un arma), no es para ti aunque esté cerca.",
      "Los nodos pequeños del camino también cuentan: elige el camino cuyos pequeños te sirvan.",
      "Cambiar un punto cuesta oro. Ve nodo a nodo en vez de rehacerlo todo.",
    ],
    aboutTitle: "Sobre esta ruta",
    questPoints: "Las misiones dan puntos aparte, así que puedes tener alguno más.",
    source: (patch: string) =>
      `Ruta de ejemplo calculada sobre el árbol oficial de ${patch}. Los puntos son por el camino más corto; pueden variar en uno o dos según por dónde vayas. El texto de cada nodo es el de Grinding Gear Games, traducido por nosotros; el nombre en español es el del juego.`,
    plannerTitle: "Ver el árbol entero",
    plannerLead: "Son webs externas y se abren en otra pestaña.",
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
    next: "Your next node",
    have: (name: string) => `I already have ${name}`,
    allTaken: "Route complete. You have all nine nodes.",
    reachNone: (level: number, points: number, first: number) =>
      `Level ${level}: at least ${points} points. The first node needs ${first}.`,
    reach: (level: number, points: number, step: number, name: string) =>
      `Level ${level}: at least ${points} points. That gets you to node ${step}, ${name}.`,
    reachAll: (level: number, points: number) => `Level ${level}: at least ${points} points. Enough for the whole route.`,
    otherClass: (className: string) => `${className} route. With another class, use the rule below.`,
    ruleTitle: "How to tell whether a node is for you",
    rules: [
      "Read the node before spending the point. It has to name what you use (chaos, spells, minions) or your defence (energy shield, life).",
      "If it talks about something you don't use (fire, cold, attacks, a weapon), it isn't for you even if it's close.",
      "The small nodes on the way count too: pick the path whose small nodes help you.",
      "Changing a point costs gold. Go node by node instead of redoing everything.",
    ],
    aboutTitle: "About this route",
    questPoints: "Quests give extra points, so you may have a few more.",
    source: (patch: string) =>
      `Example route worked out on the official ${patch} tree. Points follow the shortest path; they can vary by one or two depending on the way you take. Each node's text is Grinding Gear Games' own.`,
    plannerTitle: "See the whole tree",
    plannerLead: "These are external sites and open in a new tab.",
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

const FOLD_CLASS = "mt-2 rounded-lg border border-border/70 px-3 py-2 text-sm";
const FOLD_SUMMARY_CLASS = "cursor-pointer font-medium text-foreground";

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
 *
 * A la vista queda solo lo que hace falta ahora: hasta dónde llegan los
 * puntos y el siguiente nodo, abierto. Los demás nodos son una línea cada uno
 * y su detalle, la regla y la letra pequeña van plegados. Un smoke vigila que
 * la tarjeta no vuelva a pasar de una pantalla de texto.
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
  const nextIndex = route.steps.findIndex((step) => !taken.includes(step.nodeId));
  const levelReading = profile ? readCharacterLevel(profile) : null;
  const level = levelReading?.known ? levelReading.level : null;
  const className = lang === "en" ? route.classEn : route.classEs;
  const classMatches = profile ? sameClass(profile.characterClass, route.classEs, route.classEn) : true;
  const nameOf = (index: number) => (lang === "en" ? route.steps[index].nameEn : route.steps[index].nameEs);

  let reach: string | null = null;
  if (level !== null && classMatches) {
    const points = passivePointsFromLevel(level);
    const within = stepsWithinPoints(route, points);
    if (within === 0) reach = t.reachNone(level, points, route.steps[0].points);
    else if (within === route.steps.length) reach = t.reachAll(level, points);
    else reach = t.reach(level, points, within, nameOf(within - 1));
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

      {reach !== null && (
        <p
          className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm leading-relaxed text-foreground"
          data-testid="arbol-ruta-alcance"
        >
          {reach}
        </p>
      )}
      {!classMatches && (
        <p
          className="mt-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
          data-testid="arbol-ruta-otra-clase"
        >
          {t.otherClass(className)}
        </p>
      )}
      {nextIndex === -1 && (
        <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200" data-testid="arbol-ruta-completa">
          {t.allTaken}
        </p>
      )}

      <ol className="mt-3 space-y-1">
        {route.steps.map((step, index) => {
          const checked = taken.includes(step.nodeId);
          const isNext = index === nextIndex;
          const name = nameOf(index);
          return (
            <li
              key={step.nodeId}
              className={cn(
                "flex gap-3 rounded-lg px-2 py-1.5",
                isNext ? "border border-primary/40 bg-primary/[0.07] py-2.5" : "hover:bg-secondary/50",
              )}
              data-testid={`arbol-ruta-paso-${index}`}
              data-next={isNext ? "true" : "false"}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(step.nodeId)}
                aria-label={t.have(name)}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              {/* El siguiente nodo llega abierto. La `key` lo vuelve a montar al
                  cambiar de «siguiente», para que el abierto sea siempre el que toca. */}
              <details key={isNext ? "siguiente" : "resto"} open={isNext} className="min-w-0 flex-1 text-sm leading-relaxed">
                <summary className={cn("cursor-pointer list-none marker:content-none", checked && "opacity-55")}>
                  {isNext && (
                    <span className="mb-0.5 block text-xs font-semibold uppercase tracking-wide text-primary">
                      {t.next}
                    </span>
                  )}
                  <span className="font-semibold text-foreground">
                    {index + 1}. {name}
                  </span>
                  <span className={cn("ml-2 inline-block whitespace-nowrap rounded-full border px-1.5 py-px text-[11px]", FAMILY_CLASS[step.family])}>
                    {t.family[step.family]}
                  </span>
                  <span className="ml-1 inline-block whitespace-nowrap rounded-full border border-border px-1.5 py-px text-[11px] tabular-nums text-muted-foreground">
                    {t.points(step.points)}
                  </span>
                </summary>
                {/* Espacio duro antes de «%»: sin él, el número y el signo se partían en dos líneas. */}
                <p className="mt-1 text-foreground/90" data-testid={`arbol-ruta-da-${index}`}>
                  {lang === "en" ? step.official.join(" · ") : step.givesEs.replace(/ %/g, "\u00a0%")}
                </p>
                <p className="text-muted-foreground">
                  {step.why[lang]}
                  {lang === "es" && <span className="ml-1 text-xs">({step.nameEn})</span>}
                </p>
              </details>
            </li>
          );
        })}
      </ol>

      <details className={FOLD_CLASS} data-testid="arbol-ruta-regla">
        <summary className={FOLD_SUMMARY_CLASS}>{t.ruleTitle}</summary>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 leading-relaxed text-muted-foreground">
          {t.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>

      <details className={FOLD_CLASS} data-testid="arbol-ruta-fuente">
        <summary className={FOLD_SUMMARY_CLASS}>{t.aboutTitle}</summary>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{route.lead[lang]}</p>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{t.questPoints}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t.source(route.checkedPatch)}</p>
      </details>

      <details className={FOLD_CLASS} data-testid="arbol-ruta-planificadores">
        <summary className={FOLD_SUMMARY_CLASS}>{t.plannerTitle}</summary>
        <p className="mt-1.5 leading-relaxed text-muted-foreground">{t.plannerLead}</p>
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
      </details>
    </section>
  );
}
