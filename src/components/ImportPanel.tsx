import { useRef, useState } from "react";
import { FileUp, Loader2, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ImportPanelProps {
  busy: boolean;
  onImport: (content: string) => Promise<void>;
}

/** Importador de archivos .build: por archivo o pegando el contenido. */
export function ImportPanel({ busy, onImport }: ImportPanelProps) {
  const [pasted, setPasted] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
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
      id="panel-importacion"
      tabIndex={-1}
      className="flex flex-col gap-4 rounded-md border border-border bg-muted/40 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="build-file">Archivo .build</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="build-file"
            ref={fileInputRef}
            type="file"
            accept=".build,.json,.txt"
            disabled={busy}
            onChange={(e) => void handleFile(e.target.files?.[0])}
            className="max-w-xs cursor-pointer file:text-foreground"
          />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <FileUp className="size-3.5" aria-hidden="true" />
            Archivo .build oficial (se importa como build objetivo) o código de Path of
            Building (personaje)
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="build-paste">…o pega el contenido aquí</Label>
        <Textarea
          id="build-paste"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder='{"name": "…", "passives": […], …} (Build Planner v1) o código PoB en base64'
          rows={4}
          disabled={busy}
          className="font-mono text-xs"
        />
        <div>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !pasted.trim()}
            onClick={() => void onImport(pasted)}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardPaste className="size-4" aria-hidden="true" />
            )}
            Importar build
          </Button>
        </div>
      </div>
    </div>
  );
}
