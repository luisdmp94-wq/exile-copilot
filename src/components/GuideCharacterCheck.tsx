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
  guideSlotLabel,
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
import { sendUseBeacon } from "@/lib/visitBeacon";
import { cn } from "@/lib/utils";
import { quoted, texts, useLang, useText } from "@/i18n/lang";
import { displayProfileValue } from "@/lib/format";

const TEXT = texts(
  {
    res: { fire: "fuego", cold: "hielo", lightning: "rayo", chaos: "caos" },
    noRes: "sin resistencias",
    pasteFirst: "Pega primero el texto de una pieza.",
    notAnItemShort: "no parece un objeto de PoE2",
    added: (count: number) => `${count} ${count === 1 ? "pieza añadida" : "piezas añadidas"}.`,
    replaced: (slot: string, name: string) => `Has pegado otro ${slot}: sustituye a «${name}».`,
    anotherItem: "objeto",
    skipped: (names: string, count: number) =>
      `${names} no ${count === 1 ? "es una pieza" : "son piezas"} de equipo (arma, armadura o joyería): no cuenta para la comprobación.`,
    notAnItem: "Eso no parece un objeto de PoE2.",
    someFailed: (failed: number, total: number) => `${failed} de ${total} piezas no se han podido leer.`,
    howToCopy: "En el juego, pon el ratón encima de la pieza, pulsa Ctrl+C y pega aquí todo el texto.",
    pastePob: "Pega primero tu código de Path of Building 2.",
    title: (nextAct: string) => `¿Está listo tu personaje para el ${nextAct}?`,
    howGroup: "Cómo quieres comprobarlo",
    pasteItems: "Pegar objetos (Ctrl+C)",
    pobCode: "Código de PoB",
    useProfile: (name: string) => `Usar «${name}»`,
    itemsHelp:
      "En el juego, pon el ratón sobre una pieza equipada y pulsa Ctrl+C. Pégala aquí con Ctrl+V y se añade sola. Puedes pegar varias seguidas.",
    pobHelp: "Pega el código que exporta Path of Building 2 (Importar/Exportar → Generar).",
    itemsPlaceholder: "Clase de objeto: Cascos\nRareza: Mágico\n…",
    addPieces: "Añadir piezas",
    readCode: "Leer código",
    readPob: (name: string, count: number) => `Leído: ${name} · ${count} piezas`,
    pastedPieces: "Piezas pegadas",
    other: "otro",
    remove: (name: string) => `Quitar ${name}`,
    pieceCount: (count: number, total: number) => `${count} de ${total} piezas · cuantas más pegues, más fiable`,
    addOne: "Añade al menos una pieza antes de comprobar.",
    check: "Comprobar mi personaje",
    result: "Resultado",
    itemsOnly:
      "Solo cuento las resistencias de las piezas que has pegado. Las pasivas y otras fuentes también suman: el número exacto está en la hoja del personaje del juego (tecla C).",
    pobNote:
      "Path of Building calcula las resistencias con la penalización del acto que tenga configurado; si ves cifras muy negativas, revisa esa opción en PoB.",
    askMentorQuestion: (act: string, text: string) => `Vengo de la guía del ${act}. La comprobación dice: ${text} ¿Qué hago primero?`,
    askMentor: "Pregúntale al mentor por esto",
  },
  {
    res: { fire: "fire", cold: "cold", lightning: "lightning", chaos: "chaos" },
    noRes: "no resistances",
    pasteFirst: "Paste the text of an item first.",
    notAnItemShort: "doesn't look like a PoE2 item",
    added: (count: number) => `${count} ${count === 1 ? "item added" : "items added"}.`,
    replaced: (slot: string, name: string) => `You pasted another ${slot}: it replaces “${name}”.`,
    anotherItem: "item",
    skipped: (names: string, count: number) =>
      `${names} ${count === 1 ? "isn't" : "aren't"} gear (weapon, armour or jewellery): not counted in the check.`,
    notAnItem: "That doesn't look like a PoE2 item.",
    someFailed: (failed: number, total: number) => `${failed} of ${total} items couldn't be read.`,
    howToCopy: "In game, hover the item, press Ctrl+C and paste all the text here.",
    pastePob: "Paste your Path of Building 2 code first.",
    title: (nextAct: string) => `Is your character ready for ${nextAct}?`,
    howGroup: "How do you want to check",
    pasteItems: "Paste items (Ctrl+C)",
    pobCode: "PoB code",
    useProfile: (name: string) => `Use “${name}”`,
    itemsHelp:
      "In game, hover an equipped item and press Ctrl+C. Paste it here with Ctrl+V and it's added on its own. You can paste several in a row.",
    pobHelp: "Paste the code Path of Building 2 exports (Import/Export → Generate).",
    itemsPlaceholder: "Item Class: Helmets\nRarity: Magic\n…",
    addPieces: "Add items",
    readCode: "Read code",
    readPob: (name: string, count: number) => `Read: ${name} · ${count} items`,
    pastedPieces: "Pasted items",
    other: "other",
    remove: (name: string) => `Remove ${name}`,
    pieceCount: (count: number, total: number) => `${count} of ${total} items · the more you paste, the more reliable`,
    addOne: "Add at least one item before checking.",
    check: "Check my character",
    result: "Result",
    itemsOnly:
      "I only count the resistances on the items you pasted. Passives and other sources add up too: the exact number is on the in-game character sheet (C key).",
    pobNote:
      "Path of Building calculates resistances with whatever act penalty it's set to; if you see very negative numbers, check that option in PoB.",
    askMentorQuestion: (act: string, text: string) => `I'm coming from the ${act} guide. The check says: ${text} What should I do first?`,
    askMentor: "Ask the mentor about this",
  },
);

type Mode = "items" | "pob";

interface GuideCharacterCheckProps {
  /** «acto 1»: para redactar la pregunta al mentor. */
  actLabel: string;
  targets: GuideCheckTargets;
  /** Personaje del expediente, si hay uno cargado. */
  profile: CharacterProfile | null;
  /** Piezas pegadas. Las guarda la sección, que las comparte y las recuerda. */
  items: Item[];
  onItemsChange: (items: Item[]) => void;
  patch: string;
  /** Solo existe con expediente: el mentor responde sobre ese personaje. */
  onAskMentor?: (question: string) => void;
}

const GUIDE_SLOT_IDS = new Set(GUIDE_SLOTS.map(({ slot }) => slot));

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

function pieceSummary(item: Item, t: (typeof TEXT)["es"]): string {
  const res = resistancesFromItems([item]);
  const parts = (
    [
      [t.res.fire, res.fire],
      [t.res.cold, res.cold],
      [t.res.lightning, res.lightning],
      [t.res.chaos, res.chaos],
    ] as const
  )
    .filter(([, value]) => value !== 0)
    .map(([label, value]) => `${value! > 0 ? "+" : ""}${value}% ${label}`);
  return parts.length > 0 ? parts.join(" · ") : t.noRes;
}

/**
 * Tarjeta «¿Está listo tu personaje?» al final de cada guía.
 *
 * Las piezas pegadas viven solo en esta tarjeta: no tocan el expediente ni se
 * guardan. El código PoB se lee en el navegador, igual que en /check.
 */
export function GuideCharacterCheck({
  actLabel,
  targets,
  profile,
  items,
  onItemsChange,
  patch,
  onAskMentor,
}: GuideCharacterCheckProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const slotName = (slot: Item["slot"]) => (GUIDE_SLOT_IDS.has(slot) ? guideSlotLabel(slot, lang) : null);
  const [mode, setMode] = useState<Mode>("items");
  const [pasted, setPasted] = useState("");
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
    () => (checked && input ? checkForGuide(input, targets, lang) : null),
    [checked, input, targets, lang],
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
      setError(t.pasteFirst);
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
        if (item.slot === "other" || item.slot === "flask" || item.slot === "charm") {
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
            ? t.notAnItemShort
            : getErrorMessage(err),
        );
      }
    }
    onItemsChange(current);
    if (added > 0) setUseExpediente(false);
    // Si algo falla, el texto se queda en la casilla para poder corregirlo.
    setPasted(failures.length === 0 ? "" : source);

    const notes: string[] = [];
    if (chunks.length > 1 && added > 0) notes.push(t.added(added));
    for (const old of replaced) {
      notes.push(t.replaced(slotName(old.slot) ?? t.anotherItem, old.name));
    }
    if (skipped.length > 0) {
      notes.push(t.skipped(skipped.map((name) => quoted(name, lang)).join(", "), skipped.length));
    }
    setNotice(notes.length > 0 ? notes.join(" ") : null);

    if (failures.length > 0) {
      const lead =
        chunks.length === 1
          ? t.notAnItem
          : t.someFailed(failures.length, chunks.length);
      setError(chunks.length === 1 && failures[0] !== t.notAnItemShort ? failures[0] : `${lead} ${t.howToCopy}`);
    }
    setBusy(false);
  };

  const readPob = async () => {
    const text = pasted.trim();
    if (!text) {
      setError(t.pastePob);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await readPobCodeInBrowser(text);
      if (result.ok) {
        if (import.meta.env.PROD) sendUseBeacon("codigo-pob");
        setPobProfile(result.profile);
        setUseExpediente(false);
        setChecked(true);
      } else {
        setError(explainImportError(result.code, result.detail, lang));
      }
    } finally {
      setBusy(false);
    }
  };

  const removePiece = (target: Item) => {
    onItemsChange(items.filter((item) => item !== target));
    setNotice(null);
  };

  const pieceCount = items.filter((item) => GUIDE_SLOT_IDS.has(item.slot)).length;
  const worst = lines?.find((line) => line.tone !== "ok") ?? null;

  return (
    <section
      className="rounded-xl border-2 border-primary/40 bg-card p-4 sm:p-5"
      aria-labelledby="guia-comprobar-titulo"
      data-testid="guia-comprobar"
    >
      <h2 id="guia-comprobar-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <UserCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title(targets.nextAct)}
      </h2>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t.howGroup}>
        <Button
          type="button"
          size="sm"
          variant={mode === "items" && !useExpediente ? "secondary" : "outline"}
          aria-pressed={mode === "items" && !useExpediente}
          onClick={() => switchMode("items")}
          data-testid="guia-modo-objetos"
        >
          {t.pasteItems}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "pob" && !useExpediente ? "secondary" : "outline"}
          aria-pressed={mode === "pob" && !useExpediente}
          onClick={() => switchMode("pob")}
          data-testid="guia-modo-pob"
        >
          {t.pobCode}
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
            {t.useProfile(displayProfileValue(profile.name))}
          </Button>
        )}
      </div>

      {!useExpediente && (
        <div className="mt-4">
          <Label htmlFor="guia-pegar" className="text-sm text-muted-foreground">
            {mode === "items"
              ? t.itemsHelp
              : t.pobHelp}
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
            placeholder={mode === "items" ? t.itemsPlaceholder : "eNrtfWl3…"}
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
              {mode === "items" ? t.addPieces : t.readCode}
            </Button>
            {mode === "pob" && pobProfile && (
              <span className="text-xs text-muted-foreground">
                {t.readPob(pobProfile.name, pobProfile.items.length)}
              </span>
            )}
          </div>
        </div>
      )}

      {mode === "items" && !useExpediente && items.length > 0 && (
        <ul className="mt-4 space-y-1.5" aria-label={t.pastedPieces} data-testid="guia-piezas">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm"
            >
              <CheckCircle2 className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">
                  {(slotName(item.slot) ?? t.other).replace(/^./, (c) => c.toUpperCase())} ·{" "}
                </span>
                {item.name} · <span className="text-muted-foreground">{pieceSummary(item, t)}</span>
              </span>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label={t.remove(item.name)}
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
            {t.pieceCount(pieceCount, GUIDE_SLOTS.length)}
          </span>
          <Button
            type="button"
            onClick={() => {
              if (items.length === 0) {
                setError(t.addOne);
                return;
              }
              setChecked(true);
            }}
            data-testid="guia-comprobar-boton"
          >
            {t.check}
          </Button>
        </div>
      )}

      {lines && (
        <div className="mt-4 border-t border-border pt-4" data-testid="guia-resultado" aria-live="polite">
          <h3 className="text-sm font-semibold text-foreground">{t.result}</h3>
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
              {t.itemsOnly}
            </p>
          )}
          {mode === "pob" && !useExpediente && (
            <p className="mt-3 text-xs text-muted-foreground">
              {t.pobNote}
            </p>
          )}
          {worst && onAskMentor && useExpediente && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              onClick={() => onAskMentor(t.askMentorQuestion(actLabel, worst.text))}
              data-testid="guia-preguntar-mentor"
            >
              <MessageCircleQuestion className="size-4" aria-hidden="true" />
              {t.askMentor}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
