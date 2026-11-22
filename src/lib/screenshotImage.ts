/**
 * Una captura del juego lista para leer: se reduce en el navegador (lado mayor
 * 1600 px, JPEG) antes de mandarla, para que pese poco y llegue rápido.
 */
export async function screenshotDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/** La imagen que trae un pegado (Ctrl+V), si la hay. */
export function pastedImage(data: DataTransfer | null): File | null {
  return (
    [...(data?.items ?? [])]
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile() ?? null
  );
}
