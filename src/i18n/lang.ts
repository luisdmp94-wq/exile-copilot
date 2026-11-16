import { createContext, useContext } from "react";

/**
 * Idiomas de la web. El español es el principal; el inglés llega por bloques
 * y lo que aún no está traducido avisa con «Coming soon in English».
 *
 * Cada componente guarda sus textos a su lado con `texts(es, en)`: TypeScript
 * obliga a que la versión inglesa tenga exactamente las mismas claves.
 */
export type Lang = "es" | "en";
export const LANGS: Lang[] = ["es", "en"];
export const LANG_STORAGE_KEY = "exile-copilot:idioma";

function isLang(value: string | null | undefined): value is Lang {
  return value === "es" || value === "en";
}

/**
 * Qué idioma usar al entrar: `?lang=en` manda (sirve para enlaces en Reddit),
 * luego lo que eligió esta persona otra vez, y si no, el de su navegador. Un
 * navegador en español abre en español; cualquier otro, en inglés.
 */
export function detectLang(search: string, stored: string | null, browserLanguages: readonly string[]): Lang {
  const fromUrl = new URLSearchParams(search).get("lang")?.toLowerCase();
  if (isLang(fromUrl)) return fromUrl;
  if (isLang(stored)) return stored;
  if (browserLanguages.length === 0) return "es";
  return browserLanguages.some((language) => language.toLowerCase().startsWith("es")) ? "es" : "en";
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(LANG_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeLang(lang: Lang): void {
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Sin almacenamiento, el idioma vale para esta visita.
  }
}

export function initialLang(): Lang {
  if (typeof window === "undefined") return "es";
  const lang = detectLang(window.location.search, readStored(), window.navigator.languages ?? [window.navigator.language]);
  // Un enlace con ?lang= deja elegido ese idioma para las próximas visitas.
  if (new URLSearchParams(window.location.search).has("lang")) storeLang(lang);
  return lang;
}

export interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const LangContext = createContext<LangState>({ lang: "es", setLang: () => undefined });

export function useLang(): LangState {
  return useContext(LangContext);
}

/** Textos de un componente en los dos idiomas, con las mismas claves. */
export function texts<T extends Record<string, unknown>>(es: T, en: { [K in keyof T]: T[K] }): Record<Lang, T> {
  return { es, en };
}

/** Los textos de un componente en el idioma activo. */
export function useText<T>(dictionary: Record<Lang, T>): T {
  return dictionary[useLang().lang];
}
