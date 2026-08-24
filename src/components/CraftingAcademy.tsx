import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  CRAFTING_ACADEMY_EVIDENCE,
  CRAFTING_ACADEMY_LESSONS,
  type AcademyOption,
  type AcademyScenario,
} from "@shared/craftingAcademy.js";
import { AcademyItemBoard } from "@/components/AcademyItemBoard";
import { CraftingAdvancedAcademy } from "@/components/CraftingAdvancedAcademy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCraftingAcademy } from "@/hooks/useCraftingAcademy";

interface CraftingAcademyProps {
  /** Vuelve al banco real sin tocar personaje, objetos ni sesiones. */
  onPracticeWithMyItem: () => void;
}

function OptionButton({
  option,
  answered,
  chosen,
  isExpected,
  onChoose,
}: {
  option: AcademyOption;
  answered: boolean;
  chosen: boolean;
  isExpected: boolean;
  onChoose: () => void;
}) {
  const state = !answered ? "abierta" : isExpected ? "correcta" : chosen ? "fallada" : "descartada";
  return (
    <button
      type="button"
      disabled={answered}
      onClick={onChoose}
      data-testid={`academia-opcion-${option.id}`}
      data-state={state}
      aria-describedby={option.hint ? `pista-${option.id}` : undefined}
      className={`flex min-h-14 w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-[transform,border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default motion-reduce:transition-none ${
        state === "correcta"
          ? "border-emerald-400/60 bg-emerald-500/[0.12] text-emerald-100"
          : state === "fallada"
            ? "border-rose-400/60 bg-rose-500/[0.12] text-rose-100"
            : state === "descartada"
              ? "border-border/50 bg-transparent text-muted-foreground opacity-70"
              : "border-border bg-muted/10 hover:-translate-y-px hover:border-primary/50 hover:bg-primary/[0.06]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{option.label}</span>
        {option.hint && (
          <span id={`pista-${option.id}`} className="mt-0.5 block text-xs text-muted-foreground">
            {option.hint}
          </span>
        )}
      </span>
      {answered && isExpected && (
        <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-label="Respuesta correcta" />
      )}
      {answered && chosen && !isExpected && (
        <XCircle className="size-5 shrink-0 text-rose-300" aria-label="Tu respuesta, incorrecta" />
      )}
    </button>
  );
}

function ScenarioView({
  scenario,
  answeredOptionId,
  onAnswer,
  onNext,
  header,
  nextLabel,
}: {
  scenario: AcademyScenario;
  answeredOptionId: string | null;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  header: React.ReactNode;
  nextLabel: string;
}) {
  const questionRef = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const answered = answeredOptionId !== null;
  const wasRight = answeredOptionId === scenario.expectedOptionId;
  // En las preguntas de lectura la tarjeta no puede dar la respuesta hecha:
  // los contadores derivados se destapan al responder.
  const expectedCheck = scenario.options.find(
    (option) => option.id === scenario.expectedOptionId,
  )?.check;
  const isReadingQuestion =
    expectedCheck?.kind === "rarity" ||
    expectedCheck?.kind === "prefixCount" ||
    expectedCheck?.kind === "openSlots";
  const concealCounters = isReadingQuestion && !answered;

  // Sincronización de foco con el DOM, no de estado: al cambiar de escenario el
  // foco vuelve a la pregunta; al responder salta a la corrección para que un
  // lector de pantalla la anuncie sin buscarla.
  useEffect(() => {
    if (answered) feedbackRef.current?.focus({ preventScroll: true });
    else questionRef.current?.focus({ preventScroll: true });
  }, [scenario.id, answered]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {header}

      <p className="text-sm leading-relaxed text-muted-foreground" data-testid="academia-situacion">
        {scenario.situation}
      </p>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] lg:items-start">
        <AcademyItemBoard
          item={scenario.item}
          concealCounters={concealCounters}
          className="lg:sticky lg:top-24"
        />

        <div className="flex min-w-0 flex-col gap-3">
          <h3
            ref={questionRef}
            tabIndex={-1}
            className="dossier-title text-xl font-semibold outline-none sm:text-2xl"
            data-testid="academia-pregunta"
          >
            {scenario.question}
          </h3>

          <div className="grid min-w-0 gap-2" role="group" aria-label="Opciones de respuesta">
            {scenario.options.map((option) => (
              <OptionButton
                key={option.id}
                option={option}
                answered={answered}
                chosen={answeredOptionId === option.id}
                isExpected={option.id === scenario.expectedOptionId}
                onChoose={() => onAnswer(option.id)}
              />
            ))}
          </div>

          {answered && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          data-testid="academia-feedback"
          data-result={wasRight ? "correcto" : "incorrecto"}
          className={`min-w-0 rounded-md border p-3 outline-none sm:p-4 ${
            wasRight
              ? "border-emerald-400/50 bg-emerald-500/[0.08]"
              : "border-rose-400/50 bg-rose-500/[0.08]"
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            {wasRight ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
            ) : (
              <XCircle className="size-4 shrink-0 text-rose-300" aria-hidden="true" />
            )}
            <span className={wasRight ? "text-emerald-200" : "text-rose-200"}>
              {wasRight ? "Correcto" : "No era esa"}
            </span>
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">{scenario.explanation}</p>
          {!wasRight && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {scenario.misconception}
            </p>
          )}
          <details className="mt-3 rounded border border-current/20 px-2.5 py-2 text-xs">
            <summary className="cursor-pointer font-medium">Por qué</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              {scenario.why.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">{CRAFTING_ACADEMY_EVIDENCE}</p>
          </details>
          <Button className="mt-3 w-full sm:w-auto" type="button" onClick={onNext} data-testid="academia-continuar">
            {nextLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Nivel básico de la Academia: una situación, una pregunta, una corrección. */
function BasicCraftingAcademy({ onPracticeWithMyItem }: CraftingAcademyProps) {
  const academy = useCraftingAcademy();
  const [confirmingRestart, setConfirmingRestart] = useState(false);

  const restartButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-xs text-muted-foreground"
      data-testid="academia-reiniciar"
      onClick={() => setConfirmingRestart(true)}
    >
      <RotateCcw className="size-3.5" aria-hidden="true" />
      Reiniciar nivel
    </Button>
  );

  const restartDialog = (
    <AlertDialog open={confirmingRestart} onOpenChange={setConfirmingRestart}>
      <AlertDialogContent data-testid="academia-reiniciar-dialogo">
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reiniciar el nivel básico?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borra tu progreso de la Academia y vuelves a la primera lección. No afecta a tu
            personaje, a tus objetos ni a ninguna sesión de crafting guardada.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="academia-reiniciar-cancelar">Seguir donde estaba</AlertDialogCancel>
          <AlertDialogAction
            data-testid="academia-reiniciar-confirmar"
            onClick={() => {
              academy.restart();
              setConfirmingRestart(false);
            }}
          >
            Sí, reiniciar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const practiceButton = (
    <Button
      type="button"
      variant="outline"
      data-testid="academia-practicar"
      onClick={onPracticeWithMyItem}
    >
      Practicar con mi objeto
      <ArrowRight className="size-4" aria-hidden="true" />
    </Button>
  );

  if (academy.stage === "intro") {
    return (
      <section
        className="superficie-panel min-w-0 p-4 sm:p-6"
        data-testid="academia-crafting"
        data-stage="intro"
        aria-labelledby="academia-titulo"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="academia-titulo" className="dossier-title text-2xl font-semibold">
              Academia de crafting · Nivel básico
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Cinco lecciones cortas y un desafío. Miras un objeto, decides y te corrijo.
            </p>
          </div>
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="academia-indice">
          {CRAFTING_ACADEMY_LESSONS.map((lesson) => (
            <li
              key={lesson.id}
              className="flex min-w-0 items-start gap-2.5 rounded-md border border-border/70 bg-muted/[0.06] px-3 py-2"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-primary/40 text-[11px] font-semibold text-primary">
                {lesson.order}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{lesson.title}</span>
                <span className="block text-xs text-muted-foreground">{lesson.goal}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button type="button" onClick={academy.start} data-testid="academia-empezar">
            {academy.hasProgress ? "Seguir donde lo dejé" : "Empezar"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          {practiceButton}
          {academy.hasProgress && restartButton}
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          {CRAFTING_ACADEMY_EVIDENCE}
        </p>
        {restartDialog}
      </section>
    );
  }

  if (academy.stage === "results") {
    const { correct, total } = academy.examScore;
    const pending = academy.pendingConcepts;
    return (
      <section
        className="superficie-panel min-w-0 p-4 sm:p-6"
        data-testid="academia-crafting"
        data-stage="results"
        aria-labelledby="academia-resultado-titulo"
      >
        <h2 id="academia-resultado-titulo" className="dossier-title text-2xl font-semibold">
          {pending.length === 0 ? "Nivel básico completado" : "Casi: te quedan un par de cosas"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground" data-testid="academia-resultado-resumen">
          Acertaste {correct} de {total}. Es solo lo que has entendido de estas lecciones: no es
          una probabilidad de crafting ni una valoración de ningún objeto.
        </p>

        {pending.length > 0 ? (
          <div className="mt-4" data-testid="academia-pendientes">
            <h3 className="text-sm font-semibold">Lo que conviene repasar</h3>
            <ul className="mt-2 grid gap-2">
              {pending.map((concept) => (
                <li
                  key={concept.id}
                  data-testid={`academia-pendiente-${concept.id}`}
                  className="flex min-w-0 items-start gap-2.5 rounded-md border border-amber-500/35 bg-amber-500/[0.06] px-3 py-2"
                >
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-300" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{concept.label}</span>
                    <span className="block text-xs text-muted-foreground">{concept.recap}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 rounded-md border border-emerald-400/45 bg-emerald-500/[0.08] px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
            Sabes leer la rareza, contar prefijos y sufijos, reconocer un hueco y elegir entre las
            cuatro monedas observadas o parar.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {pending.length > 0 && (
            <Button
              type="button"
              onClick={academy.retryPendingConcepts}
              data-testid="academia-repasar"
            >
              Repasar solo lo pendiente ({pending.length})
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
          {practiceButton}
          {restartButton}
        </div>
        {restartDialog}
      </section>
    );
  }

  const step = academy.step;
  if (!step) {
    // Estado imposible por construcción; se resuelve sin bloquear al jugador.
    return (
      <section className="superficie-panel p-4" data-testid="academia-crafting" data-stage="vacio">
        <p className="text-sm text-muted-foreground">No hay ninguna situación que mostrar.</p>
        <Button className="mt-3" type="button" onClick={academy.restart}>
          Volver al principio
        </Button>
      </section>
    );
  }

  const isExam = academy.stage === "exam";
  const progressRatio = step.position / step.total;
  const lastOfRun = step.position === step.total;

  const header = (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/80">
          {isExam
            ? academy.isRetry
              ? "Repaso de lo pendiente"
              : "Desafío final"
            : `Lección ${step.lesson?.order} · ${step.lesson?.title}`}
        </p>
        <p className="text-xs text-muted-foreground" data-testid="academia-progreso">
          {step.position} de {step.total}
        </p>
      </div>
      <div
        className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border/60"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={step.total}
        aria-valuenow={step.position}
        aria-label={isExam ? "Progreso del desafío" : "Progreso de las lecciones"}
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${Math.round(progressRatio * 100)}%` }}
        />
      </div>
    </div>
  );

  return (
    <section
      className="superficie-panel min-w-0 p-4 sm:p-6"
      data-testid="academia-crafting"
      data-stage={academy.stage}
      aria-labelledby="academia-pregunta"
    >
      <ScenarioView
        key={step.scenario.id}
        scenario={step.scenario}
        answeredOptionId={academy.currentAnswer?.optionId ?? null}
        onAnswer={(optionId) =>
          academy.answer(optionId, optionId === step.scenario.expectedOptionId)
        }
        onNext={academy.next}
        header={header}
        nextLabel={
          lastOfRun
            ? isExam
              ? "Ver mi resultado"
              : "Ir al desafío final"
            : "Siguiente situación"
        }
      />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        {practiceButton}
        {restartButton}
      </div>
      {restartDialog}
    </section>
  );
}

/** Selector de niveles: el básico conserva su progreso y el avanzado es independiente. */
export function CraftingAcademy({ onPracticeWithMyItem }: CraftingAcademyProps) {
  const [level, setLevel] = useState<"basic" | "advanced">("basic");

  return (
    <div className="min-w-0 space-y-3">
      <nav
        className="flex flex-wrap items-center gap-1 rounded-md border border-border/70 bg-background/65 p-1"
        aria-label="Nivel de la Academia"
        data-testid="academia-niveles"
      >
        <button
          type="button"
          onClick={() => setLevel("basic")}
          data-testid="academia-nivel-basico"
          data-active={level === "basic" ? "true" : "false"}
          className={`rounded px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${level === "basic" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`}
        >
          Básico
        </button>
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded px-3 py-2 text-xs font-semibold text-muted-foreground opacity-50"
          aria-label="Nivel medio, en preparación"
        >
          Medio · Próximamente
        </button>
        <button
          type="button"
          onClick={() => setLevel("advanced")}
          data-testid="academia-nivel-avanzado"
          data-active={level === "advanced" ? "true" : "false"}
          className={`rounded px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${level === "advanced" ? "bg-cyan-500/15 text-cyan-200" : "text-cyan-300/75 hover:bg-cyan-500/[0.08] hover:text-cyan-100"}`}
        >
          Avanzado · Nuevo
        </button>
        <span className="ml-auto hidden px-2 text-[11px] text-muted-foreground sm:inline">
          Cambia de nivel sin tocar tu personaje
        </span>
      </nav>

      {level === "advanced" ? (
        <CraftingAdvancedAcademy
          onBack={() => setLevel("basic")}
          onPracticeWithMyItem={onPracticeWithMyItem}
        />
      ) : (
        <BasicCraftingAcademy onPracticeWithMyItem={onPracticeWithMyItem} />
      )}
    </div>
  );
}
