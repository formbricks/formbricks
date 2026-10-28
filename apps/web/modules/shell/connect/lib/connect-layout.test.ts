import { describe, expect, test } from "vitest";
import { getConnectLayout } from "./connect-layout";

describe("getConnectLayout", () => {
  test("with no agent connected, connecting comes first and setup is secondary", () => {
    const layout = getConnectLayout(0);

    expect(layout.hasAgent).toBe(false);
    expect(layout.sections).toEqual([
      { id: "connect", step: 1, emphasis: "primary" },
      { id: "setup", step: 2, emphasis: "secondary" },
    ]);
  });

  test("with an agent connected, the setup prompt is primary and connecting another stays reachable", () => {
    for (const count of [1, 5]) {
      const layout = getConnectLayout(count);

      expect(layout.hasAgent).toBe(true);
      expect(layout.sections).toEqual([
        { id: "setup", step: null, emphasis: "primary" },
        { id: "connect", step: null, emphasis: "secondary" },
      ]);
    }
  });

  test("both parts are always shown, only their order and emphasis change", () => {
    for (const count of [0, 1]) {
      expect(
        getConnectLayout(count)
          .sections.map((section) => section.id)
          .sort()
      ).toEqual(["connect", "setup"]);
    }
  });
});
