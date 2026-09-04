import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OpenCaseSelection } from "@/lib/openCase";
import type { CharacterReadiness } from "@shared/characterReadiness.js";

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
}: OpenCaseProps) {
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
      <section
        id="caso-abierto"
        tabIndex={-1}
        data-testid="caso-abierto"
        data-caso={selection.kind}
        aria-labelledby="caso-abierto-titulo"
        className="case-panel superficie-accion scroll-mt-20 p-5 outline-none sm:p-6"
      >
        <div className="relative z-10 flex flex-col gap-4">
          {isWaitingForDiagnosis ? (
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
                <ClipboardCheck className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 max-w-prose">
              <p className="rotulo-seccion text-primary/70">
                {partialAnalysis
                  ? "Análisis parcial disponible"
                  : profileReady
                    ? "Listo para analizar"
                    : "Expediente incompleto"}
              </p>
              <h2
                id="caso-abierto-titulo"
                className="dossier-title mt-1.5 text-2xl font-semibold leading-tight text-primary"
              >
                {partialAnalysis
                  ? "¿Qué puedo comprobar ya?"
                  : profileReady
                    ? "¿Qué mejoro ahora?"
                    : "Completa tu personaje"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {partialAnalysis
                  ? `Solo vemos ${profileReadiness.equippedItemCount} ${profileReadiness.equippedItemCount === 1 ? "pieza" : "piezas"}. El Mentor puede usar las estadísticas y habilidades importadas, pero no tratará el equipo ausente como analizado.`
                  : profileReady
                  ? "El mentor revisará tu personaje y elegirá una sola prioridad."
                  : "Necesitamos datos observados de PoE2 antes de recomendar una mejora."}
              </p>
              {partialAnalysis && (
                <p
                  data-testid="profile-partial-analysis"
                  className="mt-3 border-l-2 border-amber-500/70 pl-3 text-xs leading-relaxed text-amber-200/80"
                >
                  Añade más piezas para ampliar el análisis del equipo. La orientación actual seguirá marcada como parcial.
                </p>
              )}
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2.5 rotulo-seccion text-primary/70">
              <span className="grid size-7 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
                <ClipboardCheck className="size-4" aria-hidden="true" />
              </span>
              {partialAnalysis
                ? `Diagnóstico parcial · ${profileReadiness.equippedItemCount} ${profileReadiness.equippedItemCount === 1 ? "pieza observada" : "piezas observadas"}`
                : "Diagnóstico activo"}
              <span id="caso-abierto-titulo" className="sr-only">
                Caso abierto. Una sola decisión; la evidencia queda registrada.
              </span>
            </p>
          )}
          <div className="min-w-0">{dominant}</div>
        </div>
      </section>

      <Accordion type="multiple" className="superficie-panel px-5">
        {evidenceSlot !== null && (
          <AccordionItem value="evidencia">
            <AccordionTrigger data-testid="acordeon-evidencia">
              Evidencia y limitaciones
            </AccordionTrigger>
            <AccordionContent forceMount>{evidenceSlot}</AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
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
  return (
    <details
      id="mentor-briefing"
      data-testid="mentor-briefing"
      className="group superficie-panel"
      open={open}
      onToggle={(event) => onOpenChange(event.currentTarget.open)}
    >
      <summary
        className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 marker:content-none sm:px-5"
        data-testid="mentor-briefing-toggle"
      >
        <span>
          <span className="rotulo-seccion block text-primary/70">Tu copiloto</span>
          <span
            id="mentor-briefing-titulo"
            className="dossier-title mt-0.5 block text-lg font-semibold text-foreground"
          >
            Habla con tu Mentor
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground group-open:hidden">
          Abrir conversación
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground group-open:inline">
          Cerrar
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
  return (
    <Accordion
      type="multiple"
      className="superficie-panel grid grid-cols-1 gap-px px-3 sm:grid-cols-3"
      data-testid="utilidades-caso-abierto"
    >
      {sessionSlot !== null && (
        <AccordionItem value="decision" className="border-border/70 px-2 sm:border-b-0 sm:border-r data-[state=open]:sm:col-span-3 data-[state=open]:sm:border-r-0">
          <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-decision">
            Comprobar una decisión
          </AccordionTrigger>
          <AccordionContent forceMount>{sessionSlot}</AccordionContent>
        </AccordionItem>
      )}

      <AccordionItem value="historial" className="border-border/70 px-2 sm:border-b-0 sm:border-r data-[state=open]:sm:col-span-3 data-[state=open]:sm:border-r-0">
        <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-historial">
          Historial de decisiones
        </AccordionTrigger>
        <AccordionContent forceMount>{historySlot}</AccordionContent>
      </AccordionItem>

      <AccordionItem value="otras" className="border-border/70 px-2 data-[state=open]:sm:col-span-3">
        <AccordionTrigger className="min-h-11 py-2.5 hover:no-underline" data-testid="acordeon-otras">
          Otras posibilidades
          {selection.otherRecommendations.length > 0 &&
            ` (${selection.otherRecommendations.length})`}
        </AccordionTrigger>
        <AccordionContent forceMount>{othersSlot}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
