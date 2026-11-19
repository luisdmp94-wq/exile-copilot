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
import { canonicalSkillName, isKnownSkillName, sameSkillName } from "@/lib/skillNames";
import { texts, useLang, useText } from "@/i18n/lang";

/**
 * Clases que se pueden jugar hoy, tal como las nombra el cliente en español.
 *
 * Templario, Merodeador, Duelista y Sombra existen en el árbol oficial de
 * 0.5.5, pero sin ninguna ascendencia: están reservadas y aún no se pueden
 * elegir (comprobado el 18-11-2026 en grindinggear/poe2-skilltree-export y en
 * poe2db). Se añaden aquí cuando el juego las abra.
 */
export const CHARACTER_CLASSES = [
  "Bruja",
  "Hechicera",
  "Guerrero",
  "Monje",
  "Mercenario",
  "Exploradora",
  "Cazadora",
  "Druida",
] as const;

/** Las mismas clases con su nombre en el cliente en inglés. */
const CLASS_EN: Record<(typeof CHARACTER_CLASSES)[number], string> = {
  Bruja: "Witch",
  Hechicera: "Sorceress",
  Guerrero: "Warrior",
  Monje: "Monk",
  Mercenario: "Mercenary",
  Exploradora: "Ranger",
  Cazadora: "Huntress",
  Druida: "Druid",
};

/** La clase guardada (en cualquiera de los dos idiomas) → su nombre en español, que es el que usa el formulario. */
function classId(stored: string): string {
  if ((CHARACTER_CLASSES as readonly string[]).includes(stored)) return stored;
  return CHARACTER_CLASSES.find((option) => CLASS_EN[option].toLowerCase() === stored.trim().toLowerCase()) ?? "";
}

const TEXT = texts(
  {
    completeTitle: "Completa tu personaje",
    newTitle: "Tu personaje, en tres datos",
    completeLead: "Solo falta esto. El equipo y lo demás que ya tenías se quedan como están.",
    newLead: "Con esto te hago una revisión rápida de lo que más te frena. El equipo lo añades cuando quieras.",
    pickClass: "Elige la clase de tu personaje.",
    badLevel: "El nivel va de 1 a 100. Si no lo sabes, déjalo en blanco.",
    defaultName: (className: string) => `Mi ${className.toLocaleLowerCase("es")}`,
    myCharacter: "Mi personaje",
    classLegend: "1. Clase",
    classGroup: "Clase del personaje",
    buildLabel: "2. Tu build en una frase",
    buildPlaceholder: "Brujo de caos con esbirros",
    buildHelp: "Di con qué haces daño (caos, fuego, hielo, rayo o físico) y si llevas esbirros. Es lo que más me ayuda.",
    skillsLabel: "3. Tus habilidades",
    typeAndEnter: "Escribe una y pulsa Intro",
    add: "Añadir",
    skillsList: "Habilidades del personaje",
    unknownSkill: (names: string) =>
      `No reconozco ${names}. Mira que esté escrita como en el juego. Puedes guardarla igual.`,
    remove: (name: string) => `Quitar ${name}`,
    name: "Nombre (opcional)",
    level: "Nivel (opcional)",
    fullForm: "Prefiero el formulario completo",
    save: "Guardar",
    saveCharacter: "Guardar personaje",
  },
  {
    completeTitle: "Complete your character",
    newTitle: "Your character, in three answers",
    completeLead: "Just this is missing. Your gear and everything else you had stay as they are.",
    newLead: "With this I'll do a quick review of what's holding you back most. You can add your gear whenever you like.",
    pickClass: "Pick your character's class.",
    badLevel: "Level goes from 1 to 100. If you don't know it, leave it blank.",
    defaultName: (className: string) => `My ${className}`,
    myCharacter: "My character",
    classLegend: "1. Class",
    classGroup: "Character class",
    buildLabel: "2. Your build in one sentence",
    buildPlaceholder: "Chaos warlock with minions",
    buildHelp: "Say what you deal damage with (chaos, fire, cold, lightning or physical) and whether you use minions. That helps me most.",
    skillsLabel: "3. Your skills",
    typeAndEnter: "Type one and press Enter",
    add: "Add",
    skillsList: "Character skills",
    unknownSkill: (names: string) =>
      `I don't recognise ${names}. Check it's written as in the game. You can still save it.`,
    remove: (name: string) => `Remove ${name}`,
    name: "Name (optional)",
    level: "Level (optional)",
    fullForm: "I'd rather use the full form",
    save: "Save",
    saveCharacter: "Save character",
  },
);

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
  const t = useText(TEXT);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        data-testid="alta-rapida"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserRoundPlus className="size-5 text-primary" aria-hidden="true" />
            {initial ? t.completeTitle : t.newTitle}
          </DialogTitle>
          <DialogDescription>
            {initial ? t.completeLead : t.newLead}
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
  const t = useText(TEXT);
  const { lang } = useLang();
  const [name, setName] = useState(initial?.name ?? "");
  // Se elige por el nombre en español; se guarda el del idioma de la web.
  const [characterClass, setCharacterClass] = useState(() => classId(initial?.characterClass ?? ""));
  const shownClass = (option: string) =>
    lang === "en" ? (CLASS_EN[option as (typeof CHARACTER_CLASSES)[number]] ?? option) : option;
  const [level, setLevel] = useState(initial?.level ? String(initial.level) : "");
  const [archetype, setArchetype] = useState(initial?.archetype ?? "");
  // Empieza con las habilidades del personaje o, si no tiene, con las que el
  // jugador ya escribió en la tarjeta de gemas.
  const [skills, setSkills] = useState<string[]>(() =>
    initial && initial.skills.length > 0 ? initial.skills.slice(0, MAX_SKILLS) : rememberedSkills(),
  );
  const [draftSkill, setDraftSkill] = useState("");
  const [skillNames, setSkillNames] = useState<string[]>([]);
  // Los nombres en el otro idioma: quien juega con el cliente en español puede
  // usar la web en inglés (y al revés), y su habilidad tiene que reconocerse.
  const [otherLangNames, setOtherLangNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .gemSkills(lang)
      .then((response) => {
        if (!cancelled)
          setSkillNames(
            response.skills
              .map((item) => item.name)
              .sort((a, b) => a.localeCompare(b, lang)),
          );
      })
      .catch(() => {
        // Sin la lista se puede seguir escribiendo el nombre a mano.
      });
    api
      .gemSkills(lang === "en" ? "es" : "en")
      .then((response) => {
        if (!cancelled) setOtherLangNames(response.skills.map((item) => item.name));
      })
      .catch(() => {
        // Sin esta lista solo se reconocen los nombres del idioma de la web.
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  /** «killing palm» → «Killing Palm»: como lo escribe el juego, si la web la conoce. */
  const asInGame = (typed: string) => canonicalSkillName(typed, skillNames, otherLangNames);

  const addSkill = () => {
    const next = asInGame(draftSkill);
    if (!next) return;
    if (!skills.some((item) => sameSkillName(item, next)) && skills.length < MAX_SKILLS) {
      setSkills([...skills, next]);
    }
    setDraftSkill("");
  };

  /** Habilidades que la web no conoce: se avisa sin impedir guardarlas. */
  const unknownSkills =
    skillNames.length === 0 ? [] : skills.filter((item) => !isKnownSkillName(item, skillNames, otherLangNames));

  const submit = async () => {
    if (!characterClass) {
      setError(t.pickClass);
      return;
    }
    const parsedLevel = level.trim() === "" ? null : Number(level);
    if (
      parsedLevel !== null &&
      (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 100)
    ) {
      setError(t.badLevel);
      return;
    }
    const pending = asInGame(draftSkill);
    // Las que venían de antes (o se añadieron sin la lista cargada) también se
    // guardan como las escribe el juego.
    const listed = skills.map(asInGame);
    const allSkills =
      pending && !listed.some((item) => sameSkillName(item, pending)) && listed.length < MAX_SKILLS
        ? [...listed, pending]
        : listed;
    setError(null);
    const saved = await onCreate({
      name: name.trim() || t.defaultName(shownClass(characterClass)),
      characterClass: shownClass(characterClass),
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
          {t.classLegend}
        </legend>
        <div
          className="mt-2 flex flex-wrap gap-1.5"
          role="group"
          aria-label={t.classGroup}
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
              {shownClass(option)}
            </Button>
          ))}
        </div>
      </fieldset>

      <div>
        <Label
          htmlFor="alta-build"
          className="text-sm font-medium text-foreground"
        >
          {t.buildLabel}
        </Label>
        <Input
          id="alta-build"
          value={archetype}
          maxLength={200}
          onChange={(event) => setArchetype(event.target.value)}
          placeholder={t.buildPlaceholder}
          className="mt-2"
          data-testid="alta-build"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {t.buildHelp}
        </p>
      </div>

      <div>
        <Label
          htmlFor="alta-habilidad"
          className="text-sm font-medium text-foreground"
        >
          {t.skillsLabel}
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
            placeholder={t.typeAndEnter}
            autoComplete="off"
            data-testid="alta-habilidad"
          />
          <Button
            type="button"
            variant="outline"
            onClick={addSkill}
            data-testid="alta-anadir-habilidad"
          >
            {t.add}
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
            aria-label={t.skillsList}
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
                  aria-label={t.remove(item)}
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
        {unknownSkills.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-amber-200/90" data-testid="alta-habilidad-desconocida">
            {t.unknownSkill(unknownSkills.map((item) => `«${item}»`).join(", "))}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label
            htmlFor="alta-nombre"
            className="text-xs text-muted-foreground"
          >
            {t.name}
          </Label>
          <Input
            id="alta-nombre"
            value={name}
            maxLength={60}
            onChange={(event) => setName(event.target.value)}
            placeholder={
              characterClass ? t.defaultName(shownClass(characterClass)) : t.myCharacter
            }
            className="mt-1"
            data-testid="alta-nombre"
          />
        </div>
        <div>
          <Label htmlFor="alta-nivel" className="text-xs text-muted-foreground">
            {t.level}
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
          {t.fullForm}
        </button>
        <Button type="submit" disabled={saving} data-testid="alta-guardar">
          {saving && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {initial ? t.save : t.saveCharacter}
        </Button>
      </div>
    </form>
  );
}
