import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { getUserWorkspaces, getWorkspace } from "@/lib/workspace/service";
import { listV3Workspaces } from "./operations";

vi.mock("@/lib/organization/service", () => ({ getOrganizationsByUserId: vi.fn() }));
vi.mock("@/lib/workspace/service", () => ({ getUserWorkspaces: vi.fn(), getWorkspace: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn() })) },
}));

const sessionAuth = {
  user: { id: "user_1" },
  expires: "2026-07-01T00:00:00.000Z",
} as unknown as TV3Authentication;

const params = (authentication: TV3Authentication) => ({
  authentication,
  requestId: "req_1",
  instance: "/api/mcp",
});

// A workspace as the services return it: full entity. The operation must serialize it down to the DTO.
const ws = (id: string, name: string, organizationId: string) =>
  ({
    id,
    name,
    organizationId,
    createdAt: new Date(),
    updatedAt: new Date(),
    config: { secret: "should-not-leak" },
    styling: {},
  }) as any;

describe("listV3Workspaces", () => {
  beforeEach(() => vi.clearAllMocks());

  test("session user: aggregates + dedupes across orgs and returns the minimal DTO only", async () => {
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([
      { id: "org_1", name: "Org 1" },
      { id: "org_2", name: "Org 2" },
    ] as any);
    vi.mocked(getUserWorkspaces).mockImplementation(async (_userId: string, orgId: string) =>
      orgId === "org_1"
        ? [ws("w1", "Alpha", "org_1"), ws("w2", "Beta", "org_1")]
        : [ws("w2", "Beta", "org_1"), ws("w3", "Gamma", "org_2")]
    );

    const res = await listV3Workspaces(params(sessionAuth));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toEqual([
      { id: "w1", name: "Alpha", organizationId: "org_1" },
      { id: "w2", name: "Beta", organizationId: "org_1" },
      { id: "w3", name: "Gamma", organizationId: "org_2" },
    ]);
    expect(body.meta.totalCount).toBe(3);
    // Only the DTO fields — no config/styling/entity internals leak.
    expect(Object.keys(body.data[0])).toEqual(["id", "name", "organizationId"]);
  });

  test("returns workspaces in a deterministic order (name, then id)", async () => {
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([{ id: "org_1", name: "Org 1" }] as any);
    vi.mocked(getUserWorkspaces).mockResolvedValue([
      ws("w3", "Zeta", "org_1"),
      ws("w1", "alpha", "org_1"),
      ws("w2", "Beta", "org_1"),
    ]);

    const res = await listV3Workspaces(params(sessionAuth));
    const body = await res.json();

    expect(body.data.map((w: { name: string }) => w.name)).toEqual(["alpha", "Beta", "Zeta"]);
  });

  test("session user with no orgs → empty list, no workspace lookups", async () => {
    vi.mocked(getOrganizationsByUserId).mockResolvedValue([] as any);

    const res = await listV3Workspaces(params(sessionAuth));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(getUserWorkspaces).not.toHaveBeenCalled();
  });

  test("api key: returns only the workspaces in workspacePermissions", async () => {
    const keyAuth = {
      apiKeyId: "key_1",
      workspacePermissions: [
        { workspaceId: "w1", permission: "read" },
        { workspaceId: "w9", permission: "write" },
      ],
    } as unknown as TV3Authentication;
    vi.mocked(getWorkspace).mockImplementation(async (id: string) =>
      id === "w1" ? ws("w1", "Alpha", "org_1") : id === "w9" ? ws("w9", "Zeta", "org_2") : null
    );

    const res = await listV3Workspaces(params(keyAuth));
    const body = await res.json();

    expect(body.data).toEqual([
      { id: "w1", name: "Alpha", organizationId: "org_1" },
      { id: "w9", name: "Zeta", organizationId: "org_2" },
    ]);
    // API-key path must never fall back to the user/org aggregation.
    expect(getOrganizationsByUserId).not.toHaveBeenCalled();
  });

  test("no authentication → 401", async () => {
    const res = await listV3Workspaces(params(null));
    expect(res.status).toBe(401);
  });

  test("an unexpected service failure is logged and returned as a 500 (never thrown)", async () => {
    vi.mocked(getOrganizationsByUserId).mockRejectedValue(new Error("db exploded"));
    const res = await listV3Workspaces(params(sessionAuth));
    expect(res.status).toBe(500);
  });
});
