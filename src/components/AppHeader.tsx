import { Swords } from "lucide-react";
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
export function AppHeader({ health, loading, profile }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-card/70 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Swords className="size-5 text-primary" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight text-primary">
            Exile Copilot
          </h1>
        </div>

        <span className="hidden text-sm text-muted-foreground sm:inline">
          Tu mentor de PoE2: una sola próxima acción, con evidencia.
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {profile && (
            <span
              className="text-xs text-muted-foreground"
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
