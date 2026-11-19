import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { OWNER_KEY_STORAGE, StatsResponseSchema, returningVisitors, type StatsDay } from "@shared/visitStats";
import { FeedbackEntrySchema, type FeedbackEntry } from "@shared/feedback";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KEY_STORAGE = OWNER_KEY_STORAGE;
const returningOf = (day: StatsDay) => returningVisitors(day);

const SOURCE_LABELS: Record<string, string> = {
  directo: "Directo",
  reddit: "Reddit",
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord",
  tiktok: "TikTok",
  x: "X",
  steam: "Steam",
  foro: "Foro oficial",
  buscador: "Buscadores",
  otro: "Otros",
};

const USE_LABELS: Record<string, string> = {
  gema: "Gema de asistencia",
  "reparto-gemas": "Reparto de gemas",
  "pieza-leida": "Piezas pegadas",
  mentor: "Preguntas al Mentor",
  "personaje-guardado": "Personajes guardados",
  "captura-leida": "Capturas leídas",
};

const AREA_LABELS: Record<string, string> = {
  expediente: "Personaje y mentor",
  plan: "Plan y mercado",
  crafting: "Crafting",
  guias: "Guías",
};

/** Por cada origen de los últimos 7 días: visitantes, qué áreas abren y qué usan. */
function bySourceWeek(days: StatsDay[]): Array<{
  source: string;
  visitors: number;
  areas: Array<[string, number]>;
  uses: Array<[string, number]>;
}> {
  const sources = new Set(days.flatMap((day) => Object.keys(day.bySource)));
  return [...sources]
    .map((source) => ({
      source,
      visitors: sum(days, (day) => day.bySource[source]?.visitors ?? 0),
      areas: sumRecord(days, (day) => day.bySource[source]?.areas ?? {}),
      uses: sumRecord(days, (day) => day.bySource[source]?.uses ?? {}),
    }))
    .filter((row) => row.visitors > 0 || row.areas.length > 0 || row.uses.length > 0)
    .sort((a, b) => b.visitors - a.visitors);
}

function SourceRows({ rows, labels }: { rows: Array<[string, number]>; labels: Record<string, string> }) {
  if (rows.length === 0) return <span className="text-muted-foreground">nada</span>;
  return (
    <>
      {rows.map(([label, count], index) => (
        <span key={label}>
          {index > 0 && " · "}
          {labels[label] ?? label} <span className="font-semibold tabular-nums text-foreground">{count}</span>
        </span>
      ))}
    </>
  );
}

function readKey(): string {
  try {
    return window.localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function sum(days: StatsDay[], pick: (day: StatsDay) => number): number {
  return days.reduce((total, day) => total + pick(day), 0);
}

function sumRecord(days: StatsDay[], pick: (day: StatsDay) => Record<string, number>): Array<[string, number]> {
  const totals = new Map<string, number>();
  for (const day of days) for (const [label, count] of Object.entries(pick(day))) totals.set(label, (totals.get(label) ?? 0) + count);
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

function Breakdown({ title, rows, labels }: { title: string; rows: Array<[string, number]>; labels: Record<string, string> }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nada todavía.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.map(([label, count]) => (
            <li key={label} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{labels[label] ?? label}</span>
              <span className="font-semibold tabular-nums text-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Cifras del contador anónimo. Solo las ve quien tenga la clave del servidor
 * (`STATS_TOKEN`); se queda guardada en este navegador para no repetirla.
 */
export function StatsPage() {
  const [key, setKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const [days, setDays] = useState<StatsDay[] | null>(null);
  const [reports, setReports] = useState<FeedbackEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (token: string) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/stats", { headers: { Authorization: `Bearer ${token}` }, credentials: "same-origin" });
      if (response.status === 401) throw new Error("Esa clave no es la buena.");
      if (!response.ok) throw new Error("El servidor no tiene activado el contador.");
      setDays(StatsResponseSchema.parse(await response.json()).days);
      // Los avisos de problemas van con la misma clave; si fallan, las cifras siguen.
      try {
        const feedback = await fetch("/api/feedback", { headers: { Authorization: `Bearer ${token}` }, credentials: "same-origin" });
        setReports(
          feedback.ok ? z.object({ reports: z.array(FeedbackEntrySchema) }).parse(await feedback.json()).reports : null,
        );
      } catch {
        setReports(null);
      }
    } catch (err) {
      setDays(null);
      setError(err instanceof Error ? err.message : "No se pudieron leer las cifras.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (key) void load(key);
  }, [key, load]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const token = draft.trim();
    if (!token) return;
    try {
      window.localStorage.setItem(KEY_STORAGE, token);
    } catch {
      // Sin almacenamiento la clave vale para esta visita.
    }
    setDraft("");
    setKey(token);
  };

  const week = days?.slice(0, 7) ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-foreground" data-testid="estadisticas">
      <h1 className="text-2xl font-bold">Visitas de Exile Copilot</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cifras anónimas por día (hora UTC). No se guarda quién entra: solo cuántos, de dónde y qué usan. Tus
        visitas desde este navegador no cuentan mientras tenga guardada la clave.
      </p>

      {!days && (
        <form onSubmit={submit} className="mt-5 flex max-w-md gap-2">
          <Input
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Clave de estadísticas"
            aria-label="Clave de estadísticas"
            autoComplete="off"
          />
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Ver
          </Button>
        </form>
      )}
      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      {days && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Hoy", days[0]?.visitors ?? 0],
              ["Últimos 7 días", sum(week, (day) => day.visitors)],
              ["Nuevos en 7 días", sum(week, (day) => day.newVisitors)],
              ["Han vuelto en 7 días", sum(week, returningOf)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">visitantes</p>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            «Han vuelto» son visitantes que ya habían entrado otro día desde ese navegador. Si alguien vuelve tres
            días, cuenta tres. Para que tus otros navegadores no cuenten, abre en ellos{" "}
            <span className="font-mono text-foreground/90">exilecopilot.com/?nocount=1</span>.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Breakdown title="De dónde vienen (7 días)" rows={sumRecord(week, (day) => day.sources)} labels={SOURCE_LABELS} />
            <Breakdown title="Qué abren (7 días)" rows={sumRecord(week, (day) => day.areas)} labels={AREA_LABELS} />
            <Breakdown title="Qué usan (7 días)" rows={sumRecord(week, (day) => day.uses)} labels={USE_LABELS} />
          </div>

          <section className="mt-3 rounded-xl border border-border bg-card p-4" data-testid="estadisticas-avisos">
            <h2 className="text-sm font-semibold">
              Avisos de problemas {reports ? `(${reports.length})` : ""}
            </h2>
            {reports === null || reports.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nadie ha avisado de nada todavía.</p>
            ) : (
              <ul className="mt-2 space-y-3 text-sm">
                {reports.map((report) => (
                  <li key={report.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="whitespace-pre-line text-foreground">{report.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(report.createdAt).toLocaleString("es-ES")} · {report.lang.toUpperCase()}
                      {report.area ? ` · ${report.area}` : ""}
                      {report.browser ? ` · ${report.browser}` : ""}
                      {report.viewport ? ` · ${report.viewport}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-border bg-card p-4" data-testid="estadisticas-por-origen">
            <h2 className="text-sm font-semibold">Qué hace la gente de cada sitio (7 días)</h2>
            {bySourceWeek(week).length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Nada todavía.</p>
            ) : (
              <ul className="mt-2 space-y-3 text-sm">
                {bySourceWeek(week).map((row) => (
                  <li key={row.source}>
                    <p className="font-semibold text-foreground">
                      {SOURCE_LABELS[row.source] ?? row.source}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {row.visitors} {row.visitors === 1 ? "visitante" : "visitantes"}
                      </span>
                    </p>
                    <p className="text-muted-foreground">
                      Abren: <SourceRows rows={row.areas} labels={AREA_LABELS} />
                    </p>
                    <p className="text-muted-foreground">
                      Usan: <SourceRows rows={row.uses} labels={USE_LABELS} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Día a día (30 días)</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Día</th>
                  <th className="py-1 text-right font-normal">Visitantes</th>
                  <th className="py-1 text-right font-normal">Nuevos</th>
                  <th className="py-1 text-right font-normal">Vuelven</th>
                  <th className="py-1 text-right font-normal">Páginas vistas</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .filter((day) => day.visits > 0 || day.visitors > 0)
                  .map((day) => (
                    <tr key={day.day} className="border-t border-border/60">
                      <td className="py-1">{day.day}</td>
                      <td className="py-1 text-right tabular-nums">{day.visitors}</td>
                      <td className="py-1 text-right tabular-nums">{day.newVisitors}</td>
                      <td className="py-1 text-right tabular-nums">{returningOf(day)}</td>
                      <td className="py-1 text-right tabular-nums">{day.visits}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>

          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => void load(key)} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Actualizar
          </Button>
        </>
      )}
    </main>
  );
}
