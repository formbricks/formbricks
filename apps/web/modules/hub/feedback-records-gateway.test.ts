import { describe, expect, test } from "vitest";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  hasApiKeyImplicitFeedbackDirectoryAccess,
  parseFeedbackRecordsGatewayRoute,
} from "./feedback-records-gateway";

const RECORD_ID = "0f4c3f4e-4f4a-4c8f-9c2e-2b6f5a1d7e11";
const ORG_ID = "org_1";

const buildApiKey = (overrides: Partial<TAuthenticationApiKey> = {}): TAuthenticationApiKey =>
  ({
    type: "apiKey",
    organizationId: ORG_ID,
    apiKeyId: "key_1",
    organizationAccess: { accessControl: { read: false, write: false } },
    workspacePermissions: [],
    ...overrides,
  }) as TAuthenticationApiKey;

describe("parseFeedbackRecordsGatewayRoute", () => {
  // Deletes are manage-level, matching the DELETE -> manage rule the rest of the API follows via
  // methodPermissionMap. They used to resolve to "write", so a write-scoped key could delete records.
  test("requires manage to delete a single record", () => {
    const route = parseFeedbackRecordsGatewayRoute("DELETE", `/api/v3/feedbackRecords/${RECORD_ID}`);
    expect(route).toMatchObject({ operation: "delete", requiredPermission: "manage" });
  });

  test("requires manage to bulk delete", () => {
    const route = parseFeedbackRecordsGatewayRoute("DELETE", "/api/v3/feedbackRecords");
    expect(route).toMatchObject({ operation: "bulkDelete", requiredPermission: "manage" });
  });

  test.each([
    ["GET", "/api/v3/feedbackRecords", "list", "read"],
    ["POST", "/api/v3/feedbackRecords", "create", "write"],
    ["PATCH", `/api/v3/feedbackRecords/${RECORD_ID}`, "update", "write"],
    ["GET", `/api/v3/feedbackRecords/${RECORD_ID}`, "retrieve", "read"],
  ])("leaves %s %s at %s/%s", (method, path, operation, requiredPermission) => {
    expect(parseFeedbackRecordsGatewayRoute(method, path)).toMatchObject({ operation, requiredPermission });
  });
});

describe("hasApiKeyImplicitFeedbackDirectoryAccess", () => {
  // Regression: the tenant is resolved from caller-supplied input, so a key from one organization could
  // otherwise reach another organization's directory through the organizationAccess shortcuts.
  test("rejects a key from a different organization", () => {
    const authentication = buildApiKey({
      organizationAccess: { accessControl: { read: true, write: true } } as never,
      workspacePermissions: [{ workspaceId: "ws_1", permission: "manage" }] as never,
    });

    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, "other_org", ["ws_1"], "read")).toBe(
      false
    );
  });

  // Regression: organizationAccess only models read and write, so it must not stand in for manage.
  test("does not let org-level write satisfy a manage requirement", () => {
    const authentication = buildApiKey({
      organizationAccess: { accessControl: { read: true, write: true } } as never,
    });

    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "write")).toBe(true);
    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "manage")).toBe(false);
  });

  test("accepts a workspace permission of manage for a manage requirement", () => {
    const authentication = buildApiKey({
      workspacePermissions: [{ workspaceId: "ws_1", permission: "manage" }] as never,
    });

    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "manage")).toBe(true);
  });

  test("rejects a workspace permission of write for a manage requirement", () => {
    const authentication = buildApiKey({
      workspacePermissions: [{ workspaceId: "ws_1", permission: "write" }] as never,
    });

    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "write")).toBe(true);
    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "manage")).toBe(false);
  });

  test("ignores permissions for workspaces outside the directory", () => {
    const authentication = buildApiKey({
      workspacePermissions: [{ workspaceId: "ws_other", permission: "manage" }] as never,
    });

    expect(hasApiKeyImplicitFeedbackDirectoryAccess(authentication, ORG_ID, ["ws_1"], "read")).toBe(false);
  });
});
