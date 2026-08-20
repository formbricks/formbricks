import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { getWorkspacesByIds, getWorkspacesByIdsForUser } from "@/lib/workspace/service";
import { listV3Workspaces } from "./operations";

const loggerMocks = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("@/lib/workspace/service", () => ({
  getWorkspacesByIds: vi.fn(),
  getWorkspacesByIdsForUser: vi.fn(),
}));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => loggerMocks) },
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);
  });

  test("session user: aggregates + dedupes across orgs and returns the minimal DTO only", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["w1", "w2", "w3"]);
    vi.mocked(getWorkspacesByIdsForUser).mockResolvedValue([
      ws("w1", "Alpha", "org_1"),
      ws("w2", "Beta", "org_1"),
      ws("w2", "Beta", "org_1"),
      ws("w3", "Gamma", "org_2"),
    ]);

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
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith({ id: "user_1", type: "user" });
    expect(getWorkspacesByIdsForUser).toHaveBeenCalledExactlyOnceWith("user_1", ["w1", "w2", "w3"]);
  });

  test("returns workspaces in a deterministic order (name, then id)", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["w3", "w1", "w2"]);
    vi.mocked(getWorkspacesByIdsForUser).mockResolvedValue([
      ws("w3", "Zeta", "org_1"),
      ws("w1", "alpha", "org_1"),
      ws("w2", "Beta", "org_1"),
    ]);

    const res = await listV3Workspaces(params(sessionAuth));
    const body = await res.json();

    expect(body.data.map((w: { name: string }) => w.name)).toEqual(["alpha", "Beta", "Zeta"]);
  });

  test("session user with no authorized workspaces → empty list", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);
    vi.mocked(getWorkspacesByIdsForUser).mockResolvedValue([]);

    const res = await listV3Workspaces(params(sessionAuth));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith({ id: "user_1", type: "user" });
    expect(getWorkspacesByIdsForUser).toHaveBeenCalledExactlyOnceWith("user_1", []);
  });

  test("api key: returns only same-organization workspaces in workspacePermissions", async () => {
    const keyAuth = {
      apiKeyId: "key_1",
      organizationId: "org_1",
      workspacePermissions: [
        { workspaceId: "w1", permission: "read" },
        { workspaceId: "w9", permission: "write" },
      ],
    } as unknown as TV3Authentication;
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["w1", "w9"]);
    vi.mocked(getWorkspacesByIds).mockResolvedValue([ws("w1", "Alpha", "org_1")]);

    const res = await listV3Workspaces(params(keyAuth));
    const body = await res.json();

    expect(body.data).toEqual([{ id: "w1", name: "Alpha", organizationId: "org_1" }]);
    expect(getWorkspacesByIds).toHaveBeenCalledExactlyOnceWith("org_1", ["w1", "w9"]);
    // API-key path must never use the user membership resolver.
    expect(getWorkspacesByIdsForUser).not.toHaveBeenCalled();
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith({
      id: "key_1",
      type: "apiKey",
    });
  });

  test("no authentication → 401", async () => {
    const res = await listV3Workspaces(params(null));
    expect(res.status).toBe(401);
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });

  test("an unexpected service failure is logged and returned as a 500 (never thrown)", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockRejectedValue(new Error("AuthZed exploded"));
    const res = await listV3Workspaces(params(sessionAuth));
    expect(res.status).toBe(500);
  });
});
