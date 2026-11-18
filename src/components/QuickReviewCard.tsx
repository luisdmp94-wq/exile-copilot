import { useMemo, useState } from "react";
import { ClipboardCheck, MessageCircleMore } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { readCharacterLevel } from "@shared/domain.js";
import { reviewCharacter, type QuickReviewAct, type QuickReviewInput } from "@shared/quickReview.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { texts, useLang, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    title: "Revisión rápida de tu personaje",
    lead: "Contesta lo que veas en el juego y te digo los 3 problemas que más te frenan, en orden. No hace falta pegar nada.",
    level: "Tu nivel",
    act: "Dónde estás",
    acts: { 1: "Acto 1", 2: "Acto 2", 3: "Acto 3", 4: "Acto 4", maps: "Mapas" } as Record<string, string>,
    mainSkill: "Tu habilidad principal",
    mainSkillHint: "La que hace el daño",
    gemLevel: "Nivel de esa gema",
    gemLevelHint: "Sale en la ventana de habilidades",
    weapon: "Nivel de objeto de tu arma",
    weaponHint: "Al pasar el ratón. Vacío si es un único",
    resistances: "Resistencias (tecla C)",
    fire: "Fuego",
    cold: "Hielo",
    lightning: "Rayo",
    ascPoints: "Puntos de ascendencia",
    ascendancy: "Ascendencia",
    lich: "Liche",
    other: "Otra o ninguna",
    curse: "¿Llevas una maldición?",
    yes: "Sí",
    no: "No",
    unknown: "—",
    otherSkills: "Otras habilidades",
    otherSkillsHint: "Separadas por comas",
    review: "Revisar",
    resultTitle: "Lo que más te frena",
    nothing: "Con estos datos no veo nada grave. Si aun así te cuesta, pregúntale al Mentor.",
    more: (count: number) => `Hay ${count} cosa${count === 1 ? "" : "s"} más, menos urgente${count === 1 ? "" : "s"}: arregla primero estas.`,
    missing: (list: string) => `No he podido revisar: ${list}.`,
    ask: "Preguntar al Mentor sobre esto",
    askQuestion: (lines: string) => `Mi revisión rápida dice: ${lines}. ¿Por dónde empiezo y cómo lo hago?`,
    rules: "Reglas fijas con datos del juego (niveles de gema de poe2db). Sin IA.",
  },
  {
    title: "Quick character review",
    lead: "Fill in what you see in game and I'll tell you the 3 things holding you back the most, in order. No pasting needed.",
    level: "Your level",
    act: "Where you are",
    acts: { 1: "Act 1", 2: "Act 2", 3: "Act 3", 4: "Act 4", maps: "Maps" } as Record<string, string>,
    mainSkill: "Your main skill",
    mainSkillHint: "The one dealing the damage",
    gemLevel: "That gem's level",
    gemLevelHint: "Shown in the skills window",
    weapon: "Your weapon's item level",
    weaponHint: "Hover it. Leave empty if it's a unique",
    resistances: "Resistances (C key)",
    fire: "Fire",
    cold: "Cold",
    lightning: "Lightning",
    ascPoints: "Ascendancy points",
    ascendancy: "Ascendancy",
    lich: "Lich",
    other: "Other or none",
    curse: "Do you use a curse?",
    yes: "Yes",
    no: "No",
    unknown: "—",
    otherSkills: "Other skills",
    otherSkillsHint: "Comma separated",
    review: "Review",
    resultTitle: "What's holding you back",
    nothing: "With this data I don't see anything serious. If it still feels hard, ask the Mentor.",
    more: (count: number) => `There ${count === 1 ? "is" : "are"} ${count} more, less urgent: fix these first.`,
    missing: (list: string) => `I couldn't check: ${list}.`,
    ask: "Ask the Mentor about this",
    askQuestion: (lines: string) => `My quick review says: ${lines}. Where do I start and how?`,
    rules: "Fixed rules with game data (gem levels from poe2db). No AI.",
  },
);

const STORAGE_KEY = "exile-copilot:revision-rapida";

interface Form {
  level: string;
  act: string;
  mainSkill: string;
  gemLevel: string;
  weapon: string;
  fire: string;
  cold: string;
  lightning: string;
  ascPoints: string;
  ascendancy: string;
  curse: string;
  otherSkills: string;
}

const EMPTY: Form = {
  level: "",
  act: "",
  mainSkill: "",
  gemLevel: "",
  weapon: "",
  fire: "",
  cold: "",
  lightning: "",
  ascPoints: "",
  ascendancy: "",
  curse: "",
  otherSkills: "",
};

const LICH = /\b(?:liche|lich)\b/i;

/** Lo que ya sabe la web del personaje guardado, para no preguntarlo otra vez. */
function fromProfile(profile: CharacterProfile | null): Partial<Form> {
  if (!profile) return {};
  const level = readCharacterLevel(profile);
  const weapon = profile.items.find((item) => item.slot === "weapon");
  const skills = profile.skills.map((skill) => skill.mainSkill || skill.label).filter(Boolean);
  const res = profile.resistances;
  const asText = (value: number | null) => (value === null ? "" : String(value));
  return {
    ...(level.known ? { level: String(level.level) } : {}),
    ...(weapon && weapon.rarity !== "unique" && weapon.itemLevel ? { weapon: String(weapon.itemLevel) } : {}),
    ...(skills[0] ? { mainSkill: skills[0], otherSkills: skills.slice(1).join(", ") } : {}),
    fire: asText(res.fire),
    cold: asText(res.cold),
    lightning: asText(res.lightning),
    ...(profile.ascendancy ? { ascendancy: LICH.test(profile.ascendancy) ? "lich" : "other" } : {}),
  };
}

function readStored(): Partial<Form> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<Form>) : {};
  } catch {
    return {};
  }
}

const numberOrNull = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

function toInput(form: Form): QuickReviewInput {
  const act: QuickReviewAct | null =
    form.act === "maps" ? "maps" : ["1", "2", "3", "4"].includes(form.act) ? (Number(form.act) as QuickReviewAct) : null;
  return {
    level: numberOrNull(form.level),
    act,
    mainSkill: form.mainSkill.trim() || null,
    mainSkillGemLevel: numberOrNull(form.gemLevel),
    weaponItemLevel: numberOrNull(form.weapon),
    resistances: {
      fire: numberOrNull(form.fire),
      cold: numberOrNull(form.cold),
      lightning: numberOrNull(form.lightning),
    },
    ascendancyPoints: numberOrNull(form.ascPoints),
    ascendancy: form.ascendancy === "lich" ? "Lich" : form.ascendancy === "other" ? "other" : null,
    usesCurse: form.curse === "yes" ? true : form.curse === "no" ? false : null,
    otherSkills: form.otherSkills
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean),
  };
}

interface QuickReviewCardProps {
  profile: CharacterProfile | null;
  /** Lleva el resultado al Mentor; sin personaje no se ofrece. */
  onAskMentor?: (question: string) => void;
}

/**
 * «Revisión rápida»: unas pocas preguntas que el jugador contesta mirando el
 * juego, y los 3 problemas que más le frenan. Lo que ya sabe la web del
 * personaje guardado viene relleno; lo que escribe el jugador se recuerda en
 * este navegador.
 */
export function QuickReviewCard({ profile, onAskMentor }: QuickReviewCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [form, setForm] = useState<Form>(() => ({ ...EMPTY, ...fromProfile(profile), ...readStored() }));
  const [reviewed, setReviewed] = useState(false);
  const result = useMemo(() => reviewCharacter(toInput(form), lang), [form, lang]);

  const set = (key: keyof Form) => (value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Sin almacenamiento, el formulario vale para esta visita.
      }
      return next;
    });
  };

  const numberField = (key: keyof Form, label: string, hint?: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={-100}
        max={100}
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        className="h-9"
        data-testid={`revision-${key}`}
      />
      {hint && <span>{hint}</span>}
    </label>
  );

  const select = (key: keyof Form, label: string, options: Array<[string, string]>) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}</span>
      <select
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
        data-testid={`revision-${key}`}
      >
        <option value="">{t.unknown}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );

  const textField = (key: keyof Form, label: string, hint: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}</span>
      <Input
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        className="h-9"
        data-testid={`revision-${key}`}
      />
      <span>{hint}</span>
    </label>
  );

  return (
    <section
      id="revision-rapida"
      className="rounded-xl border border-primary/35 bg-card p-4 sm:p-5"
      aria-labelledby="revision-rapida-titulo"
      data-testid="revision-rapida"
    >
      <h2 id="revision-rapida-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ClipboardCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numberField("level", t.level)}
        {select("act", t.act, [
          ["1", t.acts["1"]!],
          ["2", t.acts["2"]!],
          ["3", t.acts["3"]!],
          ["4", t.acts["4"]!],
          ["maps", t.acts.maps!],
        ])}
        {select("ascPoints", t.ascPoints, [
          ["0", "0"],
          ["2", "2"],
          ["4", "4"],
          ["6", "6"],
          ["8", "8"],
        ])}
        {textField("mainSkill", t.mainSkill, t.mainSkillHint)}
        {numberField("gemLevel", t.gemLevel, t.gemLevelHint)}
        {numberField("weapon", t.weapon, t.weaponHint)}
      </div>

      <p className="mt-3 text-xs font-medium text-foreground/90">{t.resistances}</p>
      <div className="mt-1 grid grid-cols-3 gap-3">
        {numberField("fire", t.fire)}
        {numberField("cold", t.cold)}
        {numberField("lightning", t.lightning)}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {select("ascendancy", t.ascendancy, [
          ["lich", t.lich],
          ["other", t.other],
        ])}
        {form.ascendancy === "lich" &&
          select("curse", t.curse, [
            ["yes", t.yes],
            ["no", t.no],
          ])}
        <div className="col-span-2 sm:col-span-1">{textField("otherSkills", t.otherSkills, t.otherSkillsHint)}</div>
      </div>

      <Button type="button" className="mt-4" onClick={() => setReviewed(true)} data-testid="revision-revisar">
        <ClipboardCheck className="size-4" aria-hidden="true" />
        {t.review}
      </Button>

      {reviewed && (
        <div className="mt-4 border-t border-border pt-4" data-testid="revision-resultado" aria-live="polite">
          {result.top.length === 0 ? (
            <p className="text-sm text-foreground">{t.nothing}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">{t.resultTitle}</p>
              <ol className="mt-2 space-y-3">
                {result.top.map((finding, index) => (
                  <li key={finding.id} className="flex gap-3" data-testid={`revision-problema-${finding.id}`}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{finding.action}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {result.total > result.top.length && (
                <p className="mt-3 text-xs text-muted-foreground">{t.more(result.total - result.top.length)}</p>
              )}
            </>
          )}
          {result.missing.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground" data-testid="revision-falta">
              {t.missing(result.missing.join(", "))}
            </p>
          )}
          {onAskMentor && result.top.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => onAskMentor(t.askQuestion(result.top.map((finding) => finding.title).join("; ")))}
              data-testid="revision-mentor"
            >
              <MessageCircleMore className="size-4" aria-hidden="true" />
              {t.ask}
            </Button>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground/80">{t.rules}</p>
        </div>
      )}
    </section>
  );
}
