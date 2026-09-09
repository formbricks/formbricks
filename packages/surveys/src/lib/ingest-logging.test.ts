import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { RESERVED_DECLARED_FIELD_NAMES } from "@formbricks/types/surveys/validation";
import { logIngestResult } from "./ingest-logging";

describe("logIngestResult", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  test("mutes verifiedEmail in any casing — the one key the product injects itself", () => {
    logIngestResult({
      data: {},
      dropped: [
        { key: "verifiedEmail", reason: "unknown_key" },
        { key: "verifiedemail", reason: "unknown_key" },
        { key: "VERIFIEDEMAIL", reason: "unknown_key" },
      ],
      flags: [],
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  /**
   * The narrowing this pins (ENG-1843): the mute used to cover the whole of
   * RESERVED_DECLARED_FIELD_NAMES, silencing sixteen names a host can genuinely send by mistake.
   * Iterating the shared set (minus the one self-injected key) means re-widening the mute to it —
   * the exact regression — goes red here without this test naming any list literal of its own.
   */
  test("every other reserved name warns — a host sending one by mistake must see why it vanished", () => {
    const hostMistakableNames = [...RESERVED_DECLARED_FIELD_NAMES].filter((name) => name !== "verifiedemail");
    expect(hostMistakableNames.length).toBeGreaterThan(0);

    logIngestResult({
      data: {},
      dropped: hostMistakableNames.map((key) => ({ key, reason: "unknown_key" as const })),
      flags: [],
    });

    expect(warnSpy).toHaveBeenCalledTimes(hostMistakableNames.length);
    expect(warnSpy.mock.calls[0][0]).toContain("is not an ingested Embedded Data field");
  });

  test("names the drop reason for ordinary keys", () => {
    logIngestResult({
      data: {},
      dropped: [{ key: "plan", reason: "locked_field" }],
      flags: [],
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('"plan"');
    expect(warnSpy.mock.calls[0][0]).toContain("locked");
  });

  test("flags always warn — even on a self-injected key, a flagged value is actionable", () => {
    logIngestResult({
      data: {},
      dropped: [],
      flags: [{ key: "verifiedEmail", reason: "truncated" }],
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain("truncated");
  });
});
