import { useRef, useState, type ClipboardEvent } from "react";
import { Camera, FileCode2, Loader2 } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import type { ScreenshotSkill } from "@shared/screenshotRead.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { texts, useText } from "@/i18n/lang";
import { api, getErrorMessage } from "@/lib/api";
import {
  applySheetToProfile,
  applySkillsToProfile,
  mergeImportedProfile,
  type ProfileRead,
} from "@/lib/profileFromReads";
import { QUICK_REVIEW_CHANGED_EVENT } from "@/lib/quickReviewForm";
import { patchQuickReviewForm } from "@/lib/quickReviewStorage";
import { pastedImage, screenshotDataUrl } from "@/lib/screenshotImage";

const TEXT = texts(
  {
    title: "Rellénalo rápido",
    lead: "Lee los datos del juego en vez de escribirlos. Revisa los números y pulsa «Guardar correcciones».",
    shotTitle: "Con una captura",
    shotHint:
      "En el juego abre la hoja del personaje (tecla C) o la ventana de habilidades, pulsa Win+Shift+S, recorta y pégala aquí con Ctrl+V.",
    shotPick: "o elige una imagen",
    shotReading: "Leyendo tu captura…",
    shotPrivacy: "La captura se manda a la IA solo para leer los números; no la guardamos.",
    shotSheet: (count: number) =>
      `He rellenado ${count} ${count === 1 ? "dato" : "datos"} de tu hoja. Revísalos y guarda.`,
    shotSkills: "He leído tus habilidades. ¿Cuál hace tu daño?",
    shotSkillsDone: (name: string) => `«${name}» es ahora tu habilidad principal. Revísalo y guarda.`,
    shotOther: "No reconozco esa pantalla. Prueba con la hoja del personaje (tecla C) o la ventana de habilidades.",
    shotNotImage: "Eso no es una imagen. Haz la captura con Win+Shift+S y pégala aquí.",
    pobTitle: "Con un código de Path of Building 2",
    pobHint:
      "En PoB2, importa tu personaje desde tu cuenta y copia el código de «Import/Export Build» → «Generate». Se queda este mismo personaje, con su diario.",
    pobPlaceholder: "Pega aquí el código de PoB2",
    pobRead: "Actualizar con PoB2",
    pobReading: "Leyendo el código…",
    pobDone: (items: number, skills: number) =>
      `Leído del código: ${items} ${items === 1 ? "pieza" : "piezas"}, ${skills} ${skills === 1 ? "habilidad" : "habilidades"} y tus estadísticas. Revísalo y guarda.`,
    pobOtherClass: (code: string, yours: string) =>
      `Ojo: el código es de ${code} y tu personaje es ${yours}. Si no es tu personaje, cierra sin guardar.`,
    pobNothing: "Ese código no trae datos de personaje que pueda usar.",
  },
  {
    title: "Fill it in fast",
    lead: "Read your data from the game instead of typing it. Check the numbers and press “Save corrections”.",
    shotTitle: "With a screenshot",
    shotHint:
      "In game, open the character sheet (C key) or the skills window, press Win+Shift+S, crop it and paste it here with Ctrl+V.",
    shotPick: "or choose an image",
    shotReading: "Reading your screenshot…",
    shotPrivacy: "The screenshot is sent to the AI only to read the numbers; we don't keep it.",
    shotSheet: (count: number) =>
      `I filled in ${count} value${count === 1 ? "" : "s"} from your sheet. Check them and save.`,
    shotSkills: "I read your skills. Which one deals your damage?",
    shotSkillsDone: (name: string) => `“${name}” is now your main skill. Check it and save.`,
    shotOther: "I don't recognise that screen. Try the character sheet (C key) or the skills window.",
    shotNotImage: "That isn't an image. Take the screenshot with Win+Shift+S and paste it here.",
    pobTitle: "With a Path of Building 2 code",
    pobHint:
      "In PoB2, import your character from your account and copy the code from “Import/Export Build” → “Generate”. You keep this same character and its journal.",
    pobPlaceholder: "Paste your PoB2 code here",
    pobRead: "Update with PoB2",
    pobReading: "Reading the code…",
    pobDone: (items: number, skills: number) =>
      `Read from the code: ${items} item${items === 1 ? "" : "s"}, ${skills} skill${skills === 1 ? "" : "s"} and your stats. Check it and save.`,
    pobOtherClass: (code: string, yours: string) =>
      `Careful: the code is for a ${code} and your character is a ${yours}. If it isn't your character, close without saving.`,
    pobNothing: "That code has no character data I can use.",
  },
);

interface ProfileQuickReadProps {
  profile: CharacterProfile;
  /** Sustituye el borrador del editor; se guarda con «Guardar correcciones». */
  onApply: (next: CharacterProfile) => void;
}

/**
 * «Rellénalo rápido» dentro de «Editar personaje»: una captura del juego o un
 * código de PoB2 rellenan el MISMO personaje, en vez de escribir campo a campo.
 */
export function ProfileQuickRead({ profile, onApply }: ProfileQuickReadProps) {
  const t = useText(TEXT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState<"shot" | "pob" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [skills, setSkills] = useState<ScreenshotSkill[]>([]);
  const [pobCode, setPobCode] = useState("");

  const apply = (read: ProfileRead) => {
    onApply(read.profile);
    // La revisión rápida manda sobre el perfil en el Mentor: se pone al día.
    try {
      patchQuickReviewForm(window.localStorage, profile.id, read.review);
      window.dispatchEvent(new Event(QUICK_REVIEW_CHANGED_EVENT));
    } catch {
      // Sin almacenamiento, el perfil ya lleva los datos nuevos.
    }
  };

  const readShot = async (file: File) => {
    setError(null);
    setNote(null);
    setSkills([]);
    if (!file.type.startsWith("image/")) {
      setError(t.shotNotImage);
      return;
    }
    setReading("shot");
    try {
      const read = await api.readScreenshot(await screenshotDataUrl(file));
      if (read.screen === "character" && read.sheet) {
        const result = applySheetToProfile(profile, read.sheet);
        if (result.filled === 0) {
          setError(t.shotOther);
          return;
        }
        apply(result);
        setNote(t.shotSheet(result.filled));
        return;
      }
      if (read.screen === "skills" && read.skills.length > 0) {
        setSkills(read.skills);
        setNote(t.shotSkills);
        return;
      }
      setError(t.shotOther);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReading(null);
    }
  };

  const chooseMain = (index: number) => {
    const name = skills[index]?.name;
    if (!name) return;
    apply(applySkillsToProfile(profile, skills, index));
    setSkills([]);
    setNote(t.shotSkillsDone(name));
  };

  const readPob = async () => {
    setError(null);
    setNote(null);
    setReading("pob");
    try {
      const res = await api.importBuild({ content: pobCode.trim(), patch: profile.patch, intent: "character" });
      if (!res.profile) {
        setError(res.warnings[0] ?? t.pobNothing);
        return;
      }
      const result = mergeImportedProfile(profile, res.profile);
      if (result.filled === 0) {
        setError(t.pobNothing);
        return;
      }
      apply(result);
      setPobCode("");
      // Solo los avisos que cambian lo que debe hacer el jugador; el resto es
      // detalle técnico de la lectura.
      const known = (value: string) => value.trim() !== "" && value !== "Desconocida";
      const otherClass =
        known(profile.characterClass) &&
        known(res.profile.characterClass) &&
        res.profile.characterClass.trim().toLocaleLowerCase() !== profile.characterClass.trim().toLocaleLowerCase();
      const versionWarning = res.warnings.find((warning) => warning.startsWith("Incompatibilidad de versión"));
      setNote(
        [
          t.pobDone(res.profile.items.length, res.profile.skills.length),
          otherClass ? t.pobOtherClass(res.profile.characterClass, profile.characterClass) : null,
          versionWarning ?? null,
        ]
          .filter(Boolean)
          .join(" "),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setReading(null);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLElement>) => {
    const file = pastedImage(event.clipboardData);
    if (!file) return;
    event.preventDefault();
    void readShot(file);
  };

  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
      aria-labelledby="lectura-rapida-titulo"
      data-testid="lectura-rapida"
    >
      <div>
        <h3 id="lectura-rapida-titulo" className="text-base font-semibold text-foreground">
          {t.title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t.lead}</p>
      </div>

      <div
        className="rounded-md border border-dashed border-border bg-background/40 p-3 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        role="group"
        aria-label={t.shotTitle}
        onPaste={onPaste}
        data-testid="lectura-rapida-captura"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {reading === "shot" ? (
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <Camera className="size-4 text-primary" aria-hidden="true" />
          )}
          {reading === "shot" ? t.shotReading : t.shotTitle}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.shotHint}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={reading !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            {t.shotPick}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void readShot(file);
            }}
            data-testid="lectura-rapida-archivo"
          />
          <span className="text-[11px] text-muted-foreground/80">{t.shotPrivacy}</span>
        </div>
        {skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" data-testid="lectura-rapida-habilidades">
            {skills.map((skill, index) => (
              <Button
                key={`${skill.name}-${index}`}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => chooseMain(index)}
              >
                {skill.name}
                {skill.level !== null && <span className="text-muted-foreground"> · {skill.level}</span>}
              </Button>
            ))}
          </div>
        )}
      </div>

      <details className="rounded-md border border-border bg-background/40 p-3" data-testid="lectura-rapida-pob">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
          <FileCode2 className="size-4 text-primary" aria-hidden="true" />
          {t.pobTitle}
        </summary>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.pobHint}</p>
        <Textarea
          value={pobCode}
          onChange={(event) => setPobCode(event.target.value)}
          placeholder={t.pobPlaceholder}
          aria-label={t.pobTitle}
          rows={3}
          className="mt-2 font-mono text-xs"
          disabled={reading !== null}
          data-testid="lectura-rapida-pob-codigo"
        />
        <Button
          type="button"
          size="sm"
          className="mt-2"
          disabled={reading !== null || pobCode.trim() === ""}
          onClick={() => void readPob()}
          data-testid="lectura-rapida-pob-leer"
        >
          {reading === "pob" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {reading === "pob" ? t.pobReading : t.pobRead}
        </Button>
      </details>

      {note && (
        <p className="text-sm text-emerald-300" role="status" data-testid="lectura-rapida-nota">
          {note}
        </p>
      )}
      {error && (
        <p className="text-sm text-rose-300" role="alert" data-testid="lectura-rapida-error">
          {error}
        </p>
      )}
    </section>
  );
}
