import { Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthResponse } from "@shared/api.js";
import { formatDateTime } from "@/lib/format";

interface AppHeaderProps {
  health: HealthResponse | null;
  loading: boolean;
}

export function AppHeader({ health, loading }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-card/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-5">
        <div className="flex items-center gap-3">
          <Swords className="size-7 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight text-primary">
            Exile Copilot
          </h1>
        </div>
        {loading ? (
          <Skeleton className="h-5 w-24" />
        ) : health ? (
          <Badge
            variant="outline"
            className="border-primary/50 bg-primary/10 text-primary"
            title={`Datos actualizados: ${formatDateTime(health.dataUpdatedAt)}`}
          >
            Parche {health.patch}
          </Badge>
        ) : (
          <Badge variant="destructive">API sin conexión</Badge>
        )}
        <p className="w-full text-sm text-muted-foreground">
          Importa tu build, indica tu presupuesto y recibe las próximas mejoras
          ordenadas por impacto, coste y riesgo.
        </p>
      </div>
    </header>
  );
}
