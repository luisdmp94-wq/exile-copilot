import { Heart } from "lucide-react";
import { readCharacterLevel, type CharacterProfile, type ResistanceKind } from "@shared/domain.js";

const UNKNOWN_CLASS = new Set(["", "desconocida", "desconocido", "unknown"]);
import { displayProfileValue, formatCharacterLevel, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    res: { fire: "Fuego", cold: "Hielo", lightning: "Rayo", chaos: "Caos" } as Record<ResistanceKind, string>,
    unknown: (label: string) => `${label}: dato desconocido`,
    short: (label: string, value: number, missing: number, cap: number) =>
      `${label} ${value}%: te faltan ${missing} puntos para el tope del ${cap}%`,
    level: (level: string) => `nivel ${level}`,
    saved: "Guardado",
    unsaved: "Sin guardar",
    league: (league: string) => `liga ${league}`,
    patch: (patch: string) => `parche ${patch}`,
    unknownLeague: "desconocida",
    unknownPatch: "desconocido",
    life: "Vida",
    draft: "Solo con objetos · añade tu clase y tu nivel cuando quieras",
  },
  {
    res: { fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" } as Record<ResistanceKind, string>,
    unknown: (label: string) => `${label}: unknown`,
    short: (label: string, value: number, missing: number, cap: number) =>
      `${label} ${value}%: ${missing} points short of the ${cap}% cap`,
    level: (level: string) => `level ${level}`,
    saved: "Saved",
    unsaved: "Not saved",
    league: (league: string) => `league ${league}`,
    patch: (patch: string) => `patch ${patch}`,
    unknownLeague: "unknown",
    unknownPatch: "unknown",
    life: "Life",
    draft: "Items only · add your class and level whenever you like",
  },
);
type StripText = (typeof TEXT)["es"];

/** Tope normal de resistencia elemental en PoE2. */
const RESISTANCE_CAP = 75;

const RESISTANCES: ResistanceKind[] = ["fire", "cold", "lightning", "chaos"];

type Tone = "ok" | "warn" | "danger" | "unknown";

/**
 * El color resume lo que el motor ya dice con palabras: elemental al tope es
 * correcto y muy por debajo es peligroso. El caos solo se marca en negativo,
 * que es cuando la regla de caos avisa; por encima de 0 se queda neutro.
 */
function resistanceTone(kind: ResistanceKind, value: number | null): Tone {
  if (value === null) return "unknown";
  if (kind === "chaos") return value < 0 ? "danger" : value >= RESISTANCE_CAP ? "ok" : "warn";
  if (value >= RESISTANCE_CAP) return "ok";
  if (value >= 50) return "warn";
  return "danger";
}

const TONE_BAR: Record<Tone, string> = {
  ok: "bg-emerald-400",
  warn: "bg-amber-400",
  danger: "bg-rose-400",
  unknown: "bg-transparent",
};

const TONE_VALUE: Record<Tone, string> = {
  ok: "text-foreground",
  warn: "text-amber-200",
  danger: "text-rose-300",
  unknown: "text-muted-foreground",
};

function resistanceTitle(label: string, kind: ResistanceKind, value: number | null, t: StripText): string {
  if (value === null) return t.unknown(label);
  if (kind !== "chaos" && value < RESISTANCE_CAP) {
    return t.short(label, value, RESISTANCE_CAP - value, RESISTANCE_CAP);
  }
  return `${label} ${value}%`;
}

interface CharacterStripProps {
  profile: CharacterProfile;
  persisted: boolean;
}

/**
 * Franja fija del personaje: quién es y lo primero que le mata, visible en
 * las tres áreas. Es solo lectura; editar sigue en «Editar expediente».
 */
export function CharacterStrip({ profile, persisted }: CharacterStripProps) {
  const t = useText(TEXT);
  // «Analizar un objeto» crea un borrador sin clase ni nivel: se dice tal cual
  // en vez de «Desconocida · nivel desconocido».
  const classKnown = !UNKNOWN_CLASS.has(profile.characterClass.trim().toLocaleLowerCase("es"));
  const draft = !classKnown && !readCharacterLevel(profile).known;
  const subtitle = draft
    ? t.draft
    : [
        displayProfileValue(profile.characterClass),
        profile.ascendancy,
        t.level(formatCharacterLevel(profile)),
      ]
        .filter((part) => part !== null && part !== undefined && part !== "")
        .join(" · ");

  return (
    <section
      className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card px-4 py-3.5 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-6"
      aria-labelledby="expediente-titulo"
      data-testid="franja-personaje"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h2
            id="expediente-titulo"
            className="dossier-title min-w-0 truncate text-xl leading-tight text-foreground"
          >
            {displayProfileValue(profile.name)}
          </h2>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-xs",
              persisted
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300",
            )}
            data-testid="estado-memoria-build"
          >
            {persisted ? t.saved : t.unsaved}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {subtitle}
          <span className="hidden 2xl:inline">
            {" "}· {t.league(displayProfileValue(profile.league) || t.unknownLeague)} · {t.patch(profile.patch || t.unknownPatch)}
          </span>
        </p>
      </div>

      <dl className="grid grid-cols-4 gap-2 sm:gap-4 md:w-[26rem] md:shrink-0 lg:w-[30rem] lg:grid-cols-5">
        {RESISTANCES.map((kind) => {
          const label = t.res[kind];
          const value = profile.resistances[kind];
          const tone = resistanceTone(kind, value);
          const fill = value === null ? 0 : Math.max(0, Math.min(100, (value / RESISTANCE_CAP) * 100));
          return (
            <div
              key={kind}
              className="min-w-0"
              title={resistanceTitle(label, kind, value, t)}
              data-testid={`franja-resistencia-${kind}`}
              data-tone={tone}
            >
              <div className="flex items-baseline justify-between gap-1 text-xs">
                <dt className="truncate text-muted-foreground">{label}</dt>
                <dd className={cn("font-semibold tabular-nums", TONE_VALUE[tone])}>
                  {value === null ? "—" : `${value}%`}
                </dd>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
                aria-hidden="true"
              >
                <div className={cn("h-full rounded-full", TONE_BAR[tone])} style={{ width: `${fill}%` }} />
              </div>
            </div>
          );
        })}
        <div className="hidden min-w-0 lg:block" data-testid="franja-vida">
          <div className="flex items-baseline justify-between gap-1 text-xs">
            <dt className="flex items-center gap-1 truncate text-muted-foreground">
              <Heart className="size-3 shrink-0" aria-hidden="true" />
              {t.life}
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">
              {profile.life === undefined ? "—" : formatNumber(profile.life)}
            </dd>
          </div>
        </div>
      </dl>
    </section>
  );
}
