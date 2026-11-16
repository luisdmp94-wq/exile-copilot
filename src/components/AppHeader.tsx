import {
  ArrowLeft,
  Bot,
  ChevronDown,
  Database,
  Swords,
  UserRoundPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExperimentalMusicPlayer } from "@/components/ExperimentalMusicPlayer";
import type { HealthResponse } from "@shared/api.js";
import type { CharacterProfile } from "@shared/domain.js";
import { formatDateTime } from "@/lib/format";
import { texts, useText } from "@/i18n/lang";
import { LangToggle } from "@/i18n/LangToggle";

const TEXT = texts(
  {
    tagline: "Mentor de builds y crafting para Path of Exile 2",
    homeLabel: "Ir al inicio de Exile Copilot",
    homeTitle: "Volver al expediente",
    openMentor: "Abrir Mentor",
    addCharacter: "Añadir personaje",
    mentorShort: "Mentor",
    addShort: "Añadir",
    statusLabel: "Ver estado de datos y servicios",
    offline: "Sin conexión",
    patchData: (patch: string) => `Datos de PoE2 ${patch}`,
    coverage: (label: string) => `Cobertura ${label}.`,
    covered: "revisado",
    limited: "parcial",
    pending: "revisión pendiente",
    aiRuntime: "IA con respaldo verificable",
    rulesRuntime: "Motor verificable",
    patchTitle: (source: string, date: string) => `Versión del juego según ${source}, a fecha de ${date}.`,
    apiDown: "La API no está conectada.",
  },
  {
    tagline: "Build and crafting mentor for Path of Exile 2",
    homeLabel: "Go to the Exile Copilot home page",
    homeTitle: "Back to your character",
    openMentor: "Open Mentor",
    addCharacter: "Add character",
    mentorShort: "Mentor",
    addShort: "Add",
    statusLabel: "See data and service status",
    offline: "Offline",
    patchData: (patch: string) => `PoE2 ${patch} data`,
    coverage: (label: string) => `Coverage: ${label}.`,
    covered: "reviewed",
    limited: "partial",
    pending: "pending review",
    aiRuntime: "AI with a verifiable fallback",
    rulesRuntime: "Verifiable engine",
    patchTitle: (source: string, date: string) => `Game version according to ${source}, as of ${date}.`,
    apiDown: "The API is not connected.",
  },
);
type HeaderText = (typeof TEXT)["es"];

interface AppHeaderProps {
  health: HealthResponse | null;
  loading: boolean;
  profile: CharacterProfile | null;
  onHome: () => void;
  onBack: () => void;
  canGoBack: boolean;
  backLabel: string;
  onAddCharacter: () => void;
  onOpenMentor: () => void;
}

function patchLabel(health: HealthResponse): string {
  const { content, hotfix } = health.patch;
  return hotfix ? `${content}${hotfix}` : content;
}

function patchTitle(health: HealthResponse, t: HeaderText): string {
  const { asOf, source } = health.patch;
  return `${t.patchTitle(source, formatDateTime(asOf))} ${health.compatibility.summary}`;
}

function coverageLabel(health: HealthResponse, t: HeaderText): string {
  const state = health.compatibility.status;
  if (state === "covered") return t.covered;
  if (state === "limited") return t.limited;
  return t.pending;
}

function mentorRuntime(health: HealthResponse, t: HeaderText): string {
  return health.services.mentor.mode === "ai-assisted" ? t.aiRuntime : t.rulesRuntime;
}

/** Primera impresión: producto, personaje activo y una sola acción útil. */
export function AppHeader({
  health,
  loading,
  profile,
  onHome,
  onBack,
  canGoBack,
  backLabel,
  onAddCharacter,
  onOpenMentor,
}: AppHeaderProps) {
  const t = useText(TEXT);
  return (
    <header
      className="command-header sticky top-0 z-40 border-b border-border"
      data-testid="cabecera-principal"
    >
      <div className="mx-auto flex min-h-16 max-w-[92rem] items-center gap-2 px-3 py-2 sm:gap-4 sm:px-6">
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            /* Es una salida de seguridad, no un adorno: también debe existir
               en la vista estrecha del navegador integrado. */
            className="header-nav-button grid size-8 shrink-0 sm:size-9"
            aria-label={backLabel}
            title={backLabel}
            data-testid="cabecera-volver"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}

        {/* La marca puede ENCOGER (min-w-0 + truncate). Antes era `shrink-0` y a
            320 px empujaba la fila 38 px fuera de la pantalla. El nombre del
            producto se lee desde el ancho más pequeño: es lo primero que
            responde «qué es esto». */}
        <button
          type="button"
          onClick={onHome}
          className="group flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none sm:gap-3"
          aria-label={t.homeLabel}
          title={t.homeTitle}
          data-testid="cabecera-inicio"
        >
          <span className="brand-seal size-9 shrink-0 sm:size-10" aria-hidden="true">
            <Swords className="size-4 sm:size-5" />
          </span>
          <h1 className="dossier-title min-w-0 truncate text-base leading-none text-foreground sm:text-lg">
            Exile Copilot
          </h1>
        </button>

        <p className="hidden border-l border-border pl-4 text-sm text-muted-foreground xl:block">
          {t.tagline}
        </p>

        {/* Encoge: cada control lleva su propio `shrink-0`, así que la única
            pieza flexible es la ficha del personaje, que trunca. Fijar el grupo
            entero hacía que un nombre largo desbordara la fila a 768 px. */}
        <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
          {/* Función global y persistente: debe verse nada más entrar y en
              cualquiera de las tres áreas, no confundirse con una pestaña. */}
          <LangToggle />
          <ExperimentalMusicPlayer />

          {/* El nombre y nivel del personaje ya no se repiten aquí: viven en
              la franja del personaje (CharacterStrip), bajo la navegación. */}
          <Button
            type="button"
            size="sm"
            variant={profile ? "outline" : "default"}
            onClick={profile ? onOpenMentor : onAddCharacter}
            data-testid="cabecera-accion-principal"
            aria-label={profile ? t.openMentor : t.addCharacter}
            title={profile ? t.openMentor : t.addCharacter}
            className="shrink-0 px-2 sm:px-3"
          >
            {profile ? <Bot className="size-4 shrink-0" aria-hidden="true" /> : <UserRoundPlus className="size-4 shrink-0" aria-hidden="true" />}
            <span className="hidden md:inline">{profile ? t.openMentor : t.addCharacter}</span>
            {/* Por debajo de 440 px el rótulo cede su sitio al nombre del
                producto: la acción sigue etiquetada por `aria-label` y la
                página ya ofrece el mismo CTA con texto completo. */}
            <span className="hidden min-[440px]:inline md:hidden">{profile ? t.mentorShort : t.addShort}</span>
          </Button>

          <details className="group relative shrink-0" data-testid="cabecera-estado">
            <summary
              className="flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-full border border-border px-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-9 sm:px-2.5 [&::-webkit-details-marker]:hidden"
              aria-label={t.statusLabel}
            >
              {/* Por debajo de `sm` el estado se reduce a su icono: sigue
                  accesible y deja de disputarle sitio al nombre del producto. */}
              <Database className="size-3.5 shrink-0 sm:hidden" aria-hidden="true" />
              {loading ? (
                <Skeleton className="hidden h-4 w-14 sm:block" />
              ) : health ? (
                <span className="hidden whitespace-nowrap sm:inline">
                  <span className="hidden lg:inline">PoE2 </span>
                  {patchLabel(health)}
                </span>
              ) : (
                <span className="hidden whitespace-nowrap sm:inline">{t.offline}</span>
              )}
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>

            <div className="absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-1.5rem))] rounded-md border border-border bg-popover p-4 text-sm shadow-2xl">
              {health ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{t.patchData(patchLabel(health))}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground" title={patchTitle(health, t)}>
                      {t.coverage(coverageLabel(health, t))} {health.compatibility.summary}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="patch-compatibility-badge" data-status={health.compatibility.status}>
                      {coverageLabel(health, t)}
                    </Badge>
                    <Badge variant="outline" data-testid="mentor-runtime-badge" data-mode={health.services.mentor.mode}>
                      {mentorRuntime(health, t)}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-destructive">{t.apiDown}</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
