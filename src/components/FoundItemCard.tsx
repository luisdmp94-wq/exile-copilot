import { useMemo, useState } from "react";
import { Check, HelpCircle, Loader2, PackageSearch, X } from "lucide-react";
import type { CharacterProfile, Item } from "@shared/domain.js";
import { weaponInText } from "@shared/skillChoice.js";
import { attributeRiskText, attributeSwapRisks } from "@shared/gearSwap.js";
import { GearMentorAsk } from "@/components/GearMentorAsk";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, api, getErrorMessage } from "@/lib/api";
import { checkRequirements, foundVerdict, isWearable, wornInSlot, type FoundVerdict } from "@/lib/foundItem";
import { looksLikeItemText } from "@/lib/guideCheck";
import {
  COMPARE_STYLES,
  compareItems,
  contextFromProfile,
  profileUsesMinions,
  type CompareStyle,
} from "@/lib/itemCompare";
import { cn } from "@/lib/utils";
import { texts, useLang, useText } from "@/i18n/lang";

// Las mismas llaves que «¿Cuál de estas dos es mejor?»: lo que el jugador
// elige en una tarjeta vale en la otra.
const STYLE_STORAGE_KEY = "exile-copilot:comparar-estilo";
const MINIONS_STORAGE_KEY = "exile-copilot:comparar-esbirros";

const TEXT = texts(
  {
    title: "¿Me sirve lo que he encontrado?",
    lead: "Copia la pieza en el juego con Ctrl+Alt+C y pégala aquí. La comparo con la que llevas puesta.",
    pasteLabel: "Pega aquí la pieza que has encontrado",
    pastePlaceholder: "Pega aquí con Ctrl+V",
    read: "Mirar esta pieza",
    pasteFirst: "Pega primero el texto de la pieza.",
    notGear: (name: string) => `«${name}» no es una pieza de equipo (arma, armadura o joyería).`,
    notAnItem: "Eso no parece un objeto de PoE2. Pon el ratón encima de la pieza, pulsa Ctrl+Alt+C y pega aquí todo el texto.",
    remove: (name: string) => `Quitar ${name}`,
    another: "Mirar otra pieza",
    verdict: {
      blocked: "Todavía no puedes ponértela.",
      empty: (slot: string) => `Sí, póntela: no llevas nada en ${slot}.`,
      emptyRing: "Sí, póntelo: te queda un hueco de anillo libre.",
      // Con un arma de dos manos no cabe nada en la otra: no se afirma sin saberlo.
      emptyOffhand: "No llevas nada en la mano secundaria: póntela si tu arma es de una mano.",
      better: (worn: string) => `Sí, póntela: es mejor que ${worn}.`,
      worse: (worn: string) => `No: quédate con ${worn}.`,
      tie: (worn: string) => `Da igual: está muy pareja con ${worn}. Quédate con la que llevas.`,
    },
    whenYouCan: {
      better: (worn: string) => `Cuando puedas ponértela, será mejor que ${worn}. Guárdala.`,
      worse: (worn: string) => `Y aunque pudieras: ${worn} es mejor.`,
      tie: (worn: string) => `Y aunque pudieras: está muy pareja con ${worn}.`,
    },
    comparedWith: (worn: string, slot: string) => `La he comparado con ${worn}, lo que llevas en ${slot}.`,
    whichRing: "Llevas dos anillos. ¿Con cuál la comparo?",
    seeRows: "Ver la comparación fila a fila",
    yours: "La que llevas",
    found: "La encontrada",
    wasted: "No lo aprovechas con ese estilo:",
    lookedFor: "Lo he mirado para:",
    styleGroup: "Tu estilo de juego",
    styles: { caster: "Hechizos y esbirros", melee: "Cuerpo a cuerpo", ranged: "Arco o ballesta" },
    minions: "Llevo esbirros",
    disclaimer:
      "Comparo solo lo que pone en las dos piezas. No miro tu árbol de pasivas ni tus gemas. El sí o el no sale de reglas fijas, sin IA.",
    slots: {
      weapon: "el arma",
      offhand: "la mano secundaria",
      helmet: "el casco",
      body: "el pecho",
      gloves: "los guantes",
      boots: "las botas",
      belt: "el cinturón",
      amulet: "el amuleto",
      ring1: "ese anillo",
      ring2: "ese anillo",
    } as Record<string, string>,
  },
  {
    title: "Is what I found any good?",
    lead: "Copy the item in game with Ctrl+Alt+C and paste it here. I'll compare it with the one you're wearing.",
    pasteLabel: "Paste the item you found here",
    pastePlaceholder: "Paste here with Ctrl+V",
    read: "Check this item",
    pasteFirst: "Paste the text of the item first.",
    notGear: (name: string) => `“${name}” isn't gear (weapon, armour or jewellery).`,
    notAnItem: "That doesn't look like a PoE2 item. Hover the item, press Ctrl+Alt+C and paste all the text here.",
    remove: (name: string) => `Remove ${name}`,
    another: "Check another item",
    verdict: {
      blocked: "You can't equip it yet.",
      empty: (slot: string) => `Yes, equip it: you have nothing in ${slot}.`,
      emptyRing: "Yes, equip it: you have a free ring slot.",
      emptyOffhand: "You have nothing in your off hand: equip it if your weapon is one-handed.",
      better: (worn: string) => `Yes, equip it: it's better than ${worn}.`,
      worse: (worn: string) => `No: keep ${worn}.`,
      tie: (worn: string) => `Either: it's very close to ${worn}. Keep the one you're wearing.`,
    },
    whenYouCan: {
      better: (worn: string) => `Once you can equip it, it will be better than ${worn}. Keep it.`,
      worse: (worn: string) => `And even if you could: ${worn} is better.`,
      tie: (worn: string) => `And even if you could: it's very close to ${worn}.`,
    },
    comparedWith: (worn: string, slot: string) => `I compared it with ${worn}, what you wear in ${slot}.`,
    whichRing: "You wear two rings. Which one should I compare it with?",
    seeRows: "See the comparison row by row",
    yours: "Yours",
    found: "Found",
    wasted: "Not useful for that play style:",
    lookedFor: "I checked it for:",
    styleGroup: "Your play style",
    styles: { caster: "Spells and minions", melee: "Melee", ranged: "Bow or crossbow" },
    minions: "I use minions",
    disclaimer:
      "I only compare what's written on the two items. I don't look at your passive tree or gems. The yes or no comes from fixed rules, no AI.",
    slots: {
      weapon: "your weapon slot",
      offhand: "your off hand",
      helmet: "your helmet slot",
      body: "your body armour slot",
      gloves: "your gloves slot",
      boots: "your boots slot",
      belt: "your belt slot",
      amulet: "your amulet slot",
      ring1: "that ring slot",
      ring2: "that ring slot",
    } as Record<string, string>,
  },
);

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento la elección vale para esta visita.
  }
}

/** El estilo que dice su arma: un arco es «arco o ballesta» sin preguntarlo. */
function styleFromWeapon(profile: Pick<CharacterProfile, "items">): CompareStyle | null {
  const weapon = profile.items.find((item) => item.slot === "weapon");
  const read = weapon ? weaponInText(`${weapon.name} ${weapon.baseType}`) : null;
  if (!read) return null;
  if (read.caster) return "caster";
  return read.group === "Arco" || read.group === "Ballesta" ? "ranged" : "melee";
}

interface FoundItemCardProps {
  patch: string;
  /** El personaje guardado, con al menos una pieza puesta. */
  profile: CharacterProfile;
}

/**
 * «¿Me sirve lo que he encontrado?»: se pega UNA pieza y la tarjeta contesta
 * sí o no, comparándola con la que el personaje lleva en ese hueco. Respuesta
 * primero; la tabla fila a fila queda plegada.
 */
export function FoundItemCard({ patch, profile }: FoundItemCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<Item | null>(null);
  const [ringId, setRingId] = useState<string | null>(null);
  const [chosenStyle, setChosenStyle] = useState<CompareStyle | null>(() => {
    const stored = readStored(STYLE_STORAGE_KEY);
    return COMPARE_STYLES.some((style) => style.id === stored) ? (stored as CompareStyle) : null;
  });
  const [chosenMinions, setChosenMinions] = useState<boolean | null>(() => {
    const stored = readStored(MINIONS_STORAGE_KEY);
    return stored === "si" ? true : stored === "no" ? false : null;
  });
  // Lo que el jugador pulsa manda; si no ha pulsado nada, lo que dice su arma.
  const style: CompareStyle = chosenStyle ?? styleFromWeapon(profile) ?? "caster";
  const minions = chosenMinions ?? profileUsesMinions(profile);

  const readItem = async (text: string) => {
    if (!text.trim()) {
      setError(t.pasteFirst);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { item } = await api.importItemText({ text, patch });
      if (!isWearable(item)) {
        setDraft(text);
        setError(t.notGear(item.name));
        return;
      }
      setFound(item);
      setRingId(null);
      setDraft("");
    } catch (err) {
      setDraft(text);
      setError(
        err instanceof ApiRequestError && err.message === "texto-de-objeto-no-reconocido"
          ? t.notAnItem
          : getErrorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  };

  const candidates = useMemo(() => (found ? wornInSlot(profile, found) : []), [profile, found]);
  // Con dos anillos no se adivina cuál cambia: lo elige el jugador.
  const worn = candidates.length === 1 ? candidates[0] : (candidates.find((item) => item.id === ringId) ?? null);
  const requirements = useMemo(
    () => (found ? checkRequirements(found, profile, lang) : { blocked: [], unchecked: [] }),
    [found, profile, lang],
  );
  const result = useMemo(() => {
    if (!found || !worn) return null;
    // La puesta ya cuenta en las resistencias del personaje: se descuenta
    // para saber desde dónde parte cada una.
    const context = { ...contextFromProfile(profile, found.slot), equipped: worn };
    return compareItems(worn, found, style, lang, { ...context, minions: style === "caster" && minions });
  }, [found, worn, profile, style, lang, minions]);

  // «Si me quito esto, ¿se me cae otra cosa?»: el atributo que daba la puesta
  // puede ser el que le hace falta a otra pieza que lleva.
  const risks = useMemo(
    () => (found && worn ? attributeSwapRisks(worn, found, profile.items, profile.attributes) : []),
    [found, worn, profile],
  );

  const needsRingChoice = found !== null && candidates.length > 1 && worn === null;
  const verdict: FoundVerdict | null = found && !needsRingChoice ? foundVerdict(requirements, result) : null;
  const slotWords = found ? (t.slots[found.slot] ?? "") : "";
  const wornName = worn?.name ?? "";

  const foundSlot = found?.slot ?? "other";
  const verdictText = (kind: FoundVerdict): string =>
    kind === "blocked"
      ? t.verdict.blocked
      : kind === "empty"
        ? foundSlot === "ring1" || foundSlot === "ring2"
          ? t.verdict.emptyRing
          : foundSlot === "offhand"
            ? t.verdict.emptyOffhand
            : t.verdict.empty(slotWords)
        : t.verdict[kind](wornName);
  const afterBlocked =
    verdict === "blocked" && result
      ? t.whenYouCan[result.winner === "b" ? "better" : result.winner === "a" ? "worse" : "tie"](wornName)
      : null;
  // La mano secundaria vacía depende de su arma: ni sí ni no.
  const conditional = verdict === "tie" || (verdict === "empty" && foundSlot === "offhand");
  const good = !conditional && (verdict === "better" || verdict === "empty");

  return (
    <section
      className="scroll-mt-24 rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="me-sirve-titulo"
      data-testid="me-sirve"
    >
      <h2 id="me-sirve-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <PackageSearch className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.lead}</p>

      <div className="mt-3 min-w-0">
        {found ? (
          <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate" data-testid="me-sirve-pieza">
              {found.name}
            </span>
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
              aria-label={t.remove(found.name)}
              onClick={() => setFound(null)}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <Textarea
              value={draft}
              aria-label={t.pasteLabel}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              onPaste={(event) => {
                // Un objeto copiado del juego se lee al pegarlo, sin botón.
                if (busy) return;
                const text = event.clipboardData.getData("text");
                if (!looksLikeItemText(text)) return;
                event.preventDefault();
                void readItem(text);
              }}
              rows={3}
              className="font-mono text-xs"
              placeholder={t.pastePlaceholder}
              data-testid="me-sirve-texto"
            />
            {draft.trim() !== "" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={busy}
                onClick={() => void readItem(draft)}
                data-testid="me-sirve-leer"
              >
                {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {t.read}
              </Button>
            )}
          </>
        )}
        {error && (
          <p className="mt-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
      </div>

      {needsRingChoice && (
        <div className="mt-3" data-testid="me-sirve-anillos">
          <p className="text-sm text-foreground">{t.whichRing}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidates.map((ring) => (
              <Button key={ring.id} type="button" variant="outline" size="sm" onClick={() => setRingId(ring.id)}>
                {ring.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {found && verdict && (
        <div className="mt-4 border-t border-border pt-4" data-testid="me-sirve-resultado">
          <p
            className={cn(
              "flex items-start gap-2 text-base font-semibold",
              good ? "text-emerald-200" : conditional ? "text-foreground" : "text-amber-200",
            )}
            data-testid="me-sirve-veredicto"
            data-veredicto={verdict}
          >
            {good ? (
              <Check className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : conditional ? (
              <HelpCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            )}
            {verdictText(verdict)}
          </p>

          {requirements.blocked.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-sm text-foreground/90" data-testid="me-sirve-requisitos">
              {requirements.blocked.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {afterBlocked && <p className="mt-2 text-sm text-foreground/90">{afterBlocked}</p>}

          {result && verdict !== "blocked" && (
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-foreground/90">
              {(result.winner === "tie" ? result.reasons.slice(1) : result.reasons).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          {requirements.unchecked.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm text-amber-200">
              {requirements.unchecked.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          {worn && risks.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-amber-200" data-testid="me-sirve-atributos">
              {risks.map((risk) => (
                <li key={`${risk.attribute}:${risk.itemName}`}>{attributeRiskText(risk, worn.name, lang)}</li>
              ))}
            </ul>
          )}

          {result && worn && (
            <>
              <p className="mt-3 text-xs text-muted-foreground">{t.comparedWith(worn.name, slotWords)}</p>
              <details className="mt-2">
                <summary className="cursor-pointer py-1 text-sm text-muted-foreground" data-testid="me-sirve-filas">
                  {t.seeRows}
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="py-1 pr-2 font-normal"> </th>
                      <th className="py-1 pr-2 font-normal">{t.yours}</th>
                      <th className="py-1 font-normal">{t.found}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.id} className="border-t border-border/60 align-top">
                        <th scope="row" className="py-1.5 pr-2 text-left font-normal text-muted-foreground">
                          {row.label}
                        </th>
                        {(["a", "b"] as const).map((side) => (
                          <td
                            key={side}
                            className={cn(
                              "py-1.5 pr-2",
                              row.winner === side ? "font-semibold text-emerald-200" : "text-foreground/70",
                            )}
                          >
                            {row[side]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.wasted.b.length > 0 && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground/80">{t.wasted}</span> {result.wasted.b.join(" · ")}
                  </p>
                )}
              </details>
            </>
          )}

          {result && (
            <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t.styleGroup}>
              <span className="text-sm text-muted-foreground">{t.lookedFor}</span>
              {COMPARE_STYLES.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  size="sm"
                  variant={style === option.id ? "secondary" : "outline"}
                  aria-pressed={style === option.id}
                  onClick={() => {
                    setChosenStyle(option.id);
                    store(STYLE_STORAGE_KEY, option.id);
                  }}
                  data-testid={`me-sirve-estilo-${option.id}`}
                >
                  {t.styles[option.id]}
                </Button>
              ))}
              {style === "caster" && (
                <Button
                  type="button"
                  size="sm"
                  variant={minions ? "secondary" : "outline"}
                  aria-pressed={minions}
                  onClick={() => {
                    setChosenMinions(!minions);
                    store(MINIONS_STORAGE_KEY, !minions ? "si" : "no");
                  }}
                >
                  {t.minions}
                </Button>
              )}
            </div>
          )}

          {/* El Mentor de equipo: preguntas sobre ESTA comparación. Otra pieza, otro estilo: charla nueva. */}
          <GearMentorAsk
            key={`${found.id}:${worn?.id ?? "vacio"}:${style}:${minions ? "esbirros" : "sin"}`}
            profile={profile}
            found={found}
            worn={worn}
            style={style}
            minions={minions}
          />

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setFound(null)} data-testid="me-sirve-otra">
              {t.another}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
