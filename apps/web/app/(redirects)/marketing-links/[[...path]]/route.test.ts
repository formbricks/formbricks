import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET } from "./route";

// Drives the real route handler end to end (session -> active organization/workspace -> redirect),
// with only the session, cookies and data layer mocked.
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  cookies: {} as Record<string, string>,
  organizations: [] as { id: string }[],
  workspaces: [] as { id: string; name: string }[],
  workspaceOrganization: {} as Record<string, string>,
  role: "owner",
}));

vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  IS_FORMBRICKS_CLOUD: true,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: () => mocks.getSession() }));
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: (name: string) => ({ value: mocks.cookies[name] }) }),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/organization", () => ({
  getOrganizationsByUserId: () => Promise.resolve(mocks.organizations),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/lib/workspace", () => ({
  getWorkspacesByUserId: () => Promise.resolve(mocks.workspaces),
}));
vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: (id: string) =>
    Promise.resolve(
      mocks.workspaceOrganization[id] ? { id, organizationId: mocks.workspaceOrganization[id] } : null
    ),
}));
vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: () => Promise.resolve({ role: mocks.role }),
}));

// The proxy rewrites /contacts/segments to /marketing-links/contacts/segments; `path` is what follows.
const visit = async (pathname: string) => {
  const path = pathname.split("/").filter(Boolean);
  await GET(new Request(`https://app.formbricks.com/marketing-links${pathname}?utm_source=x`), {
    params: Promise.resolve({ path }),
  });
  return vi.mocked(redirect).mock.calls.at(-1)?.[0];
};

describe("ID-free marketing links", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.cookies = { "formbricks-workspace-id": "ws-2" };
    mocks.organizations = [{ id: "org-1" }];
    mocks.workspaces = [
      { id: "ws-1", name: "One" },
      { id: "ws-2", name: "Two" },
    ];
    mocks.workspaceOrganization = { "ws-2": "org-1" };
    mocks.role = "owner";
  });
  afterEach(() => vi.clearAllMocks());

  test.each<[string, string]>([
    ["/billing", "/organizations/org-1/settings/billing"],
    ["/settings/teams", "/organizations/org-1/settings/teams"],
    ["/settings/look", "/workspaces/ws-2/settings/workspace/look"],
    ["/embedded-data", "/workspaces/ws-2/settings/workspace/embedded-data"],
    ["/enterprise-license", "/organizations/org-1/settings/billing"],
    ["/mcp", "/account/settings/authorized-apps"],
    ["/contacts/segments", "/workspaces/ws-2/segments"],
    ["/branding-removal", "/workspaces/ws-2/settings/workspace/look"],
    ["/feedback-unification", "/workspaces/ws-2/unify/feedback-records"],
    ["/analysis/charts", "/workspaces/ws-2/charts"],
    ["/workflows/runs", "/workspaces/ws-2/workflows/runs"],
    ["/surveys", "/workspaces/ws-2/surveys"],
    ["/integrations/slack", "/workspaces/ws-2/settings/workspace/integrations/slack"],
  ])("%s opens %s", async (pathname, expected) => {
    expect(await visit(pathname)).toBe(`${expected}?utm_source=x`);
  });

  test("an unknown link is a 404", async () => {
    await visit("/not-a-link");
    expect(notFound).toHaveBeenCalled();
  });

  test("a stale workspace cookie falls back to the first accessible workspace", async () => {
    mocks.cookies = { "formbricks-workspace-id": "ws-deleted" };
    expect(await visit("/surveys")).toBe("/workspaces/ws-1/surveys?utm_source=x");
  });

  test("a workspace link without an accessible workspace opens the landing page", async () => {
    mocks.workspaces = [];
    expect(await visit("/contacts")).toBe("/organizations/org-1/landing?utm_source=x");
  });

  test("a billing member without a workspace goes to billing", async () => {
    mocks.workspaces = [];
    mocks.role = "billing";
    expect(await visit("/contacts")).toBe("/organizations/org-1/settings/billing?utm_source=x");
  });

  test("a user without an organization goes to the root page", async () => {
    mocks.organizations = [];
    expect(await visit("/surveys")).toBe("/");
  });

  test("an expired session goes to login", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await visit("/surveys")).toBe("/auth/login");
  });
});
