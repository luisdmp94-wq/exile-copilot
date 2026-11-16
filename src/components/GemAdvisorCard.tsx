import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Gem, Loader2, Minus, Plus, Sparkles, UserCheck, X } from "lucide-react";
import type { BuildMemoryEntry, CharacterProfile } from "@shared/domain.js";
import type { BuildContext, GemAttribute, SupportAdviceOption, SupportAdviceResponse } from "@shared/supportGemAdvice.js";
import type { SupportPlanResponse } from "@shared/supportGemPlan.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "exile-copilot:asistencia";
const MAX_SKILLS = 8;
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

type Mode = "one" | "many";

interface Remembered {
  mode: Mode;
  maxGrade: number;
  attributes: GemAttribute[];
  mySkills: string[];
  gems: number;
  free: Record<GemAttribute, number>;
  socketed: string;
}

const DEFAULTS: Remembered = {
  mode: "one",
  maxGrade: 1,
  attributes: ["Int", "Des", "Fue"],
  mySkills: [],
  gems: 1,
  free: { Int: 1, Des: 1, Fue: 1 },
  socketed: "",
};

function readRemembered(): Remembered {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Remembered> | null;
    if (!parsed) return DEFAULTS;
    const isAttribute = (item: unknown): item is GemAttribute => ATTRIBUTES.some((a) => a.id === item);
    const attributes = (parsed.attributes ?? []).filter(isAttribute);
    const slot = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 9 ? value : fallback;
    return {
      mode: parsed.mode === "many" ? "many" : "one",
      maxGrade: GRADES.some((grade) => grade.value === parsed.maxGrade) ? (parsed.maxGrade as number) : 1,
      attributes: attributes.length > 0 ? attributes : DEFAULTS.attributes,
      mySkills: Array.isArray(parsed.mySkills)
        ? parsed.mySkills.filter((name): name is string => typeof name === "string").slice(0, MAX_SKILLS)
        : [],
      gems: typeof parsed.gems === "number" && parsed.gems >= 1 && parsed.gems <= 5 ? Math.trunc(parsed.gems) : 1,
      free: { Int: slot(parsed.free?.Int, 1), Des: slot(parsed.free?.Des, 1), Fue: slot(parsed.free?.Fue, 1) },
      socketed: typeof parsed.socketed === "string" ? parsed.socketed.slice(0, 400) : "",
    };
  } catch {
    return DEFAULTS;
  }
}

function splitNames(value: string, max: number): string[] {
  return value
    .split(/[,;\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, max);
}

function gradeLabel(grade: number): string {
  return GRADES.find((item) => item.value === grade)?.label ?? String(grade);
}

function OptionDetails({ option }: { option: SupportAdviceOption }) {
  return (
    <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
      {option.effects.map((effect) => (
        <li key={effect}>· {effect}</li>
      ))}
      {option.costMultiplier && <li>· La habilidad pasa a costar el {option.costMultiplier} de su maná.</li>}
      <li>
        · Grado {gradeLabel(option.grade)}, de {ATTRIBUTE_LABEL[option.attribute]}.
      </li>
    </ul>
  );
}

interface FooterProps {
  mode: "ai" | "rules";
  /** Qué hizo la IA cuando intervino: elegir entre candidatas o solo explicar. */
  aiRole: string;
  fallbackReason: string | null;
  source: string;
  fetchedAt: string;
  hasPick: boolean;
}

function Footer({ mode, aiRole, fallbackReason, source, fetchedAt, hasPick }: FooterProps) {
  return (
    <p className="mt-3 text-xs text-muted-foreground">
      {hasPick && (mode === "ai" ? `${aiRole} ` : fallbackReason ? `${fallbackReason} ` : "Decidido por reglas, sin IA. ")}
      Datos de{" "}
      <a href={source} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        poe2db.tw
      </a>{" "}
      del {fetchedAt}. Si el juego no te deja ponerla, manda el juego.
    </p>
  );
}

const UNKNOWN_CLASS = /^desconocid/i;

/** Lo que el Expediente ya sabe de la build, en la forma que entiende el consejo de gemas. */
function buildFromCharacter(profile: CharacterProfile, memory: readonly BuildMemoryEntry[]): BuildContext {
  const active = memory.filter((entry) => entry.active);
  const labels = (kind: BuildMemoryEntry["kind"]) =>
    active
      .filter((entry) => entry.kind === kind)
      .map((entry) => `${entry.label}: ${entry.reason}`.slice(0, 200))
      .slice(0, 20);
  const core = labels("core");
  const discarded = active
    .filter((entry) => entry.kind === "discarded")
    .map((entry) => entry.label.slice(0, 200))
    .slice(0, 20);
  const characterClass = profile.characterClass.trim();
  return {
    ...(characterClass && !UNKNOWN_CLASS.test(characterClass) ? { characterClass: characterClass.slice(0, 60) } : {}),
    ...(profile.ascendancy?.trim() ? { ascendancy: profile.ascendancy.trim().slice(0, 60) } : {}),
    ...(profile.archetype?.trim() ? { archetype: profile.archetype.trim().slice(0, 200) } : {}),
    ...(core.length > 0 ? { core } : {}),
    ...(discarded.length > 0 ? { discarded } : {}),
  };
}

interface GemAdvisorCardProps {
  /** Personaje cargado en el Expediente, si lo hay. */
  profile: CharacterProfile | null;
  /** «Identidad de la build» de ese personaje. */
  buildMemory: readonly BuildMemoryEntry[];
  /** Abre el alta corta de personaje cuando todavía no hay ninguno. */
  onCreateCharacter?: () => void;
  /** Apunta en el personaje cargado que esa habilidad ya lleva esa asistencia. */
  onOwnSupport?: (skillName: string, supportName: string) => void;
}

/**
 * «¿Qué gema de asistencia le pongo?»: para una habilidad, o repartiendo
 * varias gemas entre las habilidades del personaje. Las reglas filtran con los
 * datos del juego y, si hay IA, elige y lo explica. Con un personaje cargado
 * usa su build: arquetipo, lo marcado como core o descartado y sus habilidades.
 */
export function GemAdvisorCard({ profile, buildMemory, onCreateCharacter, onOwnSupport }: GemAdvisorCardProps) {
  const [remembered] = useState(readRemembered);
  const [useCharacter, setUseCharacter] = useState(true);
  const [mode, setMode] = useState<Mode>(remembered.mode);
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [maxGrade, setMaxGrade] = useState(remembered.maxGrade);
  const [socketed, setSocketed] = useState(remembered.socketed);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Una habilidad
  const [skill, setSkill] = useState("");
  const [attributes, setAttributes] = useState<GemAttribute[]>(remembered.attributes);
  const [answer, setAnswer] = useState<SupportAdviceResponse | null>(null);

  // Varias gemas
  const [mySkills, setMySkills] = useState<string[]>(remembered.mySkills);
  const [draftSkill, setDraftSkill] = useState("");
  const [gems, setGems] = useState(remembered.gems);
  const [free, setFree] = useState(remembered.free);
  const [plan, setPlan] = useState<SupportPlanResponse | null>(null);

  const character = profile && useCharacter ? profile : null;
  const build = useMemo(
    () => (character ? buildFromCharacter(character, buildMemory) : undefined),
    [character, buildMemory],
  );
  const hasBuildIdentity = Boolean(build?.archetype || build?.core?.length);
  const characterSkills = useMemo(
    () =>
      (character?.skills ?? [])
        .filter((setup) => setup.mainSkill.trim() !== "")
        .slice(0, MAX_SKILLS)
        .map((setup) => ({ name: setup.mainSkill.trim(), supports: setup.supports.map((support) => support.name.trim()).filter(Boolean) })),
    [character],
  );
  /**
   * Asistencias que el personaje ya lleva en cualquier habilidad, según el
   * Expediente. En PoE2 cada asistencia se pone una sola vez: si ya está en
   * Drenar esencia, no vale recomendarla para Ritual profano.
   */
  const ownedSupports = characterSkills.flatMap((item) => item.supports);

  const loadCharacterSkills = () => {
    setMySkills(characterSkills.map((item) => item.name));
    setSocketed([...new Set(characterSkills.flatMap((item) => item.supports))].join(", "));
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;
    api
      .gemSkills()
      .then((response) => {
        if (!cancelled) setSkillNames(response.skills.map((item) => item.name).sort((a, b) => a.localeCompare(b, "es")));
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
      const value: Remembered = { mode, maxGrade, attributes, mySkills, gems, free, socketed };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // Sin almacenamiento la elección vale para esta visita.
    }
  }, [mode, maxGrade, attributes, mySkills, gems, free, socketed]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const toggleAttribute = (id: GemAttribute) =>
    setAttributes((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const addSkill = () => {
    const name = draftSkill.trim();
    if (!name) return;
    setError(null);
    if (mySkills.some((item) => item.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) {
      setDraftSkill("");
      return;
    }
    if (mySkills.length >= MAX_SKILLS) {
      setError(`Como mucho ${MAX_SKILLS} habilidades a la vez.`);
      return;
    }
    setMySkills([...mySkills, name]);
    setDraftSkill("");
  };

  /**
   * «Ya la tengo»: la gema se apunta como puesta (en esta tarjeta y, si hay
   * personaje, en su Expediente) y se pide la siguiente mejor.
   */
  const alreadyOwned = (skillName: string, supportName: string) => {
    const names = splitNames(socketed, 16);
    const next = names.some((name) => name.toLocaleLowerCase("es") === supportName.toLocaleLowerCase("es"))
      ? names
      : [...names, supportName];
    setSocketed(next.join(", "));
    if (character) onOwnSupport?.(skillName, supportName);
    return next;
  };

  const askOne = async (owned?: string[]) => {
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
      const names = [...new Set([...(owned ?? splitNames(socketed, 16)), ...ownedSupports])].slice(0, 30);
      setAnswer(
        await api.supportGemAdvice({
          skill: skill.trim(),
          maxGrade,
          attributes,
          ...(names.length > 0 ? { socketed: names } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(build ? { build } : {}),
        }),
      );
    } catch (err) {
      setAnswer(null);
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const askMany = async (owned?: string[]) => {
    const pending = draftSkill.trim();
    const skills = pending && mySkills.length < MAX_SKILLS ? [...mySkills, pending] : mySkills;
    if (skills.length === 0) {
      setError("Añade primero tus habilidades, tal como salen en el juego.");
      return;
    }
    if (free.Int + free.Des + free.Fue === 0) {
      setError("Si no te queda ningún hueco libre, no cabe ninguna gema más.");
      return;
    }
    if (pending) {
      setMySkills(skills);
      setDraftSkill("");
    }
    setBusy(true);
    setError(null);
    try {
      const names = [...new Set([...(owned ?? splitNames(socketed, 16)), ...ownedSupports])].slice(0, 16);
      setPlan(
        await api.supportGemPlan({
          skills,
          gems,
          maxGrade,
          capacity: free,
          ...(names.length > 0 ? { socketed: names } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(build ? { build } : {}),
        }),
      );
    } catch (err) {
      setPlan(null);
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
        ¿Qué gema de asistencia pongo?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Dime tus habilidades y qué te deja tallar tu gema. Te digo cuál poner, dónde y por qué.
      </p>

      {!profile && onCreateCharacter && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/50 px-3 py-2 text-sm"
          data-testid="asistencia-sin-personaje"
        >
          <span className="text-muted-foreground">
            Ahora te aconsejo sin saber qué build llevas. Dímelo y afino mucho más.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={onCreateCharacter} data-testid="asistencia-crear-personaje">
            <UserCheck className="size-4" aria-hidden="true" />
            Guardar mi personaje
          </Button>
        </div>
      )}

      {profile && (
        <div className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-sm" data-testid="asistencia-personaje">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={useCharacter}
              onChange={(event) => setUseCharacter(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-primary"
              data-testid="asistencia-usar-personaje"
            />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
                <UserCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Usar mi personaje: {profile.name}
              </span>
              {useCharacter && (
                <span className="block text-xs text-muted-foreground" data-testid="asistencia-build">
                  {hasBuildIdentity
                    ? [
                        build?.archetype ? `Build: ${build.archetype}.` : null,
                        build?.core?.length ? `${build.core.length} cosa(s) marcadas como core.` : null,
                        build?.discarded?.length ? `${build.discarded.length} descartada(s) que no te propondré.` : null,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    : "Aún no sé qué build es. Escribe el arquetipo en el Expediente (por ejemplo «brujo de caos con esbirros») o marca lo esencial en «Identidad de la build», y afinaré mucho más."}
                </span>
              )}
            </span>
          </label>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Qué quieres saber">
        <Button
          type="button"
          size="sm"
          variant={mode === "one" ? "secondary" : "outline"}
          aria-pressed={mode === "one"}
          onClick={() => switchMode("one")}
          data-testid="asistencia-modo-una"
        >
          Para una habilidad
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "many" ? "secondary" : "outline"}
          aria-pressed={mode === "many"}
          onClick={() => switchMode("many")}
          data-testid="asistencia-modo-varias"
        >
          Tengo varias gemas
        </Button>
      </div>

      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void (mode === "one" ? askOne() : askMany());
        }}
      >
        <datalist id="asistencia-habilidades">
          {skillNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {mode === "one" ? (
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
          </div>
        ) : (
          <div>
            <Label htmlFor="asistencia-mis-habilidades" className="text-sm text-muted-foreground">
              Tus habilidades (se quedan guardadas para la próxima vez)
            </Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="asistencia-mis-habilidades"
                list="asistencia-habilidades"
                value={draftSkill}
                onChange={(event) => {
                  setDraftSkill(event.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addSkill();
                  }
                }}
                placeholder="Escribe una y pulsa Intro"
                autoComplete="off"
                data-testid="asistencia-nueva-habilidad"
              />
              <Button type="button" variant="outline" onClick={addSkill} data-testid="asistencia-anadir-habilidad">
                Añadir
              </Button>
            </div>
            {characterSkills.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={loadCharacterSkills}
                data-testid="asistencia-cargar-personaje"
              >
                <UserCheck className="size-4" aria-hidden="true" />
                Usar las {characterSkills.length} habilidades de {character?.name}
              </Button>
            )}
            {mySkills.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tus habilidades" data-testid="asistencia-lista-habilidades">
                {mySkills.map((name) => (
                  <li key={name} className="flex items-center gap-1 rounded-full bg-secondary/70 py-0.5 pl-2.5 pr-1 text-sm">
                    {name}
                    <button
                      type="button"
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar ${name}`}
                      onClick={() => setMySkills(mySkills.filter((item) => item !== name))}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === "many" && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cuántas gemas tienes">
            <span className="text-sm text-muted-foreground">Gemas que tienes:</span>
            {[1, 2, 3, 4, 5].map((count) => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={gems === count ? "default" : "outline"}
                aria-pressed={gems === count}
                onClick={() => setGems(count)}
                data-testid={`asistencia-gemas-${count}`}
              >
                {count}
              </Button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Grado de tu gema sin tallar">
          <span className="text-sm text-muted-foreground">{mode === "one" ? "Grado de tu gema:" : "Grado de tus gemas:"}</span>
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
          {mode === "one" ? (
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
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Huecos libres por atributo">
              <span className="text-sm text-muted-foreground">Huecos libres:</span>
              {ATTRIBUTES.map((attribute) => (
                <span key={attribute.id} className="flex items-center gap-1 text-sm">
                  <span className={attribute.className}>{attribute.label}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label={`Un hueco menos de ${ATTRIBUTE_LABEL[attribute.id]}`}
                    onClick={() => setFree({ ...free, [attribute.id]: Math.max(0, free[attribute.id] - 1) })}
                  >
                    <Minus className="size-3.5" aria-hidden="true" />
                  </Button>
                  <span className="w-4 text-center tabular-nums" data-testid={`asistencia-libres-${attribute.id}`}>
                    {free[attribute.id]}
                  </span>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="size-7"
                    aria-label={`Un hueco más de ${ATTRIBUTE_LABEL[attribute.id]}`}
                    onClick={() => setFree({ ...free, [attribute.id]: Math.min(9, free[attribute.id] + 1) })}
                    data-testid={`asistencia-libres-mas-${attribute.id}`}
                  >
                    <Plus className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Lo ves en el juego, arriba del panel de habilidades: «Capacidad de las gemas equipadas».{" "}
            {mode === "one" ? "Si pone Int 5/5, ya no te cabe ninguna de inteligencia." : "Si pone Int 4/5, te queda 1 hueco de inteligencia."}
          </p>
        </div>

        {mode === "many" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="asistencia-puestas" className="text-xs text-muted-foreground">
                Asistencias que ya llevas puestas, separadas por comas
              </Label>
              <Input
                id="asistencia-puestas"
                value={socketed}
                onChange={(event) => setSocketed(event.target.value)}
                placeholder="Lanzamiento rápido I, Último aliento"
                className="mt-1"
                data-testid="asistencia-puestas"
              />
            </div>
            <div>
              <Label htmlFor="asistencia-nota" className="text-xs text-muted-foreground">
                ¿Algo que deba saber? (opcional)
              </Label>
              <Input
                id="asistencia-nota"
                value={note}
                maxLength={200}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Drenar esencia es mi daño contra jefes"
                className="mt-1"
                data-testid="asistencia-nota"
              />
            </div>
          </div>
        ) : (
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
        )}

        {error && (
          <p className="text-sm text-rose-300" role="alert" data-testid="asistencia-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} data-testid="asistencia-preguntar">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
          {mode === "one" ? "Dime cuál" : "Repárteme las gemas"}
        </Button>
      </form>

      {mode === "one" && answer && (
        <div className="mt-4 border-t border-border pt-4" data-testid="asistencia-resultado" aria-live="polite">
          {pick ? (
            <>
              <p className="text-base font-semibold text-foreground" data-testid="asistencia-elegida">
                En {answer.skill.name}, pon <span className="text-primary">{pick.name}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-foreground/90">{pick.reason}</p>
              <OptionDetails option={pick} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => void askOne(alreadyOwned(answer.skill.name, pick.name))}
                data-testid="asistencia-ya-la-tengo"
              >
                Ya la tengo: dime otra
              </Button>
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
          <Footer
            mode={answer.mode}
            aiRole="La gema la eligen las reglas; la IA solo explica el porqué."
            fallbackReason={answer.fallbackReason}
            source={answer.source}
            fetchedAt={answer.fetchedAt}
            hasPick={pick !== null}
          />
        </div>
      )}

      {mode === "many" && plan && (
        <div className="mt-4 border-t border-border pt-4" data-testid="asistencia-reparto" aria-live="polite">
          {plan.assignments.length > 0 ? (
            <ol className="space-y-3">
              {plan.assignments.map((item, index) => (
                <li key={`${item.skill}-${item.support.name}`} data-testid="asistencia-reparto-linea">
                  <p className="text-base font-semibold text-foreground">
                    {index + 1}. <span className="text-primary">{item.support.name}</span> en {item.skill}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-foreground/90">{item.reason}</p>
                  <OptionDetails option={item.support} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    disabled={busy}
                    onClick={() => void askMany(alreadyOwned(item.skill, item.support.name))}
                    data-testid="asistencia-reparto-ya-la-tengo"
                  >
                    Ya la tengo: reparte otra vez
                  </Button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-foreground/90">
              Con ese grado y esos huecos no hay ninguna asistencia que valga para tus habilidades. Guarda las gemas para
              más adelante.
            </p>
          )}
          {plan.leftover > 0 && plan.assignments.length > 0 && (
            <p className="mt-3 text-sm text-amber-200" data-testid="asistencia-sobran">
              {plan.leftover === 1 ? "Te sobra 1 gema" : `Te sobran ${plan.leftover} gemas`}: no te quedan huecos donde
              quepan. Guárdalas; no caducan.
            </p>
          )}
          {plan.unknownSkills.length > 0 && (
            <p className="mt-2 text-sm text-amber-200" data-testid="asistencia-desconocidas">
              No conozco {plan.unknownSkills.map((name) => `«${name}»`).join(", ")}. Escríbelas como salen en el juego en
              español.
            </p>
          )}
          <Footer
            mode={plan.mode}
            aiRole="El reparto es de las reglas; la IA solo explica el porqué."
            fallbackReason={plan.fallbackReason}
            source={plan.source}
            fetchedAt={plan.fetchedAt}
            hasPick={plan.assignments.length > 0}
          />
        </div>
      )}
    </section>
  );
}
