import { describe, expect, test } from "vitest";
import { hasWorkspaceAccessChanges } from "./workspace-access";

describe("hasWorkspaceAccessChanges", () => {
  test("reports no change when the submitted grants match the stored ones", () => {
    const current = [
      { workspaceId: "ws-1", permission: "read" as const },
      { workspaceId: "ws-2", permission: "manage" as const },
    ];

    expect(hasWorkspaceAccessChanges(current, current)).toBe(false);
  });

  test("reports no change when the same grants arrive in a different order", () => {
    expect(
      hasWorkspaceAccessChanges(
        [
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-2", permission: "manage" as const },
        ],
        [
          { workspaceId: "ws-2", permission: "manage" as const },
          { workspaceId: "ws-1", permission: "read" as const },
        ]
      )
    ).toBe(false);
  });

  // The escalation this guards: a team admin submitting an extra workspace, or upgrading an existing
  // grant, to give their own team access org-wide.
  test("reports a change when a workspace is added", () => {
    expect(
      hasWorkspaceAccessChanges(
        [{ workspaceId: "ws-1", permission: "read" as const }],
        [
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-victim", permission: "manage" as const },
        ]
      )
    ).toBe(true);
  });

  test("reports a change when a permission is escalated", () => {
    expect(
      hasWorkspaceAccessChanges(
        [{ workspaceId: "ws-1", permission: "read" as const }],
        [{ workspaceId: "ws-1", permission: "manage" as const }]
      )
    ).toBe(true);
  });

  test("reports a change when a workspace is removed", () => {
    expect(
      hasWorkspaceAccessChanges(
        [
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-2", permission: "read" as const },
        ],
        [{ workspaceId: "ws-1", permission: "read" as const }]
      )
    ).toBe(true);
  });

  test("reports a change when a workspace is swapped for another", () => {
    expect(
      hasWorkspaceAccessChanges(
        [{ workspaceId: "ws-1", permission: "read" as const }],
        [{ workspaceId: "ws-victim", permission: "read" as const }]
      )
    ).toBe(true);
  });

  // Duplicates must not let a submission pad its length to match the stored count.
  test("reports a change when a duplicated workspace masks an added one", () => {
    expect(
      hasWorkspaceAccessChanges(
        [
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-2", permission: "read" as const },
        ],
        [
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-1", permission: "read" as const },
          { workspaceId: "ws-victim", permission: "manage" as const },
        ]
      )
    ).toBe(true);
  });

  // The harder duplicate: the *last* entry matches the stored grant, so a `Map` keyed on workspaceId
  // collapses to something equal to `current` and the gate would be skipped, while an earlier entry
  // carries the escalated permission. Raised by CodeRabbit on #8680.
  test("reports a change when a duplicate hides an escalated permission behind a matching one", () => {
    expect(
      hasWorkspaceAccessChanges(
        [{ workspaceId: "ws-1", permission: "read" as const }],
        [
          { workspaceId: "ws-1", permission: "manage" as const },
          { workspaceId: "ws-1", permission: "read" as const },
        ]
      )
    ).toBe(true);
  });
});
