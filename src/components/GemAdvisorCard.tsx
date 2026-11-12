import { useEffect, useState } from "react";
import { ChevronDown, Gem, Loader2, Sparkles } from "lucide-react";
import type { GemAttribute, SupportAdviceResponse } from "@shared/supportGemAdvice.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "exile-copilot:asistencia";
const GRADES = [
  { value: 1, label: "I" },
  { value: 2, label: "II" },
  { value: 3, label: "III" },
  { value: 4, label: "IV" },
  { value: 5, label: "V" },
];
const ATTRIBUTES: Array<{ id: GemAttribute; label: string; className: string }> = [
  { id: "Int", label: "Inteligencia", className: "text-sky-200" },
  { id: "Des", label: "Destreza", className: "text-emerald-200" },
  { id: "Fue", label: "Fuerza", className: "text-rose-200" },
];
const ATTRIBUTE_LABEL: Record<GemAttribute, string> = { Int: "inteligencia", Des: "destreza", Fue: "fuerza" };

interface Remembered {
  maxGrade: number;
  attributes: GemAttribute[];
}

function readRemembered(): Remembered {
  const fallback: Remembered = { maxGrade: 1, attributes: ["Int", "Des", "Fue"] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Remembered> | null;
    if (!parsed) return fallback;
    const attributes = (parsed.attributes ?? []).filter((item): item is GemAttribute => ATTRIBUTES.some((a) => a.id === item));
    const maxGrade = GRADES.some((grade) => grade.value === parsed.maxGrade) ? (parsed.maxGrade as number) : 1;
    return { maxGrade, attributes: attributes.length > 0 ? attributes : fallback.attributes };
  } catch {
    return fallback;
  }
}

function splitNames(value: string): string[] {
  return value
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 5);
}

/**
 * «¿Qué gema de asistencia le pongo?»: el jugador dice la habilidad y lo que
 * le deja tallar su gema; las reglas filtran y, si hay IA, elige y lo explica.
 */
export function GemAdvisorCard() {
  const [remembered] = useState(readRemembered);
  const [skills, setSkills] = useState<string[]>([]);
  const [skill, setSkill] = useState("");
  const [maxGrade, setMaxGrade] = useState(remembered.maxGrade);
  const [attributes, setAttributes] = useState<GemAttribute[]>(remembered.attributes);
  const [socketed, setSocketed] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<SupportAdviceResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .gemSkills()
      .then((response) => {
        if (!cancelled) setSkills(response.skills.map((item) => item.name).sort((a, b) => a.localeCompare(b, "es")));
      })
      .catch(() => {
        // Sin la lista sigue funcionando: el jugador escribe el nombre a mano.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ maxGrade, attributes }));
    } catch {
      // Sin almacenamiento la elección vale para esta visita.
    }
  }, [maxGrade, attributes]);

  const toggleAttribute = (id: GemAttribute) =>
    setAttributes((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const ask = async () => {
    if (!skill.trim()) {
      setError("Escribe primero la habilidad, tal como sale en el juego.");
      return;
    }
    if (attributes.length === 0) {
      setError("Marca al menos un atributo en el que te quede hueco.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const names = splitNames(socketed);
      setAnswer(
        await api.supportGemAdvice({
          skill: skill.trim(),
          maxGrade,
          attributes,
          ...(names.length > 0 ? { socketed: names } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      );
    } catch (err) {
      setAnswer(null);
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pick = answer?.recommended ?? null;

  return (
    <section
      className="rounded-xl border-2 border-primary/40 bg-card p-4 sm:p-5"
      aria-labelledby="asistencia-titulo"
      data-testid="asistencia"
    >
      <h2 id="asistencia-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Gem className="size-5 shrink-0 text-primary" aria-hidden="true" />
        ¿Qué gema de asistencia le pongo?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dime la habilidad y qué te deja tallar tu gema. Te digo cuál poner y por qué.
      </p>

      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <div>
          <Label htmlFor="asistencia-habilidad" className="text-sm text-muted-foreground">
            Habilidad
          </Label>
          <Input
            id="asistencia-habilidad"
            list="asistencia-habilidades"
            value={skill}
            onChange={(event) => {
              setSkill(event.target.value);
              if (error) setError(null);
            }}
            placeholder="Contagio, Guerrero esqueleto…"
            autoComplete="off"
            className="mt-1"
            data-testid="asistencia-habilidad"
          />
          <datalist id="asistencia-habilidades">
            {skills.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Grado de tu gema sin tallar">
          <span className="text-sm text-muted-foreground">Grado de tu gema:</span>
          {GRADES.map((grade) => (
            <Button
              key={grade.value}
              type="button"
              size="sm"
              variant={maxGrade === grade.value ? "default" : "outline"}
              aria-pressed={maxGrade === grade.value}
              onClick={() => setMaxGrade(grade.value)}
              data-testid={`asistencia-grado-${grade.value}`}
            >
              {grade.label}
            </Button>
          ))}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Atributos en los que te queda hueco">
            <span className="text-sm text-muted-foreground">Te queda hueco en:</span>
            {ATTRIBUTES.map((attribute) => {
              const active = attributes.includes(attribute.id);
              return (
                <Button
                  key={attribute.id}
                  type="button"
                  size="sm"
                  variant={active ? "secondary" : "outline"}
                  aria-pressed={active}
                  onClick={() => toggleAttribute(attribute.id)}
                  className={cn(active ? attribute.className : "opacity-60")}
                  data-testid={`asistencia-atributo-${attribute.id}`}
                >
                  {active ? "✓ " : ""}
                  {attribute.label}
                </Button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo ves en el juego, arriba del panel de habilidades: «Capacidad de las gemas equipadas». Si pone Int 5/5, ya no
            te cabe ninguna de inteligencia.
          </p>
        </div>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            Afinar más (opcional)
          </summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="asistencia-puestas" className="text-xs text-muted-foreground">
                Asistencias que ya lleva, separadas por comas
              </Label>
              <Input
                id="asistencia-puestas"
                value={socketed}
                onChange={(event) => setSocketed(event.target.value)}
                placeholder="Lanzamiento rápido I"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="asistencia-nota" className="text-xs text-muted-foreground">
                ¿Te pasa algo con ella?
              </Label>
              <Input
                id="asistencia-nota"
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Mis esqueletos mueren muy rápido"
                className="mt-1"
                data-testid="asistencia-nota"
              />
            </div>
          </div>
        </details>

        {error && (
          <p className="text-sm text-rose-300" role="alert" data-testid="asistencia-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} data-testid="asistencia-preguntar">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          Dime cuál
        </Button>
      </form>

      {answer && (
        <div className="mt-4 border-t border-border pt-4" data-testid="asistencia-resultado" aria-live="polite">
          {pick ? (
            <>
              <p className="text-base font-semibold text-foreground" data-testid="asistencia-elegida">
                En {answer.skill.name}, pon <span className="text-primary">{pick.name}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{pick.reason}</p>
              <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
                {pick.effects.map((effect) => (
                  <li key={effect}>· {effect}</li>
                ))}
                {pick.costMultiplier && <li>· La habilidad pasa a costar el {pick.costMultiplier} de su maná.</li>}
                <li>
                  · Grado {GRADES.find((grade) => grade.value === pick.grade)?.label ?? pick.grade}, de{" "}
                  {ATTRIBUTE_LABEL[pick.attribute]}.
                </li>
              </ul>
              {answer.alternatives.length > 0 && (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                    Otras {answer.alternatives.length} que también valen
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-sm" data-testid="asistencia-otras">
                    {answer.alternatives.map((option) => (
                      <li key={option.name}>
                        <span className="font-semibold text-foreground">{option.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">({ATTRIBUTE_LABEL[option.attribute]})</span>
                        <span className="block text-muted-foreground">{option.effects[0] ?? option.description}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground/90" data-testid="asistencia-ninguna">
              Con ese grado y esos atributos no hay ninguna asistencia que valga para {answer.skill.name}. Prueba a marcar
              otro atributo o guarda la gema para más adelante.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {pick && (answer.mode === "ai" ? "Elegida por la IA entre las que valen. " : "Elegida por reglas, sin IA. ")}
            Datos de{" "}
            <a href={answer.source} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              poe2db.tw
            </a>{" "}
            del {answer.fetchedAt}. Si el juego no te deja ponerla, manda el juego.
          </p>
        </div>
      )}
    </section>
  );
}
