import { describe, expect, it } from "vitest";
import { isChunkLoadError, reloadOnceForNewVersion, type BrowserBits } from "../../src/lib/reloadForNewVersion";

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

function fakeBrowser(): { browser: BrowserBits; reloads: () => number; stored: Map<string, string> } {
  const stored = new Map<string, string>();
  let reloads = 0;
  return {
    browser: {
      navigator: { onLine: true },
      sessionStorage: {
        getItem: (key) => stored.get(key) ?? null,
        setItem: (key, value) => void stored.set(key, value),
      },
      location: {
        reload: () => {
          reloads += 1;
        },
      },
    },
    reloads: () => reloads,
    stored,
  };
}

describe("la recarga pregunta antes al servidor", () => {
  it("recarga si el servidor responde", async () => {
    const fake = fakeBrowser();
    expect(await reloadOnceForNewVersion(fake.browser, async () => ({ ok: true }))).toBe(true);
    expect(fake.reloads()).toBe(1);
  });

  it("con el servidor reiniciándose (502) no recarga ni gasta el intento", async () => {
    const fake = fakeBrowser();
    expect(await reloadOnceForNewVersion(fake.browser, async () => ({ ok: false }))).toBe(false);
    expect(fake.reloads()).toBe(0);
    expect(fake.stored.size).toBe(0);
    // Cuando el servidor vuelve, el siguiente intento sí recarga.
    expect(await reloadOnceForNewVersion(fake.browser, async () => ({ ok: true }))).toBe(true);
    expect(fake.reloads()).toBe(1);
  });

  it("sin conexión con el servidor tampoco recarga", async () => {
    const fake = fakeBrowser();
    const failing = async () => {
      throw new TypeError("Failed to fetch");
    };
    expect(await reloadOnceForNewVersion(fake.browser, failing)).toBe(false);
    expect(fake.reloads()).toBe(0);
  });

  it("no recarga dos veces seguidas", async () => {
    const fake = fakeBrowser();
    await reloadOnceForNewVersion(fake.browser, async () => ({ ok: true }));
    expect(await reloadOnceForNewVersion(fake.browser, async () => ({ ok: true }))).toBe(false);
    expect(fake.reloads()).toBe(1);
  });

  it("dos avisos a la vez hacen una sola comprobación y una sola recarga", async () => {
    const fake = fakeBrowser();
    let checks = 0;
    const slow = async () => {
      checks += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { ok: true };
    };
    const [first, second] = await Promise.all([
      reloadOnceForNewVersion(fake.browser, slow),
      reloadOnceForNewVersion(fake.browser, slow),
    ]);
    expect([first, second]).toEqual([true, true]);
    expect(checks).toBe(1);
    expect(fake.reloads()).toBe(1);
  });
});
