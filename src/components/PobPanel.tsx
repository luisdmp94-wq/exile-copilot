import { useState } from "react";
import { Calculator, Check, Copy, Download, Loader2, MapPin, Plus, Swords } from "lucide-react";
import type { PobXmlNotes } from "@shared/pobBuild.js";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";
import type { PobStatus } from "@/pob/pobClient";
import type { PobAnalysis, PobSummary } from "@/pob/pobTypes";

const TEXT = texts(
  {
    title: "Tus números con Path of Building 2",
    intro: "Tu daño, tu vida y lo que te da cada nodo, calculados con el mismo motor que Path of Building 2. Funciona aquí, en tu navegador.",
    start: "Calcular con PoB2",
    size: "Descarga unos 4 MB la primera vez; luego tu navegador lo guarda.",
    downloading: (pct: number) => `Descargando PoB2… ${pct} %`,
    starting: "Arrancando PoB2…",
    calculating: "Calculando…",
    failed: "No se pudo descargar o arrancar PoB2. Revisa tu conexión y prueba otra vez.",
    stopped: "PoB2 se ha parado calculando tu personaje. No es tu conexión: prueba otra vez.",
    retry: "Reintentar",
    error: "PoB2 no ha podido calcular tu personaje.",
    dataError: "No se pudieron cargar los datos de PoB2. Revisa tu conexión y prueba otra vez.",
    staleNote: "Son los números de antes: el último cálculo no salió.",
    skill: "Habilidad",
    computedFor: (name: string, level: number | null) => `Calculado para ${name}${level ? `, nivel ${level}` : ""}.`,
    dps: "Daño por segundo",
    minionDps: "Daño de tus esbirros",
    life: "Vida",
    energyShield: "Escudo de energía",
    mana: "Maná",
    spirit: "Espíritu",
    ehp: "Aguante",
    ehpHelp: "El daño que aguantas antes de morir.",
    resists: "Resistencias",
    resist: { fire: "Fuego", cold: "Hielo", lightning: "Rayo", chaos: "Caos" } as Record<string, string>,
    capped: "al tope",
    missing: (cap: number) => `tope ${cap} %`,
    noSkill: (name: string | null) =>
      name
        ? `PoB2 no reconoce «${name}»: no puedo calcular tu daño. Escribe tu habilidad como sale en el juego (en «Lo que te frena», «Cambiar datos»).`
        : "No sé qué habilidad usas: no puedo calcular tu daño. Dímela en «Lo que te frena», «Cambiar datos».",
    withChanges: "Con tus cambios",
    picksTitle: "Lo mejor cerca, según PoB2",
    picksLead: "Probando cada notable a pocos puntos de tu árbol:",
    damagePick: (gain: string) => `+${gain} % daño`,
    defencePick: (gain: string) => `+${gain} % aguante`,
    points: (points: number) => `${points} ${points === 1 ? "punto" : "puntos"}`,
    show: "Ver",
    take: "Coger",
    gives: "Da",
    unsupportedLines: "Ver cuáles",
    noPicks: "Ningún notable cercano sube tu daño ni tu aguante.",
    notes: "Ten en cuenta",
    noteSpanish: (count: number) => `${count} ${count === 1 ? "objeto está" : "objetos están"} en español: PoB2 no los lee.`,
    noteTranslated: (count: number) =>
      `${count === 1 ? "Tu objeto en español se ha traducido" : `Tus ${count} objetos en español se han traducido`} al inglés para PoB2.`,
    noteUntranslated: (count: number) => `${count} ${count === 1 ? "línea no se pudo traducir y no cuenta" : "líneas no se pudieron traducir y no cuentan"}.`,
    noteUnknownBases: (count: number) => `De ${count} ${count === 1 ? "objeto" : "objetos"} no reconozco la base.`,
    noteResists: "Resistencias con la penalización de tu acto (según tu nivel).",
    noteUnsupported: (count: number) => `PoB2 no entiende ${count} ${count === 1 ? "línea" : "líneas"} de tu equipo.`,
    noteGems: (names: string) => `PoB2 no reconoce: ${names}.`,
    noteLevels: "Niveles de gema según tu nivel de personaje.",
    noteNoDamage: "El daño sale a 0 porque no veo tu arma: pégala en «Equipo» (Ctrl+Alt+C sobre ella en el juego) y vuelve a calcular.",
    noteProfile: "Sin tu código de PoB2 faltan joyas y ascendencia: números aproximados.",
    noteNoClass: "No sé tu clase: sin ella PoB2 no puede leer tu árbol.",
    footer: (version: string) =>
      `Calculado en tu navegador con Path of Building 2 ${version}, de la comunidad (licencia MIT). Los números dependen de lo que la web sabe de tu personaje.`,
    export: "Exportar a PoB2",
    exportLead: "Tu personaje tal como está en la web. En Path of Building 2: Importar/Exportar → pega el código → Importar.",
    exportFailed: "No se pudo crear el código. Prueba otra vez.",
    copy: "Copiar el código",
    copied: "Copiado",
  },
  {
    title: "Your numbers with Path of Building 2",
    intro: "Your damage, your life and what each node gives, calculated with the same engine as Path of Building 2. It runs here, in your browser.",
    start: "Calculate with PoB2",
    size: "Downloads about 4 MB the first time; then your browser keeps it.",
    downloading: (pct: number) => `Downloading PoB2… ${pct}%`,
    starting: "Starting PoB2…",
    calculating: "Calculating…",
    failed: "PoB2 couldn't download or start. Check your connection and try again.",
    stopped: "PoB2 stopped while calculating your character. It isn't your connection: try again.",
    retry: "Try again",
    error: "PoB2 couldn't calculate your character.",
    dataError: "PoB2's data couldn't load. Check your connection and try again.",
    staleNote: "These are the earlier numbers: the last calculation failed.",
    skill: "Skill",
    computedFor: (name: string, level: number | null) => `Calculated for ${name}${level ? `, level ${level}` : ""}.`,
    dps: "Damage per second",
    minionDps: "Your minions' damage",
    life: "Life",
    energyShield: "Energy shield",
    mana: "Mana",
    spirit: "Spirit",
    ehp: "Toughness",
    ehpHelp: "The damage you can take before dying.",
    resists: "Resistances",
    resist: { fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" } as Record<string, string>,
    capped: "capped",
    missing: (cap: number) => `cap ${cap}%`,
    noSkill: (name: string | null) =>
      name
        ? `PoB2 doesn't recognise “${name}”: I can't work out your damage. Spell your skill as the game does (under “What's holding you back”, “Edit details”).`
        : "I don't know which skill you use: I can't work out your damage. Tell me under “What's holding you back”, “Edit details”.",
    withChanges: "With your changes",
    picksTitle: "Best nearby, according to PoB2",
    picksLead: "Trying every notable a few points from your tree:",
    damagePick: (gain: string) => `+${gain}% damage`,
    defencePick: (gain: string) => `+${gain}% toughness`,
    points: (points: number) => `${points} ${points === 1 ? "point" : "points"}`,
    show: "Show",
    take: "Take",
    gives: "Gives",
    unsupportedLines: "See which",
    noPicks: "No nearby notable raises your damage or toughness.",
    notes: "Keep in mind",
    noteSpanish: (count: number) => `${count} ${count === 1 ? "item is" : "items are"} in Spanish: PoB2 doesn't read ${count === 1 ? "it" : "them"}.`,
    noteTranslated: (count: number) =>
      `${count === 1 ? "Your Spanish item was" : `Your ${count} Spanish items were`} translated to English for PoB2.`,
    noteUntranslated: (count: number) => `${count} ${count === 1 ? "line couldn't be translated and doesn't count" : "lines couldn't be translated and don't count"}.`,
    noteUnknownBases: (count: number) => `I don't recognise the base of ${count} ${count === 1 ? "item" : "items"}.`,
    noteResists: "Resistances with your act's penalty (from your level).",
    noteUnsupported: (count: number) => `PoB2 doesn't understand ${count} ${count === 1 ? "line" : "lines"} of your gear.`,
    noteGems: (names: string) => `PoB2 doesn't recognise: ${names}.`,
    noteLevels: "Gem levels from your character level.",
    noteNoDamage: "Damage shows 0 because I can't see your weapon: paste it under “Gear” (Ctrl+Alt+C on it in the game) and calculate again.",
    noteProfile: "Without your PoB2 code, jewels and ascendancy are missing: approximate numbers.",
    noteNoClass: "I don't know your class: without it PoB2 can't read your tree.",
    footer: (version: string) =>
      `Calculated in your browser with Path of Building 2 ${version}, by the community (MIT licence). The numbers depend on what the site knows about your character.`,
    export: "Export to PoB2",
    exportLead: "Your character as it is on the site. In Path of Building 2: Import/Export → paste the code → Import.",
    exportFailed: "The code couldn't be made. Try again.",
    copy: "Copy the code",
    copied: "Copied",
  },
);

export interface PobPick {
  key: string;
  name: string;
  /** Lo que da el notable, en el idioma de la página. */
  stats: string[];
  /** Nodos que se cogen para llegar (el notable incluido). */
  path: string[];
  points: number;
  /** % de daño o de aguante que gana. */
  gain: number;
  kind: "damage" | "defence";
}

interface PobPanelProps {
  status: PobStatus;
  /** Ya dijo que sí: no se enseña el botón de empezar. */
  enabled: boolean;
  onEnable: () => void;
  onRetry: () => void;
  busy: boolean;
  /** Los números son de una petición anterior. */
  stale: boolean;
  error: string | null;
  analysis: PobAnalysis | null;
  /** El árbol guardado, para comparar mientras se edita. */
  baseline: PobAnalysis | null;
  notes: PobXmlNotes | null;
  skills: string[];
  skill: string | null;
  onSkill: (skill: string) => void;
  /** La habilidad que PoB2 ha calculado de verdad, con su nivel (ya en el idioma de la página). */
  computedSkill: { name: string; level: number | null } | null;
  picks: PobPick[];
  editing: boolean;
  onShowNode: (key: string) => void;
  onTakeNode: (key: string) => void;
  /** Escribe el código de PoB2 del personaje (con el árbol que se ve). */
  makeCode: () => Promise<string>;
  /** Cambia cuando cambia lo que se exportaría: el código viejo se borra. */
  exportKey: string;
  version: string | null;
}

function useFormat() {
  const { lang } = useLang();
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const whole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  // «17 %» en español, «17%» en inglés.
  const percent = lang === "es" ? " %" : "%";
  return { whole: (value: number) => whole.format(value), one: (value: number) => one.format(value), percent };
}

/** Cambio entre dos valores, como «+12» o «−3,5 %», solo si se nota. */
function Delta({ before, after, percent }: { before: number; after: number; percent?: boolean }) {
  const format = useFormat();
  const change = percent ? (before > 0 ? ((after - before) / before) * 100 : 0) : after - before;
  if (Math.abs(change) < (percent ? 0.05 : 0.5)) return null;
  const text = `${change > 0 ? "+" : "−"}${percent ? format.one(Math.abs(change)) : format.whole(Math.abs(change))}${percent ? format.percent : ""}`;
  return <span className={cn("ml-1 text-xs tabular-nums", change > 0 ? "text-emerald-300" : "text-rose-300")}>{text}</span>;
}

function Stat({
  label,
  value,
  help,
  before,
  after,
  percent,
}: {
  label: string;
  value: string;
  help?: string;
  before?: number;
  after?: number;
  percent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">
        {value}
        {before !== undefined && after !== undefined && <Delta before={before} after={after} percent={percent} />}
      </p>
      {help && <p className="text-[11px] leading-snug text-muted-foreground">{help}</p>}
    </div>
  );
}

function damageOf(summary: PobSummary): number {
  return summary.dps > 0 ? summary.dps : summary.minionDps;
}

function ExportCode({ makeCode }: { makeCode: () => Promise<string> }) {
  const t = useText(TEXT);
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={working}
        onClick={() => {
          setWorking(true);
          setFailed(false);
          makeCode()
            .then(setCode)
            .catch(() => {
              setCode(null);
              setFailed(true);
            })
            .finally(() => setWorking(false));
        }}
        data-testid="pob-exportar"
      >
        {working ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        {t.export}
      </Button>
      {failed && (
        <p className="text-xs text-amber-200" role="status">
          {t.exportFailed}
        </p>
      )}
      {code && (
        <div className="flex flex-col gap-2" data-testid="pob-codigo">
          <p className="text-xs text-muted-foreground">{t.exportLead}</p>
          <textarea
            readOnly
            value={code}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background/60 p-2 font-mono text-[11px] text-foreground"
            onFocus={(event) => event.currentTarget.select()}
            aria-label={t.export}
          />
          <Button
            type="button"
            size="sm"
            className="self-start"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(code)
                .then(() => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                })
                .catch(() => undefined);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? t.copied : t.copy}
          </Button>
        </div>
      )}
    </div>
  );
}

/** «Tus números»: el motor de PoB2 corriendo en el navegador. */
export function PobPanel(props: PobPanelProps) {
  const t = useText(TEXT);
  const format = useFormat();
  const { status, enabled, analysis, baseline, notes, editing } = props;

  const header = (
    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <Calculator className="size-4 shrink-0 text-primary" aria-hidden="true" />
      {t.title}
    </p>
  );

  if (!enabled) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="pob-panel">
        {header}
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.intro}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button type="button" size="sm" onClick={props.onEnable} data-testid="pob-empezar">
            <Calculator className="size-4" aria-hidden="true" />
            {t.start}
          </Button>
          <span className="text-xs text-muted-foreground">{t.size}</span>
        </div>
        <div className="mt-3">
          <ExportCode key={props.exportKey} makeCode={props.makeCode} />
        </div>
      </div>
    );
  }

  const loadingText =
    status.state === "loading"
      ? status.phase === "download"
        ? t.downloading(Math.round(status.fraction * 100))
        : t.starting
      : props.busy
        ? t.calculating
        : null;

  const main = analysis?.main ?? null;
  const base = editing ? baseline?.main ?? null : null;
  const noteLines: string[] = [];
  if (notes?.noClass) noteLines.push(t.noteNoClass);
  if (notes && notes.spanishItems > 0) noteLines.push(t.noteSpanish(notes.spanishItems));
  if (notes && notes.translatedItems > 0) {
    noteLines.push(
      [t.noteTranslated(notes.translatedItems), notes.untranslatedLines > 0 ? t.noteUntranslated(notes.untranslatedLines) : ""]
        .filter(Boolean)
        .join(" "),
    );
  }
  if (notes && notes.unknownBases > 0) noteLines.push(t.noteUnknownBases(notes.unknownBases));
  const unsupported = analysis?.unsupported ?? [];
  if (notes && notes.unknownGems.length > 0) noteLines.push(t.noteGems([...new Set(notes.unknownGems)].slice(0, 4).join(", ")));
  // PoB2 no tiene ninguna habilidad del jugador que calcular (ninguna dicha, o
  // ninguna reconocida): calcula un golpe sin arma. Ese daño no es el suyo, y
  // un «+45 % de daño» sobre él tampoco dice nada: no se enseña.
  const unknownGems = new Set(notes?.unknownGems ?? []);
  const noRealSkill = notes !== null && (props.skills.length === 0 || props.skills.every((name) => unknownGems.has(name)));
  const unknownSkillName = props.skills.find((name) => unknownGems.has(name)) ?? null;
  const shownPicks = noRealSkill ? props.picks.filter((pick) => pick.kind !== "damage") : props.picks;
  // Habilidad reconocida y aun así daño 0: casi siempre es que la web no ha visto el arma.
  if (main && !noRealSkill && damageOf(main) === 0) noteLines.unshift(t.noteNoDamage);
  if (notes && notes.guessedGemLevels > 0) noteLines.push(t.noteLevels);
  if (notes?.base === "profile") noteLines.push(t.noteProfile, t.noteResists);

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3" data-testid="pob-panel" aria-busy={loadingText !== null}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {header}
        {loadingText && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {loadingText}
          </span>
        )}
      </div>

      {status.state === "failed" || props.error === "data" ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground" role="status">
            {props.error === "data" ? t.dataError : status.state === "failed" && status.reason !== "start" ? t.stopped : t.failed}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
            {t.retry}
          </Button>
        </div>
      ) : props.error ? (
        <div className="mt-2 flex flex-col items-start gap-1.5" data-testid="pob-error">
          <p className="text-sm text-muted-foreground" role="status">
            {t.error} {main && props.stale ? t.staleNote : ""}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>
            {t.retry}
          </Button>
        </div>
      ) : null}

      {props.skills.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label={t.skill}>
          <Swords className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {props.skills.map((skill) => (
            <button
              key={skill}
              type="button"
              onClick={() => props.onSkill(skill)}
              aria-pressed={props.skill === skill}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                props.skill === skill
                  ? "border-primary bg-primary/20 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {skill}
            </button>
          ))}
        </div>
      )}

      {main && noRealSkill ? (
        <p className="mt-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-xs leading-relaxed text-amber-100" data-testid="pob-sin-habilidad">
          {t.noSkill(unknownSkillName)}
        </p>
      ) : (
        main &&
        props.computedSkill && (
          <p className="mt-1.5 text-xs text-muted-foreground" data-testid="pob-habilidad">
            {t.computedFor(props.computedSkill.name, props.computedSkill.level)}
          </p>
        )
      )}

      {main && (
        <div className={cn("mt-2 flex flex-col gap-2 transition-opacity", (props.busy || props.stale) && "opacity-60")} data-testid="pob-numeros">
          {editing && base && <p className="text-xs font-semibold text-emerald-200">{t.withChanges}</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {/* Sin habilidad reconocida PoB2 calcula un puñetazo: ese «1» no es el daño del jugador. */}
            {noRealSkill ? (
              <Stat label={t.dps} value="—" />
            ) : (
              <Stat
                label={main.dps > 0 || main.minionDps === 0 ? t.dps : t.minionDps}
                value={format.whole(damageOf(main))}
                before={base ? damageOf(base) : undefined}
                after={damageOf(main)}
                percent
              />
            )}
            <Stat label={t.life} value={format.whole(main.life)} before={base?.life} after={main.life} />
            {main.energyShield > 0 && (
              <Stat label={t.energyShield} value={format.whole(main.energyShield)} before={base?.energyShield} after={main.energyShield} />
            )}
            <Stat label={t.mana} value={format.whole(main.mana)} before={base?.mana} after={main.mana} />
            {main.spirit > 0 && <Stat label={t.spirit} value={format.whole(main.spirit)} before={base?.spirit} after={main.spirit} />}
            <Stat label={t.ehp} value={format.whole(main.ehp)} help={t.ehpHelp} before={base?.ehp} after={main.ehp} percent />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t.resists}</p>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm sm:grid-cols-4">
              {(["fire", "cold", "lightning", "chaos"] as const).map((element) => {
                const resist = main.resists[element];
                const missing = Math.max(0, resist.max - resist.value);
                const elemental = element !== "chaos";
                return (
                  <li key={element} className="tabular-nums">
                    <span className="text-muted-foreground">{t.resist[element]}:</span>{" "}
                    <span className={cn("font-semibold", elemental && missing > 0 ? "text-amber-200" : "text-foreground")}>
                      {format.whole(resist.value)}
                      {format.percent}
                    </span>
                    {base && <Delta before={base.resists[element].value} after={resist.value} />}
                    {elemental && (
                      <span className="block text-[11px] text-muted-foreground">
                        {missing === 0 ? t.capped : t.missing(Math.round(resist.max))}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {main && (
        <div className="mt-3" data-testid="pob-mejores">
          <p className="text-sm font-semibold text-foreground">{t.picksTitle}</p>
          {shownPicks.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.noPicks}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{t.picksLead}</p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {shownPicks.map((pick) => (
                  <li key={`${pick.kind}-${pick.key}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium text-foreground">{pick.name}</span>
                    <span className={cn("text-xs tabular-nums", pick.kind === "damage" ? "text-emerald-300" : "text-sky-300")}>
                      {pick.kind === "damage" ? t.damagePick(format.one(pick.gain)) : t.defencePick(format.one(pick.gain))}
                    </span>
                    <span className="text-xs text-muted-foreground">{t.points(pick.points)}</span>
                    {pick.stats.length > 0 && (
                      <span className="order-last w-full pb-1 text-xs leading-relaxed text-muted-foreground" data-testid="pob-mejor-da">
                        {t.gives}: {pick.stats.join(" · ")}
                      </span>
                    )}
                    <span className="ml-auto flex gap-1">
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => props.onShowNode(pick.key)}>
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {t.show}
                      </Button>
                      {editing && (
                        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => props.onTakeNode(pick.key)}>
                          <Plus className="size-3.5" aria-hidden="true" />
                          {t.take}
                        </Button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {(noteLines.length > 0 || unsupported.length > 0) && main && (
        <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-400/5 p-2" data-testid="pob-notas">
          <p className="text-xs font-semibold text-amber-100">{t.notes}</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-amber-100/90">
            {noteLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {unsupported.length > 0 && (
              <li>
                {t.noteUnsupported(unsupported.length)}{" "}
                <details className="inline">
                  <summary className="inline cursor-pointer underline-offset-2 hover:underline">{t.unsupportedLines}</summary>
                  <ul className="mt-1 space-y-0.5 pl-2 text-amber-100/80">
                    {unsupported.slice(0, 12).map((entry, index) => (
                      <li key={`${entry.item}-${index}`}>
                        <span className="font-medium">{entry.item}:</span> {entry.line}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <ExportCode key={props.exportKey} makeCode={props.makeCode} />
      </div>
      {props.version && <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">{t.footer(props.version)}</p>}
    </div>
  );
}
