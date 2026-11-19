import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { Camera, ClipboardCheck, Loader2, MessageCircleMore } from "lucide-react";
import type { ScreenshotReadResponse } from "@shared/screenshotRead.js";
import { api, getErrorMessage } from "@/lib/api";
import type { CharacterProfile } from "@shared/domain.js";
import { firstGapsToAsk, reviewCharacter, type QuickReviewGap } from "@shared/quickReview.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { texts, useLang, useText } from "@/i18n/lang";
import { readQuickReviewForm, writeQuickReviewForm } from "@/lib/quickReviewStorage";
import {
  LICH,
  QUICK_REVIEW_CHANGED_EVENT,
  RANGES,
  fieldIsInvalid,
  quickReviewFormFor,
  toInput,
  type Form,
} from "@/lib/quickReviewForm";

const TEXT = texts(
  {
    title: "Revisión rápida de tu personaje",
    start: "Empezar la revisión",
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
    nothing: "Con estos datos no veo nada grave.",
    nothingAsk: " Si aun así te cuesta, pregúntale al Mentor.",
    needMore: (list: string) => `Aún no puedo decirte qué te frena. Dime primero ${list}.`,
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
    start: "Start the review",
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
    nothing: "With this data I don't see anything serious.",
    nothingAsk: " If it still feels hard, ask the Mentor.",
    needMore: (list: string) => `I can't tell what's holding you back yet. First tell me ${list}.`,
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

function remember(profileId: string | null, form: Form): void {
  try {
    writeQuickReviewForm(window.localStorage, profileId, { ...form });
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
  const [reviewed, setReviewed] = useState(false);
  const [showRest, setShowRest] = useState(false);
  // Los datos opcionales empiezan plegados, salvo que ya haya alguno escrito.
  const [showOptional, setShowOptional] = useState(() => OPTIONAL_FIELDS.some((key) => form[key].trim() !== ""));
  // En móvil empieza plegada: así el equipo sigue en la primera pantalla. En
  // ordenador, abierta. La mascota («No hago daño») la abre con un evento.
  const [wide, setWide] = useState(
    () => typeof window === "undefined" || window.matchMedia?.("(min-width: 768px)").matches !== false,
  );
  /** Lo que eligió el jugador; mientras no elija, manda el tamaño de pantalla. */
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);
  const expanded = userExpanded ?? wide;
  const setExpanded = setUserExpanded;
  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 768px)");
    const follow = () => setWide(query?.matches !== false);
    query?.addEventListener?.("change", follow);
    const open = () => setUserExpanded(true);
    window.addEventListener(OPEN_REVIEW_EVENT, open);
    return () => {
      query?.removeEventListener?.("change", follow);
      window.removeEventListener(OPEN_REVIEW_EVENT, open);
    };
  }, []);
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
  const result = useMemo(() => reviewCharacter(toInput(form), lang), [form, lang]);
  const invalidKeys = (Object.keys(RANGES) as Array<keyof Form>).filter((key) => fieldIsInvalid(form, key));
  /** Sin los datos clave, «nada grave» sería mentira: se piden los dos que más pesan. */
  const gapsToAsk = firstGapsToAsk(result);
  const gapLabel = (gap: QuickReviewGap) => result.missing[result.missingKeys.indexOf(gap)] ?? "";
  /** Lleva al campo del primer dato que falta; si está plegado, lo despliega antes. */
  const goToGap = (gap: QuickReviewGap) => {
    const field = FIELD_FOR_GAP[gap];
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
      remember(profileId, next);
      return next;
    });
  };

  const setMany = (values: Partial<Form>) => {
    setForm((current) => {
      const next = { ...current, ...values };
      remember(profileId, next);
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
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      applyRead(await api.readScreenshot(canvas.toDataURL("image/jpeg", 0.85)));
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
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-testid="revision-rapida"]')) return;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const file = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!file) return;
      event.preventDefault();
      setUserExpanded(true);
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
    const file = [...event.clipboardData.items]
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
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
        className={`h-9 ${reviewed && fieldIsInvalid(form, key) ? "border-rose-400/70" : ""}`}
        aria-invalid={reviewed && fieldIsInvalid(form, key) ? true : undefined}
        data-testid={`revision-${key}`}
      />
      {reviewed && fieldIsInvalid(form, key) && RANGES[key] ? (
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
      className="scroll-mt-36 rounded-xl border border-primary/35 bg-card p-4 sm:p-5 sm:scroll-mt-24"
      aria-labelledby="revision-rapida-titulo"
      data-testid="revision-rapida"
    >
      <h2 id="revision-rapida-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ClipboardCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      {!expanded && (
        <Button type="button" className="mt-3" onClick={() => setExpanded(true)} data-testid="revision-empezar">
          <ClipboardCheck className="size-4" aria-hidden="true" />
          {t.start}
        </Button>
      )}

      {expanded && (
      <>
      <div
        className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        {textField("mainSkill", t.mainSkill, t.mainSkillHint)}
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

      <Button type="button" className="mt-4" onClick={() => setReviewed(true)} data-testid="revision-revisar">
        <ClipboardCheck className="size-4" aria-hidden="true" />
        {t.review}
      </Button>

      {reviewed && (
        <div className="mt-4 border-t border-border pt-4" data-testid="revision-resultado" aria-live="polite">
          {invalidKeys.length > 0 && (
            <p className="mb-3 text-sm text-rose-300" role="alert" data-testid="revision-invalido">
              {t.invalid(invalidKeys.map((key) => FIELD_LABEL[key]).join(", "))}
            </p>
          )}
          {result.top.length === 0 && gapsToAsk.length > 0 ? (
            <div data-testid="revision-pocos-datos">
              <p className="text-sm text-foreground">{t.needMore(gapsToAsk.map(gapLabel).join(` ${t.and} `))}</p>
              <Button type="button" size="sm" className="mt-2" onClick={() => goToGap(gapsToAsk[0])} data-testid="revision-rellenar">
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
      )}
      </>
      )}
    </section>
  );
}
