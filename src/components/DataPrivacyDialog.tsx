import { useState } from "react";
import { Bot, Database, KeyRound, Loader2, RotateCcw, Trash2 } from "lucide-react";
import {
  DELETE_VISITOR_DATA_CONFIRMATION,
  type HealthResponse,
} from "@shared/api.js";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { api, getErrorMessage } from "@/lib/api";
import { clearExileCopilotLocalData } from "@/lib/privacy";

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
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteAllData = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteVisitorData({
        confirmation: DELETE_VISITOR_DATA_CONFIRMATION,
      });
      clearExileCopilotLocalData(window.localStorage);
      // El servidor invalida también la cookie. Recargar elimina todo el estado
      // en memoria y abre una sesión anónima nueva, sin expediente anterior.
      window.location.reload();
    } catch (error) {
      setDeleteError(getErrorMessage(error));
      setDeleting(false);
    }
  };

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
              En el servidor: personaje, objetos, decisiones y sesiones. En este
              navegador: progreso de Academia y proyectos de Crafting. Otro visitante
              no puede abrir tu expediente.
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

        <section className="rounded-lg border border-destructive/35 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">Borrar todos mis datos</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Elimina de forma irreversible tus expedientes, objetos, diario, memoria,
                sesiones y proyectos de Crafting. Después empezarás con una sesión nueva.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    className="mt-3"
                    disabled={deleting}
                    data-testid="privacidad-borrar-abrir"
                  >
                    Borrar mis datos
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="privacidad-borrar-confirmacion">
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Borrar todo definitivamente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      No podrás recuperar los personajes apartados ni sus decisiones. Los
                      datos de otros visitantes no se tocarán.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  {deleteError && (
                    <p
                      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                      role="alert"
                      data-testid="privacidad-borrar-error"
                    >
                      {deleteError}
                    </p>
                  )}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Conservar mis datos</AlertDialogCancel>
                    <AlertDialogAction asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleting}
                        data-testid="privacidad-borrar-confirmar"
                        onClick={(event) => {
                          event.preventDefault();
                          void deleteAllData();
                        }}
                      >
                        {deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                        Sí, borrar todo
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">
          La aplicación no modifica Path of Exile 2 ni publica automáticamente tu
          personaje. No ofrece cuentas ni sincronización entre dispositivos.
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
