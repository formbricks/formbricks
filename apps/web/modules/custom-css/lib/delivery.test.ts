import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TCustomCssInput, TCustomCssStored } from "@formbricks/types/custom-css";
import { cache } from "@/lib/cache";
import { processCustomCss } from "@/modules/custom-css/processor";
import { getCustomCssHealth, toDeliveredCustomCss } from "./delivery";

vi.mock("server-only", () => ({}));

// vitestSetup.ts stubs createHash to a constant; the cache key has to hash the real source.
vi.mock(
  "node:crypto",
  async (importOriginal: () => Promise<typeof import("node:crypto")>) => await importOriginal()
);

vi.mock("@formbricks/database", () => ({ prisma: {} }));

// A stand-in for Redis that really caches, so the tests see reuse rather than a pass-through.
const memory = new Map<string, unknown>();
vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(async (fn: () => Promise<unknown>, key: string) => {
      if (!memory.has(key)) memory.set(key, await fn());
      return memory.get(key);
    }),
  },
}));

vi.mock("@/modules/custom-css/processor", () => ({
  CUSTOM_CSS_PROCESSOR_VERSION: 5,
  processCustomCss: vi.fn(),
  normalizeCustomCssInput: (input: unknown) => input,
}));

vi.mock("./access", () => ({ CUSTOM_CSS_PLAN_REQUIRED_MESSAGE: "", getCustomCssPlanAllowed: vi.fn() }));

const stored = (version: number, light = "a{}", dark: string | null = null): TCustomCssStored => ({
  light: { source: light, compiled: `OLD(${light})` },
  dark: dark === null ? null : { source: dark, compiled: `OLD(${dark})` },
  processorVersion: version,
});

beforeEach(() => {
  vi.clearAllMocks();
  memory.clear();
  vi.mocked(processCustomCss).mockImplementation((({ input }: { input: TCustomCssInput }) => ({
    ok: true,
    compiled: {
      light: input.light ? `NEW(${input.light})` : null,
      dark: input.dark ? `NEW(${input.dark})` : null,
    },
    warnings: [],
    processorVersion: 5,
  })) as never);
});

describe("toDeliveredCustomCss", () => {
  test("no stored CSS is no custom layer", async () => {
    await expect(toDeliveredCustomCss(null, "survey")).resolves.toBeUndefined();
    await expect(
      toDeliveredCustomCss({ light: null, dark: null, processorVersion: 5 }, "survey")
    ).resolves.toBeUndefined();
  });

  test("current output is delivered as compiled CSS only, with no reprocessing", async () => {
    await expect(toDeliveredCustomCss(stored(5, "a{}", "b{}"), "workspace")).resolves.toEqual({
      light: "OLD(a{})",
      dark: "OLD(b{})",
    });
    expect(processCustomCss).not.toHaveBeenCalled();
  });

  test("omits an appearance with no output", async () => {
    await expect(
      toDeliveredCustomCss(
        { light: { source: "/* */", compiled: "" }, dark: null, processorVersion: 5 },
        "survey"
      )
    ).resolves.toBeUndefined();
  });

  test("stale output is recompiled from source, once per version and source", async () => {
    await expect(toDeliveredCustomCss(stored(4), "survey")).resolves.toEqual({ light: "NEW(a{})" });
    await expect(toDeliveredCustomCss(stored(3), "survey")).resolves.toEqual({ light: "NEW(a{})" });

    expect(processCustomCss).toHaveBeenCalledTimes(1);
    const key = vi.mocked(cache.withCache).mock.calls[0][1];
    expect(key).toMatch(/^fb:custom-css:survey:v5:[0-9a-f]{64}$/);
    expect(vi.mocked(cache.withCache).mock.calls[0][2]).toBeGreaterThan(0);
  });

  test("a different source gets a different cache entry", async () => {
    await toDeliveredCustomCss(stored(4, "a{}"), "survey");
    await toDeliveredCustomCss(stored(4, "b{}"), "survey");
    expect(processCustomCss).toHaveBeenCalledTimes(2);
  });

  test("stale output whose source fails the current policy is withheld, never served as it was", async () => {
    vi.mocked(processCustomCss).mockReturnValue({
      ok: false,
      errors: [
        { code: "syntax_error", scope: "survey", appearance: "light", line: 1, column: 1, reason: "bad" },
      ],
    });

    await expect(toDeliveredCustomCss(stored(4), "survey")).resolves.toBeUndefined();
  });

  test("a processor throw while reprocessing is withheld too", async () => {
    vi.mocked(processCustomCss).mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(toDeliveredCustomCss(stored(4), "survey")).resolves.toBeUndefined();
  });

  test("corrupt stored data delivers nothing", async () => {
    await expect(
      toDeliveredCustomCss({ light: "x" } as unknown as TCustomCssStored, "survey")
    ).resolves.toBeUndefined();
  });
});

describe("getCustomCssHealth", () => {
  test("ok for current or absent CSS", async () => {
    await expect(getCustomCssHealth(null, "workspace")).resolves.toEqual({ status: "ok" });
    await expect(getCustomCssHealth(stored(5), "workspace")).resolves.toEqual({ status: "ok" });
  });

  test("stale when an older version still passes, withheld with errors when it no longer does", async () => {
    await expect(getCustomCssHealth(stored(4), "workspace")).resolves.toEqual({ status: "stale" });

    const errors = [
      {
        code: "limit_exceeded" as const,
        scope: "workspace" as const,
        appearance: null,
        line: null,
        column: null,
        reason: "Too many rules",
      },
    ];
    vi.mocked(processCustomCss).mockReturnValue({ ok: false, errors });
    await expect(getCustomCssHealth(stored(4, "c{}"), "workspace")).resolves.toEqual({
      status: "withheld",
      errors,
    });
  });
});
