import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { Camera, ClipboardCheck, Loader2, MessageCircleMore, PencilLine } from "lucide-react";
import type { ScreenshotReadResponse } from "@shared/screenshotRead.js";
import { api, getErrorMessage } from "@/lib/api";
import type { CharacterProfile } from "@shared/domain.js";
import { firstGapsToAsk, joinGapList, reviewCharacter, type QuickReviewGap } from "@shared/quickReview.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { texts, useLang, useText } from "@/i18n/lang";
import { loadGemNamePairs, sameGem } from "@/lib/gemNamePairs";
import { canonicalSkillName, isKnownSkillName } from "@/lib/skillNames";
import { readQuickReviewForm, writeQuickReviewForm } from "@/lib/quickReviewStorage";
import { pastedImage, screenshotDataUrl } from "@/lib/screenshotImage";
import {
  LICH,
  QUICK_REVIEW_CHANGED_EVENT,
  RANGES,
  fieldIsInvalid,
  quickReviewFormFor,
  toInput,
  withReviewBase,
  type Form,
} from "@/lib/quickReviewForm";

const TEXT = texts(
  {
    title: "Revisión rápida de tu personaje",
    eyebrow: "Revisión rápida",
    summaryTitle: "Lo que te frena",
    editData: "Cambiar datos",
    hideData: "Ocultar datos",
    done: "Listo",
    start: "Empezar la revisión",
    lead: "Contesta lo que veas en el juego y te digo los 3 problemas que más te frenan, en orden. No hace falta pegar nada.",
    level: "Tu nivel",
    act: "Dónde estás",
    acts: { 1: "Acto 1", 2: "Acto 2", 3: "Acto 3", 4: "Acto 4", maps: "Mapas" } as Record<string, string>,
    mainSkill: "Tu habilidad principal",
    mainSkillHint: "La que hace el daño",
    unknownSkill: (name: string) => `No reconozco «${name}». Elígela de la lista para escribirla como en el juego.`,
    gemLevel: "Nivel de esa gema",
    gemLevelHint: "Sale en la ventana de habilidades",
    weapon: "Nivel de objeto de tu arma",
    weaponHint: "Al pasar el ratón. Vacío si es un único",
    resistances: "Resistencias (tecla C)",
    fire: "Fuego",
    cold: "Hielo",
    lightning: "Rayo",
    ascPoints: "Puntos de ascendencia",
    ascendancy: "¿Tu ascendencia es Liche?",
    lich: "Sí",
    other: "No (otra o ninguna)",
    curse: "¿Llevas una maldición?",
    yes: "Sí",
    no: "No",
    unknown: "—",
    otherSkills: "Otras habilidades",
    otherSkillsHint: "Separadas por comas",
    review: "Revisar",
    resultTitle: "Lo que más te frena",
    nothing: "Con estos datos no veo nada grave.",
    nothingAsk: " Si aun así te cuesta, pregúntale al Mentor.",
    needMore: (list: string) => `Aún no puedo decirte qué te frena. Dime primero ${list}.`,
    stillMissing: (list: string) => `Aún me falta: ${list}. Rellénalo aquí arriba y te lo digo.`,
    fillNow: "Rellenarlo ahora",
    and: "y",
    moreData: "Más datos (opcional)",
    moreDataHint: "Arma, ascendencia y otras habilidades. Afinan la revisión.",
    invalid: (fields: string) => `Revisa estos números, no pueden ser así: ${fields}.`,
    range: (min: number, max: number) => `entre ${min} y ${max}`,
    more: (count: number) => `Hay ${count} cosa${count === 1 ? "" : "s"} más, menos urgente${count === 1 ? "" : "s"}.`,
    showMore: "Ver también",
    missing: (list: string) => `No he podido revisar: ${list}.`,
    ask: "Preguntar al Mentor sobre esto",
    askQuestion: (lines: string) => `Mi revisión rápida dice: ${lines}. ¿Por dónde empiezo y cómo lo hago?`,
    rules: "Reglas fijas con datos del juego (niveles de gema de poe2db). Sin IA.",
    pasteTitle: "Rellénalo con una captura",
    pasteHint: "En el juego abre la hoja del personaje (tecla C) o la ventana de habilidades, pulsa Win+Shift+S, recorta y pega aquí con Ctrl+V.",
    pastePick: "o elige una imagen",
    pasteReading: "Leyendo tu captura…",
    pasteSheet: (count: number) => `He rellenado ${count} dato${count === 1 ? "" : "s"} de tu hoja. Revísalos.`,
    pasteSkills: "He leído tus habilidades. ¿Cuál es la que hace el daño?",
    pasteOther: "No reconozco esa pantalla. Prueba con la hoja (tecla C) o la ventana de habilidades.",
    pasteNotImage: "Eso no es una imagen. Haz la captura con Win+Shift+S y pega aquí.",
    pastePrivacy: "La captura se manda a la IA solo para leer los números; no la guardamos.",
    pasteConfirm: "¿Leo esta imagen? Se enviará a la IA para sacar los números. Si no es la captura del juego, descártala.",
    pasteConfirmAlt: "La imagen que acabas de pegar",
    pasteConfirmYes: "Leer esta captura",
    pasteConfirmNo: "Descartar",
    how: "Cómo hacerlo",
  },
  {
    title: "Quick character review",
    eyebrow: "Quick review",
    summaryTitle: "What's holding you back",
    editData: "Edit details",
    hideData: "Hide details",
    done: "Done",
    start: "Start the review",
    lead: "Fill in what you see in game and I'll tell you the 3 things holding you back the most, in order. No pasting needed.",
    level: "Your level",
    act: "Where you are",
    acts: { 1: "Act 1", 2: "Act 2", 3: "Act 3", 4: "Act 4", maps: "Maps" } as Record<string, string>,
    mainSkill: "Your main skill",
    mainSkillHint: "The one dealing the damage",
    unknownSkill: (name: string) => `I don't recognise “${name}”. Pick it from the list so it's spelled as in the game.`,
    gemLevel: "That gem's level",
    gemLevelHint: "Shown in the skills window",
    weapon: "Your weapon's item level",
    weaponHint: "Hover it. Leave empty if it's a unique",
    resistances: "Resistances (C key)",
    fire: "Fire",
    cold: "Cold",
    lightning: "Lightning",
    ascPoints: "Ascendancy points",
    ascendancy: "Is your ascendancy Lich?",
    lich: "Yes",
    other: "No (another or none)",
    curse: "Do you use a curse?",
    yes: "Yes",
    no: "No",
    unknown: "—",
    otherSkills: "Other skills",
    otherSkillsHint: "Comma separated",
    review: "Review",
    resultTitle: "What's holding you back",
    nothing: "With this data I don't see anything serious.",
    nothingAsk: " If it still feels hard, ask the Mentor.",
    needMore: (list: string) => `I can't tell what's holding you back yet. First tell me ${list}.`,
    stillMissing: (list: string) => `I'm still missing ${list}. Fill it in above and I'll tell you.`,
    fillNow: "Fill it in now",
    and: "and",
    moreData: "More details (optional)",
    moreDataHint: "Weapon, ascendancy and other skills. They sharpen the review.",
    invalid: (fields: string) => `Check these numbers, they can't be right: ${fields}.`,
    range: (min: number, max: number) => `between ${min} and ${max}`,
    more: (count: number) => `There ${count === 1 ? "is" : "are"} ${count} more, less urgent.`,
    showMore: "Show them too",
    missing: (list: string) => `I couldn't check: ${list}.`,
    ask: "Ask the Mentor about this",
    askQuestion: (lines: string) => `My quick review says: ${lines}. Where do I start and how?`,
    rules: "Fixed rules with game data (gem levels from poe2db). No AI.",
    pasteTitle: "Fill it in with a screenshot",
    pasteHint: "In game, open the character sheet (C key) or the skills window, press Win+Shift+S, crop it and paste here with Ctrl+V.",
    pastePick: "or choose an image",
    pasteReading: "Reading your screenshot…",
    pasteSheet: (count: number) => `I filled in ${count} value${count === 1 ? "" : "s"} from your sheet. Please check them.`,
    pasteSkills: "I read your skills. Which one deals your damage?",
    pasteOther: "I don't recognise that screen. Try the character sheet (C key) or the skills window.",
    pasteNotImage: "That isn't an image. Take the screenshot with Win+Shift+S and paste it here.",
    pastePrivacy: "The screenshot is sent to the AI only to read the numbers; we don't keep it.",
    pasteConfirm: "Read this image? It will be sent to the AI to get the numbers. If it isn't your game screenshot, discard it.",
    pasteConfirmAlt: "The image you just pasted",
    pasteConfirmYes: "Read this screenshot",
    pasteConfirmNo: "Discard",
    how: "How to do it",
  },
);

/** Evento con el que otras partes de la web (la mascota) abren la revisión. */
export const OPEN_REVIEW_EVENT = "exile-copilot:abrir-revision";

/** Lo que este navegador recuerda de la revisión de ese personaje (o del borrador sin personaje). */
function readStored(profileId: string | null): Record<string, string> {
  try {
    return readQuickReviewForm(window.localStorage, profileId);
  } catch {
    return {};
  }
}

function remember(profile: CharacterProfile | null, form: Form): void {
  try {
    // Con lo que dice la ficha ahora al lado: si la ficha cambia después, se nota.
    writeQuickReviewForm(window.localStorage, profile?.id ?? null, withReviewBase({ ...form }, profile));
    // El Mentor y la mascota leen la revisión: que se enteren del cambio.
    window.dispatchEvent(new Event(QUICK_REVIEW_CHANGED_EVENT));
  } catch {
    // Sin almacenamiento, el formulario vale para esta visita.
  }
}

/** Campo del formulario al que lleva cada dato que falta. */
const FIELD_FOR_GAP: Record<QuickReviewGap, keyof Form> = {
  level: "level",
  res: "fire",
  act: "act",
  gem: "gemLevel",
  weapon: "weapon",
  asc: "ascPoints",
};

/** Lo que afina la revisión pero no hace falta para empezar: va plegado. */
const OPTIONAL_FIELDS: Array<keyof Form> = ["weapon", "ascendancy", "curse", "otherSkills"];

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
  // Cada personaje recuerda su propia revisión: lo de uno no aparece en otro.
  const profileId = profile?.id ?? null;
  const [form, setForm] = useState<Form>(() => quickReviewFormFor(profile, readStored(profileId)));
  // Si la ficha cambia (otra arma, otro nivel, otro personaje), el formulario se
  // rehace con ella: antes se quedaba con los números de cuando se abrió la
  // tarjeta, y el siguiente cambio aquí los guardaba encima de los nuevos.
  const [shownProfile, setShownProfile] = useState(profile);
  if (shownProfile !== profile) {
    setShownProfile(profile);
    setForm(quickReviewFormFor(profile, readStored(profileId)));
  }
  const [showRest, setShowRest] = useState(false);
  // Los datos opcionales empiezan plegados, salvo que ya haya alguno escrito.
  const [showOptional, setShowOptional] = useState(() => OPTIONAL_FIELDS.some((key) => form[key].trim() !== ""));
  // La tarjeta enseña el resultado («lo que te frena»). El formulario con los
  // datos se abre al pedirlo, o cuando otra parte de la web (la mascota, el
  // Mentor) manda al jugador a rellenarlo.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const open = () => setExpanded(true);
    window.addEventListener(OPEN_REVIEW_EVENT, open);
    return () => window.removeEventListener(OPEN_REVIEW_EVENT, open);
  }, []);
  // Los nombres de las habilidades del juego, para sugerirlos al escribir. Una
  // habilidad mal escrita («Golpe rodante» por «Embate rodante») dejaba al
  // árbol y a PoB2 sin saber de qué habilidad se hablaba, y nadie avisaba.
  const [skillNames, setSkillNames] = useState<string[]>([]);
  const [otherLangNames, setOtherLangNames] = useState<string[]>([]);
  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    api
      .gemSkills(lang)
      .then((response) => {
        if (!cancelled) setSkillNames(response.skills.map((item) => item.name).sort((a, b) => a.localeCompare(b, lang)));
      })
      .catch(() => undefined);
    api
      .gemSkills(lang === "en" ? "es" : "en")
      .then((response) => {
        if (!cancelled) setOtherLangNames(response.skills.map((item) => item.name));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [expanded, lang]);
  const [reading, setReading] = useState(false);
  const [readNote, setReadNote] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  /**
   * Imagen pegada fuera de la tarjeta, a la espera de que el jugador diga que
   * sí es su captura: no sale de su ordenador hasta entonces.
   */
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);
  const dropPending = () =>
    setPendingImage((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  /** Habilidades leídas de la captura, para elegir la principal con un clic. */
  const [readSkills, setReadSkills] = useState<ScreenshotReadResponse["skills"]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // El nivel de gema que trae el código de PoB2 del personaje: si es mayor que
  // el escrito (las gemas solo suben), manda el del código, que es más nuevo.
  const [gemPairs, setGemPairs] = useState<Map<string, number> | null>(null);
  const hasCodeLevels = profile?.skills.some((skill) => skill.level !== undefined) ?? false;
  useEffect(() => {
    if (!hasCodeLevels) return;
    let cancelled = false;
    loadGemNamePairs()
      .then((pairs) => {
        if (!cancelled) setGemPairs(pairs);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [hasCodeLevels]);
  const codeGemLevel =
    profile?.skills.find((skill) => skill.level !== undefined && form.mainSkill.trim() !== "" && sameGem(gemPairs, skill.mainSkill, form.mainSkill))
      ?.level ?? null;
  const [syncedGemLevel, setSyncedGemLevel] = useState<string | null>(null);
  const syncKey = codeGemLevel !== null ? `${form.mainSkill}|${codeGemLevel}` : null;
  if (syncKey !== null && syncKey !== syncedGemLevel) {
    setSyncedGemLevel(syncKey);
    const typed = Number(form.gemLevel.trim());
    if (form.gemLevel.trim() === "" || !Number.isFinite(typed) || typed < (codeGemLevel ?? 0)) {
      setForm((current) => ({ ...current, gemLevel: String(codeGemLevel) }));
    }
  }
  // El nivel del código también lo ve el Mentor: se recuerda como si lo hubiera escrito.
  // Solo el nivel: lo demás que viene de la ficha no se congela en este navegador.
  useEffect(() => {
    if (codeGemLevel === null || form.gemLevel !== String(codeGemLevel)) return;
    const stored = readStored(profileId);
    if (stored.gemLevel !== undefined && stored.gemLevel !== form.gemLevel) {
      try {
        writeQuickReviewForm(window.localStorage, profileId, { ...stored, gemLevel: form.gemLevel });
        window.dispatchEvent(new Event(QUICK_REVIEW_CHANGED_EVENT));
      } catch {
        // Sin almacenamiento vale para esta visita.
      }
    }
  }, [codeGemLevel, form.gemLevel, profileId]);
  const result = useMemo(() => reviewCharacter(toInput(form), lang), [form, lang]);
  const invalidKeys = (Object.keys(RANGES) as Array<keyof Form>).filter((key) => fieldIsInvalid(form, key));
  /** Sin los datos clave, «nada grave» sería mentira: se piden los dos que más pesan. */
  const gapsToAsk = firstGapsToAsk(result);
  const gapLabel = (gap: QuickReviewGap) => result.missing[result.missingKeys.indexOf(gap)] ?? "";
  /** Sin respuesta y con datos clave por rellenar: «Listo» no cierra, dice qué falta. */
  const blockedByGaps = result.top.length === 0 && gapsToAsk.length > 0;
  const gapList = joinGapList(gapsToAsk.map(gapLabel), t.and);
  const [triedDone, setTriedDone] = useState(false);
  /** Campos que se marcan tras pulsar «Listo» con datos clave vacíos. */
  const wantedFields = new Set<keyof Form>(
    triedDone && blockedByGaps
      ? gapsToAsk.flatMap((gap): Array<keyof Form> => (gap === "res" ? ["fire", "cold", "lightning"] : [FIELD_FOR_GAP[gap]]))
      : [],
  );
  const wantedClass = (key: keyof Form) => (wantedFields.has(key) && form[key].trim() === "" ? "border-amber-400/80" : "");
  /** Lleva al campo del primer dato que falta; si está plegado, lo despliega antes. */
  const goToGap = (gap: QuickReviewGap) => {
    const field = FIELD_FOR_GAP[gap];
    setExpanded(true);
    if (OPTIONAL_FIELDS.includes(field)) setShowOptional(true);
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLElement>(`[data-testid="revision-${field}"]`);
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus({ preventScroll: true });
    });
  };
  const FIELD_LABEL: Partial<Record<keyof Form, string>> = {
    level: t.level,
    gemLevel: t.gemLevel,
    weapon: t.weapon,
    fire: t.fire,
    cold: t.cold,
    lightning: t.lightning,
  };

  const set = (key: keyof Form) => (value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      remember(profile, next);
      return next;
    });
  };

  const setMany = (values: Partial<Form>) => {
    setForm((current) => {
      const next = { ...current, ...values };
      remember(profile, next);
      return next;
    });
  };

  /** Lo que la IA ha leído pasa a los campos; lo que no ha visto no se toca. */
  const applyRead = (read: ScreenshotReadResponse) => {
    if (read.screen === "character" && read.sheet) {
      const sheet = read.sheet;
      const values: Partial<Form> = {};
      if (sheet.level !== null) values.level = String(sheet.level);
      if (sheet.fire !== null) values.fire = String(sheet.fire);
      if (sheet.cold !== null) values.cold = String(sheet.cold);
      if (sheet.lightning !== null) values.lightning = String(sheet.lightning);
      if (sheet.className) values.ascendancy = LICH.test(sheet.className) ? "lich" : "other";
      // Reconoció la hoja pero no sacó ni un número claro: mejor decirlo que «0 datos».
      if (Object.keys(values).length === 0) {
        setReadError(t.pasteOther);
        return;
      }
      setMany(values);
      setReadNote(t.pasteSheet(Object.keys(values).length));
      return;
    }
    if (read.screen === "skills" && read.skills.length > 0) {
      setReadSkills(read.skills);
      setReadNote(t.pasteSkills);
      return;
    }
    setReadError(t.pasteOther);
  };

  const chooseMainSkill = (index: number) => {
    const main = readSkills[index];
    if (!main) return;
    setMany({
      mainSkill: main.name,
      gemLevel: main.level === null ? "" : String(main.level),
      otherSkills: readSkills
        .filter((_, other) => other !== index)
        .map((skill) => skill.name)
        .join(", "),
    });
    setReadSkills([]);
    setReadNote(null);
  };

  /** Reduce la imagen en el navegador (lado mayor 1600 px, JPEG) antes de mandarla. */
  const readImage = async (file: File) => {
    setReadError(null);
    setReadNote(null);
    setReadSkills([]);
    if (!file.type.startsWith("image/")) {
      setReadError(t.pasteNotImage);
      return;
    }
    setReading(true);
    try {
      applyRead(await api.readScreenshot(await screenshotDataUrl(file)));
    } catch (err) {
      setReadError(getErrorMessage(err));
    } finally {
      setReading(false);
    }
  };

  // Tras Win+Shift+S el foco no suele estar en la tarjeta: Ctrl+V en cualquier
  // parte de la página también vale, pero SOLO si lo pegado es una imagen y no
  // se está escribiendo en otro cuadro (las piezas se pegan como texto). Como
  // fuera de la tarjeta el jugador no ha dicho que quiera leer una captura, la
  // imagen se le enseña y espera su «sí»: en el portapapeles puede haber otra cosa.
  useEffect(() => {
    const onDocumentPaste = (event: globalThis.ClipboardEvent) => {
      // Otro cuadro ya se quedó la captura (el editor del personaje).
      if (event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-testid="revision-rapida"]')) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const file = pastedImage(event.clipboardData);
      if (!file) return;
      event.preventDefault();
      setExpanded(true);
      setReadError(null);
      setReadNote(null);
      setPendingImage((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { file, url: URL.createObjectURL(file) };
      });
      document.getElementById("revision-rapida")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    document.addEventListener("paste", onDocumentPaste);
    return () => document.removeEventListener("paste", onDocumentPaste);
  }, []);
  // Al salir de la tarjeta no se deja la imagen en memoria.
  const pendingUrlRef = useRef<string | null>(null);
  pendingUrlRef.current = pendingImage?.url ?? null;
  useEffect(
    () => () => {
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
    },
    [],
  );

  const onPasteImage = (event: ClipboardEvent<HTMLElement>) => {
    const file = pastedImage(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    dropPending();
    void readImage(file);
  };

  const numberField = (key: keyof Form, label: string, hint?: string) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={RANGES[key]?.[0] ?? 0}
        max={RANGES[key]?.[1] ?? 100}
        step={1}
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        className={`h-9 ${fieldIsInvalid(form, key) ? "border-rose-400/70" : wantedClass(key)}`}
        aria-invalid={fieldIsInvalid(form, key) ? true : undefined}
        data-testid={`revision-${key}`}
      />
      {fieldIsInvalid(form, key) && RANGES[key] ? (
        <span className="text-rose-300">{t.range(RANGES[key][0], RANGES[key][1])}</span>
      ) : (
        hint && <span>{hint}</span>
      )}
    </label>
  );

  const select = (key: keyof Form, label: string, options: Array<[string, string]>) => (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}</span>
      <select
        value={form[key]}
        onChange={(event) => set(key)(event.target.value)}
        className={`h-9 rounded-md border bg-background px-2 text-sm text-foreground ${wantedClass(key) || "border-input"}`}
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
      className="scroll-mt-36 rounded-xl border border-border bg-card p-4 sm:p-5 sm:scroll-mt-24"
      aria-labelledby="revision-rapida-titulo"
      data-testid="revision-rapida"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{t.eyebrow}</p>
          <h2 id="revision-rapida-titulo" className="text-lg font-semibold text-foreground">
            {t.summaryTitle}
          </h2>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls="revision-datos"
          data-testid="revision-empezar"
        >
          <PencilLine className="size-4" aria-hidden="true" />
          {expanded ? t.hideData : t.editData}
        </Button>
      </div>

      <div className="mt-3" data-testid="revision-resultado" aria-live="polite">
          {invalidKeys.length > 0 && (
            <p className="mb-3 text-sm text-rose-300" role="alert" data-testid="revision-invalido">
              {t.invalid(invalidKeys.map((key) => FIELD_LABEL[key]).join(", "))}
            </p>
          )}
          {result.top.length === 0 && gapsToAsk.length > 0 ? (
            <div data-testid="revision-pocos-datos">
              <p className="text-sm text-foreground">{t.needMore(gapList)}</p>
              <Button type="button" size="sm" variant="secondary" className="mt-2" onClick={() => goToGap(gapsToAsk[0])} data-testid="revision-rellenar">
                {t.fillNow}
              </Button>
            </div>
          ) : result.top.length === 0 ? (
            <p className="text-sm text-foreground">
              {t.nothing}
              {onAskMentor ? t.nothingAsk : ""}
            </p>
          ) : (
            <>
              <ol className="space-y-3">
                {result.top.map((finding, index) => (
                  <li key={finding.id} className="flex gap-3" data-testid={`revision-problema-${finding.id}`}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{finding.action}</p>
                      {finding.how && finding.how.length > 0 && (
                        <details className="mt-1.5 text-sm" data-testid={`revision-como-${finding.id}`}>
                          <summary className="cursor-pointer text-xs font-semibold text-primary">{t.how}</summary>
                          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                            {finding.how.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {result.rest.length > 0 && !showRest && (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.more(result.rest.length)}{" "}
                  <button
                    type="button"
                    className="font-semibold text-primary underline-offset-2 hover:underline"
                    onClick={() => setShowRest(true)}
                    data-testid="revision-ver-mas"
                  >
                    {t.showMore}
                  </button>
                </p>
              )}
              {showRest && result.rest.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-border/60 pt-3" data-testid="revision-resto">
                  {result.rest.map((finding) => (
                    <li key={finding.id} className="text-sm">
                      <p className="font-semibold text-foreground">{finding.title}</p>
                      <p className="mt-0.5 leading-relaxed text-muted-foreground">{finding.action}</p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          {/* Cuando ya se piden los datos clave no se repite la lista entera de lo que falta. */}
          {result.missing.length > 0 && !(result.top.length === 0 && gapsToAsk.length > 0) && (
            <p className="mt-3 text-xs text-muted-foreground" data-testid="revision-falta">
              {t.missing(result.missing.join(", "))}{" "}
              <button
                type="button"
                className="font-semibold text-primary underline-offset-2 hover:underline"
                onClick={() => goToGap(result.missingKeys[0])}
                data-testid="revision-falta-rellenar"
              >
                {t.fillNow}
              </button>
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

      {expanded && (
      <div id="revision-datos" className="mt-4 border-t border-border pt-4" data-testid="revision-datos">
      <p className="text-sm text-muted-foreground">{t.lead}</p>
      <div
        className="mt-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        onPaste={onPasteImage}
        data-testid="revision-captura"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {reading ? (
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <Camera className="size-4 text-primary" aria-hidden="true" />
          )}
          {reading ? t.pasteReading : t.pasteTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.pasteHint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reading}
            onClick={() => fileInputRef.current?.click()}
            data-testid="revision-captura-elegir"
          >
            {t.pastePick}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) {
                dropPending();
                void readImage(file);
              }
            }}
            data-testid="revision-captura-archivo"
          />
          <span className="text-[11px] text-muted-foreground/80">{t.pastePrivacy}</span>
        </div>
        {pendingImage && (
          <div
            className="mt-3 rounded-md border border-primary/40 bg-background/60 p-3"
            role="group"
            aria-label={t.pasteConfirmAlt}
            data-testid="revision-captura-confirmar"
          >
            <img
              src={pendingImage.url}
              alt={t.pasteConfirmAlt}
              className="max-h-40 max-w-full rounded border border-border object-contain"
            />
            <p className="mt-2 text-sm text-foreground">{t.pasteConfirm}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={reading}
                onClick={() => {
                  const { file } = pendingImage;
                  dropPending();
                  void readImage(file);
                }}
                data-testid="revision-captura-leer"
              >
                {t.pasteConfirmYes}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={dropPending} data-testid="revision-captura-descartar">
                {t.pasteConfirmNo}
              </Button>
            </div>
          </div>
        )}
        {readNote && (
          <p className="mt-2 text-sm text-emerald-300" role="status" data-testid="revision-captura-nota">
            {readNote}
          </p>
        )}
        {readSkills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="revision-captura-habilidades">
            {readSkills.map((skill, index) => (
              <Button key={`${skill.name}-${index}`} type="button" size="sm" variant="secondary" onClick={() => chooseMainSkill(index)}>
                {skill.name}
                {skill.level !== null && <span className="text-muted-foreground"> · {skill.level}</span>}
              </Button>
            ))}
          </div>
        )}
        {readError && (
          <p className="mt-2 text-sm text-rose-300" role="alert" data-testid="revision-captura-error">
            {readError}
          </p>
        )}
      </div>

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
        <label className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/90">{t.mainSkill}</span>
          <Input
            list="revision-habilidades"
            value={form.mainSkill}
            onChange={(event) => set("mainSkill")(event.target.value)}
            onBlur={() => {
              // «embate rodante» se guarda como lo escribe el juego: «Embate rodante».
              const asInGame = canonicalSkillName(form.mainSkill, skillNames, otherLangNames);
              if (asInGame !== form.mainSkill) set("mainSkill")(asInGame);
            }}
            autoComplete="off"
            className="h-9"
            data-testid="revision-mainSkill"
          />
          <datalist id="revision-habilidades">
            {skillNames.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          {form.mainSkill.trim() !== "" && !isKnownSkillName(form.mainSkill, skillNames, otherLangNames) ? (
            <span className="text-amber-200/90" data-testid="revision-habilidad-desconocida">
              {t.unknownSkill(form.mainSkill.trim())}
            </span>
          ) : (
            <span>{t.mainSkillHint}</span>
          )}
        </label>
        {numberField("gemLevel", t.gemLevel, t.gemLevelHint)}
      </div>

      <p className="mt-3 text-xs font-medium text-foreground/90">{t.resistances}</p>
      <div className="mt-1 grid grid-cols-3 gap-3">
        {numberField("fire", t.fire)}
        {numberField("cold", t.cold)}
        {numberField("lightning", t.lightning)}
      </div>

      <button
        type="button"
        className="mt-3 text-left text-xs font-semibold text-primary underline-offset-2 hover:underline"
        onClick={() => setShowOptional((open) => !open)}
        aria-expanded={showOptional}
        aria-controls="revision-opcional"
        data-testid="revision-mas-datos"
      >
        {showOptional ? "▾" : "▸"} {t.moreData}
        {!showOptional && <span className="ml-1 font-normal text-muted-foreground">· {t.moreDataHint}</span>}
      </button>
      <div id="revision-opcional" hidden={!showOptional} className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {numberField("weapon", t.weapon, t.weaponHint)}
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

      {triedDone && blockedByGaps && (
        <p className="mt-3 text-sm text-amber-200" role="status" data-testid="revision-falta-clave">
          {t.stillMissing(gapList)}
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        className="mt-4"
        onClick={() => {
          // Con datos clave vacíos no se cierra: se dice cuáles son y se lleva al primero.
          if (blockedByGaps) {
            setTriedDone(true);
            goToGap(gapsToAsk[0]);
            return;
          }
          setTriedDone(false);
          setExpanded(false);
        }}
        data-testid="revision-revisar"
      >
        <ClipboardCheck className="size-4" aria-hidden="true" />
        {t.done}
      </Button>

      </div>
      )}
    </section>
  );
}
