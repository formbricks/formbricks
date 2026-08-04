import { describe, expect, test } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { hasApiKeyImplicitFeedbackDirectoryAccess } from "./feedback-records-gateway-authz";

const DIRECTORY_ORG_ID = "org_directory";
const DIRECTORY_WORKSPACE_ID = "wsdirectory0000000000000";

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
        hasApiKeyImplicitFeedbackDirectoryAccess(ownerKey, DIRECTORY_ORG_ID, [DIRECTORY_WORKSPACE_ID], "read")
      ).toBe(false);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          ownerKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write"
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
          "read"
        )
      ).toBe(false);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          foreignKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write"
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
          "write"
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
          "read"
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
          "write"
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
          "write"
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
          "read"
        )
      ).toBe(false);
    });
  });
});
