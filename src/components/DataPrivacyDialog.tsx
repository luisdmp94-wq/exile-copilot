import { Bot, Database, KeyRound, RotateCcw } from "lucide-react";
import type { HealthResponse } from "@shared/api.js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface DataPrivacyDialogProps {
  health: HealthResponse | null;
}

function mentorDisclosure(health: HealthResponse | null): string {
  const mentor = health?.services.mentor;
  if (!mentor) {
    return "No se pudo comprobar ahora mismo si la asistencia externa está activa.";
  }
  if (mentor.mode === "rules-only") {
    return "Ahora usa solo las reglas verificables de Exile Copilot. Tus consultas no se envían a un proveedor de IA externo.";
  }
  const provider = mentor.provider === "groq" ? "Groq" : "OpenAI";
  return `Cuando envías una consulta al Mentor, la pregunta y el contexto necesario pueden enviarse a ${provider}. Si el proveedor falla, responden las reglas.`;
}

/** Explicación pública y breve del modelo de datos actual, sin prometer cuentas. */
export function DataPrivacyDialog({ health }: DataPrivacyDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="privacidad-abrir"
        >
          Privacidad y datos
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto border-primary/25 sm:max-w-2xl"
        data-testid="privacidad-dialogo"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Tus datos, sin letra pequeña</DialogTitle>
          <DialogDescription>
            Esto es lo que hace hoy Exile Copilot. No presupone una cuenta ni una
            sincronización que todavía no existen.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border border-border bg-card/50 p-4">
            <KeyRound className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">Sesión anónima</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              No creamos una cuenta. Una cookie privada enlaza este navegador con tu
              expediente y no puede leerla JavaScript.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <Database className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">Qué se guarda</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Solo el personaje, los objetos, decisiones y sesiones que guardas. Otro
              visitante no puede abrir ese expediente.
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <Bot className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">Cómo responde el Mentor</h3>
            <p
              className="mt-1 text-sm leading-relaxed text-muted-foreground"
              data-testid="privacidad-mentor"
            >
              {mentorDisclosure(health)}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <RotateCcw className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">Recuperación actual</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              “Empezar de nuevo” aparta el expediente y permite recuperar el último.
              No hay recuperación entre dispositivos; borrar la cookie rompe ese vínculo.
            </p>
          </section>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          La aplicación no modifica Path of Exile 2 ni publica automáticamente tu
          personaje. Todavía no ofrece cuentas ni borrado definitivo desde la interfaz.
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" data-testid="privacidad-cerrar">
              Entendido
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
