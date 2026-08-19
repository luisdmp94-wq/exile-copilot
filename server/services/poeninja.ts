import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { CurrencyKind, ItemRarity, PriceQuote } from "../../shared/domain.js";
import type { MarketRates } from "../../shared/api.js";
import type { ServerConfig } from "../config.js";
import type { Database } from "../db/database.js";
import {
  deleteCacheEntry,
  getCacheEntry,
  setCacheEntry,
  touchCacheEntry,
  type PriceCacheRow,
} from "../db/repositories.js";

/**
 * Cliente de la API económica pública DOCUMENTADA de poe.ninja (PoE2).
 * Superficie permitida (ver https://poe.ninja/docs/api):
 *
 *   GET https://poe.ninja/poe2/api/economy/leagues
 *   GET https://poe.ninja/poe2/api/economy/exchange/current/overview?league={league}&type={type}
 *   GET https://poe.ninja/poe2/api/economy/stash/current/item/overview?league={league}&type={type}
 *
 * Se llama exclusivamente desde el servidor. Caché SQLite con ETag y TTL,
 * User-Agent descriptivo, y cadena de fallback ante error de red/HTTP:
 *   1) último valor en caché aunque esté expirado (fromCache: true, degraded)
 *   2) fixtures de server/fixtures/poeNinja/ (degraded: true, quotes verified: false)
 */

const LEAGUES_URL = "https://poe.ninja/poe2/api/economy/leagues";
const EXCHANGE_URL = "https://poe.ninja/poe2/api/economy/exchange/current/overview";
const STASH_ITEM_URL = "https://poe.ninja/poe2/api/economy/stash/current/item/overview";

/** Clave de caché reservada para el listado de ligas. */
const LEAGUES_CACHE_KEY = "__leagues__";

/** Tipos consultados para resolver precios (MVP): divisa + armas únicas. */
export const CURRENCY_TYPES = ["Currency"] as const;
export const ITEM_TYPES = ["UniqueWeapons"] as const;

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;

export type OverviewOrigin = "live" | "cache-fresh" | "cache-stale" | "fixture";

export interface OverviewResult {
  /** Respuesta JSON parseada con la shape real del endpoint correspondiente. */
  payload: unknown;
  origin: OverviewOrigin;
  fetchedAt: string;
  fromCache: boolean;
  degraded: boolean;
}

export interface PoeNinjaClientOptions {
  db: Database;
  config: ServerConfig;
  fetchImpl?: FetchLike;
  fixturesDir?: string;
}

function defaultFixturesDir(): string {
  return fileURLToPath(new URL("../fixtures/poeNinja/", import.meta.url));
}

// ---------------------------------------------------------------------------
// Shapes reales de la API documentada (solo los campos que usamos)
// ---------------------------------------------------------------------------

interface ExchangeCoreItem {
  id: string;
  name: string;
  detailsId?: string;
  category?: string;
}

interface ExchangeOverview {
  core?: {
    items?: ExchangeCoreItem[];
    rates?: Record<string, number>;
    primary?: string;
    secondary?: string;
  };
  lines?: Array<{ id: string; primaryValue?: number; volumePrimaryValue?: number }>;
}

interface StashItemLine {
  id?: number;
  itemId?: string;
  detailsId?: string;
  name?: string;
  baseType?: string;
  primaryValue?: number;
  listingCount?: number;
}

function asExchangeOverview(payload: unknown): ExchangeOverview {
  return typeof payload === "object" && payload !== null ? (payload as ExchangeOverview) : {};
}

function stashLinesOf(payload: unknown): StashItemLine[] {
  if (typeof payload === "object" && payload !== null) {
    const lines = (payload as { lines?: unknown }).lines;
    if (Array.isArray(lines)) return lines as StashItemLine[];
  }
  return [];
}

/** Mapea el id de moneda primaria de poe.ninja a CurrencyKind del dominio. */
export function mapPrimaryCurrency(primary: string | undefined): {
  currency: CurrencyKind;
  note: string | null;
} {
  switch (primary) {
    case "divine":
      return { currency: "divine", note: null };
    case "exalted":
      return { currency: "exalted", note: null };
    case "chaos":
      return { currency: "chaos", note: null };
    default:
      return {
        currency: "exalted",
        note: `No verificado — moneda primaria desconocida ("${primary ?? "?"}"): se reporta como exalted.`,
      };
  }
}

export class PoeNinjaClient {
  readonly #db: Database;
  readonly #config: ServerConfig;
  readonly #fetch: FetchLike;
  readonly #fixturesDir: string;

  constructor(options: PoeNinjaClientOptions) {
    this.#db = options.db;
    this.#config = options.config;
    this.#fetch = options.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.#fixturesDir = options.fixturesDir ?? defaultFixturesDir();
  }

  #cacheKey(league: string, type: string): string {
    return `${league}:${type}`;
  }

  #endpointFor(type: string): "exchange" | "stash-item" {
    // Exchange cubre Currency y el resto de tipos intercambiables documentados.
    return (ITEM_TYPES as readonly string[]).includes(type) ? "stash-item" : "exchange";
  }

  #fixtureFileFor(type: string): string {
    return this.#endpointFor(type) === "exchange" ? "currency.json" : "item.json";
  }

  #isFresh(row: PriceCacheRow, now: Date): boolean {
    const fetched = new Date(row.fetched_at).getTime();
    if (!Number.isFinite(fetched)) return false;
    return now.getTime() - fetched < this.#config.poeNinjaCacheTtlSeconds * 1000;
  }

  #fromFixture(fixtureFile: string, reason: string): OverviewResult | null {
    try {
      const raw = readFileSync(join(this.#fixturesDir, fixtureFile), "utf8");
      return {
        payload: JSON.parse(raw),
        origin: "fixture",
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        degraded: true,
      };
    } catch (err) {
      console.warn(
        `[poeninja] sin fixture ${fixtureFile} (${reason}):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /**
   * Núcleo común de la cadena de caché: TTL → offline → red (ETag) →
   * caché antigua → fixture. Nunca lanza por errores de red.
   */
  async #fetchWithCache(args: {
    key: string;
    league: string;
    category: string;
    url: string;
    fixtureFile: string;
  }): Promise<OverviewResult | null> {
    const { key, league, category, url, fixtureFile } = args;
    const now = new Date();
    let cached = getCacheEntry(this.#db, key);
    let cachedPayload: unknown = null;

    // Caché corrupta: si el payload no parsea, se borra la fila y se trata
    // como miss (sin derribar la petición).
    if (cached) {
      try {
        cachedPayload = JSON.parse(cached.payload);
      } catch {
        console.warn(`[poeninja] caché corrupta para "${key}" — se borra la fila y se trata como miss.`);
        deleteCacheEntry(this.#db, key);
        cached = null;
      }
    }

    // 1) Caché fresca: ni siquiera tocamos la red.
    if (cached && this.#isFresh(cached, now)) {
      return {
        payload: cachedPayload,
        origin: "cache-fresh",
        fetchedAt: cached.fetched_at,
        fromCache: true,
        degraded: false,
      };
    }

    // 2) Modo offline: solo caché antigua o fixtures.
    if (this.#config.poeNinjaOffline) {
      if (cached) {
        return {
          payload: cachedPayload,
          origin: "cache-stale",
          fetchedAt: cached.fetched_at,
          fromCache: true,
          degraded: true,
        };
      }
      return this.#fromFixture(fixtureFile, "modo offline");
    }

    // 3) Red, con ETag si lo tenemos.
    const headers: Record<string, string> = {
      "User-Agent": this.#config.poeNinjaUserAgent,
      Accept: "application/json",
    };
    if (cached?.etag) headers["If-None-Match"] = cached.etag;

    try {
      const res = await this.#fetch(url, { headers });
      const fetchedAt = new Date().toISOString();

      if (res.status === 304 && cached) {
        // Not Modified: refrescamos fetched_at y servimos la caché.
        touchCacheEntry(this.#db, key, fetchedAt);
        return {
          payload: cachedPayload,
          origin: "cache-fresh",
          fetchedAt,
          fromCache: true,
          degraded: false,
        };
      }

      if (res.status === 200) {
        const text = await res.text();
        const payload: unknown = JSON.parse(text);
        setCacheEntry(this.#db, {
          key,
          league,
          category,
          payload: text,
          etag: res.headers.get("etag"),
          fetchedAt,
        });
        return { payload, origin: "live", fetchedAt, fromCache: false, degraded: false };
      }

      console.warn(`[poeninja] HTTP ${res.status} para ${url} — degradando a caché/fixture.`);
    } catch (err) {
      console.warn(
        `[poeninja] error de red para ${url}:`,
        err instanceof Error ? err.message : err,
      );
    }

    // 4) Fallback: caché antigua aunque esté expirada.
    if (cached) {
      return {
        payload: cachedPayload,
        origin: "cache-stale",
        fetchedAt: cached.fetched_at,
        fromCache: true,
        degraded: true,
      };
    }
    // 5) Fallback final: fixtures versionados.
    return this.#fromFixture(fixtureFile, "fallback final");
  }

  /**
   * Overview de exchange (divisas) o de stash items, según el tipo.
   * Nunca lanza por errores de red: degrada a caché antigua o fixtures.
   */
  getOverview(league: string, type: string): Promise<OverviewResult | null> {
    const base = this.#endpointFor(type) === "exchange" ? EXCHANGE_URL : STASH_ITEM_URL;
    return this.#fetchWithCache({
      key: this.#cacheKey(league, type),
      league,
      category: type,
      url: `${base}?league=${encodeURIComponent(league)}&type=${encodeURIComponent(type)}`,
      fixtureFile: this.#fixtureFileFor(type),
    });
  }

  /**
   * Ligas activas de PoE2 según poe.ninja (endpoint documentado /economy/leagues).
   * Misma cadena de caché (TTL, ETag, offline→fixture leagues.json, fallback).
   * Nunca lanza: si hasta el fixture falta, devuelve la liga por defecto degradada.
   */
  async getLeagues(): Promise<{
    leagues: Array<{ id: string; name: string }>;
    degraded: boolean;
    fromCache: boolean;
    fetchedAt: string;
  }> {
    const result = await this.#fetchWithCache({
      key: LEAGUES_CACHE_KEY,
      league: LEAGUES_CACHE_KEY,
      category: "leagues",
      url: LEAGUES_URL,
      fixtureFile: "leagues.json",
    });

    const parse = (payload: unknown): Array<{ id: string; name: string }> | null => {
      if (!Array.isArray(payload)) return null;
      const out: Array<{ id: string; name: string }> = [];
      for (const entry of payload) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          typeof (entry as { id?: unknown }).id === "string"
        ) {
          const e = entry as { id: string; name?: string };
          out.push({ id: e.id, name: typeof e.name === "string" ? e.name : e.id });
        }
      }
      return out.length > 0 ? out : null;
    };

    const leagues = result ? parse(result.payload) : null;
    if (leagues) {
      return {
        leagues,
        degraded: result?.degraded ?? true,
        fromCache: result?.fromCache ?? false,
        fetchedAt: result?.fetchedAt ?? new Date().toISOString(),
      };
    }
    // Ni red, ni caché, ni fixture: última red de seguridad con la liga por defecto.
    return {
      leagues: [{ id: this.#config.defaultLeague, name: this.#config.defaultLeague }],
      degraded: true,
      fromCache: false,
      fetchedAt: new Date().toISOString(),
    };
  }
}

export interface QuotesResult {
  quotes: PriceQuote[];
  league: string;
  updatedAt: string;
  fromCache: boolean;
  degraded: boolean;
  /** Moneda primaria de cotización de la liga (core.primary del exchange). */
  primaryCurrency: CurrencyKind | null;
  /**
   * Tasas de core.rates con origen y verificación. verified solo si el dato
   * es live/cache-fresh Y la moneda primaria es reconocida (divine/exalted/chaos).
   * Jamás se usan tasas de fixture o caché antigua para afirmar presupuesto.
   */
  rates: MarketRates | null;
}

/**
 * Consulta de precio. `rarity` da contexto: un objeto RARE nunca se valora
 * con precios de únicos aunque coincida la base — solo hay match de stash
 * cuando la consulta es de un único (o no lleva contexto de rareza, p. ej.
 * la ruta de mercado) y el nombre coincide EXACTAMENTE con el del único.
 */
export interface PriceQuery {
  name: string;
  rarity?: ItemRarity;
}

/**
 * Servicio de precios: resuelve nombres de divisa/item a PriceQuote usando
 * los endpoints documentados. Nunca inventa precios: sin dato → value: null,
 * verified: false, detail "No verificado".
 */
export class PriceService {
  readonly #client: PoeNinjaClient;

  constructor(client: PoeNinjaClient) {
    this.#client = client;
  }

  async getQuotes(queries: Array<string | PriceQuery>, league: string): Promise<QuotesResult> {
    // 1) Exchange de divisas primero: también nos da la moneda primaria de la liga.
    const currencyOverviews: OverviewResult[] = [];
    for (const type of CURRENCY_TYPES) {
      const ov = await this.#client.getOverview(league, type);
      if (ov) currencyOverviews.push(ov);
    }
    const itemOverviews: OverviewResult[] = [];
    for (const type of ITEM_TYPES) {
      const ov = await this.#client.getOverview(league, type);
      if (ov) itemOverviews.push(ov);
    }
    const overviews = [...currencyOverviews, ...itemOverviews];

    // Moneda primaria de cotización (la misma para items de la liga).
    const primaryRaw = currencyOverviews
      .map((ov) => asExchangeOverview(ov.payload).core?.primary)
      .find((p): p is string => typeof p === "string");
    const primary = mapPrimaryCurrency(primaryRaw);
    /** verified solo es posible si la primaria es una moneda reconocida. */
    const primaryRecognized =
      primaryRaw === "divine" || primaryRaw === "exalted" || primaryRaw === "chaos";
    // Una primaria desconocida sigue siendo desconocida: null, nunca una
    // afirmación concreta (los quotes individuales llevan su nota "No verificado").
    const primaryCurrency: CurrencyKind | null = primaryRecognized ? primary.currency : null;

    // Tasas de conversión con origen y verificación (null si no hubo exchange).
    const ratesOverview = currencyOverviews.find(
      (ov) => typeof asExchangeOverview(ov.payload).core?.rates === "object",
    );
    const ratesValues = ratesOverview
      ? (asExchangeOverview(ratesOverview.payload).core?.rates ?? null)
      : null;
    const rates: MarketRates | null =
      ratesOverview && ratesValues
        ? {
            values: ratesValues,
            origin: ratesOverview.origin,
            verified:
              (ratesOverview.origin === "live" || ratesOverview.origin === "cache-fresh") &&
              primaryRecognized,
            fetchedAt: ratesOverview.fetchedAt,
          }
        : null;

    const anyFromCache = overviews.some((o) => o.fromCache);
    const anyDegraded = overviews.some((o) => o.degraded) || overviews.length === 0;
    const updatedAt =
      overviews
        .map((o) => o.fetchedAt)
        .sort()
        .at(-1) ?? new Date().toISOString();

    const originDetail = (origin: OverviewOrigin): string | undefined =>
      origin === "fixture"
        ? "No verificado — dato de fixture offline (sin llamada de red)."
        : origin === "cache-stale"
          ? "No verificado — caché antigua servida tras fallo del servicio."
          : undefined;

    const quotes: PriceQuote[] = queries.map((rawQuery) => {
      const query: PriceQuery = typeof rawQuery === "string" ? { name: rawQuery } : rawQuery;
      const name = query.name.trim();
      const needle = name.toLowerCase();

      // a) Divisas (exchange): lines[].id → core.items[].name; valor = primaryValue.
      for (const ov of currencyOverviews) {
        const exchange = asExchangeOverview(ov.payload);
        const itemsById = new Map((exchange.core?.items ?? []).map((i) => [i.id, i.name]));
        const line = (exchange.lines ?? []).find((l) => {
          const lineName = (itemsById.get(l.id) ?? l.id).toLowerCase();
          return lineName === needle;
        });
        if (line) {
          const value = typeof line.primaryValue === "number" ? line.primaryValue : null;
          // verified solo si el dato es live/cache-fresh Y la primaria es reconocida.
          const verified =
            (ov.origin === "live" || ov.origin === "cache-fresh") &&
            value !== null &&
            primaryRecognized;
          const primaryNote = !primaryRecognized
            ? (primary.note ??
              "No verificado — moneda primaria no reconocida: el quote queda sin verificar.")
            : null;
          const detail = [originDetail(ov.origin), primaryNote].filter(Boolean).join(" ");
          return {
            itemName: name,
            currency: primary.currency,
            value,
            source: "poe.ninja",
            league,
            fetchedAt: ov.fetchedAt,
            fromCache: ov.fromCache,
            verified,
            ...(detail ? { detail } : {}),
          } satisfies PriceQuote;
        }
      }

      // b) Items únicos (stash): SOLO match exacto de nombre de único, y nunca
      //    cuando la consulta declara que el objeto NO es único (un rare jamás
      //    se valora con precios de únicos aunque coincida la base).
      const mayBeUnique = query.rarity === undefined || query.rarity === "unique";
      if (mayBeUnique) {
        for (const ov of itemOverviews) {
          const line = stashLinesOf(ov.payload).find(
            (l) => typeof l.name === "string" && l.name.toLowerCase() === needle,
          );
          if (line) {
            const value = typeof line.primaryValue === "number" ? line.primaryValue : null;
            // verified solo si el dato es live/cache-fresh Y la primaria es reconocida.
            const verified =
              (ov.origin === "live" || ov.origin === "cache-fresh") &&
              value !== null &&
              primaryRecognized;
            const primaryNote = !primaryRecognized
              ? (primary.note ??
                "No verificado — moneda primaria no reconocida: el quote queda sin verificar.")
              : null;
            const detail = [originDetail(ov.origin), primaryNote].filter(Boolean).join(" ");
            return {
              itemName: name,
              currency: primary.currency,
              value,
              source: "poe.ninja",
              league,
              fetchedAt: ov.fetchedAt,
              fromCache: ov.fromCache,
              verified,
              ...(detail ? { detail } : {}),
            } satisfies PriceQuote;
          }
        }
      }

      return {
        itemName: name,
        currency: primary.currency,
        value: null,
        source: "poe.ninja",
        league,
        fetchedAt: updatedAt,
        fromCache: anyFromCache,
        verified: false,
        detail:
          query.rarity !== undefined && query.rarity !== "unique"
            ? `No verificado — "${name}" no es único: los precios de mercado de únicos no aplican a objetos ${query.rarity}.`
            : `No verificado — "${name}" no aparece en los overviews consultados de poe.ninja.`,
      } satisfies PriceQuote;
    });

    return {
      quotes,
      league,
      updatedAt,
      fromCache: anyFromCache,
      degraded: anyDegraded,
      primaryCurrency,
      rates,
    };
  }
}
