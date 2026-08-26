import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, GitCompareArrows, RotateCcw, XCircle } from "lucide-react";
import {
  CRAFTING_MEDIUM_ACADEMY_EVIDENCE,
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  type MediumAcademyScenario,
} from "@shared/craftingMediumAcademy.js";
import { Button } from "@/components/ui/button";

interface CraftingMediumAcademyProps {
  onBack: () => void;
  onPracticeWithMyItem: () => void;
}

function MediumCase({
  scenario,
  chosenId,
  onChoose,
  onNext,
}: {
  scenario: MediumAcademyScenario;
  chosenId: string | null;
  onChoose: (id: string) => void;
  onNext: () => void;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const chosen = scenario.options.find((entry) => entry.id === chosenId);
  const answered = chosen !== undefined;
  const correct = chosen?.decision === scenario.expectedDecision;

  useEffect(() => {
    if (answered) feedbackRef.current?.focus({ preventScroll: true });
  }, [answered]);

  return (
    <div className="space-y-4" data-testid="academia-media-caso">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">
            Comparación {scenario.order}
          </p>
          <h3 className="dossier-title mt-1 text-2xl font-semibold">{scenario.title}</h3>
        </div>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/[0.08] px-2.5 py-1 text-xs text-sky-100">
          {scenario.order} / {CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length} aria-valuenow={scenario.order}>
        <span className="block h-full rounded-full bg-sky-400 transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((scenario.order / CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length) * 100)}%` }} />
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{scenario.situation}</p>

      <div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/60 sm:grid-cols-2" aria-label="Comparación antes y después">
        <div className="bg-background/70 p-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Antes</span>
          <p className="mt-1 text-sm font-medium">{scenario.before}</p>
        </div>
        <div className="bg-sky-500/[0.045] p-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300/80">Después</span>
          <p className="mt-1 text-sm font-medium">{scenario.after}</p>
        </div>
      </div>

      <div>
        <h4 className="text-lg font-semibold" data-testid="academia-media-pregunta">{scenario.question}</h4>
        <div className="mt-2 grid gap-2" role="group" aria-label="Decisiones del nivel medio">
          {scenario.options.map((entry) => {
            const expected = entry.decision === scenario.expectedDecision;
            const selected = entry.id === chosenId;
            const state = !answered ? "open" : expected ? "correct" : selected ? "wrong" : "muted";
            return (
              <button
                key={entry.id}
                type="button"
                disabled={answered}
                onClick={() => onChoose(entry.id)}
                data-testid={`academia-media-opcion-${entry.id}`}
                data-state={state}
                className={`flex min-h-14 items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-default ${state === "correct" ? "border-emerald-400/55 bg-emerald-500/[0.1]" : state === "wrong" ? "border-rose-400/55 bg-rose-500/[0.1]" : state === "muted" ? "border-border/50 opacity-55" : "border-border bg-muted/[0.04] hover:border-sky-400/45 hover:bg-sky-500/[0.05]"}`}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{entry.label}</strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{entry.hint}</span>
                </span>
                {answered && expected && <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-label="Respuesta correcta" />}
                {answered && selected && !expected && <XCircle className="size-5 shrink-0 text-rose-300" aria-label="Tu respuesta, incorrecta" />}
              </button>
            );
          })}
        </div>
      </div>

      {answered && (
        <div
          ref={feedbackRef}
          tabIndex={-1}
          role="status"
          data-testid="academia-media-feedback"
          data-result={correct ? "correcto" : "incorrecto"}
          className={`rounded-md border p-3 outline-none ${correct ? "border-emerald-400/45 bg-emerald-500/[0.08]" : "border-rose-400/45 bg-rose-500/[0.08]"}`}
        >
          <p className="text-sm font-semibold">{correct ? "Correcto" : "No era esa"}</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{scenario.explanation}</p>
          <p className="mt-2 text-xs font-medium text-sky-200">Idea clave: {scenario.takeaway}</p>
          <Button className="mt-3" type="button" onClick={onNext} data-testid="academia-media-continuar">
            {scenario.order === CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length ? "Ver resultado" : "Siguiente comparación"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

export function CraftingMediumAcademy({ onBack, onPracticeWithMyItem }: CraftingMediumAcademyProps) {
  const [stage, setStage] = useState<"intro" | "cases" | "results">("intro");
  const [cursor, setCursor] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const scenario = CRAFTING_MEDIUM_ACADEMY_SCENARIOS[cursor];
  const score = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.filter((entry) => {
    const answer = entry.options.find((option) => option.id === answers[entry.id]);
    return answer?.decision === entry.expectedDecision;
  }).length;

  const restart = () => {
    setStage("intro");
    setCursor(0);
    setAnswers({});
  };

  if (stage === "intro") {
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-media" data-stage="intro">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-sky-400/40 bg-sky-500/10 text-sky-200"><GitCompareArrows className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">Nivel medio</p>
            <h2 className="dossier-title text-2xl font-semibold">Aprende a leer el resultado</h2>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Ya sabes elegir una moneda. Ahora compararás el resultado con lo que pediste: identidad, pérdidas, tirada mínima y parada.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="academia-media-indice">
          {CRAFTING_MEDIUM_ACADEMY_SCENARIOS.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded border border-border/70 bg-muted/[0.04] px-3 py-2 text-sm">
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-sky-400/35 text-[11px] text-sky-200">{entry.order}</span>
              {entry.title}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setStage("cases")} data-testid="academia-media-empezar">Empezar <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Volver a niveles</Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{CRAFTING_MEDIUM_ACADEMY_EVIDENCE}</p>
      </section>
    );
  }

  if (stage === "results") {
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-media" data-stage="results">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">Nivel medio</p>
        <h2 className="dossier-title mt-1 text-2xl font-semibold">Ya sabes cerrar el bucle</h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="academia-media-resultado">Has resuelto {score} de {CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length}. Puedes pasar de «gasté una moneda» a una decisión comprobable.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onPracticeWithMyItem} data-testid="academia-media-practicar">Probar con mi objeto <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="outline" onClick={restart}><RotateCcw className="size-4" /> Repetir nivel</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Volver a niveles</Button>
        </div>
      </section>
    );
  }

  if (!scenario) return null;
  return (
    <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-media" data-stage="cases">
      <MediumCase
        scenario={scenario}
        chosenId={answers[scenario.id] ?? null}
        onChoose={(id) => setAnswers((current) => ({ ...current, [scenario.id]: id }))}
        onNext={() => {
          if (cursor === CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length - 1) setStage("results");
          else setCursor((current) => current + 1);
        }}
      />
    </section>
  );
}
