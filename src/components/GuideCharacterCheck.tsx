import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Loader2,
  MessageCircleQuestion,
  UserCheck,
  X,
} from "lucide-react";
import type { CharacterProfile, Item } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import { explainImportError } from "@/lib/buildCheck";
import {
  GUIDE_SLOTS,
  checkForGuide,
  guideInputFromItems,
  guideInputFromProfile,
  placePastedItem,
  resistancesFromItems,
  looksLikeItemText,
  splitPastedItems,
  type GuideCheckInput,
  type GuideCheckLine,
  type GuideCheckTargets,
} from "@/lib/guideCheck";
import { readPobCodeInBrowser } from "@/lib/pobBrowser";
import { cn } from "@/lib/utils";

type Mode = "items" | "pob";

interface GuideCharacterCheckProps {
  /** «acto 1»: para redactar la pregunta al mentor. */
  actLabel: string;
  targets: GuideCheckTargets;
  /** Personaje del expediente, si hay uno cargado. */
  profile: CharacterProfile | null;
  patch: string;
  /** Solo existe con expediente: el mentor responde sobre ese personaje. */
  onAskMentor?: (question: string) => void;
}

const SLOT_LABEL = new Map(GUIDE_SLOTS.map(({ slot, label }) => [slot, label]));

const TONE_ICON = {
  danger: AlertTriangle,
  warn: AlertCircle,
  ok: CheckCircle2,
} as const;

const TONE_TEXT: Record<GuideCheckLine["tone"], string> = {
  danger: "text-rose-300",
  warn: "text-amber-200",
  ok: "text-emerald-300",
};

function pieceSummary(item: Item): string {
  const res = resistancesFromItems([item]);
  const parts = (
    [
      ["fuego", res.fire],
      ["hielo", res.cold],
      ["rayo", res.lightning],
      ["caos", res.chaos],
    ] as const
  )
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${value! > 0 ? "+" : ""}${value}% ${label}`);
  return parts.length > 0 ? parts.join(" · ") : "sin resistencias";
}

/**
 * Tarjeta «¿Está listo tu personaje?» al final de cada guía.
 *
 * Las piezas pegadas viven solo en esta tarjeta: no tocan el expediente ni se
 * guardan. El código PoB se lee en el navegador, igual que en /check.
 */
export function GuideCharacterCheck({ actLabel, targets, profile, patch, onAskMentor }: GuideCharacterCheckProps) {
  const [mode, setMode] = useState<Mode>("items");
  const [pasted, setPasted] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [pobProfile, setPobProfile] = useState<CharacterProfile | null>(null);
  const [useExpediente, setUseExpediente] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const input: GuideCheckInput | null = useMemo(() => {
    if (useExpediente && profile) return guideInputFromProfile(profile);
    if (mode === "pob") return pobProfile ? guideInputFromProfile(pobProfile) : null;
    return items.length > 0 ? guideInputFromItems(items) : null;
  }, [useExpediente, profile, mode, pobProfile, items]);

  const lines = useMemo(
    () => (checked && input ? checkForGuide(input, targets) : null),
    [checked, input, targets],
  );

  const switchMode = (next: Mode) => {
    setMode(next);
    setUseExpediente(false);
    setPasted("");
    setError(null);
    setNotice(null);
  };

  const addPiece = async (source: string = pasted) => {
    const chunks = splitPastedItems(source);
    if (chunks.length === 0) {
      setError("Pega primero el texto de una pieza.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    // Varias piezas pegadas seguidas se leen una a una. Las que sí se leen se
    // añaden aunque otra falle, y el aviso dice cuántas fueron.
    let current = items;
    let added = 0;
    const replaced: Item[] = [];
    const skipped: string[] = [];
    const failures: string[] = [];
    for (const text of chunks) {
      try {
        const { item } = await api.importItemText({ text, patch });
        // Frascos, joyas o un texto que solo trae la cabecera no ocupan un
        // hueco de equipo: no cuentan para la comprobación.
        if (item.slot === "other" || item.slot === "flask") {
          skipped.push(item.name);
          continue;
        }
        const placed = placePastedItem(current, item);
        current = placed.items;
        added += 1;
        if (placed.replaced) replaced.push(placed.replaced);
      } catch (err) {
        failures.push(
          err instanceof ApiRequestError && err.message === "texto-de-objeto-no-reconocido"
            ? "no parece un objeto de PoE2"
            : getErrorMessage(err),
        );
      }
    }
    setItems(current);
    if (added > 0) setUseExpediente(false);
    // Si algo falla, el texto se queda en la casilla para poder corregirlo.
    setPasted(failures.length === 0 ? "" : source);

    const notes: string[] = [];
    if (chunks.length > 1 && added > 0) notes.push(`${added} ${added === 1 ? "pieza añadida" : "piezas añadidas"}.`);
    for (const old of replaced) {
      notes.push(`Has pegado otro ${SLOT_LABEL.get(old.slot) ?? "objeto"}: sustituye a «${old.name}».`);
    }
    if (skipped.length > 0) {
      notes.push(
        `${skipped.map((name) => `«${name}»`).join(", ")} no ${skipped.length === 1 ? "es una pieza" : "son piezas"} de equipo (arma, armadura o joyería): no cuenta para la comprobación.`,
      );
    }
    setNotice(notes.length > 0 ? notes.join(" ") : null);

    if (failures.length > 0) {
      const lead =
        chunks.length === 1
          ? "Eso no parece un objeto de PoE2."
          : `${failures.length} de ${chunks.length} piezas no se han podido leer.`;
      setError(
        chunks.length === 1 && failures[0] !== "no parece un objeto de PoE2"
          ? failures[0]
          : `${lead} En el juego, pon el ratón encima de la pieza, pulsa Ctrl+C y pega aquí todo el texto.`,
      );
    }
    setBusy(false);
  };

  const readPob = async () => {
    const text = pasted.trim();
    if (!text) {
      setError("Pega primero tu código de Path of Building 2.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readPobCodeInBrowser(text);
      if (result.ok) {
        setPobProfile(result.profile);
        setUseExpediente(false);
        setChecked(true);
      } else {
        setError(explainImportError(result.code, result.detail, "es"));
      }
    } finally {
      setBusy(false);
    }
  };

  const removePiece = (target: Item) => {
    setItems((current) => current.filter((item) => item !== target));
    setNotice(null);
  };

  const pieceCount = items.filter((item) => SLOT_LABEL.has(item.slot)).length;
  const worst = lines?.find((line) => line.tone !== "ok") ?? null;

  return (
    <section
      className="rounded-xl border-2 border-primary/40 bg-card p-4 sm:p-5"
      aria-labelledby="guia-comprobar-titulo"
      data-testid="guia-comprobar"
    >
      <h2 id="guia-comprobar-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <UserCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        ¿Está listo tu personaje para el {targets.nextAct}?
      </h2>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Cómo quieres comprobarlo">
        <Button
          type="button"
          size="sm"
          variant={mode === "items" && !useExpediente ? "secondary" : "outline"}
          aria-pressed={mode === "items" && !useExpediente}
          onClick={() => switchMode("items")}
          data-testid="guia-modo-objetos"
        >
          Pegar objetos (Ctrl+C)
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "pob" && !useExpediente ? "secondary" : "outline"}
          aria-pressed={mode === "pob" && !useExpediente}
          onClick={() => switchMode("pob")}
          data-testid="guia-modo-pob"
        >
          Código de PoB
        </Button>
        {profile && (
          <Button
            type="button"
            size="sm"
            variant={useExpediente ? "secondary" : "outline"}
            aria-pressed={useExpediente}
            onClick={() => {
              setUseExpediente(true);
              setChecked(true);
              setError(null);
            }}
            data-testid="guia-modo-expediente"
          >
            Usar «{profile.name}»
          </Button>
        )}
      </div>

      {!useExpediente && (
        <div className="mt-4">
          <Label htmlFor="guia-pegar" className="text-sm text-muted-foreground">
            {mode === "items"
              ? "En el juego, pon el ratón sobre una pieza equipada y pulsa Ctrl+C. Pégala aquí con Ctrl+V y se añade sola. Puedes pegar varias seguidas."
              : "Pega el código que exporta Path of Building 2 (Importar/Exportar → Generar)."}
          </Label>
          <Textarea
            id="guia-pegar"
            value={pasted}
            onChange={(event) => {
              setPasted(event.target.value);
              if (error) setError(null);
            }}
            onPaste={(event) => {
              // Un objeto copiado del juego se añade al pegarlo, sin botón.
              // Cualquier otro texto se pega normal, para poder escribir a mano.
              if (mode !== "items" || busy) return;
              const text = event.clipboardData.getData("text");
              if (!looksLikeItemText(text)) return;
              event.preventDefault();
              void addPiece(text);
            }}
            rows={mode === "items" ? 5 : 3}
            className="mt-2 font-mono text-xs"
            placeholder={mode === "items" ? "Clase de objeto: Cascos\nRareza: Mágico\n…" : "eNrtfWl3…"}
            data-testid="guia-texto"
          />
          {error && (
            <p className="mt-2 text-sm text-rose-300" role="alert" data-testid="guia-error">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void (mode === "items" ? addPiece() : readPob())}
              data-testid="guia-anadir"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <ClipboardPaste className="size-4" aria-hidden="true" />
              )}
              {mode === "items" ? "Añadir piezas" : "Leer código"}
            </Button>
            {mode === "pob" && pobProfile && (
              <span className="text-xs text-muted-foreground">
                Leído: {pobProfile.name} · {pobProfile.items.length} piezas
              </span>
            )}
          </div>
        </div>
      )}

      {mode === "items" && !useExpediente && items.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label="Piezas pegadas" data-testid="guia-piezas">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">
                  {(SLOT_LABEL.get(item.slot) ?? "otro").replace(/^./, (c) => c.toUpperCase())} ·{" "}
                </span>
                {item.name} · <span className="text-muted-foreground">{pieceSummary(item)}</span>
              </span>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={`Quitar ${item.name}`}
                onClick={() => removePiece(item)}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {notice && <p className="mt-2 text-xs text-muted-foreground">{notice}</p>}

      {mode === "items" && !useExpediente && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {pieceCount} de {GUIDE_SLOTS.length} piezas · cuantas más pegues, más fiable
          </span>
          <Button
            type="button"
            onClick={() => {
              if (items.length === 0) {
                setError("Añade al menos una pieza antes de comprobar.");
                return;
              }
              setChecked(true);
            }}
            data-testid="guia-comprobar-boton"
          >
            Comprobar mi personaje
          </Button>
        </div>
      )}

      {lines && (
        <div className="mt-4 border-t border-border pt-4" data-testid="guia-resultado" aria-live="polite">
          <h3 className="text-sm font-semibold text-foreground">Resultado</h3>
          <ul className="mt-2 space-y-2">
            {lines.map((line) => {
              const Icon = TONE_ICON[line.tone];
              return (
                <li key={line.id} className={cn("flex gap-2 text-sm", TONE_TEXT[line.tone])} data-tone={line.tone}>
                  <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{line.text}</span>
                </li>
              );
            })}
          </ul>
          {input?.source === "items" && (
            <p className="mt-3 text-xs text-muted-foreground">
              Solo cuento las resistencias de las piezas que has pegado. Las pasivas y otras fuentes
              también suman: el número exacto está en la hoja del personaje del juego (tecla C).
            </p>
          )}
          {mode === "pob" && !useExpediente && (
            <p className="mt-3 text-xs text-muted-foreground">
              Path of Building calcula las resistencias con la penalización del acto que tenga
              configurado; si ves cifras muy negativas, revisa esa opción en PoB.
            </p>
          )}
          {worst && onAskMentor && useExpediente && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              onClick={() => onAskMentor(`Vengo de la guía del ${actLabel}. La comprobación dice: ${worst.text} ¿Qué hago primero?`)}
              data-testid="guia-preguntar-mentor"
            >
              <MessageCircleQuestion className="size-4" aria-hidden="true" />
              Pregúntale al mentor por esto
            </button>
          )}
        </div>
      )}
    </section>
  );
}
