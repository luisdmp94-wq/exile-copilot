import { useEffect, useState, type FormEvent } from "react";
import type { CharacterProfile } from "@shared/domain.js";
import { GGG_AFFILIATION_NOTICE } from "@shared/passiveRegistry.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError } from "@/lib/api";
import {
  checkPastedCode,
  explainImportError,
  readBuildForCheck,
  type BuildCheckRow,
} from "@/lib/buildCheck";
import {
  checkInputFromProfile,
  findBuildPriorities,
  prioritiesForInput,
  type BuildCheckInput,
  type BuildPriority,
  type PrioritySeverity,
} from "@/lib/buildPriorities";
import {
  clearCheckHistory,
  compareChecks,
  isSameCharacter,
  loadCheckHistory,
  saveCheck,
  snapshotForCheck,
  type CheckSnapshot,
} from "@/lib/checkHistory";
import {
  CHECK_LANGS,
  CHECK_TEXT,
  initialCheckLang,
  type CheckLang,
  type CheckText,
} from "@/lib/checkText";
import { ManualCheckForm } from "./ManualCheckForm";

/**
 * Chequeo de build (relanzamiento). Página aparte en /check: el jugador pega
 * su código de Path of Building 2 (o escribe sus resistencias a mano) y ve qué
 * arreglar primero y, con PoB2, lo que hemos leído para llegar a esa conclusión.
 *
 * El estado guarda los datos, no las frases: al cambiar de idioma se vuelven a
 * redactar el resultado y el error que haya en pantalla.
 */

type CheckMode = "pob" | "manual";

/** El chequeo recién guardado y el anterior con el que se compara (si lo hay). */
interface CheckMemory {
  snapshot: CheckSnapshot;
  previous: CheckSnapshot | null;
}

type CheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: (lang: CheckLang) => string }
  | ({ status: "done"; profile: CharacterProfile } & CheckMemory)
  | ({ status: "done"; input: BuildCheckInput } & CheckMemory);

const LANG_STORAGE_KEY = "exile-copilot.check.lang";

function readStoredLang(): string | null {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeLang(lang: CheckLang) {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Sin almacenamiento (modo privado): el idioma dura lo que la pestaña.
  }
}

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Guarda el chequeo y devuelve el anterior para compararlo. */
function rememberCheck(input: BuildCheckInput, profile: CharacterProfile | null): CheckMemory {
  const storage = browserStorage();
  const previous = loadCheckHistory(storage)[0] ?? null;
  const snapshot = snapshotForCheck(input, prioritiesForInput(input, "es"), profile, new Date());
  saveCheck(storage, snapshot);
  return { snapshot, previous };
}

const CHANGE_MARK = { better: "↑", worse: "↓", info: "·" } as const;
const CHANGE_STYLE = {
  better: "text-emerald-400",
  worse: "text-destructive",
  info: "text-muted-foreground",
} as const;

function HistoryCard({ memory, lang }: { memory: CheckMemory; lang: CheckLang }) {
  const text = CHECK_TEXT[lang];
  const [forgotten, setForgotten] = useState(false);
  const forget = () => {
    clearCheckHistory(browserStorage());
    setForgotten(true);
  };

  let body;
  if (forgotten) {
    body = <p className="text-sm">{text.history.forgotten}</p>;
  } else if (memory.previous === null) {
    body = <p className="text-sm">{text.history.firstCheck}</p>;
  } else if (!isSameCharacter(memory.previous, memory.snapshot)) {
    body = <p className="text-sm">{text.history.otherCharacter}</p>;
  } else {
    const comparison = compareChecks(memory.previous, memory.snapshot, new Date(), lang);
    body = (
      <>
        <p className="text-sm font-medium">{comparison.headline}</p>
        {comparison.changes.length > 0 && (
          <ul className="space-y-0.5 text-sm tabular-nums">
            {comparison.changes.map((change) => (
              <li key={change.text} className="flex gap-2">
                <span aria-hidden="true" className={CHANGE_STYLE[change.direction]}>
                  {CHANGE_MARK[change.direction]}
                </span>
                {change.text}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <section
      aria-labelledby="build-check-history"
      className="space-y-2 rounded-lg border border-border bg-card p-5"
      data-testid="build-check-history"
    >
      <h2
        id="build-check-history"
        className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80"
      >
        {text.history.heading}
      </h2>
      {body}
      <p className="text-xs text-muted-foreground">
        {text.history.storedLocally}
        {!forgotten && (
          <>
            {" "}
            <button
              type="button"
              onClick={forget}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {text.history.forget}
            </button>
          </>
        )}
      </p>
    </section>
  );
}

const SEVERITY_STYLE: Record<PrioritySeverity, string> = {
  alta: "border-destructive/60 bg-destructive/15 text-destructive-foreground",
  media: "border-primary/60 bg-primary/15 text-primary",
  baja: "border-border bg-muted/50 text-muted-foreground",
};

function PriorityList({ priorities, text }: { priorities: BuildPriority[]; text: CheckText }) {
  if (priorities.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-5 py-4 text-sm">{text.priorities.none}</p>
    );
  }
  return (
    <ol className="space-y-3">
      {priorities.map((priority, index) => (
        <li
          key={priority.id}
          className="rounded-lg border border-border bg-card p-5"
          data-testid={`priority-${priority.id}`}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold">
              <span className="mr-2 text-primary">{index + 1}.</span>
              {priority.title}
            </h3>
            <span
              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${SEVERITY_STYLE[priority.severity]}`}
            >
              {text.priorities.severity[priority.severity]}
            </span>
          </div>
          <ul className="mb-2 space-y-0.5 text-sm font-medium tabular-nums">
            {priority.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{priority.why}</p>
        </li>
      ))}
    </ol>
  );
}

function StatGroup({ title, rows, noData }: { title: string; rows: BuildCheckRow[]; noData: string }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
        {title}
      </h3>
      <dl className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className={row.value === null ? "text-muted-foreground/70" : "font-medium tabular-nums"}>
              {row.value ?? noData}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReadingCard({ profile, lang }: { profile: CharacterProfile; lang: CheckLang }) {
  const text = CHECK_TEXT[lang];
  const reading = readBuildForCheck(profile, lang);
  return (
    <section
      aria-labelledby="build-check-reading"
      className="space-y-5 rounded-lg border border-border bg-card p-5"
      data-testid="build-check-reading"
    >
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
          {text.readingView.heading}
        </p>
        <h2 id="build-check-reading" className="text-lg font-semibold">
          {reading.identity}
        </h2>
        <p className="text-sm text-muted-foreground">
          {reading.mainSkill ? text.readingView.firstSkill(reading.mainSkill) : text.readingView.noSkills}
          {" · "}
          {text.readingView.items(reading.itemCount)}
        </p>
      </div>
      {reading.knownStats === 0 && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{text.readingView.noStats}</p>
      )}
      <div className="grid gap-5 sm:grid-cols-3">
        <StatGroup title={text.readingView.defencesTitle} rows={reading.defences} noData={text.noData} />
        <StatGroup title={text.readingView.resistancesTitle} rows={reading.resistances} noData={text.noData} />
        <StatGroup title={text.readingView.attributesTitle} rows={reading.attributes} noData={text.noData} />
      </div>
      <p className="text-xs text-muted-foreground">{text.readingView.pobNote}</p>
    </section>
  );
}

export function BuildCheckPage() {
  const [lang, setLang] = useState<CheckLang>(() =>
    initialCheckLang(window.location.search, readStoredLang(), navigator.languages ?? [navigator.language]),
  );
  const [mode, setMode] = useState<CheckMode>("pob");
  const [code, setCode] = useState("");
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const text = CHECK_TEXT[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const changeLang = (next: CheckLang) => {
    setLang(next);
    storeLang(next);
    // Si se entró con ?lang=, el enlace debe seguir la elección al recargar o compartir.
    const url = new URL(window.location.href);
    if (url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      window.history.replaceState(null, "", url);
    }
  };

  const switchMode = (next: CheckMode) => {
    setMode(next);
    setState({ status: "idle" });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = code.trim();
    if (checkPastedCode(content, lang)) {
      setState({ status: "error", message: (current) => checkPastedCode(content, current) ?? "" });
      return;
    }
    setState({ status: "loading" });
    try {
      const health = await api.health();
      const result = await api.importBuild({
        content,
        patch: health.patch.id,
        intent: "character",
      });
      if (!result.profile) {
        setState({ status: "error", message: (current) => CHECK_TEXT[current].importErrors.isPlan });
        return;
      }
      setState({
        status: "done",
        profile: result.profile,
        ...rememberCheck(checkInputFromProfile(result.profile), result.profile),
      });
    } catch (err) {
      const code =
        err instanceof ApiRequestError && err.status !== null && err.status < 500 ? err.message : null;
      const detail = err instanceof ApiRequestError ? err.detail : undefined;
      setState({
        status: "error",
        message: (current) =>
          code !== null
            ? explainImportError(code, detail, current)
            : CHECK_TEXT[current].importErrors.generic(
                err instanceof ApiRequestError && err.status !== null ? `HTTP ${err.status}` : "red",
              ),
      });
    }
  };

  const priorities =
    state.status !== "done"
      ? null
      : "profile" in state
        ? findBuildPriorities(state.profile, lang)
        : prioritiesForInput(state.input, lang);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
        <header className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/70">
              {text.page.kicker}
            </p>
            <div role="group" aria-label={text.page.languageLabel} className="flex gap-1 text-xs">
              {CHECK_LANGS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  lang={id}
                  aria-pressed={lang === id}
                  onClick={() => changeLang(id)}
                  className={`rounded-md border px-2 py-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    lang === id
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <h1 className="dossier-title text-3xl font-semibold leading-tight">{text.page.title}</h1>
          <p className="text-sm text-muted-foreground">{text.page.intro}</p>
        </header>

        <div
          role="group"
          aria-label={text.page.modeGroup}
          className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          {([
            ["pob", text.page.modePob],
            ["manual", text.page.modeManual],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => switchMode(value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                mode === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "manual" ? (
          <ManualCheckForm
            lang={lang}
            onResult={(input) => setState({ status: "done", input, ...rememberCheck(input, null) })}
            onError={(message) => {
              // El formulario redacta el error en el idioma actual; se conserva tal cual.
              setState({ status: "error", message: () => message });
            }}
          />
        ) : (
          <form onSubmit={submit} className="space-y-3" data-testid="build-check-form">
            <label htmlFor="pob-code" className="text-sm font-medium">
              {text.page.codeLabel}
            </label>
            <Textarea
              id="pob-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={text.page.codePlaceholder}
              className="max-h-48 min-h-28 font-mono text-xs"
              spellCheck={false}
              autoComplete="off"
            />
            <Button type="submit" disabled={state.status === "loading"} className="w-full sm:w-auto">
              {state.status === "loading" ? text.page.reading : text.page.read}
            </Button>
          </form>
        )}

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          >
            {state.message(lang)}
          </p>
        )}

        {priorities && (
          <section aria-labelledby="build-check-priorities" className="space-y-3" data-testid="build-check-priorities">
            <h2 id="build-check-priorities" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/80">
              {text.priorities.heading}
            </h2>
            <PriorityList priorities={priorities} text={text} />
          </section>
        )}

        {state.status === "done" && (
          <HistoryCard key={state.snapshot.checkedAt} memory={state} lang={lang} />
        )}

        {state.status === "done" && "profile" in state && <ReadingCard profile={state.profile} lang={lang} />}

        <footer className="mt-auto space-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <p>{GGG_AFFILIATION_NOTICE}</p>
          <p>
            <a href="/" className="underline underline-offset-2 hover:text-foreground">
              {text.page.previousVersion}
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
