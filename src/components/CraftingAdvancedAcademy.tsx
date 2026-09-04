import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import {
  CRAFTING_ADVANCED_ACADEMY_EVIDENCE,
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  concealAdvancedAcademyItemReading,
  type AdvancedAcademyScenario,
} from "@shared/craftingAdvancedAcademy.js";
import { AcademyItemBoard } from "@/components/AcademyItemBoard";
import { Button } from "@/components/ui/button";
import {
  emptyAdvancedAcademyProgress,
  loadAdvancedAcademyProgress,
  saveAdvancedAcademyProgress,
} from "@/lib/craftingAdvancedAcademyProgress";

function ContractCell({
  icon,
  label,
  value,
  missing,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="min-w-0 rounded border border-border/70 bg-background/55 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/70">
        {icon}
        {label}
      </p>
      <p className={`mt-1.5 text-xs leading-relaxed ${missing ? "font-semibold text-amber-200" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function AdvancedScenarioView({
  scenario,
  chosenOptionId,
  onAnswer,
  onNext,
}: {
  scenario: AdvancedAcademyScenario;
  chosenOptionId: string | null;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
}) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  const answered = chosenOptionId !== null;
  const chosen = scenario.options.find((entry) => entry.id === chosenOptionId);
  const wasRight = chosen?.decision === scenario.expectedDecision;

  useEffect(() => {
    if (answered) feedbackRef.current?.focus({ preventScroll: true });
  }, [answered]);

  return (
    <div className="space-y-4" data-testid="academia-avanzada-caso">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
            Caso {scenario.order} · {scenario.skill}
          </p>
          <h3 className="dossier-title mt-1 text-2xl font-semibold">{scenario.title}</h3>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          {scenario.order} / {CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length} aria-valuenow={scenario.order}>
        <span className="block h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((scenario.order / CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length) * 100)}%` }} />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <AcademyItemBoard
          item={scenario.item}
          concealCounters={concealAdvancedAcademyItemReading(scenario)}
          className="lg:sticky lg:top-24"
        />

        <div className="min-w-0 space-y-4">
      <div className="rounded border border-border/70 bg-muted/[0.04] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">Cómo leer este caso</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Primero mira la pieza. Después comprueba qué quieres conseguir, qué no puedes sacrificar y qué condición te obliga a parar.
        </p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{scenario.situation}</p>

      <div className="grid gap-2 sm:grid-cols-3" aria-label="Plan para hacerlo dentro de PoE2">
        <ContractCell icon={<Target className="size-3.5" />} label="Quiero conseguir" value={scenario.contract.objective} />
        <ContractCell icon={<LockKeyhole className="size-3.5" />} label="No quiero perder" value={scenario.contract.protect.length > 0 ? scenario.contract.protect.join(" · ") : "Nada marcado"} missing={scenario.contract.protect.length === 0} />
        <ContractCell icon={<ShieldCheck className="size-3.5" />} label="Dejo de gastar cuando" value={scenario.contract.stop} missing={!scenario.facts.stopDefined} />
      </div>

      {scenario.facts.routes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="academia-avanzada-rutas">
          {scenario.facts.routes.map((route) => (
            <div key={route.id} className="rounded border border-border/70 bg-muted/[0.05] p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{route.label}</strong>
                <span className={`text-[10px] font-semibold uppercase tracking-wide ${route.risk === "replacement" ? "text-rose-300" : route.risk === "stage-change" ? "text-amber-300" : "text-emerald-300"}`}>
                  {route.risk === "replacement" ? "Reemplaza" : route.risk === "stage-change" ? "Cambia etapa" : route.risk === "transformation" ? "Transforma" : "Añade"}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{route.consequence}</p>
              {!route.tooltipVerified && (
                <p
                  className="mt-2 text-[11px] font-medium text-amber-200"
                  data-testid="academia-avanzada-ruta-no-verificada"
                >
                  No verificado · léelo en PoE2 antes de gastar
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">¿Qué harías dentro de PoE2?</p>
        <h4 className="text-lg font-semibold" data-testid="academia-avanzada-pregunta">{scenario.question}</h4>
        <div className="mt-2 grid gap-2" role="group" aria-label="Opciones avanzadas">
          {scenario.options.map((entry) => {
            const expected = entry.decision === scenario.expectedDecision;
            const selected = entry.id === chosenOptionId;
            const state = !answered ? "open" : expected ? "correct" : selected ? "wrong" : "muted";
            return (
              <button
                key={entry.id}
                type="button"
                disabled={answered}
                onClick={() => onAnswer(entry.id)}
                data-testid={`academia-avanzada-opcion-${entry.id}`}
                data-state={state}
                className={`flex min-h-14 items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default ${state === "correct" ? "border-emerald-400/55 bg-emerald-500/[0.1]" : state === "wrong" ? "border-rose-400/55 bg-rose-500/[0.1]" : state === "muted" ? "border-border/40 opacity-55" : "border-border bg-background/45 hover:border-primary/45 hover:bg-primary/[0.06]"}`}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm">{entry.label}</strong>
                  {answered && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">{entry.hint}</span>
                  )}
                </span>
                {answered && expected && <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-label="Respuesta correcta" />}
                {answered && selected && !expected && <XCircle className="size-5 shrink-0 text-rose-300" aria-label="Tu respuesta, incorrecta" />}
              </button>
            );
          })}
        </div>
      </div>

      {answered && (
        <div ref={feedbackRef} tabIndex={-1} role="status" data-testid="academia-avanzada-feedback" data-result={wasRight ? "correcto" : "incorrecto"} className={`rounded border p-4 outline-none ${wasRight ? "border-emerald-400/45 bg-emerald-500/[0.07]" : "border-rose-400/45 bg-rose-500/[0.07]"}`}>
          <p className={`font-semibold ${wasRight ? "text-emerald-200" : "text-rose-200"}`}>
            {wasRight ? "Decisión sólida" : "Aquí asumirías demasiado"}
          </p>
          {!wasRight && chosen && (
            <p className="mt-1 text-sm leading-relaxed text-rose-100/85">
              <strong>Qué fallaba:</strong> {chosen.hint}
            </p>
          )}
          <p className="mt-1.5 text-sm leading-relaxed">{scenario.explanation}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><strong>Idea que te llevas:</strong> {scenario.lesson}</p>
          <div className="mt-3 rounded border border-border/70 bg-background/35 p-3" data-testid="academia-avanzada-pasos-juego">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Hazlo dentro de PoE2</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {scenario.gameSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          <Button className="mt-3" type="button" onClick={onNext} data-testid="academia-avanzada-continuar">
            {scenario.order === CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length ? "Ver resultado" : "Siguiente caso"}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

export function CraftingAdvancedAcademy({
  onBack,
  onPracticeWithMyItem,
}: {
  onBack: () => void;
  onPracticeWithMyItem: () => void;
}) {
  const [initialProgress] = useState(
    () => loadAdvancedAcademyProgress() ?? emptyAdvancedAcademyProgress(),
  );
  const [stage, setStage] = useState(initialProgress.stage);
  const [cursor, setCursor] = useState(initialProgress.cursor);
  const [answers, setAnswers] = useState<Record<string, string>>(
    initialProgress.answers,
  );

  useEffect(() => {
    saveAdvancedAcademyProgress({
      schemaVersion: 1,
      contentVersion: initialProgress.contentVersion,
      stage,
      cursor,
      answers,
    });
  }, [answers, cursor, initialProgress.contentVersion, stage]);

  const restart = () => {
    setCursor(0);
    setAnswers({});
    setStage("intro");
  };

  if (stage === "intro") {
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-avanzada" data-stage="intro">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} data-testid="academia-avanzada-volver">
          <ArrowLeft className="size-4" /> Volver a niveles
        </Button>
        <div className="mt-4 max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Nivel avanzado</p>
          <h2 className="dossier-title mt-1 text-3xl font-semibold">Diseña la decisión antes de gastar</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length} casos para aprender qué mirar, qué moneda usar y cuándo parar dentro de Path of Exile 2. La web solo te enseña; el crafting ocurre en el juego.
          </p>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="academia-avanzada-indice">
          {CRAFTING_ADVANCED_ACADEMY_SCENARIOS.map((scenario) => (
            <li key={scenario.id} className="rounded border border-border/70 bg-background/45 p-3">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/70">Caso {scenario.order}</span>
              <strong className="mt-1 block text-sm">{scenario.title}</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">{scenario.skill}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setStage("case")} data-testid="academia-avanzada-empezar">
            Empezar nivel avanzado <ArrowRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onPracticeWithMyItem}>Usar una pieza de PoE2 como guía</Button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{CRAFTING_ADVANCED_ACADEMY_EVIDENCE}</p>
      </section>
    );
  }

  if (stage === "results") {
    const correct = CRAFTING_ADVANCED_ACADEMY_SCENARIOS.filter((scenario) => {
      const selected = scenario.options.find((entry) => entry.id === answers[scenario.id]);
      return selected?.decision === scenario.expectedDecision;
    }).length;
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-avanzada" data-stage="results">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/70">Nivel avanzado completado</p>
        <h2 className="dossier-title mt-1 text-3xl font-semibold">Ya sabes planear un craft dentro de PoE2</h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="academia-avanzada-resultado">Has resuelto {correct} de {CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length} decisiones. Esto mide el recorrido, no la calidad ni el valor de un objeto real.</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            "Define una salida comprobable",
            "Protege antes de reemplazar",
            "Para cuando se cumple",
            "Cambia de base al llegar a tu límite",
            "Simula el personaje completo antes de sustituir",
          ].map((lesson) => (
            <div key={lesson} className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm text-emerald-100">
              <CheckCircle2 className="size-4 shrink-0" /> {lesson}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onPracticeWithMyItem} data-testid="academia-avanzada-practicar">Usar una pieza de PoE2 como guía <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="outline" onClick={restart}><RotateCcw className="size-4" /> Repetir nivel</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> Volver a niveles</Button>
        </div>
      </section>
    );
  }

  const scenario = CRAFTING_ADVANCED_ACADEMY_SCENARIOS[cursor]!;
  return (
    <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-avanzada" data-stage="case">
      <AdvancedScenarioView
        key={scenario.id}
        scenario={scenario}
        chosenOptionId={answers[scenario.id] ?? null}
        onAnswer={(optionId) => setAnswers((current) => ({ ...current, [scenario.id]: optionId }))}
        onNext={() => {
          if (cursor + 1 >= CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length) setStage("results");
          else setCursor((current) => current + 1);
        }}
      />
      <div className="mt-5 border-t border-border/70 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> Salir del nivel</Button>
      </div>
    </section>
  );
}
