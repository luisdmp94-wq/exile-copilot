import { Trash2 } from "lucide-react";
import type { Item, ItemRarity, ItemSlot, Modifier } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RARITY_LABELS, SLOT_LABELS } from "@/lib/format";

const SLOTS = Object.keys(SLOT_LABELS) as ItemSlot[];
const RARITIES = Object.keys(RARITY_LABELS) as ItemRarity[];

interface ItemEditorProps {
  item: Item;
  index: number;
  onChange: (item: Item) => void;
  onRemove: () => void;
}

/** Editor de un objeto del perfil: nombre, base, slot, rareza y mods (uno por línea). */
export function ItemEditor({ item, index, onChange, onRemove }: ItemEditorProps) {
  const idPrefix = `item-${index}`;

  const setModsFromText = (text: string) => {
    const lines = text.split("\n").map((line) => line.trim());
    const modifiers: Modifier[] = lines
      .map((line, i) => {
        const previous = item.modifiers[i];
        return {
          id: previous?.id ?? `${item.id}-mod-${i}`,
          text: line,
          kind: previous?.kind ?? "explicit",
          values: previous?.values ?? [],
          verified: previous?.verified ?? false,
        };
      })
      .filter((mod) => mod.text.length > 0);
    onChange({ ...item, modifiers });
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-name`}>Nombre</Label>
            <Input
              id={`${idPrefix}-name`}
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-base`}>Base</Label>
            <Input
              id={`${idPrefix}-base`}
              value={item.baseType}
              onChange={(e) => onChange({ ...item, baseType: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-slot`}>Ranura</Label>
            <Select
              value={item.slot}
              onValueChange={(value) => onChange({ ...item, slot: value as ItemSlot })}
            >
              <SelectTrigger id={`${idPrefix}-slot`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOTS.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {SLOT_LABELS[slot]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-rarity`}>Rareza</Label>
            <Select
              value={item.rarity}
              onValueChange={(value) =>
                onChange({ ...item, rarity: value as ItemRarity })
              }
            >
              <SelectTrigger id={`${idPrefix}-rarity`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RARITIES.map((rarity) => (
                  <SelectItem key={rarity} value={rarity}>
                    {RARITY_LABELS[rarity]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Eliminar objeto ${item.name || index + 1}`}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-mods`}>Mods (uno por línea)</Label>
        <Textarea
          id={`${idPrefix}-mods`}
          value={item.modifiers.map((mod) => mod.text).join("\n")}
          onChange={(e) => setModsFromText(e.target.value)}
          rows={Math.min(6, Math.max(2, item.modifiers.length))}
          className="font-mono text-xs"
          placeholder="+45% de daño físico aumentado"
        />
      </div>
    </div>
  );
}
