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
  CRAFTING_ADVANCED_ACADEMY_SCENARIOS,
  concealAdvancedAcademyItemReading,
  type AdvancedAcademyScenario,
} from "@shared/craftingAdvancedAcademy.js";
import {
  craftingAdvancedAcademyEvidence,
  craftingAdvancedAcademyScenarios,
} from "@shared/craftingAdvancedAcademyEn.js";
import { AcademyItemBoard } from "@/components/AcademyItemBoard";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText } from "@/i18n/lang";
import {
  emptyAdvancedAcademyProgress,
  loadAdvancedAcademyProgress,
  saveAdvancedAcademyProgress,
} from "@/lib/craftingAdvancedAcademyProgress";

const TEXT = texts(
  {
    caseHeader: (order: number, skill: string) => `Caso ${order} · ${skill}`,
    howToRead: "Cómo leer este caso",
    howToReadBody:
      "Primero mira la pieza. Después comprueba qué quieres conseguir, qué no puedes sacrificar y qué condición te obliga a parar.",
    planAria: "Plan para hacerlo dentro de PoE2",
    iWant: "Quiero conseguir",
    dontLose: "No quiero perder",
    nothingMarked: "Nada marcado",
    stopWhen: "Dejo de gastar cuando",
    riskReplacement: "Reemplaza",
    riskStage: "Cambia etapa",
    riskTransformation: "Transforma",
    riskAdds: "Añade",
    notVerified: "No verificado · léelo en PoE2 antes de gastar",
    whatWouldYouDo: "¿Qué harías dentro de PoE2?",
    optionsAria: "Opciones avanzadas",
    correctAnswerAria: "Respuesta correcta",
    wrongAnswerAria: "Tu respuesta, incorrecta",
    solid: "Decisión sólida",
    assumingTooMuch: "Aquí asumirías demasiado",
    whatWasWrong: "Qué fallaba:",
    takeaway: "Idea que te llevas:",
    doItInGame: "Hazlo dentro de PoE2",
    seeResult: "Ver resultado",
    nextCase: "Siguiente caso",
    backToLevels: "Volver a niveles",
    level: "Nivel avanzado",
    introTitle: "Diseña la decisión antes de gastar",
    introBody: (count: number) =>
      `${count} casos para aprender qué mirar, qué moneda usar y cuándo parar dentro de Path of Exile 2. La web solo te enseña; el crafting ocurre en el juego.`,
    caseNumber: (order: number) => `Caso ${order}`,
    start: "Empezar nivel avanzado",
    useGamePiece: "Usar una pieza de PoE2 como guía",
    levelDone: "Nivel avanzado completado",
    resultTitle: "Ya sabes planear un craft dentro de PoE2",
    result: (correct: number, total: number) =>
      `Has resuelto ${correct} de ${total} decisiones. Esto mide el recorrido, no la calidad ni el valor de un objeto real.`,
    lessons: [
      "Define una salida comprobable",
      "Protege antes de reemplazar",
      "Para cuando se cumple",
      "Cambia de base al llegar a tu límite",
      "Simula el personaje completo antes de sustituir",
    ],
    repeatLevel: "Repetir nivel",
    leaveLevel: "Salir del nivel",
  },
  {
    caseHeader: (order: number, skill: string) => `Case ${order} · ${skill}`,
    howToRead: "How to read this case",
    howToReadBody:
      "First look at the piece. Then check what you want to get, what you can't give up and what condition makes you stop.",
    planAria: "Plan for doing it in PoE2",
    iWant: "I want to get",
    dontLose: "I don't want to lose",
    nothingMarked: "Nothing marked",
    stopWhen: "I stop spending when",
    riskReplacement: "Replaces",
    riskStage: "Changes stage",
    riskTransformation: "Transforms",
    riskAdds: "Adds",
    notVerified: "Not verified · read it in PoE2 before spending",
    whatWouldYouDo: "What would you do in PoE2?",
    optionsAria: "Advanced options",
    correctAnswerAria: "Correct answer",
    wrongAnswerAria: "Your answer, incorrect",
    solid: "Solid decision",
    assumingTooMuch: "You'd be assuming too much here",
    whatWasWrong: "What was wrong:",
    takeaway: "What to take away:",
    doItInGame: "Do it in PoE2",
    seeResult: "See result",
    nextCase: "Next case",
    backToLevels: "Back to levels",
    level: "Advanced level",
    introTitle: "Plan the decision before you spend",
    introBody: (count: number) =>
      `${count} cases to learn what to look at, which currency to use and when to stop in Path of Exile 2. The site only teaches you; the crafting happens in the game.`,
    caseNumber: (order: number) => `Case ${order}`,
    start: "Start advanced level",
    useGamePiece: "Use a PoE2 item as a guide",
    levelDone: "Advanced level complete",
    resultTitle: "You can now plan a craft in PoE2",
    result: (correct: number, total: number) =>
      `You got ${correct} of ${total} decisions right. This measures the course, not the quality or value of a real item.`,
    lessons: [
      "Set an exit you can check",
      "Protect before you replace",
      "Stop once it's met",
      "Switch base when you hit your limit",
      "Simulate your whole character before swapping",
    ],
    repeatLevel: "Repeat level",
    leaveLevel: "Leave level",
  },
);

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
      <p className="flex items-center gap-1.5 text-xs font-semibold text-primary/70">
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
  const t = useText(TEXT);
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
          <p className="text-xs font-semibold text-primary/70">
            {t.caseHeader(scenario.order, scenario.skill)}
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
        <p className="text-xs font-semibold text-primary/70">{t.howToRead}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t.howToReadBody}
        </p>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{scenario.situation}</p>

      <div className="grid gap-2 sm:grid-cols-3" aria-label={t.planAria}>
        <ContractCell icon={<Target className="size-3.5" />} label={t.iWant} value={scenario.contract.objective} />
        <ContractCell icon={<LockKeyhole className="size-3.5" />} label={t.dontLose} value={scenario.contract.protect.length > 0 ? scenario.contract.protect.join(" · ") : t.nothingMarked} missing={scenario.contract.protect.length === 0} />
        <ContractCell icon={<ShieldCheck className="size-3.5" />} label={t.stopWhen} value={scenario.contract.stop} missing={!scenario.facts.stopDefined} />
      </div>

      {scenario.facts.routes.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2" data-testid="academia-avanzada-rutas">
          {scenario.facts.routes.map((route) => (
            <div key={route.id} className="rounded border border-border/70 bg-muted/[0.05] p-3">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{route.label}</strong>
                <span className={`text-xs font-semibold ${route.risk === "replacement" ? "text-rose-300" : route.risk === "stage-change" ? "text-amber-300" : "text-emerald-300"}`}>
                  {route.risk === "replacement" ? t.riskReplacement : route.risk === "stage-change" ? t.riskStage : route.risk === "transformation" ? t.riskTransformation : t.riskAdds}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{route.consequence}</p>
              {!route.tooltipVerified && (
                <p
                  className="mt-2 text-[11px] font-medium text-amber-200"
                  data-testid="academia-avanzada-ruta-no-verificada"
                >
                  {t.notVerified}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-primary/70">{t.whatWouldYouDo}</p>
        <h4 className="text-lg font-semibold" data-testid="academia-avanzada-pregunta">{scenario.question}</h4>
        <div className="mt-2 grid gap-2" role="group" aria-label={t.optionsAria}>
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
                {answered && expected && <CheckCircle2 className="size-5 shrink-0 text-emerald-300" aria-label={t.correctAnswerAria} />}
                {answered && selected && !expected && <XCircle className="size-5 shrink-0 text-rose-300" aria-label={t.wrongAnswerAria} />}
              </button>
            );
          })}
        </div>
      </div>

      {answered && (
        <div ref={feedbackRef} tabIndex={-1} role="status" data-testid="academia-avanzada-feedback" data-result={wasRight ? "correcto" : "incorrecto"} className={`rounded border p-4 outline-none ${wasRight ? "border-emerald-400/45 bg-emerald-500/[0.07]" : "border-rose-400/45 bg-rose-500/[0.07]"}`}>
          <p className={`font-semibold ${wasRight ? "text-emerald-200" : "text-rose-200"}`}>
            {wasRight ? t.solid : t.assumingTooMuch}
          </p>
          {!wasRight && chosen && (
            <p className="mt-1 text-sm leading-relaxed text-rose-100/85">
              <strong>{t.whatWasWrong}</strong> {chosen.hint}
            </p>
          )}
          <p className="mt-1.5 text-sm leading-relaxed">{scenario.explanation}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground"><strong>{t.takeaway}</strong> {scenario.lesson}</p>
          <div className="mt-3 rounded border border-border/70 bg-background/35 p-3" data-testid="academia-avanzada-pasos-juego">
            <p className="text-xs font-semibold text-primary">{t.doItInGame}</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
              {scenario.gameSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </div>
          <Button className="mt-3" type="button" onClick={onNext} data-testid="academia-avanzada-continuar">
            {scenario.order === CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length ? t.seeResult : t.nextCase}
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
  const { lang } = useLang();
  const t = useText(TEXT);
  const scenarios = craftingAdvancedAcademyScenarios(lang);
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
          <ArrowLeft className="size-4" /> {t.backToLevels}
        </Button>
        <div className="mt-4 max-w-3xl">
          <p className="text-xs font-semibold text-primary/70">{t.level}</p>
          <h2 className="dossier-title mt-1 text-3xl font-semibold">{t.introTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.introBody(CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length)}
          </p>
        </div>
        <ol className="mt-5 grid gap-2 sm:grid-cols-2" data-testid="academia-avanzada-indice">
          {scenarios.map((scenario) => (
            <li key={scenario.id} className="rounded border border-border/70 bg-background/45 p-3">
              <span className="text-xs font-semibold text-primary/70">{t.caseNumber(scenario.order)}</span>
              <strong className="mt-1 block text-sm">{scenario.title}</strong>
              <span className="mt-0.5 block text-xs text-muted-foreground">{scenario.skill}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setStage("case")} data-testid="academia-avanzada-empezar">
            {t.start} <ArrowRight className="size-4" />
          </Button>
          <Button type="button" variant="outline" onClick={onPracticeWithMyItem}>{t.useGamePiece}</Button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">{craftingAdvancedAcademyEvidence(lang)}</p>
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
        <p className="text-xs font-semibold text-primary/70">{t.levelDone}</p>
        <h2 className="dossier-title mt-1 text-3xl font-semibold">{t.resultTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="academia-avanzada-resultado">{t.result(correct, CRAFTING_ADVANCED_ACADEMY_SCENARIOS.length)}</p>
        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {t.lessons.map((lesson) => (
            <div key={lesson} className="flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm text-emerald-100">
              <CheckCircle2 className="size-4 shrink-0" /> {lesson}
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={onPracticeWithMyItem} data-testid="academia-avanzada-practicar">{t.useGamePiece} <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="outline" onClick={restart}><RotateCcw className="size-4" /> {t.repeatLevel}</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> {t.backToLevels}</Button>
        </div>
      </section>
    );
  }

  const scenario = scenarios[cursor]!;
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
        <Button type="button" variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" /> {t.leaveLevel}</Button>
      </div>
    </section>
  );
}
