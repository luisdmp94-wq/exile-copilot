import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowRight, Bot, ChevronDown, ChevronUp, Compass, HeartCrack, MessageCircleMore, Sparkles, Swords, X } from "lucide-react";
import { texts, useText } from "@/i18n/lang";
import type { MentorAnswer } from "@shared/mentorQuery.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hatRequested, isChristmasSeason } from "@/lib/season";
import type { MascotNextStepKind } from "@/lib/mascotNextStep";
import type {
  ContextualMentorAsk,
  ContextualMentorCue,
} from "@/lib/contextualMentor";

interface ContextualMentorProps {
  cue: ContextualMentorCue;
  answer: MentorAnswer | null;
  error: string | null;
  loading: boolean;
  canAsk: boolean;
  blockedReason?: string | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onAsk: (ask: ContextualMentorAsk) => Promise<void>;
  onOpenMentor: () => void;
  /** Flotante fuera del Expediente; integrado cuando acompaña a la paperdoll. */
  placement?: "floating" | "inline";
  /**
   * «¿Te has atascado?»: tres atajos para el jugador que solo quiere salir del
   * apuro. Cada uno lleva a donde ya está la respuesta (Mentor o guía).
   */
  onStuck?: (kind: StuckKind) => void;
  /** Abre «Avisar de un problema». */
  onReportProblem?: () => void;
  /** El consejo de «tu siguiente paso» y a dónde lleva su botón. */
  nextStep?: { kind: MascotNextStepKind; onGo: () => void } | null;
  /** Envía al Mentor una pregunta escrita en el bocadillo. Sin esto no hay cuadro. */
  onQuickQuestion?: (question: string) => void;
}

export type StuckKind = "damage" | "dying" | "lost";

type MascotVisualState = "ready" | "thinking" | "ai" | "warning" | "error";
type MascotSpeechPriority = "notice" | "important";

const MAX_ACKNOWLEDGED_SPEECHES = 24;

function rememberSpeechKey(current: ReadonlySet<string>, speechKey: string): Set<string> {
  if (current.has(speechKey)) return new Set(current);
  return new Set([...current, speechKey].slice(-MAX_ACKNOWLEDGED_SPEECHES));
}

function mascotSpeechPriority(
  cue: ContextualMentorCue,
  error: string | null,
  blockedReason: string | null,
): MascotSpeechPriority {
  return cue.source === "warning" || error !== null || blockedReason !== null
    ? "important"
    : "notice";
}

const SOURCE_STYLES: Record<ContextualMentorCue["source"], string> = {
  guide: "border-primary/45 bg-primary/10 text-primary",
  engine: "border-sky-400/40 bg-sky-400/10 text-sky-200",
  market: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
};

const TEXT = texts(
  {
    groundedAi: "IA fundamentada",
    rulesFallback: "Respaldo del motor de reglas",
    engine: "Respuesta del motor",
    thinking: "Pensando",
    aiReady: "IA lista",
    attention: "Atención",
    copilot: "Copiloto",
    news: "Novedad",
    region: "Mentor contextual",
    openExplanation: (title: string) => `Abrir explicación del Copiloto: ${title}`,
    seeExplanation: "Ver explicación",
    closeMessage: "Cerrar mensaje del Copiloto",
    openContextual: "Abrir mentor contextual",
    closeContextual: "Cerrar mentor contextual",
    titleOpen: (title: string) => `${title}. Abrir explicación`,
    openMentor: "Abrir mentor",
    closeMentor: "Cerrar mentor",
    openChat: "Abrir conversación con tu Copiloto",
    talk: "Hablar con tu Copiloto",
    yourCopilot: "Tu Copiloto",
    expand: "Desplegar mentor contextual",
    collapse: "Plegar mentor contextual",
    thinkingDots: "Pensando…",
    waiting: "Esperando revisión",
    askAgain: "Preguntar de nuevo",
    askHim: "Preguntarle",
    analyse: "Analizar este contexto",
    chat: "Abrir chat",
    conversation: "Ver conversación",
    checking: "Contrastando este contexto con tu personaje, el motor y el diario…",
    answer: "Respuesta contextual",
    aiCouldNot: (reason: string) => `La IA no pudo decidir: ${reason}`,
    nextTitle: "Tu siguiente paso",
    next: {
      create: { text: "Cuéntame tu personaje: un minuto y sin registrarte.", cta: "Crear mi personaje" },
      review: { text: "Dime tus resistencias y el acto, y te digo qué te frena.", cta: "Ir a la revisión rápida" },
      gear: { text: "Pega una pieza de tu equipo y te digo qué mejorar primero.", cta: "Pegar una pieza" },
      plan: { text: "Mira qué te conviene mejorar ahora y por qué.", cta: "Ver mi siguiente paso" },
    } as Record<MascotNextStepKind, { text: string; cta: string }>,
    askLabel: "Pregúntame algo",
    askPlaceholder: "Pregúntame algo…",
    askSend: "Preguntar",
    stuckTitle: "¿Te has atascado?",
    stuckDamage: "No hago daño",
    stuckDying: "Me matan",
    stuckLost: "No sé adónde ir",
    reportProblem: "Avisar de un problema",
  },
  {
    groundedAi: "Grounded AI",
    rulesFallback: "Rules engine fallback",
    engine: "Engine answer",
    thinking: "Thinking",
    aiReady: "AI ready",
    attention: "Heads up",
    copilot: "Copilot",
    news: "New",
    region: "Contextual mentor",
    openExplanation: (title: string) => `Open the Copilot's explanation: ${title}`,
    seeExplanation: "See explanation",
    closeMessage: "Close the Copilot's message",
    openContextual: "Open the contextual mentor",
    closeContextual: "Close the contextual mentor",
    titleOpen: (title: string) => `${title}. Open explanation`,
    openMentor: "Open mentor",
    closeMentor: "Close mentor",
    openChat: "Open the conversation with your Copilot",
    talk: "Talk to your Copilot",
    yourCopilot: "Your Copilot",
    expand: "Expand the contextual mentor",
    collapse: "Collapse the contextual mentor",
    thinkingDots: "Thinking…",
    waiting: "Waiting for review",
    askAgain: "Ask again",
    askHim: "Ask",
    analyse: "Analyse this context",
    chat: "Open chat",
    conversation: "See conversation",
    checking: "Checking this context against your character, the engine and the journal…",
    answer: "Contextual answer",
    aiCouldNot: (reason: string) => `The AI couldn't decide: ${reason}`,
    nextTitle: "Your next step",
    next: {
      create: { text: "Tell me about your character: it takes a minute, no sign-up.", cta: "Create my character" },
      review: { text: "Tell me your resistances and your act, and I'll tell you what's holding you back.", cta: "Go to the quick review" },
      gear: { text: "Paste one of your items and I'll tell you what to improve first.", cta: "Paste an item" },
      plan: { text: "See what to upgrade now, and why.", cta: "See my next step" },
    } as Record<MascotNextStepKind, { text: string; cta: string }>,
    askLabel: "Ask me something",
    askPlaceholder: "Ask me something…",
    askSend: "Ask",
    stuckTitle: "Stuck?",
    stuckDamage: "I lack damage",
    stuckDying: "I keep dying",
    stuckLost: "Where do I go?",
    reportProblem: "Report a problem",
  },
);
type MascotText = (typeof TEXT)["es"];

function answerLabel(answer: MentorAnswer, t: MascotText): string {
  if (answer.responseMode === "ai") {
    return answer.model ? `${t.groundedAi} · ${answer.model}` : t.groundedAi;
  }
  if (answer.responseMode === "rules_fallback") return t.rulesFallback;
  return t.engine;
}

function mascotVisualState(
  cue: ContextualMentorCue,
  answer: MentorAnswer | null,
  loading: boolean,
  error: string | null,
  blockedReason: string | null,
): MascotVisualState {
  if (loading) return "thinking";
  if (error !== null || blockedReason !== null) return "error";
  if (cue.source === "warning") return "warning";
  if (answer?.responseMode === "ai") return "ai";
  return "ready";
}

function mascotStatusLabel(state: MascotVisualState, t: MascotText): string {
  if (state === "thinking") return t.thinking;
  if (state === "ai") return t.aiReady;
  if (state === "warning" || state === "error") return t.attention;
  return t.copilot;
}

function MentorRobot({
  state,
  source,
}: {
  state: MascotVisualState;
  source: ContextualMentorCue["source"];
}) {
  return (
    <span
      className="mentor-robot"
      data-state={state}
      data-source={source}
      aria-hidden="true"
    >
      <img
        className="mentor-robot__art"
        src="/mascot/copiloto-sin-ojos.webp"
        alt=""
        width={300}
        height={341}
        draggable="false"
      />
      <MentorEyes />
      {SHOW_CHRISTMAS_HAT && <MentorChristmasHat />}
      <span className="mentor-robot__shadow" />
    </span>
  );
}

/** Se decide una vez, al cargar: en Navidad, o con `?gorro=1` para verlo antes. */
const SHOW_CHRISTMAS_HAT =
  typeof window !== "undefined" && (isChristmasSeason(new Date()) || hatRequested(window.location.search));

/**
 * Gorro de Navidad sobre el casco. Va en el mismo viewBox que la ilustración
 * (1176 × 1337), como los ojos, así que queda colocado a cualquier tamaño.
 */
/** Mechones de la vuelta de piel, siguiendo la curva del casco: [x, y, radio]. */
const HAT_FUR_TUFTS: ReadonlyArray<readonly [number, number, number]> = [
  [384, 224, 32],
  [436, 188, 35],
  [488, 161, 33],
  [540, 145, 36],
  [592, 139, 34],
  [645, 145, 36],
  [697, 161, 33],
  [750, 187, 35],
  [802, 223, 32],
];

/** Mechones del pompón, alrededor de su centro. */
const HAT_POMPOM_TUFTS: ReadonlyArray<readonly [number, number, number]> = [
  [928, 206, 40],
  [900, 190, 24],
  [920, 174, 24],
  [948, 180, 24],
  [960, 206, 24],
  [946, 232, 24],
  [918, 238, 24],
  [898, 218, 24],
];

/**
 * Gorro de Navidad. Va pintado como la mascota: luz desde arriba a la
 * izquierda, sombra propia a la derecha, pliegues, y una vuelta de piel con
 * mechones que proyecta sombra sobre el casco. Todo son formas y degradados
 * (sin filtros), así no cuesta nada mientras la mascota se mueve.
 */
function MentorChristmasHat() {
  const id = useId().replace(/:/g, "");
  const red = `gorro-rojo-${id}`;
  const shade = `gorro-sombra-${id}`;
  const light = `gorro-luz-${id}`;
  const fur = `gorro-piel-${id}`;
  const pompom = `gorro-pompon-${id}`;
  const clip = `gorro-recorte-${id}`;
  const body =
    "M 394 200 C 398 110, 500 10, 640 -24 C 740 -46, 840 -10, 880 70 C 904 112, 922 150, 924 190 " +
    "C 900 152, 860 126, 806 132 C 808 160, 808 190, 800 216 Q 590 60 394 200 Z";
  const band = "M 382 222 Q 590 58 804 222";
  return (
    <svg
      className="mentor-robot__hat"
      viewBox="0 0 1176 1337"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      data-testid="mascota-gorro"
    >
      <defs>
        <linearGradient id={red} gradientUnits="userSpaceOnUse" x1="430" y1="0" x2="880" y2="230">
          <stop offset="0" stopColor="hsl(6 86% 58%)" />
          <stop offset="0.45" stopColor="hsl(358 80% 45%)" />
          <stop offset="1" stopColor="hsl(348 76% 26%)" />
        </linearGradient>
        <radialGradient id={shade}>
          <stop offset="0" stopColor="hsl(344 80% 10%)" stopOpacity="0.75" />
          <stop offset="1" stopColor="hsl(344 80% 10%)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={light}>
          <stop offset="0" stopColor="hsl(18 100% 78%)" stopOpacity="0.8" />
          <stop offset="1" stopColor="hsl(18 100% 78%)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={fur} gradientUnits="userSpaceOnUse" x1="560" y1="100" x2="620" y2="270">
          <stop offset="0" stopColor="hsl(40 60% 99%)" />
          <stop offset="0.55" stopColor="hsl(215 30% 92%)" />
          <stop offset="1" stopColor="hsl(218 28% 74%)" />
        </linearGradient>
        <radialGradient id={pompom} gradientUnits="userSpaceOnUse" cx="910" cy="182" r="78">
          <stop offset="0" stopColor="hsl(40 60% 99%)" />
          <stop offset="0.6" stopColor="hsl(215 30% 90%)" />
          <stop offset="1" stopColor="hsl(218 28% 72%)" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={body} />
        </clipPath>
      </defs>

      {/* Sombra que el gorro deja sobre el casco, bajo la vuelta de piel. */}
      <g fill="none" strokeLinecap="round" stroke="hsl(230 40% 4%)">
        <path d={band} strokeWidth="78" opacity="0.16" transform="translate(4 24)" />
        <path d={band} strokeWidth="64" opacity="0.24" transform="translate(3 14)" />
      </g>

      {/* El cuerpo rojo y su volumen, recortado a su propia silueta. */}
      <path d={body} fill={`url(#${red})`} />
      <g clipPath={`url(#${clip})`}>
        {/* Sombra propia: el lado derecho y la parte que se dobla. */}
        <ellipse cx="812" cy="176" rx="215" ry="116" fill={`url(#${shade})`} />
        <ellipse cx="892" cy="128" rx="92" ry="92" fill={`url(#${shade})`} />
        {/* Luz de arriba a la izquierda. */}
        <ellipse cx="520" cy="70" rx="185" ry="64" transform="rotate(-30 520 70)" fill={`url(#${light})`} />
        {/* Pliegues: cada uno con su sombra y su canto iluminado. */}
        <g fill="none" strokeLinecap="round">
          <path d="M 610 40 C 706 24, 800 56, 850 116" stroke="hsl(346 80% 14%)" strokeOpacity="0.55" strokeWidth="13" />
          <path d="M 606 24 C 706 6, 806 38, 858 98" stroke="hsl(14 100% 76%)" strokeOpacity="0.35" strokeWidth="7" />
          <path d="M 462 170 C 486 112, 540 64, 606 46" stroke="hsl(346 80% 14%)" strokeOpacity="0.32" strokeWidth="11" />
          <path d="M 704 142 C 740 126, 776 124, 806 132" stroke="hsl(346 80% 12%)" strokeOpacity="0.5" strokeWidth="10" />
          {/* Canto cálido a la izquierda, como el brillo dorado de la armadura. */}
          <path d="M 400 196 C 404 112, 504 16, 640 -18" stroke="hsl(36 100% 72%)" strokeOpacity="0.55" strokeWidth="9" />
        </g>
      </g>
      <path d={body} fill="none" stroke="hsl(348 78% 15%)" strokeWidth="6" strokeLinejoin="round" />

      {/* La vuelta de piel: borde oscuro por debajo, mechones claros encima. */}
      <g fill="hsl(220 24% 52%)" stroke="hsl(220 24% 52%)" strokeLinecap="round">
        <path d={band} fill="none" strokeWidth="54" transform="translate(3 9)" />
        {HAT_FUR_TUFTS.map(([x, y, r]) => (
          <circle key={`s-${x}`} cx={x + 3} cy={y + 9} r={r} stroke="none" />
        ))}
      </g>
      <g fill={`url(#${fur})`}>
        <path d={band} fill="none" stroke={`url(#${fur})`} strokeWidth="50" strokeLinecap="round" />
        {HAT_FUR_TUFTS.map(([x, y, r]) => (
          <circle key={`f-${x}`} cx={x} cy={y} r={r} />
        ))}
      </g>
      {/* Separación entre mechones y brillo en lo alto de cada uno. */}
      <g fill="none" stroke="hsl(218 26% 66%)" strokeOpacity="0.75" strokeWidth="6" strokeLinecap="round">
        {HAT_FUR_TUFTS.slice(0, -1).map(([x, y], index) => {
          const [nextX, nextY] = HAT_FUR_TUFTS[index + 1];
          const midX = (x + nextX) / 2;
          const midY = (y + nextY) / 2;
          return <path key={`c-${x}`} d={`M ${midX - 3} ${midY + 6} q 5 16 -2 30`} />;
        })}
      </g>
      <g fill="hsl(0 0% 100%)" fillOpacity="0.9">
        {HAT_FUR_TUFTS.map(([x, y, r]) => (
          <ellipse key={`h-${x}`} cx={x - 8} cy={y - r * 0.42} rx={r * 0.5} ry={r * 0.3} />
        ))}
      </g>

      {/* El pompón: su sombra, sus mechones y su brillo. */}
      <circle cx="936" cy="224" r="58" fill="hsl(230 40% 4%)" opacity="0.2" />
      <g fill="hsl(220 24% 52%)">
        {HAT_POMPOM_TUFTS.map(([x, y, r]) => (
          <circle key={`ps-${x}-${y}`} cx={x + 4} cy={y + 8} r={r + 2} />
        ))}
      </g>
      <g fill={`url(#${pompom})`}>
        {HAT_POMPOM_TUFTS.map(([x, y, r]) => (
          <circle key={`pf-${x}-${y}`} cx={x} cy={y} r={r + 2} />
        ))}
      </g>
      <g fill="none" stroke="hsl(218 26% 66%)" strokeOpacity="0.7" strokeWidth="5" strokeLinecap="round">
        <path d="M 932 212 q 10 12 6 28" />
        <path d="M 954 196 q 12 4 16 16" />
        <path d="M 910 220 q -2 12 6 22" />
      </g>
      <ellipse cx="912" cy="184" rx="22" ry="14" transform="rotate(-28 912 184)" fill="hsl(0 0% 100%)" fillOpacity="0.92" />
    </svg>
  );
}

/**
 * Los ojos del Copiloto, dibujados sobre el visor vacío de la ilustración.
 * El viewBox es el de la ilustración original (1176 × 1337): con
 * `xMidYMid meet` se colocan igual que la imagen con `object-fit: contain`.
 * Cada estado (lista, pensando, hablando, aviso, error) cambia los ojos solo
 * con CSS; el componente no tiene lógica propia.
 */
function MentorEyes() {
  const id = useId().replace(/:/g, "");
  const glow = `ojos-brillo-${id}`;
  const fill = `ojos-color-${id}`;
  return (
    <svg
      className="mentor-robot__eyes"
      viewBox="0 0 1176 1337"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
          <stop className="mentor-robot__eye-core" offset="0" />
          <stop className="mentor-robot__eye-edge" offset="1" />
        </linearGradient>
        <filter id={glow} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className="mentor-robot__eyes-look" filter={`url(#${glow})`}>
        <g className="mentor-robot__eyes-open" fill={`url(#${fill})`}>
          <path
            className="mentor-robot__eye"
            d="M366 524C366 486 384 464 406 464C428 464 446 486 446 524Q406 516 366 524Z"
          />
          <path
            className="mentor-robot__eye"
            d="M582 524C582 486 603 464 627 464C651 464 672 486 672 524Q627 516 582 524Z"
          />
        </g>
        {/* Ojos contentos («^ ^») mientras habla con una respuesta. */}
        <g
          className="mentor-robot__eyes-happy"
          fill="none"
          stroke={`url(#${fill})`}
          strokeWidth="16"
          strokeLinecap="round"
        >
          <path d="M370 514Q406 470 442 514" />
          <path d="M586 514Q627 470 668 514" />
        </g>
      </g>
    </svg>
  );
}

function shouldSpeakAutomatically(
  cue: ContextualMentorCue,
  error: string | null,
): boolean {
  // `recommendations:` NO habla sola: la prioridad recién generada ya es el
  // contenido dominante de la pantalla y el bocadillo repetía palabra por
  // palabra lo que el jugador acaba de leer. El Copiloto solo interrumpe cuando
  // trae algo que NO está ya delante: un resultado, un freno o un aviso.
  // Un aviso puede declararse «no anunciable»: la pantalla ya lo cuenta entera.
  if (cue.announce === false) return false;
  return (
    cue.id.startsWith("crafting-result:") ||
    cue.id.startsWith("crafting-coach:") ||
    cue.id.startsWith("tracked:") ||
    cue.id.startsWith("session:") ||
    cue.id.startsWith("session-result:") ||
    cue.id.startsWith("applied:") ||
    cue.source === "warning" ||
    // `error` es transitorio: acaba de fallar algo y la página puede no
    // decirlo. `blockedReason` NO habla sola: es una condición permanente
    // (expediente incompleto, parche sin revisar) que la propia pantalla ya
    // muestra en su panel, y repetirla en cada cambio de contexto interrumpía
    // al jugador con un asunto distinto del que tiene delante.
    error !== null
  );
}

/** Presencia persistente: reacciona a decisiones semánticas, no a clics decorativos. */
/**
 * Botones del bocadillo en ordenador: más bajos, para que quepa todo sin
 * barra de desplazamiento. En móvil conservan su tamaño táctil.
 */
const COMPACT_BUTTON = "gap-1 px-2 text-xs has-[>svg]:px-2 max-sm:min-h-9 max-sm:min-w-0 sm:h-7";

/** Lo que dura el bocadillo encogiéndose al cerrar (ms); un poco más que su animación. */
const LEAVE_MS = 190;

export function ContextualMentor({
  cue,
  answer,
  error,
  loading,
  canAsk,
  blockedReason = null,
  collapsed,
  onCollapsedChange,
  onAsk,
  onOpenMentor,
  placement = "floating",
  onStuck,
  onReportProblem,
  nextStep = null,
  onQuickQuestion,
}: ContextualMentorProps) {
  const t = useText(TEXT);
  const [quickQuestion, setQuickQuestion] = useState("");
  const sendQuickQuestion = () => {
    const question = quickQuestion.trim();
    if (question === "" || !onQuickQuestion) return;
    setQuickQuestion("");
    onQuickQuestion(question);
  };
  const requestLockedRef = useRef(false);
  const shellRef = useRef<HTMLElement>(null);
  const askButtonRef = useRef<HTMLButtonElement | null>(null);
  const mascotButtonRef = useRef<HTMLButtonElement | null>(null);
  const [restoreAskFocus, setRestoreAskFocus] = useState(false);
  const [acknowledgedSpeechKeys, setAcknowledgedSpeechKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const contentCollapsed = placement === "floating" && collapsed;
  // Al plegarse, el bocadillo se queda un instante para encogerse hacia la
  // mascota en vez de desaparecer de golpe. Quien pide menos movimiento no lo ve.
  const [wasCollapsed, setWasCollapsed] = useState(contentCollapsed);
  const [leaving, setLeaving] = useState(false);
  if (wasCollapsed !== contentCollapsed) {
    setWasCollapsed(contentCollapsed);
    setLeaving(
      contentCollapsed &&
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true,
    );
  }
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(false), LEAVE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  const bubbleShown = !contentCollapsed || leaving;
  const speechKey = `${cue.id}\n${cue.message}\n${error ?? ""}\n${blockedReason ?? ""}`;
  const speechPriority = mascotSpeechPriority(cue, error, blockedReason);
  const speechVisible =
    placement === "floating" &&
    collapsed &&
    shouldSpeakAutomatically(cue, error) &&
    !acknowledgedSpeechKeys.has(speechKey);
  const visualState = mascotVisualState(cue, answer, loading, error, blockedReason);
  const visualStatus = mascotStatusLabel(visualState, t);

  useEffect(() => {
    if (!loading) requestLockedRef.current = false;
    if (loading || !restoreAskFocus || (answer === null && error === null)) return;
    // `loading: true` puede no llegar a pintarse cuando el motor local responde
    // en el mismo lote de React. Observar también respuesta/error garantiza que
    // la restauración ocurra después del render definitivo, no antes.
    let followUp: number | null = null;
    const restoreFocus = () => {
      if (
        document.activeElement === document.body ||
        document.activeElement === askButtonRef.current
      ) {
        askButtonRef.current?.focus({ preventScroll: true });
      }
    };
    const frame = window.requestAnimationFrame(() => {
      restoreFocus();
      // En motores Chromium la liberación de Enter puede ejecutarse después
      // del primer frame y mandar el foco a <body> aunque el nodo no cambie.
      // Este segundo pase solo actúa si el foco quedó huérfano; nunca se lo
      // roba a otro control elegido por el jugador durante una petición lenta.
      followUp = window.setTimeout(restoreFocus, 50);
      setRestoreAskFocus(false);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (followUp !== null) window.clearTimeout(followUp);
    };
  }, [loading, answer, error, restoreAskFocus]);

  const requestContext = (restoreKeyboardFocus = false) => {
    if (!canAsk || loading || cue.ask === null || requestLockedRef.current) return;
    requestLockedRef.current = true;
    setRestoreAskFocus(
      restoreKeyboardFocus || document.activeElement === askButtonRef.current,
    );
    void onAsk(cue.ask);
  };

  /**
   * El mentor flota sobre el contenido. Para que NUNCA tape una pregunta, un
   * botón o los datos del objeto, publica su altura real en `--mentor-inset` y
   * el contenido principal reserva ese espacio. Es sincronización con el DOM,
   * no estado de React: no provoca renders ni depende de un breakpoint.
   */
  useLayoutEffect(() => {
    const shell = shellRef.current;
    const root = document.documentElement;
    if (placement !== "floating") {
      root.style.removeProperty("--mentor-inset");
      return;
    }
    if (!shell) return;
    const publish = () => {
      const alto = Math.ceil(shell.getBoundingClientRect().height);
      // Se suma el hueco inferior del propio `aside` (bottom-3 / sm:bottom-5).
      root.style.setProperty("--mentor-inset", `${alto + 24}px`);
    };
    publish();
    // El cambio de plegado y la aparición del bocadillo alteran la geometría
    // después del render. Un segundo cálculo en el frame siguiente cubre ese
    // cambio incluso si el navegador no emite ResizeObserver a tiempo.
    const frame = window.requestAnimationFrame(publish);
    const observer = new ResizeObserver(publish);
    observer.observe(shell);
    window.addEventListener("resize", publish);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.style.removeProperty("--mentor-inset");
    };
  }, [placement, contentCollapsed, speechVisible]);

  /*
   * El Copiloto habla solo en momentos que cambian una decisión: resultados,
   * bloqueos y advertencias. El bocadillo usa el resultado canónico que ya
   * existe en pantalla; no dispara una petición de IA por cada interacción.
   */
  useEffect(() => {
    if (!speechVisible || speechPriority === "important") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      () => setAcknowledgedSpeechKeys((current) => rememberSpeechKey(current, speechKey)),
      prefersReducedMotion ? 12_000 : 10_000,
    );
    return () => window.clearTimeout(timeout);
  }, [speechKey, speechPriority, speechVisible]);

  /*
   * El bocadillo flota encima de la página y puede tapar un botón. En cuanto
   * el jugador se pone a moverse por la página (rueda o dedo), se aparta: el
   * mensaje sigue dentro del panel de la mascota. Solo cuenta el gesto real,
   * no el desplazamiento que hace la propia web al llevarte a algo.
   */
  useEffect(() => {
    if (!speechVisible) return;
    const shownAt = Date.now();
    const onUserScroll = () => {
      if (Date.now() - shownAt < 1500) return;
      setAcknowledgedSpeechKeys((current) => rememberSpeechKey(current, speechKey));
    };
    window.addEventListener("wheel", onUserScroll, { passive: true });
    window.addEventListener("touchmove", onUserScroll, { passive: true });
    return () => {
      window.removeEventListener("wheel", onUserScroll);
      window.removeEventListener("touchmove", onUserScroll);
    };
  }, [speechKey, speechVisible]);

  /*
   * Escape cierra el panel flotante, como cualquier ventana emergente. Si hay
   * un diálogo, un menú o un desplegable abierto, ese Escape es suyo: Radix lo
   * atiende antes y lo marca como gastado.
   */
  useEffect(() => {
    if (placement !== "floating" || collapsed) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) {
        return;
      }
      onCollapsedChange(true);
      mascotButtonRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [placement, collapsed, onCollapsedChange]);

  const acknowledgeSpeech = () => {
    setAcknowledgedSpeechKeys((current) => rememberSpeechKey(current, speechKey));
  };

  const openFromSpeech = () => {
    acknowledgeSpeech();
    onCollapsedChange(false);
  };

  const toggleFloatingMentor = () => {
    if (collapsed) acknowledgeSpeech();
    onCollapsedChange(!collapsed);
  };

  return (
    <aside
      ref={shellRef}
      className={cn(
        placement === "floating"
          ? "mentor-floating-shell fixed bottom-3 right-3 z-40 sm:bottom-5 sm:right-5"
          : "mentor-lens relative z-10 w-full",
      )}
      aria-label={t.region}
      data-testid="mentor-contextual"
      data-placement={placement}
      data-version="4"
      data-mentor-version="4"
      data-mascot-version="3"
      data-collapsed={contentCollapsed ? "true" : "false"}
      data-speaking={speechVisible ? "true" : "false"}
    >
      {placement === "floating" && contentCollapsed && speechVisible && (
        <div
          className="mentor-speech-bubble"
          role="status"
          aria-live="polite"
          data-testid="mentor-speech-bubble"
          data-cue-id={cue.id}
          data-source={cue.source}
          data-priority={speechPriority}
          data-auto-dismiss={speechPriority === "notice" ? "true" : "false"}
        >
          <button
            type="button"
            className="mentor-speech-bubble__open"
            onClick={openFromSpeech}
            aria-label={t.openExplanation(cue.title)}
            data-testid="mentor-speech-open"
          >
            <span className="mentor-speech-bubble__speaker">
              {t.copilot} · {speechPriority === "important" ? t.attention : t.news}
            </span>
            <strong>{cue.title}</strong>
            <span className="mentor-speech-bubble__message">{error ?? cue.message}</span>
            <span className="mentor-speech-bubble__action">{t.seeExplanation}</span>
          </button>
          <button
            type="button"
            className="mentor-speech-bubble__dismiss"
            onClick={acknowledgeSpeech}
            aria-label={t.closeMessage}
            data-testid="mentor-speech-dismiss"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {placement === "floating" && (
        <button
          ref={mascotButtonRef}
          type="button"
          className="mentor-floating-mascot"
          data-version="3"
          data-state={visualState}
          data-source={cue.source}
          data-attention={speechVisible ? "true" : "false"}
          onClick={toggleFloatingMentor}
          aria-label={collapsed ? t.openContextual : t.closeContextual}
          aria-expanded={!collapsed}
          title={
            collapsed && speechVisible
              ? t.titleOpen(cue.title)
              : collapsed
                ? t.openMentor
                : t.closeMentor
          }
          data-testid="mentor-mascota"
        >
          <MentorRobot state={visualState} source={cue.source} />
          <span className="mentor-floating-mascot__beacon" aria-hidden="true" />
        </button>
      )}

      <div
        className={cn(
          // En móvil el panel es opaco: sobre una pantalla llena de texto, el
          // fondo translúcido dejaba ver las letras de detrás y costaba leerlo.
          "overflow-y-auto border border-primary/35 bg-background sm:bg-background/95 sm:backdrop-blur-xl",
          placement === "floating"
            ? bubbleShown
              ? cn("mentor-bubble max-h-[44vh] sm:max-h-[60vh]", contentCollapsed && "mentor-bubble--leaving")
              : "hidden"
            : "mentor-lens__surface",
          placement === "inline" && "mentor-companion",
        )}
        aria-hidden={contentCollapsed && leaving ? true : undefined}
      >
        {placement === "inline" && (
          <button
            type="button"
            className="mentor-mascot"
            data-version="3"
            data-state={visualState}
            data-source={cue.source}
            onClick={onOpenMentor}
            aria-label={t.openChat}
            title={t.talk}
            data-testid="mentor-mascota"
          >
            <MentorRobot state={visualState} source={cue.source} />
            <span className="mentor-mascot__status">
              <span className="ai-dot" aria-hidden="true" />
              {visualStatus}
            </span>
          </button>
        )}

        <div
          className={cn(
            "flex items-center gap-3 border-b border-border/70",
            placement === "inline" && "mentor-companion__header px-4 py-3",
            placement === "floating" && "mentor-floating-header py-2",
          )}
        >
          <span className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary",
            placement === "inline" || placement === "floating" ? "hidden" : null,
          )}>
            {answer?.responseMode === "ai" ? (
              <Sparkles className="size-4" aria-hidden="true" />
            ) : (
              <Bot className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary/75">
              {t.yourCopilot}
            </p>
            <p
              className="truncate text-sm font-semibold text-foreground"
              data-testid="mentor-contextual-titulo"
            >
              {cue.title}
            </p>
          </div>
          {placement === "floating" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={collapsed ? t.expand : t.collapse}
              aria-expanded={!collapsed}
              data-testid="mentor-contextual-plegar"
              onClick={() => onCollapsedChange(!collapsed)}
            >
              {collapsed && !leaving ? (
                <ChevronUp className="size-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-4" aria-hidden="true" />
              )}
            </Button>
          )}
        </div>

        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {cue.title}. {answer?.answer ?? error ?? cue.message}
        </div>

        <div className={cn(
          "flex flex-col",
          placement === "floating" ? "gap-2.5 px-3.5 pb-4 pt-3" : "gap-3 px-4 py-4",
          !bubbleShown && "hidden",
          placement === "inline" && "mentor-companion__body",
        )}>
            {placement !== "floating" && (
              <span
                className={cn(
                  "w-fit border px-2 py-0.5 text-xs font-semibold",
                  SOURCE_STYLES[cue.source],
                )}
              >
                {cue.eyebrow}
              </span>
            )}
            <p
              className={cn(
                "text-muted-foreground",
                placement === "floating" ? "text-[13px] leading-snug" : "text-sm leading-relaxed",
              )}
              data-testid="mentor-contextual-mensaje"
            >
              {cue.message}
            </p>
            {blockedReason !== null && (
              <p
                className="border-l-2 border-amber-400/60 bg-amber-400/5 px-3 py-2 text-xs text-amber-100"
                data-testid="mentor-contextual-patch-review-gate"
              >
                {blockedReason}
              </p>
            )}
            {placement === "floating" && nextStep && (
              <section
                className="rounded-lg border border-primary/40 bg-primary/10 p-2.5"
                aria-label={t.nextTitle}
                data-testid="mentor-siguiente-paso"
                data-kind={nextStep.kind}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{t.nextTitle}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-foreground">{t.next[nextStep.kind].text}</p>
                <Button type="button" size="sm" className={cn("mt-2", COMPACT_BUTTON)} onClick={nextStep.onGo} data-testid="mentor-siguiente-paso-ir">
                  {t.next[nextStep.kind].cta}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </section>
            )}
            {placement === "floating" && onQuickQuestion && (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendQuickQuestion();
                }}
                data-testid="mentor-pregunta-rapida"
              >
                <input
                  value={quickQuestion}
                  onChange={(event) => setQuickQuestion(event.target.value)}
                  maxLength={300}
                  aria-label={t.askLabel}
                  placeholder={t.askPlaceholder}
                  className="h-9 min-w-0 flex-1 rounded-full border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:text-[13px]"
                  data-testid="mentor-pregunta-rapida-texto"
                />
                <Button type="submit" size="sm" variant="secondary" className="max-sm:min-h-9 sm:h-8 sm:text-xs" disabled={quickQuestion.trim() === ""} data-testid="mentor-pregunta-rapida-enviar">
                  {t.askSend}
                </Button>
              </form>
            )}
            {placement === "floating" && onStuck && (
              <section aria-label={t.stuckTitle} data-testid="mentor-atascado">
                <p className="text-xs font-semibold text-muted-foreground">{t.stuckTitle}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {([
                    ["damage", t.stuckDamage, Swords],
                    ["dying", t.stuckDying, HeartCrack],
                    ["lost", t.stuckLost, Compass],
                  ] as const).map(([kind, label, Icon]) => (
                    <Button
                      key={kind}
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={cn(COMPACT_BUTTON, "px-1.5 has-[>svg]:px-1.5")}
                      onClick={() => onStuck(kind)}
                      data-testid={`mentor-atascado-${kind}`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </Button>
                  ))}
                </div>
              </section>
            )}
            <div className={cn("flex flex-wrap", placement === "floating" ? "gap-1.5" : "gap-2")}>
              {cue.ask !== null && (
                <Button
                  type="button"
                  ref={askButtonRef}
                  size="sm"
                  aria-disabled={!canAsk || loading}
                  className={cn(
                    "aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
                    placement === "floating" && COMPACT_BUTTON,
                  )}
                  onFocus={(event) => {
                    askButtonRef.current = event.currentTarget;
                  }}
                  onClick={() => requestContext()}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    // El click sintético nativo puede llegar después de que una
                    // respuesta local haya repintado el botón y devolver el foco
                    // a <body>. Ejecutar la misma acción aquí mantiene el control
                    // estable para teclado y evita un segundo envío.
                    event.preventDefault();
                    requestContext(true);
                  }}
                  onKeyUp={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.currentTarget.focus({ preventScroll: true });
                  }}
                  data-testid="mentor-contextual-preguntar"
                >
                  <Sparkles className={cn("size-4", loading && "animate-pulse")} aria-hidden="true" />
                  {loading
                    ? t.thinkingDots
                    : blockedReason
                      ? t.waiting
                    : answer
                      ? t.askAgain
                      : placement === "inline"
                        ? t.askHim
                        : t.analyse}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={placement === "floating" ? COMPACT_BUTTON : undefined}
                onClick={onOpenMentor}
              >
                <MessageCircleMore className="size-4" aria-hidden="true" />
                {placement === "inline" ? t.chat : t.conversation}
              </Button>
              {placement === "floating" && onReportProblem && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={cn("text-muted-foreground", COMPACT_BUTTON)}
                  onClick={onReportProblem}
                  data-testid="mentor-avisar-problema"
                >
                  {t.reportProblem}
                </Button>
              )}
            </div>

            {loading && (
              <p className="text-xs text-muted-foreground" data-testid="mentor-contextual-cargando">
                {t.checking}
              </p>
            )}

            {answer !== null && !loading && (
              <section
                className="border-l-2 border-emerald-400/50 bg-emerald-400/5 px-3 py-2"
                aria-label={t.answer}
                data-testid="mentor-contextual-respuesta"
              >
                <p
                  className="text-xs font-semibold text-emerald-200"
                  data-testid="mentor-contextual-modo"
                >
                  {answerLabel(answer, t)}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{answer.answer}</p>
                {answer.responseMode === "rules_fallback" && answer.fallbackReason && (
                  <p className="mt-1 text-xs text-amber-200">
                    {t.aiCouldNot(answer.fallbackReason)}
                  </p>
                )}
              </section>
            )}

            {error !== null && !loading && (
              <p className="border-l-2 border-destructive/60 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
      </div>
      {placement === "floating" && bubbleShown && (
        <span
          className={cn("mentor-bubble__tail", contentCollapsed && "mentor-bubble__tail--leaving")}
          aria-hidden="true"
        />
      )}
    </aside>
  );
}
