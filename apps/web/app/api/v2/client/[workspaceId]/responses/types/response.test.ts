import { describe, expect, test } from "vitest";
import { MAX_RESPONSE_TTC } from "@formbricks/types/responses";
import { ZResponseInputV2 } from "./response";

describe("ZResponseInputV2 ttc sanitization", () => {
  const base = {
    workspaceId: "cm8f4x9mm0001gx9h5b7d7h3q",
    surveyId: "cm8f4x9mm0002gx9h5b7d7h3q",
    finished: true,
    data: {},
  };

  test("clamps negative and absurdly large ttc values into [0, MAX_RESPONSE_TTC]", () => {
    const result = ZResponseInputV2.safeParse({
      ...base,
      ttc: { q1: -1, q2: 1e15, q3: 5000 },
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Out-of-range telemetry is clamped, not rejected: the response is still accepted.
    expect(result.data.ttc).toEqual({ q1: 0, q2: MAX_RESPONSE_TTC, q3: 5000 });
  });

  test("leaves in-range ttc values untouched", () => {
    const result = ZResponseInputV2.safeParse({ ...base, ttc: { q1: 0, q2: 42_000 } });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.ttc).toEqual({ q1: 0, q2: 42_000 });
  });
});
