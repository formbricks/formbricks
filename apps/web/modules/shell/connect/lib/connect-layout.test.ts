import { describe, expect, test } from "vitest";
import { getConnectLayout } from "./connect-layout";

describe("getConnectLayout", () => {
  test("with no agent connected, connecting comes first and setup is secondary", () => {
    const layout = getConnectLayout(0, 1);

    expect(layout.hasAgent).toBe(false);
    expect(layout.sections).toEqual([
      { id: "connect", step: 1, emphasis: "primary" },
      { id: "setup", step: 2, emphasis: "secondary" },
    ]);
  });

  test("with an agent connected, the setup prompt is primary and connecting another stays reachable", () => {
    for (const count of [1, 5]) {
      const layout = getConnectLayout(count, 1);

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
        getConnectLayout(count, 1)
          .sections.map((section) => section.id)
          .sort()
      ).toEqual(["connect", "setup"]);
    }
  });

  test("an agent is connected and the organization has no workspace: the new-organization notice", () => {
    const layout = getConnectLayout(1, 0);

    expect(layout.notice).toBe("new_organization");
    expect(layout.sections[0]).toEqual({ id: "setup", step: null, emphasis: "primary" });
  });

  test("the notice follows connections first, then the workspace count", () => {
    expect(getConnectLayout(0, 0).notice).toBe("no_agent");
    expect(getConnectLayout(0, 3).notice).toBe("no_agent");
    expect(getConnectLayout(2, 3).notice).toBe("agent_connected");
    expect(getConnectLayout(2, 1).notice).toBe("agent_connected");
  });
});
