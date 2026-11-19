import { useEffect, useMemo, useState } from "react";
import type { CharacterProfile } from "@shared/domain.js";
import { QUICK_REVIEW_CHANGED_EVENT, quickReviewFormFor, type Form } from "@/lib/quickReviewForm";
import { peekQuickReviewForm } from "@/lib/quickReviewStorage";

/**
 * La «Revisión rápida» de ese personaje, tal como está ahora mismo: se vuelve
 * a leer cada vez que el jugador cambia un dato en la tarjeta. Solo mira; no
 * guarda nada ni adopta el borrador de la portada.
 */
export function useQuickReviewForm(profile: CharacterProfile | null): Form {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const reread = () => setVersion((current) => current + 1);
    window.addEventListener(QUICK_REVIEW_CHANGED_EVENT, reread);
    return () => window.removeEventListener(QUICK_REVIEW_CHANGED_EVENT, reread);
  }, []);
  return useMemo(() => {
    let stored: Record<string, string> = {};
    try {
      stored = peekQuickReviewForm(window.localStorage, profile?.id ?? null);
    } catch {
      // Sin almacenamiento solo cuenta lo que la web sabe del personaje.
    }
    return quickReviewFormFor(profile, stored);
    // `version` no se lee: solo fuerza a releer lo guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, version]);
}
