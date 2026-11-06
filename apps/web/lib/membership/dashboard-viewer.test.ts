import { describe, expect, test, vi } from "vitest";
import { isOnlyDashboardViewer } from "./dashboard-viewer";

const clientWith = (roles: string[]) => {
  const findMany = vi.fn(async () => roles.map((role) => ({ role })));
  return { client: { membership: { findMany } } as never, findMany };
};

describe("isOnlyDashboardViewer", () => {
  test("someone with no membership is not a viewer", async () => {
    expect(await isOnlyDashboardViewer(clientWith([]).client, "u1")).toBe(false);
  });

  test("viewer memberships only", async () => {
    const { client, findMany } = clientWith(["dashboard_viewer", "dashboard_viewer"]);
    expect(await isOnlyDashboardViewer(client, "u1")).toBe(true);
    expect(findMany).toHaveBeenCalledWith({ where: { userId: "u1" }, select: { role: true } });
  });

  test("a viewer who holds another role elsewhere is not only a viewer", async () => {
    expect(await isOnlyDashboardViewer(clientWith(["dashboard_viewer", "member"]).client, "u1")).toBe(false);
  });

  test("hundreds of viewer memberships", async () => {
    const roles = Array.from({ length: 500 }, () => "dashboard_viewer");
    expect(await isOnlyDashboardViewer(clientWith(roles).client, "u1")).toBe(true);
  });
});
