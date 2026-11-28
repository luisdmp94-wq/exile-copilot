/**
 * Vista previa, SOLO en desarrollo, de las herramientas de crafteo avanzado
 * que la web tiene apagadas para el parche (Essences, Alloys, Orbe fracturante).
 *
 * Sirve para verlas mientras se hacen: abrir la web local con `?avanzado=1`.
 * En la web publicada `import.meta.env.DEV` es falso y esta función devuelve
 * siempre `false`: el interruptor de verdad sigue siendo la cobertura del
 * parche que da el servidor (`patchCompatibility`), y crear una comprobación
 * de Essence o Alloy lo sigue rechazando el servidor.
 */
const KEY = "exile-copilot:vista-previa-avanzado";

export function previewsAdvancedCrafting(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    const asked = new URLSearchParams(window.location.search).get("avanzado");
    // Se recuerda durante la visita: la web cambia la dirección al navegar.
    if (asked === "1") window.sessionStorage.setItem(KEY, "1");
    if (asked === "0") window.sessionStorage.removeItem(KEY);
    return window.sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
