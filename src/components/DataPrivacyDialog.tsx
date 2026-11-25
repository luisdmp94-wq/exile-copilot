import { useState } from "react";
import { Bot, Database, KeyRound, Loader2, Music2, RotateCcw, Trash2 } from "lucide-react";
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
import { texts, useText } from "@/i18n/lang";

const TEXT = texts(
  {
    mentorUnknown: "No se pudo comprobar ahora mismo si la asistencia externa está activa.",
    mentorRules: "Ahora usa solo las reglas verificables de Exile Copilot. Tus consultas no se envían a un proveedor de IA externo.",
    mentorAi: (provider: string) =>
      `Al preguntar se envían a ${provider} tu pregunta, hasta ocho turnos y un resumen de clase, defensas, objetivo, presupuesto, equipo y decisión activa. No se envían tu nombre de personaje, cookie, id de personaje, tooltips completos ni resultados libres del diario. Si falla, responden las reglas. Si pegas una captura en la revisión rápida, la imagen se envía a ${provider} solo para leer los números; no la guardamos (ten en cuenta que en ella puede verse tu nombre de personaje).`,
    open: "Privacidad y datos",
    title: "Tus datos, sin letra pequeña",
    intro: "Esto es lo que hace hoy Exile Copilot. No presupone una cuenta ni una sincronización que todavía no existen.",
    sessionTitle: "Sesión anónima",
    sessionText: "No creamos una cuenta. Una cookie privada enlaza este navegador con tu personaje y no puede leerla JavaScript.",
    storedTitle: "Qué se guarda",
    storedText:
      "En el servidor: tus personajes, objetos, decisiones, sesiones y hasta ocho turnos completos del Mentor ligados a tu sesión anónima y a cada personaje. En este navegador: progreso de Academia y proyectos de Crafting. Otro visitante no puede abrir tus personajes ni sus conversaciones. Además, un contador anónimo suma cuántas visitas hay cada día, de qué sitio llegan (por ejemplo, Reddit) y qué herramientas se usan; no guarda tu IP, tu sesión ni nada que te identifique. Si usas «Avisar de un problema», guardamos tu mensaje y, si los dejas marcados, el navegador, el tamaño de pantalla y el área; se borran a los 90 días. Si el Mentor no sabe contestar una pregunta, guardamos el texto de esa pregunta y el motivo para enseñarle la respuesta; sin tu sesión, tu personaje ni nada que te identifique, y se borra a los 90 días. El enlace «Invítame a un café» abre Ko-fi, una web externa: aquí solo contamos cuántas veces se pulsa.",
    mentorTitle: "Cómo responde el Mentor",
    recoveryTitle: "Recuperación actual",
    recoveryText:
      "Si se pierde la referencia local, la cookie privada permite redescubrir el personaje reciente. Al cambiar, puedes elegir cualquiera de los personajes guardados en esa sesión mediante resúmenes que no incluyen equipo ni notas. No hay recuperación entre dispositivos; borrar la cookie rompe ese vínculo.",
    musicTitle: "Música mediante YouTube",
    musicText:
      "Abrir el reproductor no contacta con terceros. Solo si pulsas “Reproducir con YouTube” se crea el reproductor externo; YouTube puede recibir tu dirección IP y datos técnicos del navegador. Exile Copilot no envía tu personaje ni tu personaje con esa petición.",
    deleteTitle: "Borrar todos mis datos",
    deleteText:
      "Elimina de forma irreversible tus personajes, objetos, diario, memoria, sesiones, conversación guardada del Mentor y proyectos de Crafting. Después empezarás con una sesión nueva.",
    deleteButton: "Borrar mis datos",
    confirmTitle: "¿Borrar todo definitivamente?",
    confirmText: "No podrás recuperar los personajes apartados ni sus decisiones. Los datos de otros visitantes no se tocarán.",
    keep: "Conservar mis datos",
    confirm: "Sí, borrar todo",
    footer: "La aplicación no modifica Path of Exile 2 ni publica automáticamente tu personaje. No ofrece cuentas ni sincronización entre dispositivos.",
    ok: "Entendido",
  },
  {
    mentorUnknown: "We couldn't check right now whether outside AI help is active.",
    mentorRules: "Right now it only uses Exile Copilot's verifiable rules. Your questions are not sent to any outside AI provider.",
    mentorAi: (provider: string) =>
      `When you ask, ${provider} receives your question, up to eight turns and a summary of your class, defences, goal, budget, gear and active decision.\n` +
      `Not sent: your character name, cookie, character id, full tooltips or free-text journal notes.\n` +
      `If ${provider} fails, the rules answer instead.\n` +
      `A screenshot pasted into the quick review goes to ${provider} only to read the numbers. We don't keep it, but your character name may be visible in it.`,
    open: "Privacy and data",
    title: "Your data, no fine print",
    intro: "This is what Exile Copilot does today. It doesn't assume accounts or syncing that don't exist yet.",
    sessionTitle: "Anonymous session",
    sessionText: "We don't create an account. A private cookie links this browser to your characters, and JavaScript can't read it.",
    storedTitle: "What is stored",
    storedText:
      "On the server: your characters, items, decisions, sessions and up to eight full Mentor turns, linked to your anonymous session.\n" +
      "In this browser: Academy progress and Crafting projects.\n" +
      "No other visitor can open your characters or conversations.\n" +
      "An anonymous counter adds up daily visits, the site they come from (for example, Reddit) and the tools used. It doesn't store your IP, your session or anything that identifies you.\n" +
      "If you use “Report a problem”, we keep your message and, if you leave them ticked, your browser, screen size and area. They're deleted after 90 days.\n" +
      "If the Mentor can't answer a question, we keep the text of that question and the reason, so we can teach it the answer. No session, no character, nothing that identifies you, and it's deleted after 90 days.\n" +
      "The “Buy me a coffee” link opens Ko-fi, an outside site: here we only count how many times it's clicked.",
    mentorTitle: "How the Mentor answers",
    recoveryTitle: "Current recovery",
    recoveryText:
      "If this browser loses track of your character, the private cookie can find the most recent one again.\n" +
      "When switching, you pick from summaries of the characters saved in this session; they leave out gear and notes.\n" +
      "There's no recovery across devices, and deleting the cookie breaks the link.",
    musicTitle: "Music through YouTube",
    musicText:
      "Opening the player doesn't contact anyone. Only if you press “Play with YouTube” is the outside player created; YouTube may receive your IP address and technical browser data. Exile Copilot doesn't send your character with that request.",
    deleteTitle: "Delete all my data",
    deleteText:
      "Permanently deletes your characters, items, journal, memory, sessions, saved Mentor conversation and Crafting projects. You'll start again with a new session.",
    deleteButton: "Delete my data",
    confirmTitle: "Delete everything for good?",
    confirmText: "You won't be able to recover set-aside characters or their decisions. Other visitors' data is not touched.",
    keep: "Keep my data",
    confirm: "Yes, delete everything",
    footer: "The app doesn't change Path of Exile 2 or publish your character automatically. It has no accounts and no syncing between devices.",
    ok: "Got it",
  },
);
type PrivacyText = (typeof TEXT)["es"];

interface DataPrivacyDialogProps {
  health: HealthResponse | null;
}

function mentorDisclosure(health: HealthResponse | null, t: PrivacyText): string {
  const mentor = health?.services.mentor;
  if (!mentor) return t.mentorUnknown;
  if (mentor.mode === "rules-only") return t.mentorRules;
  return t.mentorAi(mentor.provider === "groq" ? "Groq" : "OpenAI");
}

/** Explicación pública y breve del modelo de datos actual, sin prometer cuentas. */
export function DataPrivacyDialog({ health }: DataPrivacyDialogProps) {
  const t = useText(TEXT);
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
      clearExileCopilotLocalData(window.sessionStorage);
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
          className="inline-flex min-h-10 items-center underline decoration-border underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
          data-testid="privacidad-abrir"
        >
          {t.open}
        </button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100vh-2rem)] overflow-y-auto border-primary/25 sm:max-w-2xl"
        data-testid="privacidad-dialogo"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.intro}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border border-border bg-card/50 p-4">
            <KeyRound className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{t.sessionTitle}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.sessionText}</p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <Database className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{t.storedTitle}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{t.storedText}</p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <Bot className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{t.mentorTitle}</h3>
            <p
              className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground"
              data-testid="privacidad-mentor"
            >
              {mentorDisclosure(health, t)}
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4">
            <RotateCcw className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{t.recoveryTitle}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{t.recoveryText}</p>
          </section>

          <section className="rounded-lg border border-border bg-card/50 p-4 sm:col-span-2">
            <Music2 className="mb-3 size-5 text-primary" aria-hidden="true" />
            <h3 className="font-semibold text-foreground">{t.musicTitle}</h3>
            <p
              className="mt-1 text-sm leading-relaxed text-muted-foreground"
              data-testid="privacidad-musica"
            >
              {t.musicText}
            </p>
          </section>
        </div>

        <section className="rounded-lg border border-destructive/35 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <Trash2 className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{t.deleteTitle}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.deleteText}</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    className="mt-3"
                    disabled={deleting}
                    data-testid="privacidad-borrar-abrir"
                  >
                    {t.deleteButton}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent data-testid="privacidad-borrar-confirmacion">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{t.confirmText}</AlertDialogDescription>
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
                    <AlertDialogCancel disabled={deleting}>{t.keep}</AlertDialogCancel>
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
                        {t.confirm}
                      </Button>
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {t.footer}
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" data-testid="privacidad-cerrar">
              {t.ok}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
