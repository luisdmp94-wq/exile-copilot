import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface TargetDraft {
  name: string;
  sourceUrl: string;
  summary: string;
  desiredModsText: string;
}

interface TargetSectionProps {
  draft: TargetDraft;
  onChange: (draft: TargetDraft) => void;
}

/** Build objetivo opcional: solo una referencia, nunca verdad absoluta. */
export function TargetSection({ draft, onChange }: TargetSectionProps) {
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
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
            <Label
              htmlFor="target-url"
              className="inline-flex items-center gap-1.5"
            >
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
            placeholder={"+% de daño físico aumentado\n+ vida máxima\nresistencias de fuego"}
            className="font-mono text-xs"
          />
        </div>
      </CardContent>
    </Card>
  );
}
