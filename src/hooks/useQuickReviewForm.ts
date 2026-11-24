import { useEffect, useMemo, useState } from "react";
import type { CharacterProfile } from "@shared/domain.js";
import { QUICK_REVIEW_CHANGED_EVENT, hasReviewBase, quickReviewFormFor, withReviewBase, type Form } from "@/lib/quickReviewForm";
import { peekQuickReviewForm, quickReviewKey, writeQuickReviewForm } from "@/lib/quickReviewStorage";

/**
 * La «Revisión rápida» de ese personaje, tal como está ahora mismo: se vuelve
 * a leer cada vez que el jugador cambia un dato en la tarjeta. No adopta el
 * borrador de la portada. Lo único que guarda: a una revisión de antes, que no
 * lleva al lado lo que decía la ficha, se lo apunta la primera vez que la ve,
 * para que los cambios de la ficha a partir de ahí sí se noten.
 */
export function useQuickReviewForm(profile: CharacterProfile | null): Form {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const reread = () => setVersion((current) => current + 1);
    window.addEventListener(QUICK_REVIEW_CHANGED_EVENT, reread);
    return () => window.removeEventListener(QUICK_REVIEW_CHANGED_EVENT, reread);
  }, []);
  useEffect(() => {
    if (!profile) return;
    try {
      // Solo la copia propia de este personaje, no el borrador de la portada.
      if (window.localStorage.getItem(quickReviewKey(profile.id)) === null) return;
      const stored = peekQuickReviewForm(window.localStorage, profile.id);
      if (Object.keys(stored).length === 0 || hasReviewBase(stored)) return;
      writeQuickReviewForm(window.localStorage, profile.id, withReviewBase(stored, profile));
    } catch {
      // Sin almacenamiento no hay nada que apuntar.
    }
    // Una vez por personaje: lo que importa es la ficha del momento en que se ve por primera vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);
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
