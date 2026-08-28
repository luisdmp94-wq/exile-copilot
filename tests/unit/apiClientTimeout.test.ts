import { afterEach, describe, expect, it, vi } from "vitest";
import {
  api,
  MENTOR_REQUEST_TIMEOUT_MS,
} from "../../src/lib/api.js";
import type { MentorQueryRequest } from "../../shared/mentorQuery.js";

describe("plazo de la consulta del Mentor", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("libera la interfaz si la API nunca responde", async () => {
    vi.useFakeTimers();
    const captured: { signal: AbortSignal | null } = { signal: null };
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      captured.signal = init?.signal ?? null;
      return new Promise<Response>(() => {});
    });
    vi.stubGlobal("fetch", fetchImpl);

    const pending = api.mentorQuery({} as MentorQueryRequest);
    const assertion = expect(pending).rejects.toMatchObject({
      message: expect.stringContaining("Mentor tardó demasiado"),
      status: null,
    });

    await vi.advanceTimersByTimeAsync(MENTOR_REQUEST_TIMEOUT_MS);
    await assertion;

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(captured.signal?.aborted).toBe(true);
  });
});
