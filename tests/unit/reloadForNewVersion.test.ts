import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../../src/lib/reloadForNewVersion";

describe("recarga tras una versión nueva", () => {
  it("reconoce los trozos de JavaScript de una versión anterior", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://exilecopilot.com/assets/CraftingSection-abc.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(
      isChunkLoadError(
        new TypeError('Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "text/html".'),
      ),
    ).toBe(true);
  });

  it("un fallo normal de la página no provoca recargas", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
