import { useRef, useState, type RefObject } from "react";
import { Info, Pencil } from "lucide-react";
import type { CharacterProfile, Item, Recommendation } from "@shared/domain.js";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EquipmentPanel } from "@/components/EquipmentPanel";
import { ItemDetailDialog } from "@/components/ItemDetailDialog";

interface ExpedienteSectionProps {
  profile: CharacterProfile | null;
  restoring: boolean;
  /** Ids del contenido dominante del Caso Abierto. Vacío = ninguna celda señalada. */
  highlightedItemIds: Set<string>;
  /** Recomendaciones vigentes: el diálogo de objeto enseña las que lo citan. */
  recommendations: Recommendation[];
  /** Datos no verificados del caso abierto; alimenta el aviso discreto. */
  limitations: string[];
  focusedItemId: string | null;
  onFocusHandled: () => void;
  dialogTriggerRef: RefObject<HTMLElement | null>;
  /** Lleva la atención al Caso Abierto (navegación objeto → caso). */
  onShowOpenCase: () => void;
  onEditExpediente: () => void;
}

/**
 * Columna «Expediente»: quién es el personaje y qué lleva puesto.
 *
 * Es una vista de SOLO LECTURA derivada del perfil guardado. No es una segunda
 * instancia de `CharacterSection`: el editor completo sigue siendo único y vive
 * en el panel lateral «Editar expediente».
 */
export function ExpedienteSection({
  profile,
  restoring,
  highlightedItemIds,
  recommendations,
  limitations,
  focusedItemId,
  onFocusHandled,
  dialogTriggerRef,
  onShowOpenCase,
  onEditExpediente,
}: ExpedienteSectionProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const items = profile?.items ?? [];
  // El objeto abierto es el elegido aquí o el que pide el Caso Abierto
  // (navegación recomendación → objeto). Se deriva: nada de setState en render.
  const openItemId = selectedItemId ?? focusedItemId;
  const selectedItem: Item | null = items.find((item) => item.id === openItemId) ?? null;

  const closeDetail = () => {
    setSelectedItemId(null);
    if (focusedItemId !== null) onFocusHandled();
  };

  const relatedRecommendations = recommendations.filter(
    (rec) => selectedItem !== null && rec.relatedItemIds.includes(selectedItem.id),
  );

  // true mientras el diálogo se cierra por «Ver recomendaciones»: el foco no
  // vuelve al disparador sino al Caso Abierto, que es el destino real.
  const navigatingToOpenCase = useRef(false);
  const goToOpenCase = () => {
    navigatingToOpenCase.current = true;
    closeDetail();
    onShowOpenCase();
  };

  if (restoring) {
    return (
      <section className="superficie-panel flex flex-col gap-4 p-5" aria-busy="true">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full" />
        <p className="text-sm text-muted-foreground">Restaurando tu último personaje…</p>
      </section>
    );
  }

  if (profile === null) return null;

  return (
    <section
      className="superficie-panel flex flex-col gap-4 p-4"
      aria-labelledby="expediente-titulo"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Expediente
          </p>
          <h2
            id="expediente-titulo"
            className="font-serif text-2xl font-semibold leading-tight text-foreground"
          >
            {profile.name}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {profile.characterClass}
          {profile.ascendancy !== null && profile.ascendancy !== "" && (
            <> · {profile.ascendancy}</>
          )}{" "}
          · nivel {profile.level} · liga {profile.league || "desconocida"} · parche{" "}
          {profile.patch || "desconocido"}
        </p>
        {limitations.length > 0 && (
          <p
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
            data-testid="expediente-limitaciones"
          >
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {limitations.length} dato(s) sin verificar — ver «Evidencia y
              limitaciones»
            </span>
          </p>
        )}
      </div>

      <EquipmentPanel
        items={profile.items}
        highlightedItemIds={highlightedItemIds}
        onSelectItem={(item, trigger) => {
          dialogTriggerRef.current = trigger;
          setSelectedItemId(item.id);
        }}
      />

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={onEditExpediente}
          data-testid="abrir-editor-expediente"
        >
          <Pencil className="size-4" aria-hidden="true" />
          Editar expediente
        </Button>
      </div>

      <ItemDetailDialog
        item={selectedItem}
        triggerRef={dialogTriggerRef}
        relatedRecommendations={relatedRecommendations}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        onGoToRecommendations={goToOpenCase}
        getCloseFocusTarget={() => {
          if (!navigatingToOpenCase.current) return null;
          navigatingToOpenCase.current = false;
          return document.getElementById("caso-abierto");
        }}
      />
    </section>
  );
}
