export const EXILE_COPILOT_STORAGE_PREFIX = "exile-copilot:";

type ClearableStorage = Pick<Storage, "key" | "length" | "removeItem">;

/**
 * Retira solo las claves de Exile Copilot. Nunca usa `clear()`: localhost puede
 * compartir almacenamiento con otras herramientas del jugador.
 */
export function clearExileCopilotLocalData(
  storage: ClearableStorage,
): number {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(EXILE_COPILOT_STORAGE_PREFIX)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
  return keys.length;
}
