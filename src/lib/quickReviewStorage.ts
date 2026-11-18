/**
 * Dónde se recuerda lo que el jugador escribe en la «Revisión rápida».
 *
 * Cada personaje tiene su copia: lo de la bruja no aparece al abrir la
 * arquera. Lo que se rellena sin personaje (en la portada) es un borrador, y
 * se lo queda el primer personaje que se abra sin copia propia: así no se
 * pierde al crear el personaje justo después.
 */
export const QUICK_REVIEW_STORAGE_KEY = "exile-copilot:revision-rapida";

export interface QuickReviewStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function quickReviewKey(profileId: string | null): string {
  return profileId === null ? QUICK_REVIEW_STORAGE_KEY : `${QUICK_REVIEW_STORAGE_KEY}:${profileId}`;
}

function parse(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

export function readQuickReviewForm(store: QuickReviewStore, profileId: string | null): Record<string, string> {
  try {
    const own = store.getItem(quickReviewKey(profileId));
    if (own !== null || profileId === null) return parse(own);
    // Personaje sin copia: se queda el borrador de la portada, si lo hay.
    const draft = store.getItem(QUICK_REVIEW_STORAGE_KEY);
    if (draft === null) return {};
    store.setItem(quickReviewKey(profileId), draft);
    store.removeItem(QUICK_REVIEW_STORAGE_KEY);
    return parse(draft);
  } catch {
    return {};
  }
}

export function writeQuickReviewForm(store: QuickReviewStore, profileId: string | null, form: Record<string, string>): void {
  try {
    store.setItem(quickReviewKey(profileId), JSON.stringify(form));
  } catch {
    // Sin almacenamiento, el formulario vale para esta visita.
  }
}
