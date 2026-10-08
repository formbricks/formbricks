import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GET as analysis } from "./analysis/[[...path]]/route";
import { GET as billing } from "./billing/route";
import { GET as brandingRemoval } from "./branding-removal/[[...path]]/route";
import { GET as contacts } from "./contacts/[[...path]]/route";
import { GET as embeddedData } from "./embedded-data/[[...path]]/route";
import { GET as enterpriseLicense } from "./enterprise-license/[[...path]]/route";
import { GET as feedbackUnification } from "./feedback-unification/[[...path]]/route";
import { GET as integrations } from "./integrations/[[...path]]/route";
import { GET as mcp } from "./mcp/[[...path]]/route";
import { GET as settings } from "./settings/[[...path]]/route";
import { GET as surveys } from "./surveys/[[...path]]/route";
import { GET as workflows } from "./workflows/[[...path]]/route";

// Drives the real route handlers end to end (session -> active organization/workspace -> redirect),
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

type TRoute = (request: Request, context: { params: Promise<{ path?: string[] }> }) => Promise<never>;

const visit = async (route: TRoute, pathname: string, path?: string[]) => {
  await route(new Request(`https://app.formbricks.com${pathname}?utm_source=x`), {
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
  afterEach(() => vi.mocked(redirect).mockClear());

  test.each<[string, TRoute, string, string[] | undefined, string]>([
    ["billing", billing as TRoute, "/billing", undefined, "/organizations/org-1/settings/billing"],
    ["settings", settings, "/settings/teams", ["teams"], "/organizations/org-1/settings/teams"],
    [
      "settings (workspace page)",
      settings,
      "/settings/look",
      ["look"],
      "/workspaces/ws-2/settings/workspace/look",
    ],
    [
      "embedded-data",
      embeddedData,
      "/embedded-data",
      undefined,
      "/workspaces/ws-2/settings/workspace/embedded-data",
    ],
    [
      "enterprise-license",
      enterpriseLicense,
      "/enterprise-license",
      undefined,
      "/organizations/org-1/settings/billing",
    ],
    ["mcp", mcp, "/mcp", undefined, "/account/settings/authorized-apps"],
    ["contacts", contacts, "/contacts/segments", ["segments"], "/workspaces/ws-2/segments"],
    [
      "branding-removal",
      brandingRemoval,
      "/branding-removal",
      undefined,
      "/workspaces/ws-2/settings/workspace/look",
    ],
    [
      "feedback-unification",
      feedbackUnification,
      "/feedback-unification",
      undefined,
      "/workspaces/ws-2/unify/feedback-records",
    ],
    ["analysis", analysis, "/analysis/charts", ["charts"], "/workspaces/ws-2/charts"],
    ["workflows", workflows, "/workflows/runs", ["runs"], "/workspaces/ws-2/workflows/runs"],
    ["surveys", surveys, "/surveys", undefined, "/workspaces/ws-2/surveys"],
    [
      "integrations",
      integrations,
      "/integrations/slack",
      ["slack"],
      "/workspaces/ws-2/settings/workspace/integrations/slack",
    ],
  ])(
    "%s opens the page in the current workspace or organization",
    async (_, route, pathname, path, expected) => {
      expect(await visit(route, pathname, path)).toBe(`${expected}?utm_source=x`);
    }
  );

  test("a stale workspace cookie falls back to the first accessible workspace", async () => {
    mocks.cookies = { "formbricks-workspace-id": "ws-deleted" };
    expect(await visit(surveys, "/surveys")).toBe("/workspaces/ws-1/surveys?utm_source=x");
  });

  test("a workspace link without an accessible workspace opens the landing page", async () => {
    mocks.workspaces = [];
    expect(await visit(contacts, "/contacts")).toBe("/organizations/org-1/landing?utm_source=x");
  });

  test("a billing member without a workspace goes to billing", async () => {
    mocks.workspaces = [];
    mocks.role = "billing";
    expect(await visit(contacts, "/contacts")).toBe("/organizations/org-1/settings/billing?utm_source=x");
  });

  test("a user without an organization goes to the root page", async () => {
    mocks.organizations = [];
    expect(await visit(surveys, "/surveys")).toBe("/");
  });

  test("an expired session goes to login", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect(await visit(surveys, "/surveys")).toBe("/auth/login");
  });
});
