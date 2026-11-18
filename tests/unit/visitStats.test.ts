import { afterEach, describe, expect, it } from "vitest";
import { classifySource, looksLikeBot, pageOf, sourceFromHeader } from "../../shared/visitStats.js";
import { createDatabase } from "../../server/db/database.js";
import { readStats, recordArea, recordUse, recordVisit } from "../../server/analytics.js";
import { buildVisitBeacon, isOwnerBrowser, visitSource } from "../../src/lib/visitBeacon.js";

describe("de dónde llega una visita", () => {
  const own = "exilecopilot.com";

  it("reconoce los sitios desde los que se va a enseñar la web", () => {
    expect(classifySource("https://www.reddit.com/r/PathOfExile2/", null, own)).toBe("reddit");
    expect(classifySource("https://old.reddit.com/", null, own)).toBe("reddit");
    expect(classifySource("https://www.twitch.tv/", null, own)).toBe("twitch");
    expect(classifySource("https://www.google.es/", null, own)).toBe("buscador");
    expect(classifySource("https://discord.com/channels/1/2", null, own)).toBe("discord");
    expect(classifySource("https://steamcommunity.com/app/2694490/discussions/", null, own)).toBe("steam");
    expect(classifySource("https://es.pathofexile.com/forum/view-thread/4016512", null, own)).toBe("foro");
    expect(classifySource("https://www.pathofexile.com/forum", null, own)).toBe("foro");
  });

  it("la cabecera de origen solo acepta nombres de la lista", () => {
    expect(sourceFromHeader("twitch")).toBe("twitch");
    expect(sourceFromHeader(" Steam ")).toBe("steam");
    expect(sourceFromHeader("mi-nombre")).toBe("directo");
    expect(sourceFromHeader(undefined)).toBe("directo");
  });

  it("sin página anterior, o desde la propia web, es «directo»", () => {
    expect(classifySource("", null, own)).toBe("directo");
    expect(classifySource("https://exilecopilot.com/guias/acto-1", null, own)).toBe("directo");
  });

  it("un sitio desconocido es «otro» y nunca se guarda su nombre", () => {
    expect(classifySource("https://foro-raro.example/hilo/123", null, own)).toBe("otro");
    expect(classifySource("no es una dirección", null, own)).toBe("otro");
  });

  it("?ref=twitch manda sobre la página anterior; un ?ref= inventado no", () => {
    expect(classifySource("", "twitch", own)).toBe("twitch");
    expect(classifySource("https://www.reddit.com/", "Twitch", own)).toBe("twitch");
    expect(classifySource("https://www.reddit.com/", "mi-nombre", own)).toBe("reddit");
  });

  it("la página se reduce a una sección conocida", () => {
    expect(pageOf("/")).toBe("inicio");
    expect(pageOf("/guias/acto-2")).toBe("guias");
    expect(pageOf("/estadisticas")).toBe("estadisticas");
    expect(pageOf("/cualquier/cosa?con=datos")).toBe("otra");
  });
});

describe("contador por día", () => {
  const now = new Date("2026-11-16T20:00:00Z");

  it("suma visitas, visitantes, nuevos, orígenes y usos sin guardar nada por persona", () => {
    const db = createDatabase(":memory:");
    recordVisit(db, { page: "inicio", source: "reddit", firstVisit: true, firstToday: true }, now);
    recordVisit(db, { page: "guias", source: "directo", firstVisit: false, firstToday: false }, now);
    recordVisit(db, { page: "inicio", source: "twitch", firstVisit: false, firstToday: true }, now);
    recordUse(db, "gema", now);
    recordUse(db, "gema", now);
    const [today, yesterday] = readStats(db, 2, now);
    expect(today).toEqual({
      day: "2026-11-16",
      visitors: 2,
      newVisitors: 1,
      visits: 3,
      sources: { reddit: 1, twitch: 1 },
      pages: { inicio: 2, guias: 1 },
      uses: { gema: 2 },
      areas: {},
      bySource: {
        reddit: { visitors: 1, areas: {}, uses: {} },
        twitch: { visitors: 1, areas: {}, uses: {} },
        directo: { visitors: 0, areas: {}, uses: { gema: 2 } },
      },
    });
    expect(yesterday).toMatchObject({ day: "2026-11-15", visitors: 0, visits: 0 });
    const columns = (db.prepare("PRAGMA table_info(daily_counts)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toEqual(["day", "kind", "label", "count"]);
  });

  it("separa áreas y usos por el sitio del que llegó la visita", () => {
    const db = createDatabase(":memory:");
    recordVisit(db, { page: "inicio", source: "twitch", firstVisit: true, firstToday: true }, now);
    recordArea(db, { area: "guias", source: "twitch" }, now);
    recordArea(db, { area: "expediente", source: "twitch" }, now);
    recordArea(db, { area: "guias", source: "steam" }, now);
    recordUse(db, "pieza-leida", now, "twitch");
    recordUse(db, "pieza-leida", now, "twitch");
    recordUse(db, "mentor", now);
    const [today] = readStats(db, 1, now);
    expect(today.areas).toEqual({ guias: 2, expediente: 1 });
    expect(today.uses).toEqual({ "pieza-leida": 2, mentor: 1 });
    expect(today.bySource.twitch).toEqual({
      visitors: 1,
      areas: { guias: 1, expediente: 1 },
      uses: { "pieza-leida": 2 },
    });
    expect(today.bySource.steam).toEqual({ visitors: 0, areas: { guias: 1 }, uses: {} });
    expect(today.bySource.directo?.uses).toEqual({ mentor: 1 });
  });
});

describe("aviso de visita del navegador", () => {
  const store = new Map<string, string>();
  const session = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => void session.set(key, value),
    },
  };
  const place = (href: string) => new URL(href);

  afterEach(() => {
    store.clear();
    session.clear();
    delete (globalThis as { window?: unknown }).window;
  });

  it("reconoce el navegador del dueño por la clave de estadísticas guardada", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    expect(isOwnerBrowser()).toBe(false);
    store.set("exile-copilot:clave-estadisticas", "   ");
    expect(isOwnerBrowser()).toBe(false);
    store.set("exile-copilot:clave-estadisticas", "una-clave-cualquiera");
    expect(isOwnerBrowser()).toBe(true);
  });

  it("recuerda de dónde llegó la visita aunque recargue o cambie de página", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    const day = new Date("2026-11-16T10:00:00Z");
    expect(visitSource()).toBe("directo");
    expect(buildVisitBeacon(place("https://exilecopilot.com/?ref=twitch"), "", day).source).toBe("twitch");
    expect(buildVisitBeacon(place("https://exilecopilot.com/guias/acto-1"), "https://exilecopilot.com/", day).source).toBe("twitch");
    expect(visitSource()).toBe("twitch");
  });

  it("quien llega desde un sitio desconocido sigue siendo «otro» al usar la web, no «directo»", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    const day = new Date("2026-11-16T10:00:00Z");
    expect(buildVisitBeacon(place("https://exilecopilot.com/"), "https://un-blog-cualquiera.example/post", day).source).toBe("otro");
    // Sus piezas pegadas y áreas abiertas se suman en «Otros».
    expect(visitSource()).toBe("otro");
    // Y un valor raro guardado a mano cuenta como directo.
    session.set("exile-copilot:origen-visita", "<script>");
    expect(visitSource()).toBe("directo");
  });

  it("la primera visita es nueva y de hoy; la siguiente del mismo día, no", () => {
    (globalThis as { window?: unknown }).window = fakeWindow;
    const day = new Date("2026-11-16T10:00:00Z");
    expect(buildVisitBeacon(place("https://exilecopilot.com/?ref=twitch"), "", day)).toEqual({
      page: "inicio",
      source: "twitch",
      firstVisit: true,
      firstToday: true,
    });
    expect(buildVisitBeacon(place("https://exilecopilot.com/guias/acto-1"), "", day)).toMatchObject({
      firstVisit: false,
      firstToday: false,
    });
    expect(buildVisitBeacon(place("https://exilecopilot.com/"), "", new Date("2026-11-17T10:00:00Z"))).toMatchObject({
      firstVisit: false,
      firstToday: true,
    });
  });
});

describe("robots fuera del contador", () => {
  it("un navegador de verdad cuenta", () => {
    expect(looksLikeBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/116.0.0.0")).toBe(false);
    expect(looksLikeBot("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(looksLikeBot("Mozilla/5.0 (Linux; Android 14; CUBOT KingKong) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")).toBe(false);
  });
  it("buscadores, vigilantes, vistas previas y navegadores automáticos no cuentan", () => {
    expect(looksLikeBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 HeadlessChrome/131.0.0.0 Safari/537.36")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)")).toBe(true);
    expect(looksLikeBot("python-requests/2.32")).toBe(true);
    expect(looksLikeBot("")).toBe(true);
    expect(looksLikeBot("Mozilla/5.0 (Windows NT 10.0) Chrome/131.0", true)).toBe(true);
  });
});
