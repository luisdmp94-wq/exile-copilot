import { Compass, Loader2, MessageCircleQuestion, ShieldCheck, Sparkles, Upload } from "lucide-react";
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
      className="welcome-stage superficie-accion mb-6 px-6 py-10 sm:px-12 sm:py-14"
      data-testid="bienvenida"
      aria-labelledby="bienvenida-titulo"
    >
      <div className="relative z-10 flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Primera consulta
          </p>
          <h2
            id="bienvenida-titulo"
            className="dossier-title max-w-2xl text-4xl font-semibold leading-[1.05] text-foreground sm:text-6xl"
          >
            Tu build tiene una historia. Empecemos por leerla.
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
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

        <ol className="grid max-w-3xl grid-cols-1 gap-5 border-t border-border/60 pt-7 sm:grid-cols-3">
          {PASOS.map(({ icon: Icon, titulo, texto }, index) => (
            <li key={titulo} className="welcome-step flex flex-col gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                0{index + 1} / {titulo}
              </span>
              <span className="text-xs text-muted-foreground">{texto}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
