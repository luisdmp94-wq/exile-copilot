import {
  ArrowRight,
  Hammer,
  Loader2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomePanelProps {
  /** Lleva el foco al panel de importación (que vive en «Personaje»). */
  onGoToImport: () => void;
  onStartNew: () => void;
  onStartItem: () => void;
  onLoadDemo: () => void;
  loadingDemo: boolean;
}

const INTENCIONES = [
  {
    icon: TrendingUp,
    titulo: "Mejorar mi personaje",
    texto: "Importa lo que ya juegas y recibe una sola prioridad.",
    action: "import" as const,
    cta: "Importar mi personaje",
  },
  {
    icon: UserRoundPlus,
    titulo: "Empezar desde cero",
    texto: "Crea el expediente y completa solo lo que ya sabes.",
    action: "new" as const,
    cta: "Crear personaje",
  },
  {
    icon: Hammer,
    titulo: "Evaluar o craftear",
    texto: "Pega un objeto de PoE2 y entra directamente al banco.",
    action: "item" as const,
    cta: "Pegar un objeto",
  },
] as const;

/**
 * Bienvenida cuando todavía no hay personaje. Sustituye a cinco paneles vacíos
 * por una sola entrada clara: qué hacer primero y qué esperar después.
 */
export function WelcomePanel({
  onGoToImport,
  onStartNew,
  onStartItem,
  onLoadDemo,
  loadingDemo,
}: WelcomePanelProps) {
  const runAction = (action: (typeof INTENCIONES)[number]["action"]) => {
    if (action === "import") onGoToImport();
    else if (action === "new") onStartNew();
    else onStartItem();
  };

  return (
    <section
      className="welcome-stage superficie-accion mb-6 px-6 py-10 sm:px-12 sm:py-14"
      data-testid="bienvenida"
      aria-labelledby="bienvenida-titulo"
    >
      <div className="relative z-10 flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
            Primera consulta
          </p>
          <h2
            id="bienvenida-titulo"
            className="dossier-title max-w-2xl text-4xl font-semibold leading-[1.05] text-foreground sm:text-6xl"
          >
            ¿Qué quieres hacer hoy?
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            Elige una intención. Exile Copilot te llevará directamente al siguiente paso.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-testid="intenciones-iniciales">
          {INTENCIONES.map(({ icon: Icon, titulo, texto, action, cta }) => (
            <button
              key={action}
              type="button"
              onClick={() => runAction(action)}
              data-testid={
                action === "import"
                  ? "bienvenida-importar"
                  : action === "new"
                    ? "bienvenida-nuevo"
                    : "bienvenida-objeto"
              }
              data-intent={action}
              className="group flex min-h-44 flex-col items-start gap-3 rounded-md border border-border/80 bg-background/65 p-5 text-left transition-colors hover:border-primary/60 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
            >
              <span className="grid size-10 place-items-center rounded-full border border-primary/35 bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="font-serif text-xl font-semibold text-foreground">{titulo}</span>
              <span className="text-sm leading-relaxed text-muted-foreground">{texto}</span>
              <span className="mt-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                {action === "import" && <Upload className="size-3.5" aria-hidden="true" />}
                {cta}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          <span className="text-xs text-muted-foreground">¿Solo quieres explorar?</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
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
      </div>
    </section>
  );
}
