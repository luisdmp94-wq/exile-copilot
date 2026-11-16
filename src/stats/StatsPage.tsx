import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { StatsResponseSchema, type StatsDay } from "@shared/visitStats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const KEY_STORAGE = "exile-copilot:clave-estadisticas";

const SOURCE_LABELS: Record<string, string> = {
  directo: "Directo",
  reddit: "Reddit",
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord",
  tiktok: "TikTok",
  x: "X",
  buscador: "Buscadores",
  otro: "Otros",
};

const USE_LABELS: Record<string, string> = {
  gema: "Gema de asistencia",
  "reparto-gemas": "Reparto de gemas",
  "pieza-leida": "Piezas pegadas",
  mentor: "Preguntas al Mentor",
  "personaje-guardado": "Personajes guardados",
};

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
        Cifras anónimas por día (hora UTC). No se guarda quién entra: solo cuántos, de dónde y qué usan.
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
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["Hoy", days[0]?.visitors ?? 0],
              ["Últimos 7 días", sum(week, (day) => day.visitors)],
              ["Nuevos en 7 días", sum(week, (day) => day.newVisitors)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">visitantes</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Breakdown title="De dónde vienen (7 días)" rows={sumRecord(week, (day) => day.sources)} labels={SOURCE_LABELS} />
            <Breakdown title="Qué usan (7 días)" rows={sumRecord(week, (day) => day.uses)} labels={USE_LABELS} />
          </div>

          <section className="mt-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">Día a día (30 días)</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Día</th>
                  <th className="py-1 text-right font-normal">Visitantes</th>
                  <th className="py-1 text-right font-normal">Nuevos</th>
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
