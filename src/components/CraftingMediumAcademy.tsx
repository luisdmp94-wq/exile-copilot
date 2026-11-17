import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Gamepad2, RotateCcw, XCircle } from "lucide-react";
import {
  CRAFTING_MEDIUM_ACADEMY_SCENARIOS,
  type MediumAcademyScenario,
} from "@shared/craftingMediumAcademy.js";
import {
  craftingMediumAcademyEvidence,
  craftingMediumAcademyScenarios,
  craftingMediumBaseReadingHelp,
} from "@shared/craftingMediumAcademyEn.js";
import { AcademyItemBoard } from "@/components/AcademyItemBoard";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText } from "@/i18n/lang";
import {
  emptyMediumAcademyProgress,
  loadMediumAcademyProgress,
  saveMediumAcademyProgress,
} from "@/lib/craftingMediumAcademyProgress";

interface CraftingMediumAcademyProps {
  onBack: () => void;
  onPracticeWithMyItem: () => void;
}

const TEXT = texts(
  {
    situationNumber: (order: number) => `Situación ${order}`,
    beforeDeciding: "Antes de decidir",
    readItem:
      "Lee la base, la rareza, sus modificadores y los huecos. Después compáralos con lo que tu personaje necesita.",
    inGameAria: "Situación dentro del juego",
    inGame: "En el juego",
    whatYouWant: "Lo que buscas",
    whatWouldYouDo: "¿Qué harías dentro de PoE2?",
    decisionsAria: "Decisiones del nivel medio",
    correctAnswerAria: "Respuesta correcta",
    wrongAnswerAria: "Tu respuesta, incorrecta",
    correct: "Correcto",
    notThatOne: "No era esa",
    whatWasWrong: "Qué fallaba:",
    keyIdea: (takeaway: string) => `Idea clave: ${takeaway}`,
    stopWhen: "Para cuando",
    doItInGame: "Hazlo dentro de PoE2",
    seeResult: "Ver resultado",
    nextSituation: "Siguiente situación",
    level: "Nivel medio",
    introTitle: "Aprende a decidir dentro del juego",
    introBody:
      "Ya sabes qué hace cada moneda. Ahora aprenderás qué significa la base, cómo confirmarla sin adivinar la build, detectar una salida prometedora, invertir con intención y parar cuando la pieza ya cumple su función.",
    start: "Empezar",
    backToLevels: "Volver a niveles",
    resultTitle: "Ya sabes dirigir un craft en PoE2",
    result: (score: number, total: number) =>
      `Has resuelto ${score} de ${total}. Ya puedes pasar de «tengo una moneda» a «sé por qué la usaría y cuándo parar».`,
    useGamePiece: "Usar una pieza de PoE2 como guía",
    repeatLevel: "Repetir nivel",
  },
  {
    situationNumber: (order: number) => `Situation ${order}`,
    beforeDeciding: "Before you decide",
    readItem:
      "Read the base, the rarity, its modifiers and the open slots. Then compare them with what your character needs.",
    inGameAria: "Situation in the game",
    inGame: "In the game",
    whatYouWant: "What you're after",
    whatWouldYouDo: "What would you do in PoE2?",
    decisionsAria: "Medium level decisions",
    correctAnswerAria: "Correct answer",
    wrongAnswerAria: "Your answer, incorrect",
    correct: "Correct",
    notThatOne: "Not that one",
    whatWasWrong: "What was wrong:",
    keyIdea: (takeaway: string) => `Key idea: ${takeaway}`,
    stopWhen: "Stop when",
    doItInGame: "Do it in PoE2",
    seeResult: "See result",
    nextSituation: "Next situation",
    level: "Medium level",
    introTitle: "Learn to make decisions in the game",
    introBody:
      "You already know what each currency does. Now you'll learn what the base means, how to confirm it without guessing your build, spot a promising start, invest with a purpose and stop when the piece already does its job.",
    start: "Start",
    backToLevels: "Back to levels",
    resultTitle: "You can now steer a craft in PoE2",
    result: (score: number, total: number) =>
      `You solved ${score} of ${total}. You've gone from “I have a currency” to “I know why I'd use it and when to stop”.`,
    useGamePiece: "Use a PoE2 item as a guide",
    repeatLevel: "Repeat level",
  },
);

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
  const { lang } = useLang();
  const t = TEXT[lang];
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
          <p className="text-xs font-semibold text-primary/70">
            {t.situationNumber(scenario.order)}
          </p>
          <h3 className="dossier-title mt-1 text-2xl font-semibold">{scenario.title}</h3>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
          {scenario.order} / {CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length}
        </span>
      </div>

      <div className="h-1 overflow-hidden rounded-full bg-border/60" role="progressbar" aria-valuemin={0} aria-valuemax={CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length} aria-valuenow={scenario.order}>
        <span className="block h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none" style={{ width: `${Math.round((scenario.order / CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length) * 100)}%` }} />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <AcademyItemBoard item={scenario.item} className="lg:sticky lg:top-24" />

        <div className="min-w-0 space-y-4">
          <div className="rounded-md border border-border/70 bg-muted/[0.04] p-3">
            <p className="text-xs font-semibold text-primary/70">{t.beforeDeciding}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {scenario.facts.situation === "base-selection"
                ? craftingMediumBaseReadingHelp(lang)
                : t.readItem}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">{scenario.situation}</p>

          <div className="grid gap-px overflow-hidden rounded-md border border-border/70 bg-border/60 sm:grid-cols-2" aria-label={t.inGameAria}>
            <div className="bg-background/70 p-3">
              <span className="text-xs font-semibold text-muted-foreground">{t.inGame}</span>
              <p className="mt-1 text-sm font-medium">{scenario.gameState}</p>
            </div>
            <div className="bg-muted/[0.04] p-3">
              <span className="text-xs font-semibold text-primary/70">{t.whatYouWant}</span>
              <p className="mt-1 text-sm font-medium">{scenario.playerGoal}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold text-primary/70">{t.whatWouldYouDo}</p>
            <h4 className="text-lg font-semibold" data-testid="academia-media-pregunta">{scenario.question}</h4>
            <div className="mt-2 grid gap-2" role="group" aria-label={t.decisionsAria}>
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
                    className={`flex min-h-14 items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default ${state === "correct" ? "border-emerald-400/55 bg-emerald-500/[0.1]" : state === "wrong" ? "border-rose-400/55 bg-rose-500/[0.1]" : state === "muted" ? "border-border/50 opacity-55" : "border-border bg-muted/[0.04] hover:border-primary/45 hover:bg-primary/[0.06]"}`}
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
            <div
              ref={feedbackRef}
              tabIndex={-1}
              role="status"
              data-testid="academia-media-feedback"
              data-result={correct ? "correcto" : "incorrecto"}
              className={`rounded-md border p-3 outline-none ${correct ? "border-emerald-400/45 bg-emerald-500/[0.08]" : "border-rose-400/45 bg-rose-500/[0.08]"}`}
            >
              <p className="text-sm font-semibold">{correct ? t.correct : t.notThatOne}</p>
              {!correct && chosen && (
                <p className="mt-1 text-sm leading-relaxed text-rose-100/85">
                  <strong>{t.whatWasWrong}</strong> {chosen.hint}
                </p>
              )}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{scenario.explanation}</p>
              <p className="mt-2 text-xs font-medium text-primary">{t.keyIdea(scenario.takeaway)}</p>
              <div className="mt-3 rounded border border-amber-400/25 bg-amber-400/[0.05] px-3 py-2" data-testid="academia-media-parada">
                <p className="text-xs font-semibold text-amber-200">{t.stopWhen}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{scenario.stopCondition}</p>
              </div>
              <div className="mt-3 rounded border border-border/70 bg-background/35 p-3" data-testid="academia-media-pasos-juego">
                <p className="text-xs font-semibold text-primary">{t.doItInGame}</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {scenario.gameSteps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              </div>
              <Button className="mt-3" type="button" onClick={onNext} data-testid="academia-media-continuar">
                {scenario.order === CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length ? t.seeResult : t.nextSituation}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CraftingMediumAcademy({ onBack, onPracticeWithMyItem }: CraftingMediumAcademyProps) {
  const { lang } = useLang();
  const t = useText(TEXT);
  const scenarios = craftingMediumAcademyScenarios(lang);
  const [initialProgress] = useState(
    () => loadMediumAcademyProgress() ?? emptyMediumAcademyProgress(),
  );
  const [stage, setStage] = useState(initialProgress.stage);
  const [cursor, setCursor] = useState(initialProgress.cursor);
  const [answers, setAnswers] = useState<Record<string, string>>(
    initialProgress.answers,
  );
  const scenario = scenarios[cursor];
  const score = CRAFTING_MEDIUM_ACADEMY_SCENARIOS.filter((entry) => {
    const answer = entry.options.find((option) => option.id === answers[entry.id]);
    return answer?.decision === entry.expectedDecision;
  }).length;

  useEffect(() => {
    saveMediumAcademyProgress({
      schemaVersion: 1,
      contentVersion: initialProgress.contentVersion,
      stage,
      cursor,
      answers,
    });
  }, [answers, cursor, initialProgress.contentVersion, stage]);

  const restart = () => {
    setStage("intro");
    setCursor(0);
    setAnswers({});
  };

  if (stage === "intro") {
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-media" data-stage="intro">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-sm border border-primary/40 bg-primary/10 text-primary"><Gamepad2 className="size-5" aria-hidden="true" /></span>
          <div>
            <p className="text-xs font-semibold text-primary/70">{t.level}</p>
            <h2 className="dossier-title text-2xl font-semibold">{t.introTitle}</h2>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {t.introBody}
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="academia-media-indice">
          {scenarios.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 rounded border border-border/70 bg-muted/[0.04] px-3 py-2 text-sm">
              <span className="grid size-5 shrink-0 place-items-center rounded-full border border-primary/35 text-[11px] text-primary">{entry.order}</span>
              {entry.title}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" onClick={() => setStage("cases")} data-testid="academia-media-empezar">{t.start} <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> {t.backToLevels}</Button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">{craftingMediumAcademyEvidence(lang)}</p>
      </section>
    );
  }

  if (stage === "results") {
    return (
      <section className="superficie-panel min-w-0 p-4 sm:p-6" data-testid="academia-media" data-stage="results">
        <p className="text-xs font-semibold text-primary/70">{t.level}</p>
        <h2 className="dossier-title mt-1 text-2xl font-semibold">{t.resultTitle}</h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="academia-media-resultado">{t.result(score, CRAFTING_MEDIUM_ACADEMY_SCENARIOS.length)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={onPracticeWithMyItem} data-testid="academia-media-practicar">{t.useGamePiece} <ArrowRight className="size-4" /></Button>
          <Button type="button" variant="outline" onClick={restart}><RotateCcw className="size-4" /> {t.repeatLevel}</Button>
          <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="size-4" /> {t.backToLevels}</Button>
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
