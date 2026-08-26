import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { OpenCaseSelection } from "@/lib/openCase";

interface OpenCaseProps {
  selection: OpenCaseSelection;
  /** Contenido dominante, uno por cada caso de la jerarquía (§3). */
  sessionSlot: ReactNode;
  journalSlot: ReactNode;
  recommendationSlot: ReactNode;
  generateSlot: ReactNode;
  /** Evidencia del caso; `null` cuando el caso no tiene snapshot que enseñar. */
  evidenceSlot: ReactNode | null;
  mentorSlot: ReactNode;
}

/**
 * Caso Abierto: contenedor de PRESENTACIÓN.
 *
 * No guarda estado de negocio propio. Recibe la selección ya calculada por
 * `selectOpenCase` y pinta un único contenido dominante, seguido de la lectura
 * progresiva.
 *
 * Los contenidos plegados se montan siempre (`forceMount`): plegarlos no puede
 * perder la conversación escrita a medias ni un informe de exportación ya
 * generado. Radix aporta el teclado y `aria-expanded`.
 *
 * Lo que NUNCA baja a un acordeón son las alertas materiales de la
 * recomendación (irreversible, posible pérdida de mods, presupuesto superado):
 * viven en el contenido dominante, antes del CTA.
 */
export function OpenCase({
  selection,
  sessionSlot,
  journalSlot,
  recommendationSlot,
  generateSlot,
  evidenceSlot,
  mentorSlot,
}: OpenCaseProps) {
  const isWaitingForDiagnosis = selection.kind === "generate";
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
      <section
        id="caso-abierto"
        tabIndex={-1}
        data-testid="caso-abierto"
        data-caso={selection.kind}
        aria-labelledby="caso-abierto-titulo"
        className={`case-panel superficie-accion scroll-mt-20 outline-none ${
          isWaitingForDiagnosis ? "p-5 sm:p-6" : "p-6 sm:p-8"
        }`}
      >
        <div
          className={`relative z-10 grid gap-6 ${
            isWaitingForDiagnosis
              ? "sm:grid-cols-[minmax(10rem,0.7fr)_minmax(16rem,1.3fr)] sm:items-center"
              : "sm:grid-cols-[8rem_minmax(0,1fr)]"
          }`}
        >
          <div className="border-b border-primary/25 pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/70">
              {isWaitingForDiagnosis ? "Listo para analizar" : "Diagnóstico activo"}
            </p>
            <h2
              id="caso-abierto-titulo"
              className="dossier-title mt-2 text-2xl font-semibold leading-tight text-primary"
            >
              {isWaitingForDiagnosis ? "¿Qué mejoro ahora?" : "Caso abierto"}
            </h2>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {isWaitingForDiagnosis
                ? "El mentor revisará tu personaje y elegirá una sola prioridad."
                : "Una sola decisión. La evidencia queda registrada."}
            </p>
          </div>
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

        <AccordionItem value="mentor">
          <AccordionTrigger data-testid="acordeon-mentor">
            Preguntar al mentor
          </AccordionTrigger>
          <AccordionContent forceMount>{mentorSlot}</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
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
