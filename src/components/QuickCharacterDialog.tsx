import { useEffect, useState } from "react";
import { Loader2, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

/** Clases tal como las nombra el cliente en español. */
export const CHARACTER_CLASSES = [
  "Bruja",
  "Hechicera",
  "Guerrero",
  "Monje",
  "Mercenario",
  "Exploradora",
  "Cazadora",
  "Druida",
  "Templario",
  "Merodeador",
  "Duelista",
  "Sombra",
] as const;

const MAX_SKILLS = 8;
const GEM_CARD_STORAGE_KEY = "exile-copilot:asistencia";

export interface QuickCharacterInput {
  name: string;
  characterClass: string;
  /** null = el jugador no lo ha dicho todavía. */
  level: number | null;
  archetype: string;
  skills: string[];
}

/** Las habilidades que el jugador ya escribió en la tarjeta de gemas, si las hay. */
function rememberedSkills(): string[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(GEM_CARD_STORAGE_KEY) ?? "null",
    ) as { mySkills?: unknown } | null;
    return Array.isArray(parsed?.mySkills)
      ? parsed.mySkills
          .filter(
            (name): name is string =>
              typeof name === "string" && name.trim() !== "",
          )
          .slice(0, MAX_SKILLS)
      : [];
  } catch {
    return [];
  }
}

interface QuickCharacterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Con datos de partida, el diálogo completa un personaje que ya existe (por
   * ejemplo, uno creado al pegar un objeto) en vez de crear otro.
   */
  initial?: QuickCharacterInput | null;
  saving: boolean;
  /** Devuelve true cuando el personaje ha quedado guardado. */
  onCreate: (input: QuickCharacterInput) => Promise<boolean>;
  /** Abre el formulario completo del Expediente, para quien lo prefiera. */
  onOpenFullEditor: () => void;
}

/**
 * Alta corta de personaje: clase, una frase con la build y las habilidades.
 * Guarda un personaje normal del Expediente; el resto de campos se quedan en
 * blanco y se pueden completar después en el formulario de siempre.
 */
export function QuickCharacterDialog({
  open,
  onOpenChange,
  initial = null,
  saving,
  onCreate,
  onOpenFullEditor,
}: QuickCharacterDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-testid="alta-rapida"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-5 text-primary" aria-hidden="true" />
            {initial ? "Completa tu personaje" : "Tu personaje, en tres datos"}
          </DialogTitle>
          <DialogDescription>
            {initial
              ? "Solo falta esto. El equipo y lo demás que ya tenías se quedan como están."
              : "Con esto ya sé qué build llevas y te aconsejo pensando en ella. Lo demás lo completas cuando quieras."}
          </DialogDescription>
        </DialogHeader>
        {/* El formulario se monta al abrir: así empieza limpio cada vez. */}
        <QuickCharacterForm
          initial={initial}
          saving={saving}
          onCreate={onCreate}
          onOpenFullEditor={onOpenFullEditor}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface QuickCharacterFormProps {
  initial: QuickCharacterInput | null;
  saving: boolean;
  onCreate: (input: QuickCharacterInput) => Promise<boolean>;
  onOpenFullEditor: () => void;
  onDone: () => void;
}

function QuickCharacterForm({
  initial,
  saving,
  onCreate,
  onOpenFullEditor,
  onDone,
}: QuickCharacterFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [characterClass, setCharacterClass] = useState(
    (CHARACTER_CLASSES as readonly string[]).includes(initial?.characterClass ?? "")
      ? (initial?.characterClass ?? "")
      : "",
  );
  const [level, setLevel] = useState(initial?.level ? String(initial.level) : "");
  const [archetype, setArchetype] = useState(initial?.archetype ?? "");
  // Empieza con las habilidades del personaje o, si no tiene, con las que el
  // jugador ya escribió en la tarjeta de gemas.
  const [skills, setSkills] = useState<string[]>(() =>
    initial && initial.skills.length > 0 ? initial.skills.slice(0, MAX_SKILLS) : rememberedSkills(),
  );
  const [draftSkill, setDraftSkill] = useState("");
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .gemSkills()
      .then((response) => {
        if (!cancelled)
          setSkillNames(
            response.skills
              .map((item) => item.name)
              .sort((a, b) => a.localeCompare(b, "es")),
          );
      })
      .catch(() => {
        // Sin la lista se puede seguir escribiendo el nombre a mano.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const addSkill = () => {
    const next = draftSkill.trim();
    if (!next) return;
    if (
      !skills.some(
        (item) => item.toLocaleLowerCase("es") === next.toLocaleLowerCase("es"),
      ) &&
      skills.length < MAX_SKILLS
    ) {
      setSkills([...skills, next]);
    }
    setDraftSkill("");
  };

  const submit = async () => {
    if (!characterClass) {
      setError("Elige la clase de tu personaje.");
      return;
    }
    const parsedLevel = level.trim() === "" ? null : Number(level);
    if (
      parsedLevel !== null &&
      (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 100)
    ) {
      setError("El nivel va de 1 a 100. Si no lo sabes, déjalo en blanco.");
      return;
    }
    const pending = draftSkill.trim();
    const allSkills =
      pending && !skills.includes(pending) && skills.length < MAX_SKILLS
        ? [...skills, pending]
        : skills;
    setError(null);
    const saved = await onCreate({
      name: name.trim() || `Mi ${characterClass.toLocaleLowerCase("es")}`,
      characterClass,
      level: parsedLevel,
      archetype: archetype.trim(),
      skills: allSkills,
    });
    if (saved) onDone();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <fieldset>
        <legend className="text-sm font-medium text-foreground">
          1. Clase
        </legend>
        <div
          className="mt-2 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Clase del personaje"
        >
          {CHARACTER_CLASSES.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={characterClass === option ? "default" : "outline"}
              aria-pressed={characterClass === option}
              onClick={() => {
                setCharacterClass(option);
                setError(null);
              }}
              data-testid={`alta-clase-${option}`}
            >
              {option}
            </Button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label
          htmlFor="alta-build"
          className="text-sm font-medium text-foreground"
        >
          2. Tu build en una frase
        </Label>
        <Input
          id="alta-build"
          value={archetype}
          maxLength={200}
          onChange={(event) => setArchetype(event.target.value)}
          placeholder="Brujo de caos con esbirros"
          className="mt-2"
          data-testid="alta-build"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Di con qué haces daño (caos, fuego, hielo, rayo o físico) y si llevas
          esbirros. Es lo que más me ayuda.
        </p>
      </div>

      <div>
        <Label
          htmlFor="alta-habilidad"
          className="text-sm font-medium text-foreground"
        >
          3. Tus habilidades
        </Label>
        <div className="mt-2 flex gap-2">
          <Input
            id="alta-habilidad"
            list="alta-habilidades"
            value={draftSkill}
            onChange={(event) => setDraftSkill(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addSkill();
              }
            }}
            placeholder="Escribe una y pulsa Intro"
            autoComplete="off"
            data-testid="alta-habilidad"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addSkill}
            data-testid="alta-anadir-habilidad"
          >
            Añadir
          </Button>
        </div>
        <datalist id="alta-habilidades">
          {skillNames.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
        {skills.length > 0 && (
          <ul
            className="mt-2 flex flex-wrap gap-1.5"
            aria-label="Habilidades del personaje"
            data-testid="alta-lista-habilidades"
          >
            {skills.map((item) => (
              <li
                key={item}
                className="flex items-center gap-1 rounded-full bg-secondary/70 py-0.5 pl-2.5 pr-1 text-sm"
              >
                {item}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Quitar ${item}`}
                  onClick={() =>
                    setSkills(skills.filter((skill) => skill !== item))
                  }
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label
            htmlFor="alta-nombre"
            className="text-xs text-muted-foreground"
          >
            Nombre (opcional)
          </Label>
          <Input
            id="alta-nombre"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              characterClass
                ? `Mi ${characterClass.toLocaleLowerCase("es")}`
                : "Mi personaje"
            }
            className="mt-1"
            data-testid="alta-nombre"
          />
        </div>
        <div>
          <Label htmlFor="alta-nivel" className="text-xs text-muted-foreground">
            Nivel (opcional)
          </Label>
          <Input
            id="alta-nivel"
            value={level}
            inputMode="numeric"
            maxLength={3}
            onChange={(event) =>
              setLevel(event.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="9"
            className="mt-1"
            data-testid="alta-nivel"
          />
        </div>
      </div>

      {error && (
        <p
          className="text-sm text-rose-300"
          role="alert"
          data-testid="alta-error"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={onOpenFullEditor}
          data-testid="alta-rapida-completo"
        >
          Prefiero el formulario completo
        </button>
        <Button type="submit" disabled={saving} data-testid="alta-guardar">
          {saving && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {initial ? "Guardar" : "Guardar personaje"}
        </Button>
      </div>
    </form>
  );
}
