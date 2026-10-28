import { describe, expect, test } from "vitest";
import {
  buildConnectionRows,
  getApiKeyScopes,
  mapApiKeyToRow,
  mapOAuthConsentToRow,
} from "./connection-rows";

const names = new Map([
  ["ws-1", "Production"],
  ["ws-2", "Staging"],
]);

const apiKey = (overrides: Partial<Parameters<typeof mapApiKeyToRow>[0]> = {}) => ({
  id: "key-1",
  label: "Nightly digest",
  createdAt: new Date("2026-10-01T08:00:00Z"),
  lastUsedAt: null,
  organizationAccess: { accessControl: { read: false, write: false } },
  apiKeyWorkspaces: [{ workspaceId: "ws-1", permission: "read" as const }],
  ...overrides,
});

describe("getApiKeyScopes", () => {
  test("a read-only key carries every read scope and no write scope", () => {
    const scopes = getApiKeyScopes({ workspacePermissions: [{ permission: "read" }] });
    expect(scopes).toContain("responses:read");
    expect(scopes.some((scope) => scope.endsWith(":write"))).toBe(false);
  });

  test("one write or manage workspace grant unlocks the write scopes", () => {
    for (const permission of ["write", "manage"] as const) {
      const scopes = getApiKeyScopes({ workspacePermissions: [{ permission: "read" }, { permission }] });
      expect(scopes).toContain("surveys:write");
      expect(scopes).toContain("webhooks:write");
    }
  });

  test("the audit log needs the organization-level read grant, never a workspace grant", () => {
    expect(getApiKeyScopes({ workspacePermissions: [{ permission: "manage" }] })).not.toContain("audit:read");
    expect(
      getApiKeyScopes({
        workspacePermissions: [],
        organizationAccess: { accessControl: { read: true, write: false } },
      })
    ).toEqual(["audit:read"]);
  });

  test("a key with no workspace reaches no workspace data", () => {
    expect(getApiKeyScopes({ workspacePermissions: [] })).toEqual([]);
  });
});

describe("mapApiKeyToRow organization access", () => {
  test("surfaces the member and team management grant next to the scope summary", () => {
    const row = mapApiKeyToRow(
      apiKey({ organizationAccess: { accessControl: { read: true, write: true } } }),
      names
    );
    expect(row.access).toEqual({
      write: [],
      readOnly: ["surveys", "workflows", "feedbackRecords", "responses", "contacts", "webhooks", "audit"],
      manageMembers: true,
    });
  });

  test("a key with only the organization write grant reaches no workspace data but can manage members", () => {
    const row = mapApiKeyToRow(
      apiKey({
        apiKeyWorkspaces: [],
        organizationAccess: { accessControl: { read: false, write: true } },
      }),
      names
    );
    expect(row.access).toEqual({ write: [], readOnly: [], manageMembers: true });
  });

  test("leaves the flag off without the write grant, and OAuth connections never carry it", () => {
    expect(mapApiKeyToRow(apiKey(), names).access).not.toHaveProperty("manageMembers");
    expect(
      mapOAuthConsentToRow({
        id: "c",
        scopes: ["surveys:read"],
        createdAt: new Date(),
        client: null,
      }).access
    ).not.toHaveProperty("manageMembers");
  });
});

describe("mapApiKeyToRow", () => {
  test("names the workspaces with their permission and splits write from read-only access", () => {
    const row = mapApiKeyToRow(
      apiKey({
        apiKeyWorkspaces: [
          { workspaceId: "ws-1", permission: "read" },
          { workspaceId: "ws-2", permission: "manage" },
        ],
      }),
      names
    );

    expect(row.workspaces).toEqual({
      type: "named",
      items: [
        { name: "Production", permission: "read" },
        { name: "Staging", permission: "manage" },
      ],
    });
    expect(row.access.write).toEqual([
      "surveys",
      "workflows",
      "feedbackRecords",
      "responses",
      "contacts",
      "webhooks",
    ]);
    expect(row.access.readOnly).toEqual([]);
  });

  test("a key that never authenticated is 'neverUsed', one that did is 'active'", () => {
    expect(mapApiKeyToRow(apiKey(), names).status).toBe("neverUsed");
    expect(mapApiKeyToRow(apiKey({ lastUsedAt: new Date("2026-10-20T00:00:00Z") }), names).status).toBe(
      "active"
    );
  });

  test("a workspace that no longer exists is dropped rather than shown as an id", () => {
    const row = mapApiKeyToRow(
      apiKey({ apiKeyWorkspaces: [{ workspaceId: "gone", permission: "read" }] }),
      names
    );
    expect(row.workspaces).toEqual({ type: "none" });
  });
});

describe("mapOAuthConsentToRow", () => {
  const consent = {
    id: "consent-1",
    scopes: ["openid", "offline_access", "surveys:read", "surveys:write", "responses:read"],
    createdAt: new Date("2026-10-10T10:00:00Z"),
    client: { clientId: "client-abc", name: " Claude Code " },
  };

  test("lists only resource scopes and reaches everything the person can", () => {
    const row = mapOAuthConsentToRow(consent);
    expect(row).toMatchObject({
      kind: "oauth",
      name: "Claude Code",
      status: "active",
      workspaces: { type: "all" },
      authorizedAt: consent.createdAt,
    });
    expect(row.access).toEqual({ write: ["surveys"], readOnly: ["responses"] });
  });

  test("falls back to the client id when the client registered without a name", () => {
    expect(mapOAuthConsentToRow({ ...consent, client: { clientId: "client-abc", name: null } }).name).toBe(
      "client-abc"
    );
  });
});

describe("buildConnectionRows", () => {
  test("merges both kinds, most recent activity first", () => {
    const rows = buildConnectionRows({
      workspaces: [{ id: "ws-1", name: "Production" }],
      consents: [
        {
          id: "consent-old",
          scopes: ["surveys:read"],
          createdAt: new Date("2026-09-01T00:00:00Z"),
          client: { clientId: "c1", name: "Codex" },
        },
      ],
      apiKeys: [
        apiKey({ id: "key-used", label: "Used", lastUsedAt: new Date("2026-10-25T00:00:00Z") }),
        apiKey({ id: "key-new", label: "Never used", createdAt: new Date("2026-10-02T00:00:00Z") }),
      ],
    });

    expect(rows.map((row) => row.id)).toEqual(["key-used", "key-new", "consent-old"]);
  });
});
