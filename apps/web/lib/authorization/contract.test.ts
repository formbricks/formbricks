import { describe, expect, test } from "vitest";
import { AUTHORIZATION_PERMISSION_MAP } from "./contract";

describe("current authorization vocabulary", () => {
  test("contains exactly the current resource permissions", () => {
    expect(AUTHORIZATION_PERMISSION_MAP).toEqual({
      apiKey: ["read", "manage"],
      organization: [
        "read",
        "write",
        "manage",
        "manage_billing",
        "read_access",
        "manage_access",
        "manage_api_keys",
      ],
      team: ["read", "manage", "delete"],
      workspace: ["read", "write", "manage", "share"],
      survey: ["read", "write", "manage", "delete", "publish", "response_read", "response_export"],
      dashboard: ["read", "write"],
      response: ["read", "write", "manage", "export"],
    });
  });

  test("contains 29 actions and no deferred capabilities", () => {
    const actions = Object.entries(AUTHORIZATION_PERMISSION_MAP).flatMap(([resourceType, permissions]) =>
      permissions.map((permission) => `${resourceType}.${permission}`)
    );

    expect(actions).toHaveLength(29);
    expect(actions).not.toContain("survey.share");
    expect(actions).not.toContain("dashboard.manage");
    expect(actions).not.toContain("auditLog.read");
  });
});
