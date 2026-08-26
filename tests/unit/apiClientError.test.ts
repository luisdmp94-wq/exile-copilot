import { describe, expect, it } from "vitest";
import { ApiRequestError, getErrorMessage } from "../../src/lib/api.js";

describe("errores públicos del cliente", () => {
  const requestId = "ec_0123456789abcdef";

  it("muestra una referencia segura cuando el servidor falla", () => {
    const message = getErrorMessage(
      new ApiRequestError(
        "error-interno",
        500,
        "Ocurrió un error interno. Inténtalo de nuevo más tarde.",
        requestId,
      ),
    );

    expect(message).toContain(`Referencia ${requestId}`);
  });

  it("no añade ruido de soporte a errores corregibles por el jugador", () => {
    const message = getErrorMessage(
      new ApiRequestError("validacion-fallida", 400, "Falta el objeto.", requestId),
    );

    expect(message).toBe("validacion-fallida: Falta el objeto.");
    expect(message).not.toContain("Referencia");
  });

  it("mantiene claro un fallo de conexión sin inventar una referencia", () => {
    const message = getErrorMessage(new ApiRequestError("No se pudo conectar"));

    expect(message).toBe("No se pudo conectar");
  });
});
