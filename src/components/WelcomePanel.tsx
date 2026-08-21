import { Compass, Loader2, MessageCircleQuestion, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomePanelProps {
  /** Lleva el foco al panel de importación (que vive en «Personaje»). */
  onGoToImport: () => void;
  onLoadDemo: () => void;
  loadingDemo: boolean;
}

const PASOS = [
  {
    icon: Upload,
    titulo: "Importa",
    texto: "Trae tu personaje desde un archivo .build oficial o desde un código PoB.",
  },
  {
    icon: MessageCircleQuestion,
    titulo: "Pregunta",
    texto: "El mentor lee tu personaje y tu diario, y responde con una sola próxima acción.",
  },
  {
    icon: Compass,
    titulo: "Prueba",
    texto: "Anota el resultado en el diario: la siguiente decisión parte de ahí.",
  },
] as const;

/**
 * Bienvenida cuando todavía no hay personaje. Sustituye a cinco paneles vacíos
 * por una sola entrada clara: qué hacer primero y qué esperar después.
 */
export function WelcomePanel({ onGoToImport, onLoadDemo, loadingDemo }: WelcomePanelProps) {
  return (
    <section
      className="superficie-accion mb-6 px-5 py-6 sm:px-8 sm:py-8"
      data-testid="bienvenida"
      aria-labelledby="bienvenida-titulo"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2
            id="bienvenida-titulo"
            className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
          >
            Importa tu personaje
          </h2>
          <p className="text-sm text-muted-foreground">
            El mentor solo habla con datos tuyos. Sin personaje no puede decidir nada, y
            no va a improvisar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="lg" onClick={onGoToImport} data-testid="bienvenida-importar">
            <Upload className="size-4" aria-hidden="true" />
            Importar mi personaje
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onLoadDemo}
            disabled={loadingDemo}
            data-testid="bienvenida-ejemplo"
          >
            {loadingDemo ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            Cargar ejemplo
          </Button>
        </div>

        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PASOS.map(({ icon: Icon, titulo, texto }, index) => (
            <li key={titulo} className="superficie-panel flex flex-col gap-1.5 p-3">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon className="size-4 text-sky-300" aria-hidden="true" />
                {index + 1}. {titulo}
              </span>
              <span className="text-xs text-muted-foreground">{texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
