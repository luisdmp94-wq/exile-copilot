import { describe, expect, it } from "vitest";
import { guidesFor } from "../../src/guides/index.js";
import type { GuideRouteStep } from "../../src/guides/guide.js";
import {
  LAST_GUIDE_STORAGE_KEY,
  ROUTE_STORAGE_PREFIX,
  nextRouteIndex,
  readResumePoint,
} from "../../src/lib/resumePoint.js";

function store(entries: Record<string, string>) {
  return { getItem: (key: string) => entries[key] ?? null };
}

const guides = [...guidesFor("es")].sort((a, b) => a.act - b.act);
const actTwo = guides.find((guide) => guide.act === 2)!;
const actTwoRoute = actTwo.route!;

describe("«Sigues por aquí»", () => {
  it("sin nada marcado ni guía abierta no dice nada", () => {
    expect(readResumePoint(store({}), "es")).toBeNull();
  });

  it("con zonas marcadas, dice el acto, lo hecho y la siguiente zona", () => {
    const done = actTwoRoute.slice(0, 3).map((step) => step.zone);
    const point = readResumePoint(store({ [ROUTE_STORAGE_PREFIX + actTwo.slug]: JSON.stringify(done) }), "es")!;
    expect(point.slug).toBe(actTwo.slug);
    expect(point.actLabel).toMatch(/^Acto 2/);
    expect(point.done).toBe(3);
    expect(point.total).toBe(actTwoRoute.length);
    expect(point.next?.zone).toBe(actTwoRoute[point.next!.step - 1].zone);
    expect(point.next!.step).toBeGreaterThan(3);
  });

  it("una zona opcional pero clave (la ascendencia) no se salta", () => {
    const steps: GuideRouteStep[] = [
      { zone: "A", text: "", priority: "historia", sourceIds: [] },
      { zone: "B", text: "", priority: "clave", optional: true, sourceIds: [] },
      { zone: "C", text: "", priority: "recomendable", optional: true, sourceIds: [] },
      { zone: "D", text: "", priority: "historia", sourceIds: [] },
    ];
    expect(nextRouteIndex(steps, (index) => index === 0)).toBe(1);
    expect(nextRouteIndex(steps, (index) => index <= 1)).toBe(3);
    expect(nextRouteIndex(steps, (index) => index !== 2)).toBe(2);
    expect(nextRouteIndex(steps, () => true)).toBe(-1);
  });

  it("si acabó un acto, lleva al siguiente", () => {
    const actOne = guides.find((guide) => guide.act === 1)!;
    const all = actOne.route!.map((step) => step.zone);
    const point = readResumePoint(store({ [ROUTE_STORAGE_PREFIX + actOne.slug]: JSON.stringify(all) }), "es")!;
    expect(point.slug).toBe(actTwo.slug);
    expect(point.starting).toBe(true);
    expect(point.next?.step).toBe(1);
  });

  it("sin marcar nada, usa la última guía abierta", () => {
    const point = readResumePoint(store({ [LAST_GUIDE_STORAGE_KEY]: actTwo.slug }), "es")!;
    expect(point.slug).toBe(actTwo.slug);
    expect(point.starting).toBe(true);
  });

  it("en inglés enseña la zona en inglés, aunque se marcó con el nombre en español", () => {
    const done = actTwoRoute.slice(0, 1).map((step) => step.zone);
    const point = readResumePoint(store({ [ROUTE_STORAGE_PREFIX + actTwo.slug]: JSON.stringify(done) }), "en")!;
    const english = guidesFor("en").find((guide) => guide.slug === actTwo.slug)!;
    expect(point.next?.zone).toBe(english.route![point.next!.step - 1].zone);
    expect(point.actLabel).toMatch(/^Act 2/);
  });

  it("lo guardado roto no rompe nada", () => {
    expect(readResumePoint(store({ [ROUTE_STORAGE_PREFIX + actTwo.slug]: "{roto" }), "es")).toBeNull();
  });
});
