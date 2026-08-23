import { ArrowLeft, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthResponse } from "@shared/api.js";
import type { CharacterProfile } from "@shared/domain.js";
import { formatDateTime } from "@/lib/format";

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
  return `Versión del juego según ${source}, a fecha de ${formatDateTime(asOf)}`;
}

/**
 * Cabecera compacta: marca, descripción corta, parche y —si existe— un resumen
 * discreto del personaje. Sin menús sin función.
 */
export function AppHeader({ health, loading, profile, onHome, onBack, canGoBack }: AppHeaderProps) {
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
          Diagnóstico · decisión · memoria
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {profile && (
            <span
              className="border-r border-border/70 pr-3 text-xs text-muted-foreground"
              data-testid="cabecera-personaje"
            >
              <span className="font-medium text-foreground">{profile.name}</span> · nivel{" "}
              {profile.level} · {profile.league}
            </span>
          )}
          {loading ? (
            <Skeleton className="h-5 w-24" />
          ) : health ? (
            <Badge
              variant="outline"
              className="border-primary/50 bg-primary/10 text-primary"
              title={patchTitle(health)}
            >
              Parche {patchLabel(health)}
            </Badge>
          ) : (
            <Badge variant="destructive">API sin conexión</Badge>
          )}
        </div>
      </div>
    </header>
  );
}
