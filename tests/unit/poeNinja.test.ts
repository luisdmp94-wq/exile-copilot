import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createDatabase } from "../../server/db/database.js";
import {
  mapPrimaryCurrency,
  PoeNinjaClient,
  PriceService,
  type FetchLike,
} from "../../server/services/poeninja.js";
import { loadConfig, type ServerConfig } from "../../server/config.js";

const LEAGUE = "Runes of Aldur";

const currencyFixture = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/poeNinja/currency.json", import.meta.url)),
  "utf8",
);
const itemFixture = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/poeNinja/item.json", import.meta.url)),
  "utf8",
);
const leaguesFixture = readFileSync(
  fileURLToPath(new URL("../../server/fixtures/poeNinja/leagues.json", import.meta.url)),
  "utf8",
);

function offlineConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return { ...loadConfig({}), poeNinjaOffline: true, ...overrides };
}

/** Mock de fetch que responde según la URL del endpoint documentado. */
function fetchByUrl(handlers: {
  exchange?: (call: number, headers: Record<string, string>) => { status: number; body?: string; etag?: string };
  stash?: (call: number, headers: Record<string, string>) => { status: number; body?: string; etag?: string };
  leagues?: (call: number, headers: Record<string, string>) => { status: number; body?: string; etag?: string };
}): { fetchImpl: FetchLike; calls: Array<{ url: string; headers: Record<string, string> }> } {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const counters = { exchange: 0, stash: 0, leagues: 0 };
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    let which: keyof typeof counters;
    if (url.includes("/economy/leagues")) which = "leagues";
    else if (url.includes("/exchange/current/overview")) which = "exchange";
    else if (url.includes("/stash/current/item/overview")) which = "stash";
    else throw new Error(`URL no documentada en el mock: ${url}`);
    counters[which] += 1;
    const handler = handlers[which];
    if (!handler) throw new Error(`fetch inesperado a ${which}: ${url}`);
    const res = handler(counters[which], init.headers);
    return {
      status: res.status,
      headers: { get: (n: string) => (n.toLowerCase() === "etag" ? (res.etag ?? null) : null) },
      text: () => Promise.resolve(res.body ?? ""),
    };
  };
  return { fetchImpl, calls };
}

describe("poe.ninja — endpoints documentados (shapes reales)", () => {
  it("mapPrimaryCurrency mapea ids a CurrencyKind con fallback documentado", () => {
    expect(mapPrimaryCurrency("divine")).toEqual({ currency: "divine", note: null });
    expect(mapPrimaryCurrency("exalted")).toEqual({ currency: "exalted", note: null });
    expect(mapPrimaryCurrency("chaos")).toEqual({ currency: "chaos", note: null });
    const fallback = mapPrimaryCurrency("gold-something");
    expect(fallback.currency).toBe("exalted");
    expect(fallback.note).toContain("No verificado");
  });

  it("offline: divisas desde fixture de exchange, moneda primaria divine, degraded", async () => {
    const db = createDatabase(":memory:");
    const fetchSpy = vi.fn();
    const client = new PoeNinjaClient({
      db,
      config: offlineConfig(),
      fetchImpl: fetchSpy as unknown as FetchLike,
    });
    const service = new PriceService(client);

    const result = await service.getQuotes(["Divine Orb", "exalted orb"], LEAGUE);
    expect(result.degraded).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled(); // offline: cero red

    const divine = result.quotes[0];
    expect(divine?.value).toBe(1);
    expect(divine?.currency).toBe("divine"); // moneda real de cotización (core.primary)
    expect(divine?.verified).toBe(false); // fixture → no verificado
    expect(divine?.detail).toContain("No verificado");
    expect(divine?.source).toBe("poe.ninja");
    expect(divine?.league).toBe(LEAGUE);

    // match case-insensitive sobre core.items[].name
    const exalted = result.quotes[1];
    expect(exalted?.itemName).toBe("exalted orb");
    expect(exalted?.value).toBe(0.0095);
  });

  it("offline: items únicos desde fixture de stash (match exacto de nombre de único)", async () => {
    const db = createDatabase(":memory:");
    const client = new PoeNinjaClient({ db, config: offlineConfig() });
    const service = new PriceService(client);

    const result = await service.getQuotes(["Gale Hymn", "Varnished Crossbow"], LEAGUE);
    // Match exacto de nombre de único; la base sola NO se valora con precio de único
    expect(result.quotes[0]?.value).toBe(1.2);
    expect(result.quotes[0]?.currency).toBe("divine");
    expect(result.quotes[0]?.verified).toBe(false); // fixture → No verificado aunque tenga valor
    expect(result.quotes[0]?.detail).toContain("fixture offline");
    expect(result.quotes[1]?.value).toBeNull();
    expect(result.quotes[1]?.verified).toBe(false);
    // La respuesta expone moneda primaria y tasas del exchange (objeto con origen y verificación)
    expect(result.primaryCurrency).toBe("divine");
    expect(result.rates?.values).toEqual({ exalted: 105, chaos: 35.44 });
    expect(result.rates?.origin).toBe("fixture");
    expect(result.rates?.verified).toBe(false); // fixture → tasas NO verificadas
    expect(result.degraded).toBe(true);
  });

  it("un objeto declarado rare nunca se valora con precio de único aunque coincida el nombre", async () => {
    const db = createDatabase(":memory:");
    const client = new PoeNinjaClient({ db, config: offlineConfig() });
    const service = new PriceService(client);

    const result = await service.getQuotes([{ name: "Gale Hymn", rarity: "rare" }], LEAGUE);
    expect(result.quotes[0]?.value).toBeNull();
    expect(result.quotes[0]?.verified).toBe(false);
    expect(result.quotes[0]?.detail).toContain("no es único");

    // La misma consulta declarada única sí encuentra el valor (del fixture, no verificado)
    const asUnique = await service.getQuotes([{ name: "Gale Hymn", rarity: "unique" }], LEAGUE);
    expect(asUnique.quotes[0]?.value).toBe(1.2);
    expect(asUnique.quotes[0]?.verified).toBe(false);
  });

  it("nombre desconocido → value null, verified:false, detail No verificado", async () => {
    const db = createDatabase(":memory:");
    const client = new PoeNinjaClient({ db, config: offlineConfig() });
    const service = new PriceService(client);
    const result = await service.getQuotes(["Objeto Inventado 3000"], LEAGUE);
    const quote = result.quotes[0];
    expect(quote?.value).toBeNull();
    expect(quote?.verified).toBe(false);
    expect(quote?.detail).toContain("No verificado");
  });
});

describe("poe.ninja — caché con ETag (endpoints documentados)", () => {
  it("200 con ETag guarda caché; TTL 0 revalida con If-None-Match y sirve 304", async () => {
    const db = createDatabase(":memory:");
    const { fetchImpl, calls } = fetchByUrl({
      exchange: (call, headers) =>
        call === 1
          ? { status: 200, body: currencyFixture, etag: '"etag-123"' }
          : headers["If-None-Match"] === '"etag-123"'
            ? { status: 304 }
            : (() => {
                throw new Error("revalidación sin If-None-Match");
              })(),
    });
    // TTL 0 → la caché nunca está fresca: cada petición revalida.
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 0 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });

    const first = await client.getOverview(LEAGUE, "Currency");
    expect(first?.origin).toBe("live");
    expect(first?.fromCache).toBe(false);
    expect(calls[0]?.url).toContain("/poe2/api/economy/exchange/current/overview");
    expect(calls[0]?.url).toContain(`league=${encodeURIComponent(LEAGUE)}`);
    expect(calls[0]?.url).toContain("type=Currency");
    expect(calls[0]?.headers["If-None-Match"]).toBeUndefined();
    expect(calls[0]?.headers["User-Agent"]).toContain("exile-copilot");

    const second = await client.getOverview(LEAGUE, "Currency");
    expect(second?.origin).toBe("cache-fresh");
    expect(second?.fromCache).toBe(true);
    expect(second?.degraded).toBe(false);
    expect(calls[1]?.headers["If-None-Match"]).toBe('"etag-123"');
    // fetched_at se refresca tras el 304
    expect(Date.parse(second?.fetchedAt ?? "")).toBeGreaterThanOrEqual(Date.parse(first?.fetchedAt ?? ""));
  });

  it("TTL > 0 sirve caché fresca sin tocar la red", async () => {
    const db = createDatabase(":memory:");
    const { fetchImpl, calls } = fetchByUrl({
      exchange: () => ({ status: 200, body: currencyFixture, etag: '"etag-1"' }),
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 900 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });

    await client.getOverview(LEAGUE, "Currency");
    const second = await client.getOverview(LEAGUE, "Currency");
    expect(second?.origin).toBe("cache-fresh");
    expect(calls).toHaveLength(1); // sin segunda llamada de red
  });

  it("error de red con caché expirada → sirve caché antigua degradada", async () => {
    const db = createDatabase(":memory:");
    const { fetchImpl } = fetchByUrl({
      exchange: () => ({ status: 200, body: currencyFixture, etag: '"etag-1"' }),
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 0 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });
    await client.getOverview(LEAGUE, "Currency"); // puebla caché

    const failingFetch: FetchLike = () => Promise.reject(new Error("network down"));
    const failingClient = new PoeNinjaClient({ db, config, fetchImpl: failingFetch });
    const stale = await failingClient.getOverview(LEAGUE, "Currency");
    expect(stale?.origin).toBe("cache-stale");
    expect(stale?.fromCache).toBe(true);
    expect(stale?.degraded).toBe(true);
  });

  it("error de red sin caché → cae a fixtures con degraded", async () => {
    const db = createDatabase(":memory:");
    const failingFetch: FetchLike = () => Promise.reject(new Error("network down"));
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 0 });
    const client = new PoeNinjaClient({ db, config, fetchImpl: failingFetch });
    const service = new PriceService(client);
    const result = await service.getQuotes(["Chaos Orb"], LEAGUE);
    expect(result.degraded).toBe(true);
    expect(result.quotes[0]?.value).toBe(0.0282);
    expect(result.quotes[0]?.currency).toBe("divine");
    expect(result.quotes[0]?.verified).toBe(false);
    expect(result.quotes[0]?.detail).toContain("No verificado");
  });

  it("live: exchange + stash devuelven quotes verificados con moneda primaria real", async () => {
    const db = createDatabase(":memory:");
    const { fetchImpl } = fetchByUrl({
      exchange: () => ({ status: 200, body: currencyFixture, etag: '"e1"' }),
      stash: () => ({ status: 200, body: itemFixture, etag: '"e2"' }),
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 900 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });
    const service = new PriceService(client);

    const result = await service.getQuotes(["Divine Orb", "Storm Cantor"], LEAGUE);
    expect(result.degraded).toBe(false);
    expect(result.primaryCurrency).toBe("divine");
    expect(result.rates?.values).toEqual({ exalted: 105, chaos: 35.44 });
    expect(result.rates?.origin).toBe("live");
    expect(result.rates?.verified).toBe(true); // live + primaria reconocida
    expect(result.quotes[0]?.verified).toBe(true);
    expect(result.quotes[0]?.value).toBe(1);
    expect(result.quotes[0]?.currency).toBe("divine");
    expect(result.quotes[1]?.verified).toBe(true);
    expect(result.quotes[1]?.value).toBe(0.35);
    expect(result.quotes[1]?.currency).toBe("divine");
  });

  it("primaria desconocida: quotes y rates quedan NO verificados aunque el dato sea live", async () => {
    const mutated = JSON.parse(currencyFixture) as { core?: { primary?: string } };
    if (mutated.core) mutated.core.primary = "algo-raro";
    const db = createDatabase(":memory:");
    const { fetchImpl } = fetchByUrl({
      exchange: () => ({ status: 200, body: JSON.stringify(mutated), etag: '"e1"' }),
      stash: () => ({ status: 200, body: itemFixture, etag: '"e2"' }),
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 900 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });
    const service = new PriceService(client);

    const result = await service.getQuotes(["Divine Orb", "Storm Cantor"], LEAGUE);
    // Una primaria desconocida sigue siendo desconocida: primaryCurrency es null
    // (nunca se convierte en una afirmación concreta) y NADA queda verificado.
    expect(result.primaryCurrency).toBeNull();
    expect(result.rates?.origin).toBe("live");
    expect(result.rates?.verified).toBe(false); // primaria no reconocida → tasas no verificadas
    expect(result.quotes[0]?.value).toBe(1); // el valor existe...
    expect(result.quotes[0]?.verified).toBe(false); // ...pero no se puede dar por verificado
    expect(result.quotes[0]?.detail).toContain("No verificado");
    expect(result.quotes[0]?.detail).toContain("algo-raro");
    expect(result.quotes[1]?.verified).toBe(false);
  });

  it("caché corrupta: borra la fila, trata como miss y no derriba la petición", async () => {
    const db = createDatabase(":memory:");
    // Inserta una fila con payload JSON inválido directamente en la tabla
    db.prepare(
      "INSERT INTO price_cache (key, league, category, payload, etag, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(`${LEAGUE}:Currency`, LEAGUE, "Currency", "{json-roto", '"etag-x"', new Date(0).toISOString());

    const { fetchImpl, calls } = fetchByUrl({
      exchange: () => ({ status: 200, body: currencyFixture, etag: '"e-new"' }),
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 900 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });

    const result = await client.getOverview(LEAGUE, "Currency");
    expect(result?.origin).toBe("live"); // miss → red, sin excepción
    expect(calls).toHaveLength(1);
    // La fila corrupta fue reemplazada por una válida
    const row = db.prepare("SELECT payload FROM price_cache WHERE key = ?").get(`${LEAGUE}:Currency`) as { payload: string };
    expect(() => JSON.parse(row.payload)).not.toThrow();

    // Modo offline con caché corrupta → cae a fixture sin lanzar
    const db2 = createDatabase(":memory:");
    db2.prepare(
      "INSERT INTO price_cache (key, league, category, payload, etag, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(`${LEAGUE}:Currency`, LEAGUE, "Currency", "no-json", null, new Date().toISOString());
    const offlineClient = new PoeNinjaClient({ db: db2, config: offlineConfig() });
    const offlineResult = await offlineClient.getOverview(LEAGUE, "Currency");
    expect(offlineResult?.origin).toBe("fixture");
    expect(offlineResult?.degraded).toBe(true);
  });
});

describe("poe.ninja — getLeagues", () => {
  it("offline → fixture leagues.json degradado con las 4 ligas reales", async () => {
    const db = createDatabase(":memory:");
    const fetchSpy = vi.fn();
    const client = new PoeNinjaClient({
      db,
      config: offlineConfig(),
      fetchImpl: fetchSpy as unknown as FetchLike,
    });
    const result = await client.getLeagues();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.degraded).toBe(true);
    expect(result.leagues.map((l) => l.id)).toEqual([
      "Runes of Aldur",
      "HC Runes of Aldur",
      "Standard",
      "Hardcore",
    ]);
  });

  it("live mock → ligas verificadas sin degraded, cacheadas con ETag", async () => {
    const db = createDatabase(":memory:");
    const { fetchImpl, calls } = fetchByUrl({
      leagues: (call, headers) =>
        call === 1
          ? { status: 200, body: leaguesFixture, etag: '"lg-1"' }
          : headers["If-None-Match"] === '"lg-1"'
            ? { status: 304 }
            : { status: 200, body: leaguesFixture },
    });
    const config = offlineConfig({ poeNinjaOffline: false, poeNinjaCacheTtlSeconds: 0 });
    const client = new PoeNinjaClient({ db, config, fetchImpl });

    const first = await client.getLeagues();
    expect(first.degraded).toBe(false);
    expect(first.leagues[0]?.id).toBe("Runes of Aldur");
    expect(calls[0]?.url).toBe("https://poe.ninja/poe2/api/economy/leagues");

    // TTL 0 → revalida con ETag, 304 → sirve caché sin degraded
    const second = await client.getLeagues();
    expect(second.degraded).toBe(false);
    expect(second.fromCache).toBe(true);
    expect(calls[1]?.headers["If-None-Match"]).toBe('"lg-1"');
  });
});
