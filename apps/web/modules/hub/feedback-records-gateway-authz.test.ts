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
  describe("organization-level access control is bound to the API key's own organization (ENG-1980)", () => {
    test("denies a foreign-organization key that has org-level write, for read and write", () => {
      const foreignKey = makeApiKeyAuth({
        organizationId: "org_attacker",
        organizationAccess: { accessControl: { read: true, write: true } },
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

    test("grants a same-organization key with org-level write, for read and write", () => {
      const ownerKey = makeApiKeyAuth({
        organizationAccess: { accessControl: { read: false, write: true } },
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(ownerKey, DIRECTORY_ORG_ID, [DIRECTORY_WORKSPACE_ID], "read")
      ).toBe(true);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          ownerKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write"
        )
      ).toBe(true);
    });

    test("grants a same-organization key with org-level read only for read", () => {
      const readerKey = makeApiKeyAuth({
        organizationAccess: { accessControl: { read: true, write: false } },
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          readerKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "read"
        )
      ).toBe(true);
      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          readerKey,
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

    test("denies a foreign-organization key even with a matching workspace permission (defense-in-depth, ENG-1980)", () => {
      // Upstream (authenticateApiKeyFromHeaders) filters workspacePermissions to the key's own org,
      // so this shape shouldn't occur in production — but the authz function must deny it on its own
      // rather than rely on that invariant holding.
      const foreignKey = makeApiKeyAuth({
        organizationId: "org_attacker",
        workspacePermissions: [
          { workspaceId: DIRECTORY_WORKSPACE_ID, workspaceName: "Shared", permission: "manage" },
        ],
      });

      expect(
        hasApiKeyImplicitFeedbackDirectoryAccess(
          foreignKey,
          DIRECTORY_ORG_ID,
          [DIRECTORY_WORKSPACE_ID],
          "write"
        )
      ).toBe(false);
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
