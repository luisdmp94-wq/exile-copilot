import { BookOpen, FileCheck2, X } from "lucide-react";
import type { BuildTargetPlan } from "@shared/gggBuildPlanner.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

export interface TargetDraft {
  name: string;
  sourceUrl: string;
  summary: string;
  desiredModsText: string;
  /** Plan oficial importado de un `.build` de GGG; se conserva crudo. */
  plan: BuildTargetPlan | null;
}

interface TargetSectionProps {
  draft: TargetDraft;
  warnings: string[];
  onChange: (draft: TargetDraft) => void;
}

/** Build objetivo opcional: solo una referencia, nunca verdad absoluta. */
export function TargetSection({ draft, warnings, onChange }: TargetSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-xl">2. Build objetivo (opcional)</CardTitle>
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 text-amber-300"
          >
            Referencia, no verificada
          </Badge>
          {draft.plan && (
            <Badge
              variant="outline"
              className="border-primary/50 bg-primary/10 text-primary"
            >
              <FileCheck2 className="size-3.5" aria-hidden="true" />
              Plan .build oficial importado
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Estos datos SÍ se envían al motor y pueden cambiar tus recomendaciones: el
          nombre, el resumen y los mods deseados orientan las mejoras hacia tu build
          objetivo. El enlace solo se guarda como referencia: no se descarga ni se
          verifica su contenido.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {draft.plan && (
          <Alert className="border-primary/50 bg-primary/10 [&>svg]:text-primary">
            <FileCheck2 className="size-4" aria-hidden="true" />
            <AlertTitle>Plan importado desde un archivo .build oficial</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                Archivo de plan importado como build objetivo — no es tu personaje
                actual. Contiene {draft.plan.build.passives?.length ?? 0} pasiva(s),{" "}
                {draft.plan.build.skills?.length ?? 0} habilidad(es) y{" "}
                {draft.plan.build.inventory_slots?.length ?? 0} hueco(s) de inventario.
                Importado el {formatDateTime(draft.plan.importedAt)}. El plan original
                se conserva íntegro y se reenvía al motor tal cual.
              </span>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onChange({ ...draft, plan: null })}
                >
                  <X className="size-4" aria-hidden="true" />
                  Quitar plan importado
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
            <AlertTitle>Avisos de importación del plan</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-name">Nombre de la build objetivo</Label>
            <Input
              id="target-name"
              value={draft.name}
              onChange={(e) => onChange({ ...draft, name: e.target.value })}
              placeholder="p. ej. Gemling Grenade Mercenary"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-url" className="inline-flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-muted-foreground" aria-hidden="true" />
              Enlace de referencia
            </Label>
            <Input
              id="target-url"
              type="url"
              value={draft.sourceUrl}
              onChange={(e) => onChange({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://mobalytics.gg/poe-2/…"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-summary">Resumen</Label>
          <Textarea
            id="target-summary"
            value={draft.summary}
            onChange={(e) => onChange({ ...draft, summary: e.target.value })}
            rows={2}
            placeholder="¿Qué quieres conseguir con esta build?"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-mods">Mods deseados (uno por línea)</Label>
          <Textarea
            id="target-mods"
            value={draft.desiredModsText}
            onChange={(e) => onChange({ ...draft, desiredModsText: e.target.value })}
            rows={4}
            placeholder={
              "+% de daño físico aumentado\n+ vida máxima\nresistencias de fuego"
            }
            className="font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
