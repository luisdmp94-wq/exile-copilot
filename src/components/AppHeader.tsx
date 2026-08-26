import { ArrowLeft, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthResponse } from "@shared/api.js";
import type { CharacterProfile } from "@shared/domain.js";
import { formatCharacterLevel, formatDateTime } from "@/lib/format";

interface AppHeaderProps {
  health: HealthResponse | null;
  loading: boolean;
  /** Resumen discreto del personaje activo; null mientras no haya ninguno. */
  profile: CharacterProfile | null;
  onHome: () => void;
  onBack: () => void;
  canGoBack: boolean;
}

function patchLabel(health: HealthResponse): string {
  const { content, hotfix } = health.patch;
  return hotfix ? `${content}${hotfix}` : content;
}

function patchTitle(health: HealthResponse): string {
  const { asOf, source } = health.patch;
  return `Versión del juego según ${source}, a fecha de ${formatDateTime(asOf)}. ${health.compatibility.summary}`;
}

function coverageLabel(health: HealthResponse): string {
  const state = health.compatibility.status;
  if (state === "covered") return "revisado";
  if (state === "limited") return "parcial";
  return "sin revisar";
}

function mentorRuntime(health: HealthResponse): { label: string; title: string } {
  const mentor = health.services.mentor;
  if (mentor.mode === "ai-assisted") {
    const provider = mentor.provider === "groq" ? "Groq" : "OpenAI";
    return {
      label: "IA asistida",
      title: `El Mentor puede consultar ${provider} cuando tú se lo pides. Las reglas verificables siguen decidiendo y actúan como respaldo.`,
    };
  }
  return {
    label: "Mentor por reglas",
    title: "El Mentor usa únicamente el motor verificable de Exile Copilot; no envía la consulta a un proveedor de IA externo.",
  };
}

/**
 * Cabecera compacta: marca, descripción corta, parche y —si existe— un resumen
 * discreto del personaje. Sin menús sin función.
 */
export function AppHeader({ health, loading, profile, onHome, onBack, canGoBack }: AppHeaderProps) {
  const runtime = health ? mentorRuntime(health) : null;
  return (
    <header className="command-header border-b border-primary/15">
      <div className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 sm:gap-4">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="header-nav-button"
              aria-label="Volver al área anterior"
              title="Volver"
            >
              <ArrowLeft className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onHome}
            className="group flex items-center gap-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Ir al inicio de Exile Copilot"
            title="Volver al expediente"
          >
            <span className="brand-seal" aria-hidden="true">
              <Swords className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-primary/70">
                Archivo del exiliado
              </p>
              <h1 className="dossier-title text-2xl font-semibold leading-none text-foreground">
                Exile Copilot
              </h1>
            </div>
          </button>
        </div>

        <span className="hidden border-l border-border/70 pl-4 text-xs uppercase tracking-[0.14em] text-muted-foreground lg:inline">
          Asistente de combate · IA guiada
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {profile && (
            <span
              className="border-r border-border/70 pr-3 text-xs text-muted-foreground"
              data-testid="cabecera-personaje"
            >
              <span className="font-medium text-foreground">{profile.name}</span> · nivel{" "}
              {formatCharacterLevel(profile)} · {profile.league}
            </span>
          )}
          {!loading && runtime ? (
            <span
              className="hidden items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-500/12 px-2 py-1 text-[11px] text-emerald-100 sm:inline-flex"
              data-testid="mentor-runtime-badge"
              data-mode={health?.services.mentor.mode}
              title={runtime.title}
            >
              <span className="ai-dot" aria-hidden="true" />
              {runtime.label}
            </span>
          ) : null}
          {loading ? (
            <Skeleton className="h-5 w-24" />
          ) : health ? (
            <Badge
              variant="outline"
              data-testid="patch-compatibility-badge"
              data-status={health.compatibility.status}
              className={
                health.compatibility.status === "review-required"
                  ? "border-destructive/60 bg-destructive/10 text-destructive-foreground"
                  : health.compatibility.status === "limited"
                    ? "border-amber-400/50 bg-amber-500/10 text-amber-200"
                    : "border-emerald-400/50 bg-emerald-500/10 text-emerald-100"
              }
              title={patchTitle(health)}
            >
              Datos {patchLabel(health)} · {coverageLabel(health)}
            </Badge>
          ) : (
            <Badge variant="destructive">API sin conexión</Badge>
          )}
        </div>
      </div>
    </header>
  );
}
