import { afterEach, describe, expect, it } from "vitest";
import { classifySource, pageOf } from "../../shared/visitStats.js";
import { createDatabase } from "../../server/db/database.js";
import { readStats, recordUse, recordVisit } from "../../server/analytics.js";
import { buildVisitBeacon } from "../../src/lib/visitBeacon.js";

describe("de dónde llega una visita", () => {
  const own = "exilecopilot.com";

  it("reconoce los sitios desde los que se va a enseñar la web", () => {
    expect(classifySource("https://www.reddit.com/r/PathOfExile2/", null, own)).toBe("reddit");
    expect(classifySource("https://old.reddit.com/", null, own)).toBe("reddit");
    expect(classifySource("https://www.twitch.tv/", null, own)).toBe("twitch");
    expect(classifySource("https://www.google.es/", null, own)).toBe("buscador");
    expect(classifySource("https://discord.com/channels/1/2", null, own)).toBe("discord");
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
    });
    expect(yesterday).toMatchObject({ day: "2026-11-15", visitors: 0, visits: 0 });
    const columns = (db.prepare("PRAGMA table_info(daily_counts)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(columns).toEqual(["day", "kind", "label", "count"]);
  });
});

describe("aviso de visita del navegador", () => {
  const store = new Map<string, string>();
  const fakeWindow = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  };
  const place = (href: string) => new URL(href);

  afterEach(() => {
    store.clear();
    delete (globalThis as { window?: unknown }).window;
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
