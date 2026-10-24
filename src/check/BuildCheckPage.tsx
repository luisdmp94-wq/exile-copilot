import { useState, type FormEvent } from "react";
import { GGG_AFFILIATION_NOTICE } from "@shared/passiveRegistry.js";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiRequestError, getErrorMessage } from "@/lib/api";
import {
  checkPastedCode,
  explainImportError,
  readBuildForCheck,
  type BuildCheckReading,
  type BuildCheckRow,
} from "@/lib/buildCheck";

/**
 * Chequeo de build (relanzamiento). Página aparte en /check: el jugador pega
 * su código de Path of Building 2 y ve lo que hemos leído. Las prioridades
 * llegan en el siguiente bloque; aquí solo se comprueba que la lectura es fiel.
 */

type CheckState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; reading: BuildCheckReading };

function StatGroup({ title, rows }: { title: string; rows: BuildCheckRow[] }) {
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
              {row.value ?? "sin dato"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function BuildCheckPage() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<CheckState>({ status: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = code.trim();
    const problem = checkPastedCode(content);
    if (problem) {
      setState({ status: "error", message: problem });
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
        setState({
          status: "error",
          message:
            "Eso es un plan de build, no un personaje. Pega el código que da Path of Building 2 en Import/Export Build → Generate.",
        });
        return;
      }
      setState({ status: "done", reading: readBuildForCheck(result.profile) });
    } catch (err) {
      const message =
        err instanceof ApiRequestError && err.status !== null && err.status < 500
          ? explainImportError(err.message, err.detail)
          : getErrorMessage(err);
      setState({ status: "error", message });
    }
  };

  const reading = state.status === "done" ? state.reading : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
        <header className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-primary/70">
            Exile Copilot · Path of Exile 2
          </p>
          <h1 className="dossier-title text-3xl font-semibold leading-tight">Chequeo de build</h1>
          <p className="text-sm text-muted-foreground">
            Pega el código de tu personaje de Path of Building 2 y te digo qué he leído.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-3" data-testid="build-check-form">
          <label htmlFor="pob-code" className="text-sm font-medium">
            Código de Path of Building 2
          </label>
          <Textarea
            id="pob-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="En PoB2: Import/Export Build → Generate → Copy, y pégalo aquí"
            className="max-h-48 min-h-28 font-mono text-xs"
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" disabled={state.status === "loading"} className="w-full sm:w-auto">
            {state.status === "loading" ? "Leyendo…" : "Leer mi build"}
          </Button>
        </form>

        {state.status === "error" && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          >
            {state.message}
          </p>
        )}

        {reading && (
          <section
            aria-labelledby="build-check-reading"
            className="space-y-5 rounded-lg border border-border bg-card p-5"
            data-testid="build-check-reading"
          >
            <div className="space-y-1">
              <h2 id="build-check-reading" className="text-lg font-semibold">
                {reading.identity}
              </h2>
              <p className="text-sm text-muted-foreground">
                {reading.mainSkill ? `Primer grupo de habilidades: ${reading.mainSkill}` : "Sin habilidades en el código"}
                {" · "}
                {reading.itemCount} objeto{reading.itemCount === 1 ? "" : "s"} equipado{reading.itemCount === 1 ? "" : "s"}
              </p>
            </div>
            {reading.knownStats === 0 && (
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                El código no trae estadísticas calculadas. Abre la build en PoB2, comprueba que tiene equipo y vuelve a generar el código.
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-3">
              <StatGroup title="Defensa" rows={reading.defences} />
              <StatGroup title="Resistencias" rows={reading.resistances} />
              <StatGroup title="Atributos" rows={reading.attributes} />
            </div>
            <p className="text-xs text-muted-foreground">
              Son los valores que calcula Path of Building. Si alguno no coincide con tu personaje en el juego, dímelo.
            </p>
          </section>
        )}

        <footer className="mt-auto space-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <p>{GGG_AFFILIATION_NOTICE}</p>
          <p>
            <a href="/" className="underline underline-offset-2 hover:text-foreground">
              Abrir la versión anterior de Exile Copilot
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
