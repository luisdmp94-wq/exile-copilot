import { useState, type FormEvent } from "react";
import type { ItemSlot } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REQUIRED_SLOTS, type BuildCheckInput } from "@/lib/buildPriorities";
import {
  EMPTY_MANUAL_VALUES,
  parseManualCheck,
  RESISTANCE_FIELDS,
  type ManualResistanceValues,
} from "@/lib/manualCheck";

/**
 * Alternativa sin Path of Building: el jugador copia sus resistencias de la
 * hoja de personaje y marca los huecos vacíos. Pasa por las mismas reglas que
 * un código PoB2.
 */
export function ManualCheckForm({
  onResult,
  onError,
}: {
  onResult: (input: BuildCheckInput) => void;
  onError: (message: string) => void;
}) {
  const [values, setValues] = useState<ManualResistanceValues>(EMPTY_MANUAL_VALUES);
  const [emptySlots, setEmptySlots] = useState<ItemSlot[]>([]);

  const toggleSlot = (slot: ItemSlot) => {
    setEmptySlots((current) =>
      current.includes(slot) ? current.filter((candidate) => candidate !== slot) : [...current, slot],
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = parseManualCheck(values, emptySlots);
    if (result.ok) onResult(result.input);
    else onError(result.message);
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="manual-check-form">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Resistencias</legend>
        <p className="text-xs text-muted-foreground">
          Cópialas de la hoja de personaje del juego. Deja en blanco las que no sepas.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RESISTANCE_FIELDS.map(({ key, label }) => (
            <label key={key} className="space-y-1 text-sm">
              <span className="text-muted-foreground">{label} (%)</span>
              <Input
                name={key}
                inputMode="numeric"
                autoComplete="off"
                placeholder="—"
                value={values[key]}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
                className="tabular-nums"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">¿Qué huecos de equipo tienes vacíos?</legend>
        <p className="text-xs text-muted-foreground">Si llevas todo puesto, no marques nada.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {REQUIRED_SLOTS.map(({ slot, label }) => (
            <label
              key={slot}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-[:checked]:border-primary/60 has-[:checked]:bg-primary/10"
            >
              <input
                type="checkbox"
                checked={emptySlots.includes(slot)}
                onChange={() => toggleSlot(slot)}
                className="size-4 accent-[hsl(var(--primary))]"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" className="w-full sm:w-auto">
        Ver qué arreglar
      </Button>
    </form>
  );
}
