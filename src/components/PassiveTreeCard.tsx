import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Check, Copy, MapPin, Network, ShieldPlus } from "lucide-react";
import type { CharacterProfile } from "@shared/domain.js";
import { GGG_AFFILIATION_NOTICE, GGG_AFFILIATION_NOTICE_ES } from "@shared/passiveRegistry.js";
import {
  treeRequestFromProfile,
  type PassiveTreeAdviceResponse,
} from "@shared/passiveTreeRequest.js";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { texts, useLang, useText } from "@/i18n/lang";
import type { MapSuggestion } from "@/components/PassiveTreeMap";

const PassiveTreeMap = lazy(() => import("@/components/PassiveTreeMap"));

type Suggestion = PassiveTreeAdviceResponse["offence"][number];

const TEXT = texts(
  {
    title: "Tu árbol de pasivas",
    emptyLead: "Pega tu código de Path of Building 2 y te digo tus próximos notables, con el camino dibujado en el árbol del juego.",
    emptyHow: "En Path of Building 2: Importar/Exportar → Generar → Copiar.",
    pasteCode: "Pegar mi código de PoB2",
    loading: "Leyendo tu árbol…",
    failed: "No he podido leer tu árbol ahora. Prueba otra vez en un momento.",
    retry: "Reintentar",
    summary: (taken: number, version: string) => `Tienes ${taken} pasivas en el árbol ${version}.`,
    forSkills: (skills: string) => `Lo que más ayuda a ${skills}, en el orden en que se coge:`,
    noSkill: "Tengo tu árbol, pero no sé qué habilidad usas para hacer daño. Dímela y te digo qué notables le sirven.",
    setSkill: "Decir mi habilidad",
    nothing: "No veo ningún notable cerca que ayude a lo que usas. Mira el árbol: lo tienes dibujado abajo.",
    points: (points: number, first: boolean) => `${first ? "" : "+"}${points} ${points === 1 ? "punto" : "puntos"}`,
    gives: "Da",
    why: "Por qué",
    onTheWay: (count: number) => `Lo que coges por el camino (${count} ${count === 1 ? "nodo" : "nodos"})`,
    search: "En el juego, escribe el nombre en «Busca aquí» del árbol y te lo marca.",
    copy: "Copiar el nombre",
    copied: "Copiado",
    show: "Ver en el árbol",
    defenceTitle: "Si mueres mucho",
    defenceLead: (points: number) => `${points} ${points === 1 ? "punto" : "puntos"} desde tu árbol de hoy.`,
    mismatch: (code: string, tree: string) =>
      `Tu código es del árbol ${code} y la web usa el ${tree}: algún nodo puede no casar. Vuelve a exportarlo desde Path of Building 2 actualizado.`,
    unknown: (count: number) => `${count} ${count === 1 ? "nodo de tu código no está" : "nodos de tu código no están"} en este árbol.`,
    rules: "Lo eligen reglas con el árbol oficial y tus habilidades, sin IA. Tú decides.",
    source: (version: string) => `Árbol oficial de Grinding Gear Games (${version}); nombres en español de poe2db.`,
    notice: GGG_AFFILIATION_NOTICE_ES,
  },
  {
    title: "Your passive tree",
    emptyLead: "Paste your Path of Building 2 code and I'll show your next notables, with the path drawn on the game's tree.",
    emptyHow: "In Path of Building 2: Import/Export → Generate → Copy.",
    pasteCode: "Paste my PoB2 code",
    loading: "Reading your tree…",
    failed: "I couldn't read your tree right now. Try again in a moment.",
    retry: "Try again",
    summary: (taken: number, version: string) => `You have ${taken} passives on the ${version} tree.`,
    forSkills: (skills: string) => `What helps ${skills} most, in the order you take it:`,
    noSkill: "I have your tree, but I don't know which skill does your damage. Tell me and I'll show which notables help it.",
    setSkill: "Tell you my skill",
    nothing: "I don't see any nearby notable that helps what you use. Look at the tree below.",
    points: (points: number, first: boolean) => `${first ? "" : "+"}${points} ${points === 1 ? "point" : "points"}`,
    gives: "Gives",
    why: "Why",
    onTheWay: (count: number) => `What you take on the way (${count} ${count === 1 ? "node" : "nodes"})`,
    search: "In the game, type the name in the tree's search box and it gets highlighted.",
    copy: "Copy the name",
    copied: "Copied",
    show: "Show on the tree",
    defenceTitle: "If you die a lot",
    defenceLead: (points: number) => `${points} ${points === 1 ? "point" : "points"} from your tree today.`,
    mismatch: (code: string, tree: string) =>
      `Your code is from tree ${code} and the site uses ${tree}: some nodes may not match. Export it again from an updated Path of Building 2.`,
    unknown: (count: number) => `${count} ${count === 1 ? "node from your code isn't" : "nodes from your code aren't"} on this tree.`,
    rules: "Picked by rules with the official tree and your skills, no AI. You decide.",
    source: (version: string) => `Official tree by Grinding Gear Games (${version}); Spanish names from poe2db.`,
    notice: GGG_AFFILIATION_NOTICE,
  },
);

interface PassiveTreeCardProps {
  /** El personaje que ven el motor y el Mentor (con la revisión rápida). */
  profile: CharacterProfile;
  /** Abre el editor en «Rellénalo rápido» → código de PoB2. */
  onPasteCode: () => void;
  /** Abre la revisión rápida para decir la habilidad principal. */
  onSetSkill: () => void;
}

function joinNames(names: string[], lang: "es" | "en"): string {
  const list = names.slice(0, 2);
  if (list.length <= 1) return list[0] ?? "";
  return `${list[0]} ${lang === "es" ? "y" : "and"} ${list[1]}`;
}

function CopyName({ name }: { name: string }) {
  const t = useText(TEXT);
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(name)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => undefined);
      }}
      aria-label={`${t.copy}: ${name}`}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied ? t.copied : t.copy}
    </Button>
  );
}

function Step({
  step,
  label,
  first,
  onShow,
}: {
  step: Suggestion;
  label: string;
  first: boolean;
  onShow: () => void;
}) {
  const t = useText(TEXT);
  const wayCount = step.onTheWay.reduce((total, group) => total + group.count, 0);
  return (
    <li className="rounded-lg border border-border bg-background/40 p-3" data-testid="arbol-paso">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-base font-semibold text-foreground">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-emerald-400 text-xs font-bold text-emerald-950">
            {label}
          </span>
          {step.name}
        </p>
        <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-xs tabular-nums text-emerald-200">
          {t.points(step.points, first)}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">
        <span className="font-semibold">{t.gives}:</span> {step.stats.join(" · ")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground/90">{t.why}:</span> {step.reasons.join(" ")}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onShow} data-testid="arbol-ver-nodo">
          <MapPin className="size-3.5" aria-hidden="true" />
          {t.show}
        </Button>
        <CopyName name={step.search} />
      </div>
      {wayCount > 0 && (
        <details className="mt-2 text-xs text-muted-foreground" data-testid="arbol-camino">
          <summary className="cursor-pointer select-none hover:text-foreground">{t.onTheWay(wayCount)}</summary>
          <ul className="mt-1 space-y-0.5 pl-4">
            {step.onTheWay.map((group) => (
              <li key={group.text} className="list-disc">
                {group.count > 1 ? `${group.count} × ` : ""}
                {group.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/**
 * «Tu árbol de pasivas»: con el código de PoB2 del jugador, los próximos
 * notables (reglas, sin IA) y el árbol oficial dibujado con su camino.
 */
export function PassiveTreeCard({ profile, onPasteCode, onSetSkill }: PassiveTreeCardProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const request = useMemo(() => treeRequestFromProfile(profile, lang), [profile, lang]);
  const requestKey = JSON.stringify(request);
  const hasTree = request.passives.length > 0;
  const [answer, setAnswer] = useState<{ key: string; data: PassiveTreeAdviceResponse } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [focus, setFocus] = useState<{ key: string | null; nonce: number }>({ key: null, nonce: 0 });

  useEffect(() => {
    if (!hasTree) return;
    let cancelled = false;
    api
      .passiveTreeAdvice(JSON.parse(requestKey) as typeof request)
      .then((data) => {
        if (!cancelled) setAnswer({ key: requestKey, data });
      })
      .catch(() => {
        if (!cancelled) setFailedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
    // `request` se lee a través de su clave: así no se pide dos veces lo mismo.
  }, [requestKey, hasTree, attempt]);

  const data = answer?.key === requestKey ? answer.data : null;
  const suggestions: MapSuggestion[] = useMemo(() => {
    if (!data) return [];
    const list = data.offence.map((step, index) => ({ key: step.key, path: step.path, label: String(index + 1) }));
    if (data.defence) list.push({ key: data.defence.key, path: data.defence.path, label: lang === "es" ? "Defensa" : "Defence" });
    return list;
  }, [data, lang]);

  const show = (key: string) => {
    setFocus((current) => ({ key, nonce: current.nonce + 1 }));
    document.getElementById("arbol-pasivas-mapa")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <section
      id="arbol-pasivas"
      className="rounded-xl border border-border bg-card p-4 sm:p-5"
      aria-labelledby="arbol-pasivas-titulo"
      data-testid="arbol-pasivas"
    >
      <h2 id="arbol-pasivas-titulo" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <Network className="size-5 shrink-0 text-primary" aria-hidden="true" />
        {t.title}
      </h2>

      {!hasTree ? (
        <div className="mt-2 flex flex-col items-start gap-2" data-testid="arbol-vacio">
          <p className="text-sm leading-relaxed text-muted-foreground">{t.emptyLead}</p>
          <p className="text-xs text-muted-foreground">{t.emptyHow}</p>
          <Button type="button" size="sm" onClick={onPasteCode} data-testid="arbol-pegar-codigo">
            {t.pasteCode}
          </Button>
        </div>
      ) : failedKey === requestKey ? (
        <div className="mt-2 flex flex-col items-start gap-2">
          <p className="text-sm text-muted-foreground" role="status">
            {t.failed}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setFailedKey(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t.retry}
          </Button>
        </div>
      ) : data === null ? (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {t.loading}
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {t.summary(data.allocated.length, data.tree.version)}{" "}
            {data.unknownCount > 0 && data.versionMismatch === null ? t.unknown(data.unknownCount) : null}
          </p>
          {data.versionMismatch && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 p-2.5 text-sm text-amber-100" data-testid="arbol-version">
              {t.mismatch(data.versionMismatch.code, data.versionMismatch.tree)}
            </p>
          )}

          {data.skills.length === 0 ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-muted-foreground">{t.noSkill}</p>
              <Button type="button" variant="outline" size="sm" onClick={onSetSkill}>
                {t.setSkill}
              </Button>
            </div>
          ) : data.offence.length === 0 && data.defence === null ? (
            <p className="text-sm text-muted-foreground">{t.nothing}</p>
          ) : (
            <>
              {data.offence.length > 0 && (
                <>
                  <p className="text-sm text-foreground/90">{t.forSkills(joinNames(data.skills, lang))}</p>
                  <p className="text-xs text-muted-foreground">{t.search}</p>
                  <ol className="flex flex-col gap-2">
                    {data.offence.map((step, index) => (
                      <Step key={step.key} step={step} label={String(index + 1)} first={index === 0} onShow={() => show(step.key)} />
                    ))}
                  </ol>
                </>
              )}
              {data.defence && (
                <div data-testid="arbol-defensa">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <ShieldPlus className="size-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    {t.defenceTitle}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.defenceLead(data.defence.points)}</p>
                  <ol className="mt-2">
                    <Step step={data.defence} label="D" first onShow={() => show(data.defence!.key)} />
                  </ol>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t.rules}</p>
            </>
          )}

          <div id="arbol-pasivas-mapa">
            <Suspense
              fallback={
                <div className="h-[360px] rounded-lg border border-border bg-[#07080b] sm:h-[440px]" aria-hidden="true" />
              }
            >
              <PassiveTreeMap
                characterClass={profile.characterClass || null}
                allocated={data.allocated}
                suggestions={suggestions}
                focusKey={focus.key}
                focusNonce={focus.nonce}
              />
            </Suspense>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground/80">
            {t.source(data.tree.version)} {t.notice}
          </p>
        </div>
      )}
    </section>
  );
}
