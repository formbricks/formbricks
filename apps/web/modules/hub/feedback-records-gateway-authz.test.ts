import { describe, expect, test } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  canApiKeyMutateFeedbackDirectoryRecords,
  hasApiKeyImplicitFeedbackDirectoryAccess,
} from "./feedback-records-gateway-authz";

const DIRECTORY_ORG_ID = "org_directory";
const DIRECTORY_WORKSPACE_ID = "wsdirectory0000000000000";
const OTHER_DIRECTORY_WORKSPACE_ID = "wsdirectory1111111111111";

const makeApiKeyAuth = (overrides: Partial<TAuthenticationApiKey> = {}): TAuthenticationApiKey => ({
  type: "apiKey",
  apiKeyId: "key_1",
  organizationId: DIRECTORY_ORG_ID,
  organizationAccess: { accessControl: { read: false, write: false } },
  workspacePermissions: [],
  ...overrides,
});

describe("hasApiKeyImplicitFeedbackDirectoryAccess", () => {
  describe("organization-level access control does not grant feedback-record access", () => {
    // organizationAccess.accessControl governs org management (members/teams), NOT workspace data.
    // Feedback records are workspace-scoped, so they must never be reachable via org-level access —
    // only via a matching workspace permission.
    test("denies a same-organization key with org-level write and no matching workspace permission", () => {
      const ownerKey = makeApiKeyAuth({
        organizationAccess: { accessControl: { read: true, write: true } },
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          ownerKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "read",
          false
        )
      ).toBe(false);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          ownerKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write",
          false
        )
      ).toBe(false);
    });

    test("denies a foreign-organization key regardless of org-level or workspace access (ENG-1980)", () => {
      const foreignKey = makeApiKeyAuth({
        organizationId: "org_attacker",
        organizationAccess: { accessControl: { read: true, write: true } },
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "manage" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          foreignKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "read",
          false
        )
      ).toBe(false);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          foreignKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write",
          false
        )
      ).toBe(false);
    });
  });

  describe("workspace-permission path (same-organization keys only)", () => {
    test("grants a same-organization key (no org-level access) via a matching workspace permission", () => {
      // Fall-through: org-level accessControl is all-false, so access comes solely from the
      // per-workspace permission.
      const workspaceKey = makeApiKeyAuth({
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "write" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          workspaceKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write",
          false
        )
      ).toBe(true);
    });

    test("grants a read op via a read workspace permission (equal weight)", () => {
      const workspaceKey = makeApiKeyAuth({
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "read" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          workspaceKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "read",
          false
        )
      ).toBe(true);
    });

    test("grants a write op via a manage workspace permission (higher weight)", () => {
      const workspaceKey = makeApiKeyAuth({
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "manage" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          workspaceKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write",
          false
        )
      ).toBe(true);
    });

    test("denies when the read-only workspace permission is below the required write weight", () => {
      const workspaceKey = makeApiKeyAuth({
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "read" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          workspaceKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write",
          false
        )
      ).toBe(false);
    });

    test("denies when no workspace permission matches a directory workspace", () => {
      const workspaceKey = makeApiKeyAuth({
        workspacePermissions: [
          { workspaceId: "wsother00000000000000000", workspaceName: "Other", permission: "manage" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          workspaceKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "read",
          false
        )
      ).toBe(false);
    });
  });

  // ENG-2189: a shared directory's records carry no workspace, so a workspace permission cannot say
  // whose they are. ENG-2083: deletes additionally require `manage`, matching DELETE everywhere else.
  describe("record mutations in a shared directory (ENG-2189, ENG-2083)", () => {
    const sharedDirectory = [DIRECTORY_WORKSPACE_ID, OTHER_DIRECTORY_WORKSPACE_ID];
    const soleDirectory = [DIRECTORY_WORKSPACE_ID];

    const keyWith = (permission: "read" | "write" | "manage"): TAuthenticationApiKey =>
      makeApiKeyAuth({
        workspacePermissions: [{ workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission }],
      });

    test("refuses a mutation in a shared directory even with write on one of its workspaces", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("write"),
          DIRECTORY_ORG_ID,
          sharedDirectory,
          "write",
          true
        )
      ).toBe(false);
    });

    test("refuses a mutation in a shared directory even at manage — weight cannot buy out of it", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("manage"),
          DIRECTORY_ORG_ID,
          sharedDirectory,
          "manage",
          true
        )
      ).toBe(false);
    });

    test("allows a mutation when the directory belongs to exactly one workspace", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("manage"),
          DIRECTORY_ORG_ID,
          soleDirectory,
          "manage",
          true
        )
      ).toBe(true);
    });

    test("still applies the permission weight in a sole-workspace directory (ENG-2083)", () => {
      // `write` is no longer enough for a delete, which the gateway routes as `manage`.
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("write"),
          DIRECTORY_ORG_ID,
          soleDirectory,
          "manage",
          true
        )
      ).toBe(false);
    });

    test("leaves creates in a shared directory alone — adding records is ordinary workspace work", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("write"),
          DIRECTORY_ORG_ID,
          sharedDirectory,
          "write",
          false
        )
      ).toBe(true);
    });

    test("leaves reads in a shared directory alone — seeing everything is the point of sharing", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          keyWith("read"),
          DIRECTORY_ORG_ID,
          sharedDirectory,
          "read",
          false
        )
      ).toBe(true);
    });

    test("still refuses a foreign-organization key on a mutation (ENG-1980)", () => {
      const foreignKey = makeApiKeyAuth({
        organizationId: "org_attacker",
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "manage" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(foreignKey, DIRECTORY_ORG_ID, soleDirectory, "manage", true)
      ).toBe(false);
    });

    test("refuses a mutation in a directory assigned to no workspace at all", () => {
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(keyWith("manage"), DIRECTORY_ORG_ID, [], "manage", true)
      ).toBe(false);
    });
  });
});

describe("canApiKeyMutateFeedbackDirectoryRecords", () => {
  test("refuses a directory with no workspaces — nobody's permission covers it", () => {
    expect(canApiKeyMutateFeedbackDirectoryRecords([])).toBe(false);
  });

  test("allows a directory owned by exactly one workspace", () => {
    expect(canApiKeyMutateFeedbackDirectoryRecords([DIRECTORY_WORKSPACE_ID])).toBe(true);
  });

  test("refuses as soon as a second workspace shares the directory", () => {
    expect(
      canApiKeyMutateFeedbackDirectoryRecords([DIRECTORY_WORKSPACE_ID, OTHER_DIRECTORY_WORKSPACE_ID])
    ).toBe(false);
  });
});
