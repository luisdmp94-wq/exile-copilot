import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MAX_ITEM_TEXT_CHARACTERS, type MetaResponse } from "@shared/api.js";
import {
  PLACEHOLDER_CHARACTER_LEVEL,
  readCharacterLevel,
  type Attributes,
  type CharacterProfile,
  type Item,
  type Resistances,
  type SkillSetup,
} from "@shared/domain.js";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ImportPanel } from "@/components/ImportPanel";
import { ItemEditor } from "@/components/ItemEditor";
import type { CharacterState } from "@/hooks/useCharacter";
import type { EditorDrafts } from "@/hooks/useEditorDrafts";
import { texts, useLang, useText } from "@/i18n/lang";
import { displayProfileValue, storeProfileValue } from "@/lib/format";

interface CharacterSectionProps {
  character: CharacterState;
  meta: MetaResponse | null;
  activePatch: string;
  /**
   * Borradores locales del editor. Los guarda `App` para que cerrar y volver a
   * abrir el panel lateral no borre nada de lo escrito.
   */
  drafts: EditorDrafts;
  /**
   * Presentación: true cuando OTRA superficie (la bienvenida) ya ofrece la
   * importación y el ejemplo. Con ello esta sección no repite ni el vacío
   * «Todavía no hay personaje» ni su botón «Cargar ejemplo». No cambia ninguna
   * lógica de personaje: solo qué se pinta sin personaje.
   */
  hideEmptyState: boolean;
  editorMode?: "full" | "import" | "new" | "item" | "memory";
  initialFocus?: "import" | "character" | "item" | null;
  /** Notifica una persistencia real para actualizar el mentor contextual. */
  onProfileSaved?: (profile: CharacterProfile) => void;
  /** Continúa directamente al banco de Crafting con el objeto recién leído. */
  onItemImported?: (item: Item) => void;
  /** Cierra el alta y abre el expediente cuando PoB produjo un personaje. */
  onProfileImported?: () => void;
  /** Convierte el alta en editor sin cerrar el panel cuando faltan datos observables. */
  onIncompleteProfileImported?: () => void;
  /** Cierra el editor cuando el expediente se aparta para empezar de nuevo. */
  onStartOver?: () => void;
  /** Lleva un `.build` a su lugar correcto: Plan y mercado. */
  onGoToTargetImport?: () => void;
}

const TEXT = texts(
  {
    titleItem: "Analizar un objeto",
    titleNew: "Crear personaje",
    titleImport: "Añadir personaje",
    titleMemory: "Guardar personaje",
    titleFull: "Mi personaje",
    origin: {
      empty: "Sin personaje",
      demo: "Ejemplo cargado",
      imported: "Importado",
      manual: "Creado aquí",
    },
    warningsCount: (count: number) => `${count} aviso(s)`,
    unsavedChanges: "Cambios sin guardar",
    startOver: "Cambiar o empezar de nuevo",
    loadDemo: "Cargar ejemplo",
    importWarnings: "Avisos de la importación",
    restoring: "Restaurando tu último personaje…",
    emptyTitle: "Todavía no hay personaje",
    emptyDescription:
      "Importa un archivo .build arriba o carga el ejemplo de Mercenario con ballesta para explorar la aplicación.",
    memoryTitle: "Activa la memoria para continuar",
    memoryLead: (name: string) =>
      `Guardaremos «${name}» y después abriremos la comprobación que acabas de elegir. No tienes que volver a rellenar el personaje.`,
    saveAndContinue: "Guardar y continuar",
    itemTextLabel: "Analizar objeto copiado del juego (Ctrl+Alt+C sobre el objeto en PoE2)",
    itemTextPlaceholder: "Clase de objeto: Ballestas\nRareza: Raro\nNúcleo de fénix\nBallesta barnizada\n…",
    analyzeItem: "Analizar objeto",
    saveCorrections: "Guardar correcciones",
    slotTakenTitle: "Ese hueco ya está ocupado",
    slotTakenLead: "no se añadirá ni sustituirá nada hasta que elijas qué hacer.",
    replaceItem: (name: string) => `Sustituir ${name}`,
    keepBoth: "Conservar ambos · guardar como extra",
    cancelAndReview: "Cancelar y revisar",
    // Editor del expediente
    name: "Nombre",
    characterClass: "Clase",
    ascendancy: "Ascendencia (nombre visible)",
    ascendancyPlaceholder: "Desconocida",
    ascendancyId: "ID de ascendencia (oficial, opcional)",
    ascendancyIdPlaceholder: "p. ej. Warrior1",
    ascendancyIdHelp: "Solo si lo conoces; se exporta como id oficial en el archivo .build.",
    archetype: "Arquetipo (opcional)",
    archetypePlaceholder: "p. ej. mercenario con ballesta",
    level: "Nivel",
    unknown: "Desconocido",
    league: "Liga",
    pickLeague: "Elige una liga",
    patch: "Parche",
    pickPatch: "Elige un parche",
    attributesLegend: "Atributos",
    attributesHelp: "Deja el campo vacío si no lo sabes: «desconocido» no es lo mismo que 0.",
    attributes: { str: "Fuerza", dex: "Destreza", int: "Inteligencia" },
    resistancesLegend: "Resistencias (%)",
    resistances: { fire: "Fuego", cold: "Hielo", lightning: "Rayo", chaos: "Caos" },
    defensesLegend: "Defensas",
    defenses: {
      life: "Vida",
      energyShield: "Escudo de energía",
      evasion: "Evasión",
      armour: "Armadura",
    },
    itemsLegend: (count: number) => `Objetos (${count})`,
    noItems: "Sin objetos. Analiza un objeto copiado del juego con el panel de abajo.",
    skillsLegend: (count: number) => `Habilidades (${count})`,
    mainSkill: "Habilidad principal",
    unverifiedId: "id no verificado",
    supports: "Soportes (separados por comas)",
    supportUnverified: (name: string) => `${name}: id no verificado`,
    removeSkill: (name: string) => `Eliminar habilidad ${name || "sin nombre"}`,
    addSkill: "Añadir habilidad",
    passivesLegend: (count: number) => `Pasivas asignadas (${count})`,
    noPassives: "Sin pasivas. Añade nodos del árbol por nombre o por id oficial.",
    passive: (position: number) => `Pasiva ${position}`,
    officialId: "id oficial",
    unverifiedName: "nombre sin verificar",
    removePassive: (label: string | number) => `Eliminar pasiva ${label}`,
    addPassive: "Añadir pasiva",
  },
  {
    titleItem: "Analyse an item",
    titleNew: "Create character",
    titleImport: "Add character",
    titleMemory: "Save character",
    titleFull: "My character",
    origin: {
      empty: "No character",
      demo: "Example loaded",
      imported: "Imported",
      manual: "Created here",
    },
    warningsCount: (count: number) => (count === 1 ? "1 warning" : `${count} warnings`),
    unsavedChanges: "Unsaved changes",
    startOver: "Change or start over",
    loadDemo: "Load example",
    importWarnings: "Import warnings",
    restoring: "Restoring your last character…",
    emptyTitle: "No character yet",
    emptyDescription:
      "Import a .build file above or load the crossbow Mercenary example to explore the app.",
    memoryTitle: "Turn on memory to continue",
    memoryLead: (name: string) =>
      `We'll save “${name}” and then open the check you just picked. You don't have to fill in the character again.`,
    saveAndContinue: "Save and continue",
    itemTextLabel: "Analyse an item copied from the game (Ctrl+Alt+C over the item in PoE2)",
    itemTextPlaceholder: "Item Class: Crossbows\nRarity: Rare\nPhoenix Core\nVarnished Crossbow\n…",
    analyzeItem: "Analyze item",
    saveCorrections: "Save changes",
    slotTakenTitle: "That slot is already taken",
    slotTakenLead: "won't be added and won't replace anything until you choose what to do.",
    replaceItem: (name: string) => `Replace ${name}`,
    keepBoth: "Keep both · save as extra",
    cancelAndReview: "Cancel and review",
    // Character editor
    name: "Name",
    characterClass: "Class",
    ascendancy: "Ascendancy (display name)",
    ascendancyPlaceholder: "Unknown",
    ascendancyId: "Ascendancy ID (official, optional)",
    ascendancyIdPlaceholder: "e.g. Warrior1",
    ascendancyIdHelp: "Only if you know it; it's exported as the official id in the .build file.",
    archetype: "Archetype (optional)",
    archetypePlaceholder: "e.g. crossbow Mercenary",
    level: "Level",
    unknown: "Unknown",
    league: "League",
    pickLeague: "Pick a league",
    patch: "Patch",
    pickPatch: "Pick a patch",
    attributesLegend: "Attributes",
    attributesHelp: "Leave the field empty if you don't know it: “unknown” is not the same as 0.",
    attributes: { str: "Strength", dex: "Dexterity", int: "Intelligence" },
    resistancesLegend: "Resistances (%)",
    resistances: { fire: "Fire", cold: "Cold", lightning: "Lightning", chaos: "Chaos" },
    defensesLegend: "Defences",
    defenses: {
      life: "Life",
      energyShield: "Energy Shield",
      evasion: "Evasion",
      armour: "Armour",
    },
    itemsLegend: (count: number) => `Items (${count})`,
    noItems: "No items. Analyse an item copied from the game with the panel below.",
    skillsLegend: (count: number) => `Skills (${count})`,
    mainSkill: "Main skill",
    unverifiedId: "unverified id",
    supports: "Supports (comma-separated)",
    supportUnverified: (name: string) => `${name}: unverified id`,
    removeSkill: (name: string) => `Remove skill ${name || "without a name"}`,
    addSkill: "Add skill",
    passivesLegend: (count: number) => `Allocated passives (${count})`,
    noPassives: "No passives. Add tree nodes by name or by official id.",
    passive: (position: number) => `Passive ${position}`,
    officialId: "official id",
    unverifiedName: "unverified name",
    removePassive: (label: string | number) => `Remove passive ${label}`,
    addPassive: "Add passive",
  },
);

const RESISTANCE_KEYS: (keyof Resistances)[] = ["fire", "cold", "lightning", "chaos"];

const ATTRIBUTE_KEYS: (keyof Attributes)[] = ["str", "dex", "int"];

const DEFENSE_KEYS: ("life" | "energyShield" | "evasion" | "armour")[] = [
  "life",
  "energyShield",
  "evasion",
  "armour",
];

/** number | null: "" → null (desconocido); nunca mostrar null como 0. */
function nullableToInput(value: number | null | undefined): string | number {
  return value ?? "";
}

function inputToNullable(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function inputToOptional(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const ORIGIN_BADGE_CLASSES = {
  empty: "border-border text-muted-foreground",
  demo: "border-primary/50 bg-primary/10 text-primary",
  imported: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  manual: "border-sky-500/40 bg-sky-500/15 text-sky-300",
} as const;

export function CharacterSection({
  character,
  meta,
  activePatch,
  drafts,
  hideEmptyState,
  editorMode = "full",
  initialFocus = null,
  onProfileSaved,
  onItemImported,
  onProfileImported,
  onIncompleteProfileImported,
  onStartOver,
  onGoToTargetImport,
}: CharacterSectionProps) {
  const t = useText(TEXT);
  const { profile, warnings, origin, busy, restoring, dirty } = character;
  const { itemText, setItemText } = drafts;

  const originBadge = { label: t.origin[origin], className: ORIGIN_BADGE_CLASSES[origin] };

  useEffect(() => {
    const id =
      initialFocus === "import"
        ? "panel-importacion"
        : initialFocus === "character"
          ? "char-name"
          : initialFocus === "item"
            ? "item-text"
            : null;
    if (id === null) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocus]);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">
              {editorMode === "item"
                ? t.titleItem
                : editorMode === "new"
                  ? t.titleNew
                  : editorMode === "import"
                    ? t.titleImport
                    : editorMode === "memory"
                      ? t.titleMemory
                  : t.titleFull}
            </CardTitle>
            {editorMode !== "item" && (
              <Badge variant="outline" className={originBadge.className}>
                {originBadge.label}
              </Badge>
            )}
            {warnings.length > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/15 text-amber-300"
              >
                {t.warningsCount(warnings.length)}
              </Badge>
            )}
            {dirty && (
              <Badge variant="outline" className="text-muted-foreground">
                {t.unsavedChanges}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile && editorMode !== "memory" && editorMode !== "item" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  character.reset();
                  onStartOver?.();
                }}
                disabled={busy !== null}
                className="text-muted-foreground"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {t.startOver}
              </Button>
            )}
            {!hideEmptyState && editorMode !== "memory" && editorMode !== "item" && (
              <Button
                type="button"
                onClick={() => void character.loadDemo()}
                disabled={busy !== null || restoring}
              >
                {busy === "demo" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {t.loadDemo}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {editorMode === "import" && (
          <ImportPanel
            busy={busy === "build"}
            kind="character"
            onImport={async (content) => {
              const outcome = await character.importBuild(content, activePatch, "character");
              if (outcome === "profile-ready") onProfileImported?.();
              if (outcome === "profile-incomplete") onIncompleteProfileImported?.();
              return outcome;
            }}
            pasted={drafts.pastedBuild}
            onPastedChange={drafts.setPastedBuild}
            onGoToTarget={onGoToTargetImport}
          />
        )}

        {warnings.length > 0 && (
          <Alert
            data-testid="import-warnings"
            className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300"
          >
            <AlertTitle>{t.importWarnings}</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc">
                {warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {restoring || (busy === "demo" && !profile) ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            {restoring && (
              <p className="text-sm text-muted-foreground">
                {t.restoring}
              </p>
            )}
          </div>
        ) : !profile ? (
          hideEmptyState ? null : (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>{t.emptyTitle}</EmptyTitle>
                <EmptyDescription>
                  {t.emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  onClick={() => void character.loadDemo()}
                  disabled={busy !== null}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  {t.loadDemo}
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : editorMode === "memory" && profile ? (
          <div className="flex flex-col gap-4 rounded-md border border-primary/35 bg-primary/5 p-4">
            <div className="space-y-1">
              <p className="font-medium text-foreground">{t.memoryTitle}</p>
              <p className="text-sm text-muted-foreground">
                {t.memoryLead(displayProfileValue(profile.name))}
              </p>
            </div>
            <Button
              type="button"
              data-testid="guardar-y-continuar"
              className="w-fit"
              onClick={() => {
                void character.saveCorrections().then((savedProfile) => {
                  if (savedProfile) onProfileSaved?.(savedProfile);
                });
              }}
              disabled={busy !== null}
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {t.saveAndContinue}
            </Button>
          </div>
        ) : editorMode !== "item" && editorMode !== "import" ? (
          // El paperdoll ya NO vive aquí: es la vista de solo lectura del
          // expediente. Esta sección es exclusivamente el editor completo.
          <ProfileEditor
            profile={profile}
            meta={meta}
            onUpdate={character.updateProfile}
            onMutate={character.mutateProfile}
            supportsDrafts={drafts.supports}
            setSupportsDrafts={drafts.setSupports}
          />
        ) : null}

        {!restoring && editorMode !== "new" && editorMode !== "import" && editorMode !== "memory" && (profile || editorMode === "item") && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4">
            <Label htmlFor="item-text">
              {t.itemTextLabel}
            </Label>
            <Textarea
              id="item-text"
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              rows={5}
              maxLength={MAX_ITEM_TEXT_CHARACTERS}
              disabled={busy !== null}
              placeholder={t.itemTextPlaceholder}
              className="font-mono text-xs"
            />
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null || !itemText.trim()}
                onClick={() => {
                  void character.importItemText(itemText, activePatch, {
                    persistImmediately: editorMode === "item",
                  }).then((item) => {
                    if (item === null) return;
                    setItemText("");
                    onItemImported?.(item);
                  });
                }}
              >
                {busy === "item" ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ScanSearch className="size-4" aria-hidden="true" />
                )}
                {t.analyzeItem}
              </Button>
            </div>
          </div>
        )}

        {profile && !restoring && editorMode !== "item" && editorMode !== "import" && editorMode !== "memory" && (
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="guardar-correcciones"
              onClick={() => {
                void character.saveCorrections().then((savedProfile) => {
                  if (savedProfile) onProfileSaved?.(savedProfile);
                });
              }}
              disabled={busy !== null || !dirty}
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {t.saveCorrections}
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
    <AlertDialog
      open={character.pendingItemImport !== null}
      onOpenChange={(open) => {
        if (!open) character.cancelPendingItemImport();
      }}
    >
      <AlertDialogContent data-testid="item-slot-collision-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t.slotTakenTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="text-foreground">
              {character.pendingItemImport?.item.name}
            </strong>{" "}
            {t.slotTakenLead}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          {character.pendingItemImport?.candidates.map((candidate) => (
            <Button
              key={candidate.id}
              type="button"
              disabled={busy !== null}
              onClick={() => {
                void character.resolvePendingItemImport({
                  mode: "replace",
                  targetItemId: candidate.id,
                }).then((item) => {
                  if (!item) return;
                  setItemText("");
                  onItemImported?.(item);
                });
              }}
            >
              {t.replaceItem(candidate.name)}
            </Button>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={busy !== null}
            onClick={() => {
              void character.resolvePendingItemImport({ mode: "extra" }).then((item) => {
                if (!item) return;
                setItemText("");
                onItemImported?.(item);
              });
            }}
          >
            {t.keepBoth}
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{t.cancelAndReview}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}

interface ProfileEditorProps {
  profile: CharacterProfile;
  meta: MetaResponse | null;
  onUpdate: (patch: Partial<CharacterProfile>) => void;
  onMutate: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  /** Borrador de supports en edición; lo guarda `App` (ver `useEditorDrafts`). */
  supportsDrafts: Record<string, string>;
  setSupportsDrafts: Dispatch<SetStateAction<Record<string, string>>>;
}

function ProfileEditor({
  profile,
  meta,
  onUpdate,
  onMutate,
  supportsDrafts,
  setSupportsDrafts,
}: ProfileEditorProps) {
  const t = useText(TEXT);
  const { lang } = useLang();
  const levelReading = readCharacterLevel(profile);

  const addSkill = () => {
    const skill: SkillSetup = {
      id: `skill-${Date.now()}`,
      label: "",
      mainSkill: "",
      mainSkillGemId: null,
      supports: [],
    };
    onUpdate({ skills: [...profile.skills, skill] });
  };

  const updateSkill = (id: string, patch: Partial<SkillSetup>) => {
    onUpdate({
      skills: profile.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-name">{t.name}</Label>
          <Input
            id="char-name"
            value={displayProfileValue(profile.name)}
            onChange={(e) => onUpdate({ name: storeProfileValue(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-class">{t.characterClass}</Label>
          <Input
            id="char-class"
            value={displayProfileValue(profile.characterClass)}
            onChange={(e) => onUpdate({ characterClass: storeProfileValue(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-ascendancy">{t.ascendancy}</Label>
          <Input
            id="char-ascendancy"
            value={profile.ascendancy ?? ""}
            placeholder={t.ascendancyPlaceholder}
            onChange={(e) => onUpdate({ ascendancy: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-ascendancy-id">{t.ascendancyId}</Label>
          <Input
            id="char-ascendancy-id"
            value={profile.ascendancyId ?? ""}
            placeholder={t.ascendancyIdPlaceholder}
            aria-describedby="char-ascendancy-id-help"
            onChange={(e) => onUpdate({ ascendancyId: e.target.value || null })}
            className="font-mono text-xs"
          />
          <p id="char-ascendancy-id-help" className="text-xs text-muted-foreground">
            {t.ascendancyIdHelp}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-archetype">{t.archetype}</Label>
          <Input
            id="char-archetype"
            value={profile.archetype ?? ""}
            placeholder={t.archetypePlaceholder}
            onChange={(e) => onUpdate({ archetype: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-level">{t.level}</Label>
          <Input
            id="char-level"
            type="number"
            min={1}
            max={100}
            value={levelReading.known ? levelReading.level : ""}
            placeholder={t.unknown}
            onChange={(e) => {
              const parsed = inputToNullable(e.target.value);
              if (parsed === null) {
                // Vaciar el campo no es evidencia de nivel: vuelve al mínimo
                // técnico y Crafting sigue tratándolo como desconocido.
                onUpdate({ level: PLACEHOLDER_CHARACTER_LEVEL, levelSource: "placeholder" });
                return;
              }
              onUpdate({
                level: Math.min(100, Math.max(1, parsed)),
                levelSource: "observed",
              });
            }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-league">{t.league}</Label>
          {meta && meta.leagues.length > 0 ? (
            <Select
              value={meta.leagues.includes(profile.league) ? profile.league : ""}
              onValueChange={(value) => onUpdate({ league: value })}
            >
              <SelectTrigger id="char-league">
                <SelectValue placeholder={displayProfileValue(profile.league) || t.pickLeague} />
              </SelectTrigger>
              <SelectContent>
                {meta.leagues.map((league) => (
                  <SelectItem key={league} value={league}>
                    {league}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="char-league"
              value={displayProfileValue(profile.league)}
              onChange={(e) => onUpdate({ league: storeProfileValue(e.target.value) })}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-patch">{t.patch}</Label>
          {meta && meta.patches.length > 0 ? (
            <Select
              value={meta.patches.some((p) => p.id === profile.patch) ? profile.patch : ""}
              onValueChange={(value) => onUpdate({ patch: value })}
            >
              <SelectTrigger id="char-patch">
                <SelectValue placeholder={displayProfileValue(profile.patch) || t.pickPatch} />
              </SelectTrigger>
              <SelectContent>
                {meta.patches.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    disabled={p.status === "announced" && p.id !== profile.patch}
                  >
                    {lang === "en" ? (p.labelEn ?? p.label) : p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="char-patch"
              value={profile.patch}
              onChange={(e) => onUpdate({ patch: e.target.value })}
            />
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t.attributesLegend}</legend>
        <p className="text-xs text-muted-foreground">
          {t.attributesHelp}
        </p>
        <div className="grid grid-cols-3 gap-3">
          {ATTRIBUTE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`attr-${key}`}>{t.attributes[key]}</Label>
              <Input
                id={`attr-${key}`}
                type="number"
                min={0}
                value={nullableToInput(profile.attributes[key])}
                placeholder={t.unknown}
                onChange={(e) => {
                  const parsed = inputToNullable(e.target.value);
                  onUpdate({
                    attributes: {
                      ...profile.attributes,
                      [key]: parsed === null ? null : Math.max(0, parsed),
                    },
                  });
                }}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t.resistancesLegend}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESISTANCE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`res-${key}`}>{t.resistances[key]}</Label>
              <Input
                id={`res-${key}`}
                type="number"
                value={nullableToInput(profile.resistances[key])}
                placeholder={t.unknown}
                onChange={(e) =>
                  onUpdate({
                    resistances: {
                      ...profile.resistances,
                      [key]: inputToNullable(e.target.value),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t.defensesLegend}</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEFENSE_KEYS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`def-${key}`}>{t.defenses[key]}</Label>
              <Input
                id={`def-${key}`}
                type="number"
                min={0}
                value={nullableToInput(profile[key])}
                placeholder={t.unknown}
                onChange={(e) => onUpdate({ [key]: inputToOptional(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {t.itemsLegend(profile.items.length)}
        </legend>
        {profile.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.noItems}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {profile.items.map((item, index) => (
              <ItemEditor
                key={item.id}
                item={item}
                index={index}
                onChange={(updated) =>
                  onMutate((p) => ({
                    ...p,
                    items: p.items.map((it) => (it.id === item.id ? updated : it)),
                  }))
                }
                onRemove={() =>
                  onMutate((p) => ({
                    ...p,
                    items: p.items.filter((it) => it.id !== item.id),
                  }))
                }
              />
            ))}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {t.skillsLegend(profile.skills.length)}
        </legend>
        {profile.skills.map((skill) => (
          <div
            key={skill.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`skill-main-${skill.id}`}>{t.mainSkill}</Label>
                  <Input
                    id={`skill-main-${skill.id}`}
                    value={skill.mainSkill}
                    onChange={(e) =>
                      updateSkill(skill.id, {
                        mainSkill: e.target.value,
                        label: e.target.value,
                      })
                    }
                  />
                  {skill.mainSkillGemId === null && (
                    <Badge
                      variant="outline"
                      className="w-fit border-amber-500/40 bg-amber-500/10 text-amber-300"
                    >
                      {t.unverifiedId}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`skill-supports-${skill.id}`}>
                    {t.supports}
                  </Label>
                  <Input
                    id={`skill-supports-${skill.id}`}
                    value={
                      supportsDrafts[skill.id] ??
                      skill.supports.map((s) => s.name).join(", ")
                    }
                    onChange={(e) =>
                      setSupportsDrafts((prev) => ({
                        ...prev,
                        [skill.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const draft = supportsDrafts[skill.id];
                      if (draft !== undefined) {
                        const names = draft
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0);
                        updateSkill(skill.id, {
                          supports: names.map((name) => {
                            const existing = skill.supports.find(
                              (s) => s.name === name,
                            );
                            return { name, gemId: existing?.gemId ?? null };
                          }),
                        });
                        setSupportsDrafts((prev) => {
                          const next = { ...prev };
                          delete next[skill.id];
                          return next;
                        });
                      }
                    }}
                  />
                  {skill.supports.some((s) => s.gemId === null) && (
                    <div className="flex flex-wrap gap-1">
                      {skill.supports
                        .filter((s) => s.gemId === null)
                        .map((s) => (
                          <Badge
                            key={s.name}
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-300"
                          >
                            {t.supportUnverified(s.name)}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t.removeSkill(skill.mainSkill)}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  onMutate((p) => ({
                    ...p,
                    skills: p.skills.filter((s) => s.id !== skill.id),
                  }))
                }
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" variant="outline" size="sm" onClick={addSkill}>
            <Plus className="size-4" aria-hidden="true" />
            {t.addSkill}
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          {t.passivesLegend(profile.passives.allocated.length)}
        </legend>
        {profile.passives.allocated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.noPassives}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.passives.allocated.map((node, index) => (
              <div key={`${node.ref}-${index}`} className="flex items-center gap-2">
                <Input
                  value={node.ref}
                  aria-label={t.passive(index + 1)}
                  onChange={(e) =>
                    onMutate((p) => ({
                      ...p,
                      passives: {
                        allocated: p.passives.allocated.map((n, i) =>
                          i === index ? { ...n, ref: e.target.value } : n,
                        ),
                      },
                    }))
                  }
                  className="font-mono text-xs"
                />
                {node.isOfficialId ? (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                  >
                    {t.officialId}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-300"
                  >
                    {t.unverifiedName}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.removePassive(node.ref || index + 1)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    onMutate((p) => ({
                      ...p,
                      passives: {
                        allocated: p.passives.allocated.filter((_, i) => i !== index),
                      },
                    }))
                  }
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onMutate((p) => ({
                ...p,
                passives: {
                  allocated: [
                    ...p.passives.allocated,
                    { ref: "", isOfficialId: false },
                  ],
                },
              }))
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            {t.addPassive}
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
