import type { Dispatch, SetStateAction } from "react";
import {
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ScanSearch,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { MetaResponse } from "@shared/api.js";
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

interface CharacterSectionProps {
  character: CharacterState;
  meta: MetaResponse | null;
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
  editorMode?: "full" | "new" | "item";
  /** Notifica una persistencia real para actualizar el mentor contextual. */
  onProfileSaved?: () => void;
  /** Continúa directamente al banco de Crafting con el objeto recién leído. */
  onItemImported?: (item: Item) => void;
}

const RESISTANCE_FIELDS: { key: keyof Resistances; label: string }[] = [
  { key: "fire", label: "Fuego" },
  { key: "cold", label: "Frío" },
  { key: "lightning", label: "Rayo" },
  { key: "chaos", label: "Caos" },
];

const ATTRIBUTE_FIELDS: { key: keyof Attributes; label: string }[] = [
  { key: "str", label: "Fuerza" },
  { key: "dex", label: "Destreza" },
  { key: "int", label: "Inteligencia" },
];

const DEFENSE_FIELDS: {
  key: "life" | "energyShield" | "evasion" | "armour";
  label: string;
}[] = [
  { key: "life", label: "Vida" },
  { key: "energyShield", label: "Escudo de energía" },
  { key: "evasion", label: "Evasión" },
  { key: "armour", label: "Armadura" },
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

const ORIGIN_BADGES = {
  empty: { label: "Sin personaje", className: "border-border text-muted-foreground" },
  demo: {
    label: "Ejemplo cargado",
    className: "border-primary/50 bg-primary/10 text-primary",
  },
  imported: {
    label: "Importado",
    className: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
  },
  manual: {
    label: "Creado aquí",
    className: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  },
} as const;

export function CharacterSection({
  character,
  meta,
  drafts,
  hideEmptyState,
  editorMode = "full",
  onProfileSaved,
  onItemImported,
}: CharacterSectionProps) {
  const { profile, warnings, origin, busy, restoring, dirty } = character;
  const { itemText, setItemText } = drafts;

  const originBadge = ORIGIN_BADGES[origin];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <CardTitle className="text-xl">
              {editorMode === "item"
                ? "Analizar un objeto"
                : editorMode === "new"
                  ? "Crear personaje"
                  : "Mi personaje"}
            </CardTitle>
            <Badge variant="outline" className={originBadge.className}>
              {originBadge.label}
            </Badge>
            {warnings.length > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/15 text-amber-300"
              >
                {warnings.length} aviso(s)
              </Badge>
            )}
            {dirty && (
              <Badge variant="outline" className="text-muted-foreground">
                Cambios sin guardar
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={character.reset}
                disabled={busy !== null}
                className="text-muted-foreground"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Empezar de nuevo
              </Button>
            )}
            {!hideEmptyState && (
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
                Cargar ejemplo
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {editorMode === "full" && (
          <ImportPanel
            busy={busy === "build"}
            onImport={character.importBuild}
            pasted={drafts.pastedBuild}
            onPastedChange={drafts.setPastedBuild}
          />
        )}

        {warnings.length > 0 && (
          <Alert className="border-amber-500/50 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-300">
            <AlertTitle>Avisos de importación</AlertTitle>
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
                Restaurando tu último personaje…
              </p>
            )}
          </div>
        ) : !profile ? (
          hideEmptyState ? null : (
            <Empty className="border border-dashed border-border">
              <EmptyHeader>
                <EmptyTitle>Todavía no hay personaje</EmptyTitle>
                <EmptyDescription>
                  Importa un archivo .build arriba o carga el ejemplo de Mercenario con
                  ballesta para explorar la aplicación.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  onClick={() => void character.loadDemo()}
                  disabled={busy !== null}
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  Cargar ejemplo
                </Button>
              </EmptyContent>
            </Empty>
          )
        ) : editorMode !== "item" ? (
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

        {!restoring && editorMode !== "new" && (profile || editorMode === "item") && (
          <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4">
            <Label htmlFor="item-text">
              Analizar objeto copiado del juego (Ctrl+Alt+C sobre el objeto en PoE2)
            </Label>
            <Textarea
              id="item-text"
              value={itemText}
              onChange={(e) => setItemText(e.target.value)}
              rows={5}
              disabled={busy !== null}
              placeholder={
                "Clase de objeto: Ballestas\nRareza: Raro\nNúcleo de fénix\nBallesta barnizada\n…"
              }
              className="font-mono text-xs"
            />
            <div>
              <Button
                type="button"
                variant="secondary"
                disabled={busy !== null || !itemText.trim()}
                onClick={() => {
                  void character.importItemText(itemText).then((item) => {
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
                Analizar objeto
              </Button>
            </div>
          </div>
        )}

        {profile && !restoring && editorMode !== "item" && (
          <div className="flex justify-end">
            <Button
              type="button"
              data-testid="guardar-correcciones"
              onClick={() => {
                void character.saveCorrections().then((saved) => {
                  if (saved) onProfileSaved?.();
                });
              }}
              disabled={busy !== null || !dirty}
            >
              {busy === "save" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              Guardar correcciones
            </Button>
          </div>
        )}

      </CardContent>
    </Card>
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
          <Label htmlFor="char-name">Nombre</Label>
          <Input
            id="char-name"
            value={profile.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-class">Clase</Label>
          <Input
            id="char-class"
            value={profile.characterClass}
            onChange={(e) => onUpdate({ characterClass: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-ascendancy">Ascendencia (nombre visible)</Label>
          <Input
            id="char-ascendancy"
            value={profile.ascendancy ?? ""}
            placeholder="Desconocida"
            onChange={(e) => onUpdate({ ascendancy: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-ascendancy-id">ID de ascendencia (oficial, opcional)</Label>
          <Input
            id="char-ascendancy-id"
            value={profile.ascendancyId ?? ""}
            placeholder="p. ej. Warrior1"
            aria-describedby="char-ascendancy-id-help"
            onChange={(e) => onUpdate({ ascendancyId: e.target.value || null })}
            className="font-mono text-xs"
          />
          <p id="char-ascendancy-id-help" className="text-xs text-muted-foreground">
            Solo si lo conoces; se exporta como id oficial en el archivo .build.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-archetype">Arquetipo (opcional)</Label>
          <Input
            id="char-archetype"
            value={profile.archetype ?? ""}
            placeholder="p. ej. mercenario con ballesta"
            onChange={(e) => onUpdate({ archetype: e.target.value || null })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-level">Nivel</Label>
          <Input
            id="char-level"
            type="number"
            min={1}
            max={100}
            value={levelReading.known ? levelReading.level : ""}
            placeholder="Desconocido"
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
          <Label htmlFor="char-league">Liga</Label>
          {meta && meta.leagues.length > 0 ? (
            <Select
              value={meta.leagues.includes(profile.league) ? profile.league : ""}
              onValueChange={(value) => onUpdate({ league: value })}
            >
              <SelectTrigger id="char-league">
                <SelectValue placeholder={profile.league || "Elige una liga"} />
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
              value={profile.league}
              onChange={(e) => onUpdate({ league: e.target.value })}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-patch">Parche</Label>
          {meta && meta.patches.length > 0 ? (
            <Select
              value={meta.patches.some((p) => p.id === profile.patch) ? profile.patch : ""}
              onValueChange={(value) => onUpdate({ patch: value })}
            >
              <SelectTrigger id="char-patch">
                <SelectValue placeholder={profile.patch || "Elige un parche"} />
              </SelectTrigger>
              <SelectContent>
                {meta.patches.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
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
        <legend className="text-sm font-medium">Atributos</legend>
        <p className="text-xs text-muted-foreground">
          Deja el campo vacío si no lo sabes: «desconocido» no es lo mismo que 0.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {ATTRIBUTE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`attr-${key}`}>{label}</Label>
              <Input
                id={`attr-${key}`}
                type="number"
                min={0}
                value={nullableToInput(profile.attributes[key])}
                placeholder="Desconocido"
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
        <legend className="text-sm font-medium">Resistencias (%)</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESISTANCE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`res-${key}`}>{label}</Label>
              <Input
                id={`res-${key}`}
                type="number"
                value={nullableToInput(profile.resistances[key])}
                placeholder="Desconocido"
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
        <legend className="text-sm font-medium">Defensas</legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DEFENSE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`def-${key}`}>{label}</Label>
              <Input
                id={`def-${key}`}
                type="number"
                min={0}
                value={nullableToInput(profile[key])}
                placeholder="Desconocido"
                onChange={(e) => onUpdate({ [key]: inputToOptional(e.target.value) })}
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Objetos ({profile.items.length})
        </legend>
        {profile.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin objetos. Analiza un objeto copiado del juego con el panel de abajo.
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
          Habilidades ({profile.skills.length})
        </legend>
        {profile.skills.map((skill) => (
          <div
            key={skill.id}
            className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
          >
            <div className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`skill-main-${skill.id}`}>Habilidad principal</Label>
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
                      id no verificado
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`skill-supports-${skill.id}`}>
                    Soportes (separados por comas)
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
                            {s.name}: id no verificado
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
                aria-label={`Eliminar habilidad ${skill.mainSkill || "sin nombre"}`}
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
            Añadir habilidad
          </Button>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">
          Pasivas asignadas ({profile.passives.allocated.length})
        </legend>
        {profile.passives.allocated.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin pasivas. Añade nodos del árbol por nombre o por id oficial.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {profile.passives.allocated.map((node, index) => (
              <div key={`${node.ref}-${index}`} className="flex items-center gap-2">
                <Input
                  value={node.ref}
                  aria-label={`Pasiva ${index + 1}`}
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
                    id oficial
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-300"
                  >
                    nombre sin verificar
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar pasiva ${node.ref || index + 1}`}
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
            Añadir pasiva
          </Button>
        </div>
      </fieldset>
    </div>
  );
}
