import { describe, expect, test } from "vitest";
import { getDefaultConditionPath } from "./workflow-steps";

describe("getDefaultConditionPath", () => {
  test("starts a new If/else on the first Variable that can be picked", () => {
    expect(
      getDefaultConditionPath([
        {
          kind: "payload",
          hasSample: true,
          truncated: false,
          options: [
            { path: "payload.tags", label: "tags", typeHint: "list", isPickable: false },
            { path: "payload.channel", label: "channel", typeHint: "text", isPickable: true },
          ],
        },
      ])
    ).toBe("payload.channel");
  });

  test("falls back to a placeholder before any Variable is known", () => {
    expect(
      getDefaultConditionPath([{ kind: "payload", hasSample: false, truncated: false, options: [] }])
    ).toBe("payload.value");
  });
});
