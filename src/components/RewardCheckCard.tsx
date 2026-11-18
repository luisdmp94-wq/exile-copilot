import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, ListChecks, XCircle } from "lucide-react";
import type { Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActGuide } from "@/guides/guide";
import { GUIDE_SLOTS } from "@/lib/guideCheck";
import { checkRewards, rewardInputsNeeded, type RewardStatus } from "@/lib/rewardCheck";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";

const STORAGE_PREFIX = "exile-copilot:guia-recompensas:";

const TEXT = texts(
  {
    element: { fire: "fuego", cold: "hielo", lightning: "rayo" },
    status: { ok: "Lo tienes", missing: "Te falta", unsure: "No puedo asegurarlo", ask: "Dímelo tú" },
    title: (act: string) => `¿Me he saltado algo del ${act}?`,
    lead: "No veo tu partida, pero cada recompensa deja huella en un número del juego. Dime esos números y hago la resta.",
    yourGear: "Tu equipo: ",
    noGear: "aún no has pegado ninguna pieza. Pégalas arriba, en «¿Está listo tu personaje?».",
    gearCount: (count: number, total: number) => `${count} de ${total} piezas pegadas`,
    halfGear: ". Con el equipo a medias, las restas no valen.",
    actGroup: "En qué acto estás ahora",
    whereFirst: "Primero dime dónde estás ahora:",
    whereNow: "Ahora estás en:",
    stillIn: (act: number) => `Sigo en el acto ${act}`,
    alreadyIn: (act: number) => `Ya en el acto ${act}`,
    whyAct: (act: number) =>
      `Importa: al pasar al acto ${act} el juego te quita resistencias, y sin saberlo la resta sale mal.`,
    resLabel: (element: string) => `Resistencia al ${element} de tu hoja (tecla C)`,
    spiritLabel: "Espíritu máximo de tu hoja (tecla C)",
    pointsLabel: "Puntos de set de armas (árbol, tecla P, arriba a la derecha)",
    pointsHelp: "En el árbol pone «Set de armas I: 2 (2)». El número que vale es el que está entre paréntesis: el total.",
    yes: "Sí",
    no: "No",
    footer:
      "Solo afirmo lo que sale de la resta. Si llevas resistencias en el árbol de pasivas o alguna pieza no es la que llevas puesta, te lo digo en vez de adivinar.",
  },
  {
    element: { fire: "fire", cold: "cold", lightning: "lightning" },
    status: { ok: "You have it", missing: "Missing", unsure: "Can't be sure", ask: "Tell me" },
    title: (act: string) => `Did I skip anything in ${act}?`,
    lead: "I can't see your game, but every reward leaves a trace in a number the game shows. Tell me those numbers and I'll do the subtraction.",
    yourGear: "Your gear: ",
    noGear: "you haven't pasted any items yet. Paste them above, in “Is your character ready?”.",
    gearCount: (count: number, total: number) => `${count} of ${total} items pasted`,
    halfGear: ". With half your gear, the subtractions don't hold.",
    actGroup: "Which act you're in now",
    whereFirst: "First tell me where you are now:",
    whereNow: "You're now in:",
    stillIn: (act: number) => `Still in act ${act}`,
    alreadyIn: (act: number) => `Already in act ${act}`,
    whyAct: (act: number) =>
      `It matters: when you reach act ${act} the game takes away resistances, and without knowing it the subtraction comes out wrong.`,
    resLabel: (element: string) => `${element.replace(/^./, (c) => c.toUpperCase())} resistance on your sheet (C key)`,
    spiritLabel: "Maximum spirit on your sheet (C key)",
    pointsLabel: "Weapon set points (tree, P key, top right)",
    pointsHelp: "The tree shows “Weapon Set I: 2 (2)”. The number that counts is the one in brackets: the total.",
    yes: "Yes",
    no: "No",
    footer:
      "I only state what the subtraction supports. If you have resistances on your passive tree or an item isn't the one you're wearing, I tell you instead of guessing.",
  },
);

interface Remembered {
  /** null = el jugador aún no ha dicho en qué acto está. */
  currentAct: number | null;
  resistance: Record<string, string>;
  spirit: string;
  points: string;
  answers: Record<string, boolean>;
}

function readRemembered(slug: string, act: number): Remembered {
  const fallback: Remembered = { currentAct: null, resistance: {}, spirit: "", points: "", answers: {} };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_PREFIX + slug) ?? "null") as Partial<Remembered> | null;
    if (!parsed) return fallback;
    const text = (value: unknown) => (typeof value === "string" ? value.slice(0, 4) : "");
    return {
      currentAct: parsed.currentAct === act || parsed.currentAct === act + 1 ? parsed.currentAct : null,
      resistance: Object.fromEntries(Object.entries(parsed.resistance ?? {}).map(([key, value]) => [key, text(value)])),
      spirit: text(parsed.spirit),
      points: text(parsed.points),
      answers: Object.fromEntries(Object.entries(parsed.answers ?? {}).filter(([, value]) => typeof value === "boolean")) as Record<
        string,
        boolean
      >,
    };
  } catch {
    return fallback;
  }
}

/** Número escrito por el jugador; vacío o no numérico = no lo ha dicho. */
function toNumber(value: string): number | null {
  if (value.trim() === "" || value.trim() === "-") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const STATUS: Record<RewardStatus, { icon: typeof CheckCircle2; className: string }> = {
  ok: { icon: CheckCircle2, className: "text-emerald-300" },
  missing: { icon: XCircle, className: "text-rose-300" },
  unsure: { icon: AlertTriangle, className: "text-amber-300" },
  ask: { icon: CircleHelp, className: "text-sky-300" },
};

interface RewardCheckCardProps {
  guide: ActGuide;
  /** Guías de los actos anteriores: la cuenta de puntos es acumulada. */
  earlier: readonly ActGuide[];
  /** Piezas de equipo pegadas en la comprobación del personaje. */
  items: readonly Item[];
}

/**
 * «¿Me he saltado algo?»: con el equipo pegado y unos pocos números que
 * enseña el juego, deduce qué recompensas permanentes del acto tiene el
 * jugador y cuáles le faltan.
 */
export function RewardCheckCard({ guide, earlier, items }: RewardCheckCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const needed = useMemo(() => rewardInputsNeeded(guide), [guide]);
  const [remembered] = useState(() => readRemembered(guide.slug, guide.act));
  const [currentAct, setCurrentAct] = useState(remembered.currentAct);
  const [resistance, setResistance] = useState(remembered.resistance);
  const [spirit, setSpirit] = useState(remembered.spirit);
  const [points, setPoints] = useState(remembered.points);
  const [answers, setAnswers] = useState(remembered.answers);

  useEffect(() => {
    try {
      const value: Remembered = { currentAct, resistance, spirit, points, answers };
      window.localStorage.setItem(STORAGE_PREFIX + guide.slug, JSON.stringify(value));
    } catch {
      // Sin almacenamiento los números valen para esta visita.
    }
  }, [guide.slug, currentAct, resistance, spirit, points, answers]);

  const pieces = items.filter((item) => GUIDE_SLOTS.some(({ slot }) => slot === item.slot));
  const lines = useMemo(
    () =>
      checkRewards(guide, earlier, {
        items: pieces,
        expectedPieces: GUIDE_SLOTS.length,
        currentAct,
        sheetResistance: Object.fromEntries(needed.resistances.map((element) => [element, toNumber(resistance[element] ?? "")])),
        sheetSpirit: toNumber(spirit),
        weaponSetPoints: toNumber(points),
        answers,
      }, lang),
    // `pieces` se recalcula en cada render; depende solo de `items`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guide, earlier, items, currentAct, needed, resistance, spirit, points, answers, lang],
  );

  if (lines.length === 0) return null;
  const numeric = (value: string) => value.replace(/[^\d-]/g, "").slice(0, 4);

  return (
    <section
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="saltado-titulo"
      data-testid="saltado"
    >
      <h2 id="saltado-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ListChecks className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title(guide.actLabel)}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      <div className="mt-3 space-y-3">
        <p className="text-sm" data-testid="saltado-equipo">
          <span className="text-muted-foreground">{t.yourGear}</span>
          {pieces.length === 0 ? (
            <span className="text-amber-200">
              {t.noGear}
            </span>
          ) : (
            <span className={pieces.length < GUIDE_SLOTS.length ? "text-amber-200" : "text-foreground"}>
              {t.gearCount(pieces.length, GUIDE_SLOTS.length)}
              {pieces.length < GUIDE_SLOTS.length ? t.halfGear : "."}
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t.actGroup}>
          <span className={cn("text-sm", currentAct === null ? "font-semibold text-amber-200" : "text-muted-foreground")}>
            {currentAct === null ? t.whereFirst : t.whereNow}
          </span>
          {[guide.act, guide.act + 1].map((act) => (
            <Button
              key={act}
              type="button"
              size="sm"
              variant={currentAct === act ? "default" : "outline"}
              aria-pressed={currentAct === act}
              onClick={() => setCurrentAct(act)}
              data-testid={`saltado-acto-${act}`}
            >
              {act === guide.act ? t.stillIn(act) : t.alreadyIn(act)}
            </Button>
          ))}
        </div>
        {needed.resistances.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t.whyAct(guide.act + 1)}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {needed.resistances.map((element) => (
            <div key={element}>
              <Label htmlFor={`saltado-res-${element}`} className="text-xs text-muted-foreground">
                {t.resLabel(t.element[element])}
              </Label>
              <Input
                id={`saltado-res-${element}`}
                value={resistance[element] ?? ""}
                inputMode="numeric"
                onChange={(event) => setResistance({ ...resistance, [element]: numeric(event.target.value) })}
                placeholder="27"
                className="mt-1"
                data-testid={`saltado-res-${element}`}
              />
            </div>
          ))}
          {needed.spirit && (
            <div>
              <Label htmlFor="saltado-espiritu" className="text-xs text-muted-foreground">
                {t.spiritLabel}
              </Label>
              <Input
                id="saltado-espiritu"
                value={spirit}
                inputMode="numeric"
                onChange={(event) => setSpirit(numeric(event.target.value))}
                placeholder="130"
                className="mt-1"
                data-testid="saltado-espiritu"
              />
            </div>
          )}
          {needed.weaponSetPoints && (
            <div>
              <Label htmlFor="saltado-puntos" className="text-xs text-muted-foreground">
                {t.pointsLabel}
              </Label>
              <Input
                id="saltado-puntos"
                value={points}
                inputMode="numeric"
                onChange={(event) => setPoints(numeric(event.target.value))}
                placeholder="4"
                className="mt-1"
                data-testid="saltado-puntos"
              />
            </div>
          )}
        </div>
        {needed.weaponSetPoints && (
          <p className="text-xs text-muted-foreground">
            {t.pointsHelp}
          </p>
        )}
      </div>

      <ul className="mt-4 space-y-3 border-t border-border pt-4" data-testid="saltado-resultado" aria-live="polite">
        {lines.map((line) => {
          const status = STATUS[line.status];
          const Icon = status.icon;
          return (
            <li key={line.zone} className="flex gap-2.5" data-testid="saltado-linea" data-status={line.status}>
              <Icon className={cn("mt-0.5 size-5 shrink-0", status.className)} aria-hidden="true" />
              <div className="min-w-0 text-sm leading-relaxed">
                <p className="font-semibold text-foreground">
                  {line.reward} <span className="font-normal text-muted-foreground">· {line.zone}</span>{" "}
                  <span className={cn("text-xs font-normal", status.className)}>· {t.status[line.status]}</span>
                </p>
                {line.question ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-foreground/90">{line.question}</span>
                    {([true, false] as const).map((value) => (
                      <Button
                        key={String(value)}
                        type="button"
                        size="sm"
                        variant={answers[line.zone] === value ? "secondary" : "outline"}
                        aria-pressed={answers[line.zone] === value}
                        onClick={() => setAnswers({ ...answers, [line.zone]: value })}
                      >
                        {value ? t.yes : t.no}
                      </Button>
                    ))}
                  </div>
                ) : null}
                {(line.status !== "ask" || !line.question) && <p className="text-foreground/85">{line.text}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        {t.footer}
      </p>
    </section>
  );
}
