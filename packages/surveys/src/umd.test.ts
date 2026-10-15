import { describe, expect, test, vi } from "vitest";

// What Zod's config was when the renderer's module graph started evaluating: schemas are built at
// import time, and each one decides then whether to probe `new Function` (ENG-3969).
const seen = vi.hoisted(() => ({ jitlessWhenIndexLoaded: undefined as boolean | undefined }));

vi.mock("./index", async () => {
  const { z } = await import("zod");
  seen.jitlessWhenIndexLoaded = z.config().jitless;
  return {};
});

describe("UMD entry", () => {
  test("turns Zod's JIT off before the renderer builds any schema", async () => {
    await import("./umd");

    expect(seen.jitlessWhenIndexLoaded).toBe(true);
  });
});
