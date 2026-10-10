import { afterEach, describe, expect, test, vi } from "vitest";
import { FORMBRICKS_ORGANIZATION_ID_COOKIE, FORMBRICKS_WORKSPACE_ID_COOKIE } from "@/lib/localStorage";
import {
  getActiveOrganizationIdForUser,
  getActiveWorkspaceIdForUser,
  resolveActiveOrganizationId,
  resolveActiveWorkspaceId,
} from "./active-organization";

const mocks = vi.hoisted(() => ({
  getOrganizationsByUserId: vi.fn(),
  getWorkspace: vi.fn(),
  getWorkspacesByUserId: vi.fn(),
  cookieGet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => mocks.cookieGet(name) }),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/organization", () => ({
  getOrganizationsByUserId: (...a: unknown[]) => mocks.getOrganizationsByUserId(...a),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/workspace", () => ({
  getWorkspacesByUserId: (...a: unknown[]) => mocks.getWorkspacesByUserId(...a),
}));
vi.mock("@/lib/workspace/service", () => ({ getWorkspace: (...a: unknown[]) => mocks.getWorkspace(...a) }));

describe("resolveActiveOrganizationId", () => {
  afterEach(() => vi.clearAllMocks());

  test("prefers the organization cookie when the user is still a member", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    expect(await resolveActiveOrganizationId("user-1", "ws-1", "org-2")).toBe("org-2");
  });

  test("falls back to the last workspace's organization when the organization cookie is stale", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    mocks.getWorkspace.mockResolvedValue({ id: "ws-1", organizationId: "org-2" });
    expect(await resolveActiveOrganizationId("user-1", "ws-1", "org-left")).toBe("org-2");
  });

  test("ignores a workspace the user can no longer reach and uses the first organization", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    mocks.getWorkspace.mockResolvedValue({ id: "ws-1", organizationId: "org-left" });
    expect(await resolveActiveOrganizationId("user-1", "ws-1", undefined)).toBe("org-1");

    mocks.getWorkspace.mockResolvedValue(null);
    expect(await resolveActiveOrganizationId("user-1", "ws-deleted", undefined)).toBe("org-1");
  });

  test("returns undefined when the user has no organization", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([]);
    expect(await resolveActiveOrganizationId("user-1", undefined, undefined)).toBeUndefined();
  });
});

describe("getActiveOrganizationIdForUser", () => {
  afterEach(() => vi.clearAllMocks());

  test("resolves the organization of the workspace in the active-context cookie", async () => {
    mocks.getOrganizationsByUserId.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    mocks.getWorkspace.mockResolvedValue({ id: "ws-2", organizationId: "org-2" });
    mocks.cookieGet.mockImplementation((name: string) =>
      name === FORMBRICKS_WORKSPACE_ID_COOKIE ? { value: "ws-2" } : undefined
    );

    expect(await getActiveOrganizationIdForUser("user-1")).toBe("org-2");
  });
});

describe("resolveActiveWorkspaceId", () => {
  afterEach(() => vi.clearAllMocks());

  test("keeps the cookie workspace while the user can still reach it in the organization", async () => {
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }]);
    expect(await resolveActiveWorkspaceId("user-1", "org-1", "ws-2")).toBe("ws-2");
  });

  test("falls back to the first accessible workspace when the cookie is stale", async () => {
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }]);
    expect(await resolveActiveWorkspaceId("user-1", "org-1", "ws-deleted")).toBe("ws-1");
    expect(await resolveActiveWorkspaceId("user-1", "org-1", undefined)).toBe("ws-1");
  });

  test("returns undefined when the organization has no accessible workspace", async () => {
    mocks.getWorkspacesByUserId.mockResolvedValue([]);
    expect(await resolveActiveWorkspaceId("user-1", "org-1", "ws-1")).toBeUndefined();
  });
});

describe("getActiveWorkspaceIdForUser", () => {
  afterEach(() => vi.clearAllMocks());

  test("prefers a workspace of the active organization over a cookie workspace of another one", async () => {
    // The organization cookie names org-2 while the workspace cookie still points at ws-a of org-1.
    mocks.cookieGet.mockImplementation((name: string) => {
      if (name === FORMBRICKS_ORGANIZATION_ID_COOKIE) return { value: "org-2" };
      if (name === FORMBRICKS_WORKSPACE_ID_COOKIE) return { value: "ws-a" };
      return undefined;
    });
    mocks.getOrganizationsByUserId.mockResolvedValue([{ id: "org-1" }, { id: "org-2" }]);
    mocks.getWorkspacesByUserId.mockImplementation(async (_userId: string, organizationId: string) =>
      organizationId === "org-2" ? [{ id: "ws-b" }] : [{ id: "ws-a" }]
    );

    expect(await getActiveOrganizationIdForUser("user-1")).toBe("org-2");
    expect(await getActiveWorkspaceIdForUser("user-1", "org-2")).toBe("ws-b");
  });

  test("uses the cookie workspace when it belongs to the active organization", async () => {
    mocks.cookieGet.mockImplementation((name: string) =>
      name === FORMBRICKS_WORKSPACE_ID_COOKIE ? { value: "ws-2" } : undefined
    );
    mocks.getWorkspacesByUserId.mockResolvedValue([{ id: "ws-1" }, { id: "ws-2" }]);
    expect(await getActiveWorkspaceIdForUser("user-1", "org-1")).toBe("ws-2");
  });
});
