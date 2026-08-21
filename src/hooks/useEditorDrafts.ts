import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * Borradores locales del editor del expediente.
 *
 * El editor vive dentro de un panel lateral modal. Mantenerlo MONTADO con el
 * panel cerrado no es una opción: un contenido modal de Radix forzado a montar
 * deja `pointer-events: none` en el `body` y bloquea toda la aplicación. Así
 * que el panel se monta y desmonta con normalidad y lo que se conserva es el
 * ESTADO, aquí arriba: cerrar y volver a abrir no borra nada de lo escrito.
 *
 * Son los tres únicos borradores que vivían dentro del editor:
 *  - el `.build` pegado en el importador,
 *  - el texto del objeto copiado del juego,
 *  - los supports en edición de cada configuración de habilidad.
 */
export interface EditorDrafts {
  pastedBuild: string;
  setPastedBuild: (value: string) => void;
  itemText: string;
  setItemText: (value: string) => void;
  supports: Record<string, string>;
  setSupports: Dispatch<SetStateAction<Record<string, string>>>;
}

export function useEditorDrafts(): EditorDrafts {
  const [pastedBuild, setPastedBuild] = useState("");
  const [itemText, setItemText] = useState("");
  const [supports, setSupports] = useState<Record<string, string>>({});
  return {
    pastedBuild,
    setPastedBuild,
    itemText,
    setItemText,
    supports,
    setSupports,
  };
}
