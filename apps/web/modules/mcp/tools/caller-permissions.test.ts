import type { AuthInfo } from "@modelcontextprotocol/server";
import { describe, expect, test } from "vitest";
import { mcpCallerHolds } from "./caller-permissions";
import { FULL_MCP_GRANT } from "./test-utils";

const API_KEY_AUTH = { apiKeyId: "key_ro", organizationId: "org_1", workspacePermissions: [] };

const authInfoWithScopes = (scopes: string[], authentication?: unknown): AuthInfo =>
  ({
    token: "tok",
    clientId: "client",
    scopes,
    extra: {
      requestId: "req",
      grant: FULL_MCP_GRANT,
      ...(authentication ? { formbricksAuthentication: authentication } : {}),
    },
  }) as unknown as AuthInfo;

describe("mcpCallerHolds", () => {
  const RESPONSES_READ = { permission: "responses", level: "read" } as const;

  test("needs the scope and the grant's level both", () => {
    expect(mcpCallerHolds(authInfoWithScopes(["responses:read"]), RESPONSES_READ)).toBe(true);
    expect(mcpCallerHolds(authInfoWithScopes(["workflows:read"]), RESPONSES_READ)).toBe(false);
    const narrowGrant = authInfoWithScopes(["responses:read"]);
    (narrowGrant.extra as Record<string, unknown>).grant = {
      access: "all",
      permissions: { workflowRuns: "read" },
    };
    expect(mcpCallerHolds(narrowGrant, RESPONSES_READ)).toBe(false);
  });

  test("gates an API key, which has no grant, on its scopes alone", () => {
    const apiKey = authInfoWithScopes(["responses:read"], API_KEY_AUTH);
    delete (apiKey.extra as Record<string, unknown>).grant;
    expect(mcpCallerHolds(apiKey, RESPONSES_READ)).toBe(true);
  });

  test("fails closed for an OAuth caller without a grant, or without auth info", () => {
    const grantless = authInfoWithScopes(["responses:read"]);
    delete (grantless.extra as Record<string, unknown>).grant;
    expect(mcpCallerHolds(grantless, RESPONSES_READ)).toBe(false);
    expect(mcpCallerHolds(undefined, RESPONSES_READ)).toBe(false);
  });
});
