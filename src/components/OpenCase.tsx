import { useState, type ReactNode } from "react";
import { Bot, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OpenCaseSelection } from "@/lib/openCase";
import type { CharacterReadiness } from "@shared/characterReadiness.js";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    partialAvailable: "Análisis parcial disponible",
    readyToAnalyse: "Listo para analizar",
    incompleteFile: "Faltan datos",
    whatCanICheck: "¿Qué puedo comprobar ya?",
    whatToImprove: "¿Qué mejoro ahora?",
    completeCharacter: "Completa tu personaje",
    partialIntro: (count: number) =>
      `Solo vemos ${count} ${count === 1 ? "pieza" : "piezas"}. El Mentor puede usar las estadísticas y habilidades importadas, pero no tratará el equipo ausente como analizado.`,
    readyIntro: "El mentor revisará tu personaje y elegirá una sola prioridad.",
    needDataIntro: "Con lo que tengo aún no puedo recomendarte una mejora sin inventar. Abajo te digo qué falta.",
    addMoreItems:
      "Añade más piezas para ampliar el análisis del equipo. La orientación actual seguirá marcada como parcial.",
    nextStepPartial: (count: number) =>
      `Tu siguiente paso · diagnóstico parcial, ${count} ${count === 1 ? "pieza observada" : "piezas observadas"}`,
    nextStep: "Tu siguiente paso",
    nextStepSr: "Una sola decisión cada vez; lo que hagas queda en tu diario.",
    evidence: "Evidencia y limitaciones",
    yourCopilot: "Tu copiloto",
    talkToMentor: "Habla con tu Mentor",
    openChat: "Abrir conversación",
    close: "Cerrar",
    checkDecision: "Comprobar una decisión",
    decisionHistory: "Historial de decisiones",
    otherOptions: "Otras posibilidades",
    advancedTitle: "Herramientas avanzadas",
    advancedHint: "Comprobar una decisión, historial y otras posibilidades",
  },
  {
    partialAvailable: "Partial analysis available",
    readyToAnalyse: "Ready to analyse",
    incompleteFile: "Missing details",
    whatCanICheck: "What can I check already?",
    whatToImprove: "What should I improve now?",
    completeCharacter: "Complete your character",
    partialIntro: (count: number) =>
      `We only see ${count} ${count === 1 ? "item" : "items"}. The Mentor can use your imported stats and skills, but it won't treat the missing gear as analysed.`,
    readyIntro: "The mentor will review your character and pick a single priority.",
    needDataIntro: "With what I have I can't suggest an upgrade without guessing. Below I tell you what's missing.",
    addMoreItems:
      "Add more items to widen the gear analysis. The current advice will stay marked as partial.",
    nextStepPartial: (count: number) =>
      `Your next step · partial diagnosis, ${count} ${count === 1 ? "item seen" : "items seen"}`,
    nextStep: "Your next step",
    nextStepSr: "One decision at a time; whatever you do is saved in your journal.",
    evidence: "Evidence and limits",
    yourCopilot: "Your copilot",
    talkToMentor: "Talk to your Mentor",
    openChat: "Open chat",
    close: "Close",
    checkDecision: "Check a decision",
    decisionHistory: "Decision history",
    otherOptions: "Other options",
    advancedTitle: "Advanced tools",
    advancedHint: "Check a decision, history and other options",
  },
);

interface OpenCaseProps {
  selection: OpenCaseSelection;
  /** Evita presentar una captura parcial como un análisis amplio. */
  profileReadiness: CharacterReadiness;
  /** Contenido dominante, uno por cada caso de la jerarquía (§3). */
  sessionSlot: ReactNode;
  journalSlot: ReactNode;
  recommendationSlot: ReactNode;
  generateSlot: ReactNode;
  /** Evidencia del caso; `null` cuando el caso no tiene snapshot que enseñar. */
  evidenceSlot: ReactNode | null;
  /** Pregunta rápida al Mentor, al pie de la tarjeta y fuera del caso medido. */
  mentorAskSlot?: ReactNode;
}

/**
 * Caso Abierto: contenedor de PRESENTACIÓN.
 *
 * No guarda estado de negocio propio. Recibe la selección ya calculada por
 * `selectOpenCase` y pinta un único contenido dominante, seguido de la lectura
 * progresiva.
 *
 * Lo que NUNCA baja a un acordeón son las alertas materiales de la
 * recomendación (irreversible, posible pérdida de mods, presupuesto superado):
 * viven en el contenido dominante, antes del CTA.
 */
export function OpenCase({
  selection,
  profileReadiness,
  sessionSlot,
  journalSlot,
  recommendationSlot,
  generateSlot,
  evidenceSlot,
  mentorAskSlot,
}: OpenCaseProps) {
  const t = useText(TEXT);
  const isWaitingForDiagnosis = selection.kind === "generate";
  const profileReady = profileReadiness.ready;
  const partialAnalysis = profileReadiness.analysisScope === "partial";
  const dominant =
    selection.kind === "session"
      ? sessionSlot
      : selection.kind === "journal"
        ? journalSlot
        : selection.kind === "recommendation"
          ? recommendationSlot
          : generateSlot;

  return (
    <div className="flex flex-col gap-6">
      {/* tabIndex={-1}: destino programático de la navegación objeto → caso.
          No entra en el orden de tabulación. */}
      {/*
       * UN SOLO TITULAR POR PANEL.
       *
       * Antes este panel pintaba un raíl lateral con «Caso abierto» al mismo
       * tamaño que el título real de la recomendación: dos H2 compitiendo, y el
       * que mandaba visualmente era el que no decía nada. Ahora:
       *
       * - Sin diagnóstico, el panel ES la pregunta: «¿Qué mejoro ahora?».
       * - Con diagnóstico, el titular lo pone el contenido dominante y aquí
       *   solo queda el rótulo de estado; el nombre accesible de la región se
       *   mantiene con un encabezado para lectores de pantalla.
       */}
      {/* «Tu siguiente paso»: la tarjeta la pone el envoltorio para que la
          pregunta al Mentor comparta marco con la decisión sin formar parte
          de la región del caso (que tiene su propia medida de densidad). */}
      <div className="case-panel superficie-accion" data-testid="tu-siguiente-paso">
      <section
        id="caso-abierto"
        tabIndex={-1}
        data-testid="caso-abierto"
        data-caso={selection.kind}
        aria-labelledby="caso-abierto-titulo"
        className="scroll-mt-20 p-5 outline-none"
      >
        <div className="relative z-10 flex flex-col gap-3">
          {isWaitingForDiagnosis ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 max-w-prose">
              <p className="rotulo-seccion text-primary/70">
                {partialAnalysis
                  ? t.partialAvailable
                  : profileReady
                    ? t.readyToAnalyse
                    : t.incompleteFile}
              </p>
              <h2
                id="caso-abierto-titulo"
                className="dossier-title mt-1.5 text-2xl font-semibold leading-tight text-primary"
              >
                {partialAnalysis
                  ? t.whatCanICheck
                  : profileReady
                    ? t.whatToImprove
                    : t.completeCharacter}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {partialAnalysis
                  ? t.partialIntro(profileReadiness.equippedItemCount)
                  : profileReady
                  ? t.readyIntro
                  : t.needDataIntro}
              </p>
              {partialAnalysis && (
                <p
                  data-testid="profile-partial-analysis"
                  className="mt-3 border-l-2 border-amber-500/70 pl-3 text-xs leading-relaxed text-amber-200/80"
                >
                  {t.addMoreItems}
                </p>
              )}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2.5 text-sm font-medium text-primary">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                <Bot className="size-4" aria-hidden="true" />
              </span>
              {partialAnalysis
                ? t.nextStepPartial(profileReadiness.equippedItemCount)
                : t.nextStep}
              <span id="caso-abierto-titulo" className="sr-only">
                {t.nextStepSr}
              </span>
            </p>
          )}
          <div className="min-w-0">{dominant}</div>
        </div>
      </section>
      {mentorAskSlot && (
        <div className="hidden border-t border-border/70 px-5 py-3.5 sm:block">{mentorAskSlot}</div>
      )}
      </div>

      {/* Sin evidencia no se pinta el marco vacío: quedaba una raya suelta. */}
      {evidenceSlot !== null && (
        <Accordion type="multiple" className="superficie-panel px-5">
          <AccordionItem value="evidencia">
            <AccordionTrigger data-testid="acordeon-evidencia">
              {t.evidence}
            </AccordionTrigger>
            <AccordionContent forceMount>{evidenceSlot}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

/**
 * Conversación completa del Mentor, bajo demanda.
 *
 * Vive fuera de `OpenCase` para que el orden de lectura sea honesto en móvil:
 * decisión → expediente/equipo → conversación. El acceso global de cabecera
 * puede abrirla y desplazarse hasta aquí desde cualquier punto.
 */
export function MentorBriefing({
  children,
  open,
  onOpenChange,
}: {
  children: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useText(TEXT);
  return (
    <details
      id="mentor-briefing"
      data-testid="mentor-briefing"
      className="group superficie-panel scroll-mt-20"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary
        className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none sm:px-5"
        data-testid="mentor-briefing-toggle"
      >
        <span>
          <span className="rotulo-seccion block text-primary/70">{t.yourCopilot}</span>
          <span
            id="mentor-briefing-titulo"
            className="dossier-title mt-0.5 block text-lg font-semibold text-foreground"
          >
            {t.talkToMentor}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground group-open:hidden">
          {t.openChat}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground group-open:inline">
          {t.close}
        </span>
      </summary>
      <div className="border-t border-primary/15 px-4 pb-4 pt-3 sm:px-5 sm:pb-5">
        {children}
      </div>
    </details>
  );
}

/**
 * Segundo grupo plegado del Caso Abierto: memoria y alternativas.
 *
 * Va detrás del equipo en móvil (§8) y bajo el caso en escritorio, por eso es
 * un componente aparte y no dos ítems más del acordeón anterior.
 */
export function OpenCaseSecondary({
  selection,
  sessionSlot,
  historySlot,
  othersSlot,
}: {
  selection: OpenCaseSelection;
  /**
   * `DecisionSessionSection` cuando NO domina el caso. Sigue siendo la única
   * instancia: aquí vive su formulario para empezar a comprobar una decisión,
   * y en cuanto hay sesión abierta el componente pasa al contenido dominante.
   */
  sessionSlot: ReactNode | null;
  historySlot: ReactNode;
  othersSlot: ReactNode;
}) {
  const t = useText(TEXT);
  // Plegado de serie: al novato le basta la revisión rápida y el Mentor. La
  // decisión en marcha no vive aquí (pasa al caso principal), así que plegarlo
  // no esconde nada urgente. Se recuerda lo que eligió el jugador.
  const [open, setOpen] = useState(readAdvancedOpen);
  return (
    <details
      className="superficie-panel group"
      open={open}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        try {
          window.localStorage.setItem(ADVANCED_STORAGE_KEY, next ? "abierto" : "plegado");
        } catch {
          // Sin almacenamiento, vale para esta visita.
        }
      }}
      data-testid="herramientas-avanzadas"
    >
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-5 py-3 [&::-webkit-details-marker]:hidden"
        data-testid="herramientas-avanzadas-abrir"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{t.advancedTitle}</span>
          <span className="block text-xs text-muted-foreground">{t.advancedHint}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
    <Accordion
      type="multiple"
      className="grid grid-cols-1 gap-px border-t border-border/70 px-3 sm:grid-cols-3"
      data-testid="utilidades-caso-abierto"
    >
      {sessionSlot !== null && (
        <AccordionItem value="decision" className="border-border/70 px-2 sm:border-b-0 sm:border-r data-[state=open]:sm:col-span-3 data-[state=open]:sm:border-r-0">
          <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-decision">
            {t.checkDecision}
          </AccordionTrigger>
          <AccordionContent forceMount>{sessionSlot}</AccordionContent>
        </AccordionItem>
      )}

      <AccordionItem value="historial" className="border-border/70 px-2 sm:border-b-0 sm:border-r data-[state=open]:sm:col-span-3 data-[state=open]:sm:border-r-0">
        <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-historial">
          {t.decisionHistory}
        </AccordionTrigger>
        <AccordionContent forceMount>{historySlot}</AccordionContent>
      </AccordionItem>

      <AccordionItem value="otras" className="border-border/70 px-2 data-[state=open]:sm:col-span-3">
        <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-otras">
          {t.otherOptions}
          {selection.otherRecommendations.length > 0 &&
            ` (${selection.otherRecommendations.length})`}
        </AccordionTrigger>
        <AccordionContent forceMount>{othersSlot}</AccordionContent>
      </AccordionItem>
    </Accordion>
    </details>
  );
}

const ADVANCED_STORAGE_KEY = "exile-copilot:herramientas-avanzadas";

function readAdvancedOpen(): boolean {
  try {
    return window.localStorage.getItem(ADVANCED_STORAGE_KEY) === "abierto";
  } catch {
    return false;
  }
}
