import { useRef } from "react";
import { ArrowRight, ClipboardPaste, Download, FileUp, HelpCircle, Loader2, Route, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_BUILD_IMPORT_CHARACTERS } from "@shared/api.js";

interface ImportPanelProps {
  busy: boolean;
  onImport: (content: string) => Promise<unknown>;
  pasted: string;
  onPastedChange: (value: string) => void;
  kind?: "character" | "target";
  onGoToTarget?: () => void;
}

/** El destino lo decide la pantalla, no la extensión del archivo. */
export function ImportPanel({
  busy,
  onImport,
  pasted,
  onPastedChange,
  kind = "character",
  onGoToTarget,
}: ImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTarget = kind === "target";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BUILD_IMPORT_CHARACTERS) {
      toast.error("El archivo es demasiado grande (máx. 2 MB)");
      return;
    }
    const content = await file.text();
    if (!content.trim()) {
      toast.error("El archivo está vacío");
      return;
    }
    await onImport(content);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div
      id={isTarget ? "panel-importacion-objetivo" : "panel-importacion"}
      tabIndex={-1}
      data-testid={isTarget ? "importador-build-objetivo" : "importador-personaje"}
      className="flex flex-col gap-4 rounded-md border border-border bg-muted/40 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-primary">
          {isTarget ? <Route className="size-4" aria-hidden="true" /> : <UserRoundPlus className="size-4" aria-hidden="true" />}
        </span>
        <div>
          <p className="font-semibold text-foreground">
            {isTarget ? "Importar una build objetivo" : "Añadir tu personaje actual"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isTarget
              ? "Aquí sí van los archivos .build oficiales: se guardan como destino y nunca sustituyen a tu personaje."
              : "Pega un código de Path of Building 2 para recuperar el equipo y las estadísticas que incluya. Un archivo .build de PoE2 solo crea un borrador parcial."}
          </p>
        </div>
      </div>

      {!isTarget && (
        <details
          className="rounded-md border border-border/70 bg-background/35 px-3 py-2 text-sm"
          data-testid="ayuda-codigo-pob2"
        >
          <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
            <HelpCircle className="size-4 shrink-0 text-primary" aria-hidden="true" />
            ¿Dónde consigo el código de PoB2?
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>En Path of Building 2, crea o abre una build y entra en «Import/Export Build».</li>
            <li>En «Character Import», pulsa «Authorize with Path of Exile» y completa la autorización oficial.</li>
            <li>Elige tu liga y personaje; importa «Passive Tree and Jewels» y después «Items and Skills».</li>
            <li>Comprueba que aparecen tu equipo, nivel y habilidades.</li>
            <li>En «Build Sharing», pulsa «Generate», luego «Copy», y pega aquí el código completo.</li>
          </ol>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            La autorización ocurre entre PoB2 y Path of Exile. Exile Copilot solo recibe el código que tú pegas aquí.
          </p>
          <div className="mt-3 flex flex-col items-start gap-1.5 border-t border-border/55 pt-3">
            <a
              className="inline-flex min-h-9 items-center gap-2 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases/latest/download/PathOfBuildingCommunity-PoE2-Setup.exe"
              target="_blank"
              rel="noreferrer"
              data-testid="descargar-pob2-windows"
            >
              <Download className="size-3.5" aria-hidden="true" />
              Descargar instalador para Windows
            </a>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Descarga directa del instalador oficial más reciente. No necesitas buscarlo dentro de GitHub.
            </p>
            <a
              className="inline-flex min-h-7 items-center gap-1 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/releases"
              target="_blank"
              rel="noreferrer"
              data-testid="versiones-pob2"
            >
              Ver versión portátil y otras descargas en GitHub
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </a>
          </div>
        </details>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={isTarget ? "target-build-file" : "character-build-file"}>
          {isTarget
            ? "Archivo .build para usar como objetivo"
            : "Archivo de texto con un código de Path of Building 2"}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={isTarget ? "target-build-file" : "character-build-file"}
            ref={fileInputRef}
            type="file"
            accept={isTarget ? ".build,.json,.txt" : ".txt"}
            disabled={busy}
            onChange={(event) => void handleFile(event.target.files?.[0])}
            className="max-w-xs cursor-pointer file:text-foreground"
          />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileUp className="size-3.5" aria-hidden="true" />
            {isTarget
              ? "Plan del Build Planner de PoE2"
              : "Recomendado: pega abajo el código generado por PoB2"}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={isTarget ? "target-build-paste" : "character-build-paste"}>
          …o pega el contenido aquí
        </Label>
        <Textarea
          id={isTarget ? "target-build-paste" : "character-build-paste"}
          value={pasted}
          onChange={(event) => onPastedChange(event.target.value)}
          placeholder={isTarget ? '{"name": "…", "passives": […], …}' : "Código generado por Path of Building 2"}
          rows={4}
          maxLength={MAX_BUILD_IMPORT_CHARACTERS}
          disabled={busy}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={isTarget ? "outline" : "default"}
            disabled={busy || !pasted.trim()}
            onClick={() => void onImport(pasted)}
            data-testid={isTarget ? "importar-build-objetivo" : "importar-personaje"}
          >
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ClipboardPaste className="size-4" aria-hidden="true" />}
            {isTarget ? "Usar como build objetivo" : "Leer mi personaje"}
          </Button>
          {!isTarget && onGoToTarget && (
            <Button type="button" variant="ghost" size="sm" onClick={onGoToTarget} data-testid="ir-importar-objetivo">
              Quiero usarlo solo como build objetivo
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
