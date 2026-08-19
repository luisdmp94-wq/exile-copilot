import { useState } from "react";
import { Loader2, Plus, Save, ScanSearch, Sparkles, Trash2 } from "lucide-react";
import type { MetaResponse } from "@shared/api.js";
import type {
  Attributes,
  CharacterProfile,
  Resistances,
  SkillSetup,
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

interface CharacterSectionProps {
  character: CharacterState;
  meta: MetaResponse | null;
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

function toInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
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
} as const;

export function CharacterSection({ character, meta }: CharacterSectionProps) {
  const { profile, warnings, origin, busy, dirty } = character;
  const [itemText, setItemText] = useState("");
  const [supportsDrafts, setSupportsDrafts] = useState<Record<string, string>>({});

  const originBadge = ORIGIN_BADGES[origin];

  const addSkill = () => {
    if (!profile) return;
    const skill: SkillSetup = {
      id: `skill-${Date.now()}`,
      label: "",
      mainSkill: "",
      supports: [],
    };
    character.updateProfile({ skills: [...profile.skills, skill] });
  };

  const updateSkill = (id: string, patch: Partial<SkillSetup>) => {
    if (!profile) return;
    character.updateProfile({
      skills: profile.skills.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-xl">1. Mi personaje</CardTitle>
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
          <Button
            type="button"
            onClick={() => void character.loadDemo()}
            disabled={busy !== null}
          >
            {busy === "demo" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            Cargar ejemplo
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ImportPanel busy={busy === "build"} onImport={character.importBuild} />

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

        {busy === "demo" && !profile ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !profile ? (
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
        ) : (
          <ProfileEditor
            profile={profile}
            meta={meta}
            busy={busy}
            supportsDrafts={supportsDrafts}
            setSupportsDrafts={setSupportsDrafts}
            onUpdate={character.updateProfile}
            onMutate={character.mutateProfile}
            onAddSkill={addSkill}
            onUpdateSkill={updateSkill}
          />
        )}

        {profile && (
          <>
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4">
              <Label htmlFor="item-text">
                Analizar objeto copiado del juego (Ctrl+C sobre el objeto en PoE2)
              </Label>
              <Textarea
                id="item-text"
                value={itemText}
                onChange={(e) => setItemText(e.target.value)}
                rows={5}
                disabled={busy !== null}
                placeholder={"Rarity: Rare\nDoom Bow\nAdvanced Crossbow\n…"}
                className="font-mono text-xs"
              />
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy !== null || !itemText.trim()}
                  onClick={() => {
                    void character.importItemText(itemText).then(() => setItemText(""));
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

            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void character.saveCorrections()}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ProfileEditorProps {
  profile: CharacterProfile;
  meta: MetaResponse | null;
  busy: CharacterState["busy"];
  supportsDrafts: Record<string, string>;
  setSupportsDrafts: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onUpdate: (patch: Partial<CharacterProfile>) => void;
  onMutate: (updater: (profile: CharacterProfile) => CharacterProfile) => void;
  onAddSkill: () => void;
  onUpdateSkill: (id: string, patch: Partial<SkillSetup>) => void;
}

function ProfileEditor({
  profile,
  meta,
  supportsDrafts,
  setSupportsDrafts,
  onUpdate,
  onMutate,
  onAddSkill,
  onUpdateSkill,
}: ProfileEditorProps) {
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
          <Label htmlFor="char-ascendancy">Ascendencia</Label>
          <Input
            id="char-ascendancy"
            value={profile.ascendancy ?? ""}
            onChange={(e) =>
              onUpdate({ ascendancy: e.target.value || undefined })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-level">Nivel</Label>
          <Input
            id="char-level"
            type="number"
            min={1}
            max={100}
            value={profile.level}
            onChange={(e) =>
              onUpdate({ level: Math.min(100, Math.max(1, toInt(e.target.value, 1))) })
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="char-league">Liga</Label>
          {meta && meta.leagues.includes(profile.league) ? (
            <Select
              value={profile.league}
              onValueChange={(value) => onUpdate({ league: value })}
            >
              <SelectTrigger id="char-league">
                <SelectValue />
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
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Atributos</legend>
        <div className="grid grid-cols-3 gap-3">
          {ATTRIBUTE_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <Label htmlFor={`attr-${key}`}>{label}</Label>
              <Input
                id={`attr-${key}`}
                type="number"
                min={0}
                value={profile.attributes[key]}
                onChange={(e) =>
                  onUpdate({
                    attributes: {
                      ...profile.attributes,
                      [key]: Math.max(0, toInt(e.target.value, 0)),
                    },
                  })
                }
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
                value={profile.resistances[key]}
                onChange={(e) =>
                  onUpdate({
                    resistances: {
                      ...profile.resistances,
                      [key]: toInt(e.target.value, 0),
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Objetos ({profile.items.length})</legend>
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
                      onUpdateSkill(skill.id, {
                        mainSkill: e.target.value,
                        label: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`skill-supports-${skill.id}`}>
                    Soportes (separados por comas)
                  </Label>
                  <Input
                    id={`skill-supports-${skill.id}`}
                    value={supportsDrafts[skill.id] ?? skill.supports.join(", ")}
                    onChange={(e) =>
                      setSupportsDrafts((prev) => ({
                        ...prev,
                        [skill.id]: e.target.value,
                      }))
                    }
                    onBlur={() => {
                      const draft = supportsDrafts[skill.id];
                      if (draft !== undefined) {
                        onUpdateSkill(skill.id, {
                          supports: draft
                            .split(",")
                            .map((s) => s.trim())
                            .filter((s) => s.length > 0),
                        });
                        setSupportsDrafts((prev) => {
                          const next = { ...prev };
                          delete next[skill.id];
                          return next;
                        });
                      }
                    }}
                  />
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
          <Button type="button" variant="outline" size="sm" onClick={onAddSkill}>
            <Plus className="size-4" aria-hidden="true" />
            Añadir habilidad
          </Button>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="passives-list">
          Pasivas asignadas ({profile.passives.allocated.length}, una por línea)
        </Label>
        <Textarea
          id="passives-list"
          rows={5}
          value={profile.passives.allocated.join("\n")}
          onChange={(e) =>
            onUpdate({
              passives: {
                allocated: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line.length > 0),
              },
            })
          }
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}
