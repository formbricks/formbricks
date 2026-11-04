import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SIGNATURE_FONT_FAMILY } from "./signature-draw";
import {
  FONT_LOAD_TIMEOUT_MS,
  type SignatureFontEnvironment,
  loadSignatureFont,
  resetSignatureFontCache,
} from "./signature-font";

const createEnvironment = (load: () => Promise<unknown> = () => Promise.resolve()) => {
  const added: unknown[] = [];
  const created: { family: string; source: string; descriptors: Record<string, string> }[] = [];
  const environment: SignatureFontEnvironment = {
    createFontFace: (family, source, descriptors) => {
      created.push({ family, source, descriptors });
      return { load };
    },
    addToDocument: (face) => added.push(face),
  };
  return { environment, added, created };
};

beforeEach(() => {
  resetSignatureFontCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadSignatureFont", () => {
  test("loads the face from the URL and registers it with the document", async () => {
    const { environment, added, created } = createEnvironment();
    await expect(loadSignatureFont("https://app.test/js/fonts/ds.woff2?v=abc", environment)).resolves.toBe(
      true
    );
    expect(created).toEqual([
      {
        family: SIGNATURE_FONT_FAMILY,
        source: 'url("https://app.test/js/fonts/ds.woff2?v=abc")',
        descriptors: expect.objectContaining({ weight: "400 700" }),
      },
    ]);
    expect(added).toHaveLength(1);
  });

  test("requests each URL once, even from concurrent callers", async () => {
    const { environment, created } = createEnvironment();
    const results = await Promise.all([
      loadSignatureFont("https://app.test/a.woff2", environment),
      loadSignatureFont("https://app.test/a.woff2", environment),
    ]);
    expect(results).toEqual([true, true]);
    expect(created).toHaveLength(1);
  });

  test("resolves false, never rejects, when the font cannot be loaded", async () => {
    const { environment, added } = createEnvironment(() => Promise.reject(new Error("network error")));
    await expect(loadSignatureFont("https://app.test/b.woff2", environment)).resolves.toBe(false);
    expect(added).toHaveLength(0);
  });

  test("a failed load is retried by the next call", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(undefined);
    const { environment } = createEnvironment(load);
    expect(await loadSignatureFont("https://app.test/c.woff2", environment)).toBe(false);
    expect(await loadSignatureFont("https://app.test/c.woff2", environment)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("resolves false where there is no FontFace API", async () => {
    await expect(loadSignatureFont("https://app.test/d.woff2", null)).resolves.toBe(false);
  });
});

describe("loadSignatureFont timeout", () => {
  test("gives up after the timeout so a stalled font cannot hold up drawing", async () => {
    vi.useFakeTimers();
    const { environment, added } = createEnvironment(() => new Promise(() => undefined));
    const result = loadSignatureFont("https://app.test/slow.woff2", environment);
    await vi.advanceTimersByTimeAsync(FONT_LOAD_TIMEOUT_MS - 1);
    let settled = false;
    void result.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe(false);
    expect(added).toHaveLength(0);
  });

  test("a font that arrives in time resolves true and cancels the timer", async () => {
    vi.useFakeTimers();
    const { environment } = createEnvironment(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    const result = loadSignatureFont("https://app.test/ok.woff2", environment);
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test("a timed-out load is forgotten, so the next call tries again", async () => {
    vi.useFakeTimers();
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockResolvedValueOnce(undefined);
    const { environment } = createEnvironment(load);
    const first = loadSignatureFont("https://app.test/retry.woff2", environment);
    await vi.advanceTimersByTimeAsync(FONT_LOAD_TIMEOUT_MS);
    await expect(first).resolves.toBe(false);
    await expect(loadSignatureFont("https://app.test/retry.woff2", environment)).resolves.toBe(true);
  });
});
