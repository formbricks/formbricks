import { getTeamsByOrganizationId } from "@/app/(app)/(onboarding)/lib/onboarding";
import { getUserProjects } from "@/lib/project/service";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

vi.mock("@/lib/constants", () => ({ DEFAULT_BRAND_COLOR: "#fff" }));
// Mocks before component import
vi.mock("@/app/(app)/(onboarding)/lib/onboarding", () => ({ getTeamsByOrganizationId: vi.fn() }));
vi.mock("@/lib/project/service", () => ({ getUserProjects: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getAccessControlPermission: vi.fn() }));
vi.mock("@/modules/organization/lib/utils", () => ({ getOrganizationAuth: vi.fn() }));
vi.mock("@/tolgee/server", () => ({ getTranslate: () => Promise.resolve((key: string) => key) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/modules/ui/components/header", () => ({
  Header: ({ title, subtitle }: any) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));
vi.mock(
  "@/app/(app)/(onboarding)/organizations/[organizationId]/projects/new/settings/components/ProjectSettings",
  () => ({
    ProjectSettings: (props: any) => <div data-testid="project-settings" data-mode={props.projectMode} />,
  })
);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProjectSettingsPage", () => {
  const params = Promise.resolve({ organizationId: "org1" });
  const searchParams = Promise.resolve({ channel: "link", industry: "other", mode: "cx" } as any);

  test("redirects to login when no session user", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({ session: {} } as any);
    await Page({ params, searchParams });
    expect(redirect).toHaveBeenCalledWith("/auth/login");
  });

  test("throws when teams not found", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({
      session: { user: { id: "u1" } },
      organization: { billing: { plan: "basic" } },
    } as any);
    vi.mocked(getUserProjects).mockResolvedValueOnce([] as any);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValueOnce(null as any);
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(false as any);

    await expect(Page({ params, searchParams })).rejects.toThrow("common.organization_teams_not_found");
  });

  test("renders header, settings and close link when projects exist", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({
      session: { user: { id: "u1" } },
      organization: { billing: { plan: "basic" } },
    } as any);
    vi.mocked(getUserProjects).mockResolvedValueOnce([{ id: "p1" }] as any);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValueOnce([{ id: "t1", name: "Team1" }] as any);
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(true as any);

    const element = await Page({ params, searchParams });
    render(element as React.ReactElement);

    // Header
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "organizations.projects.new.settings.project_settings_title"
    );
    // ProjectSettings stub receives mode prop
    expect(screen.getByTestId("project-settings")).toHaveAttribute("data-mode", "cx");
    // Close link for existing projects
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/");
  });

  test("renders without close link when no projects", async () => {
    vi.mocked(getOrganizationAuth).mockResolvedValueOnce({
      session: { user: { id: "u1" } },
      organization: { billing: { plan: "basic" } },
    } as any);
    vi.mocked(getUserProjects).mockResolvedValueOnce([] as any);
    vi.mocked(getTeamsByOrganizationId).mockResolvedValueOnce([{ id: "t1", name: "Team1" }] as any);
    vi.mocked(getAccessControlPermission).mockResolvedValueOnce(true as any);

    const element = await Page({ params, searchParams });
    render(element as React.ReactElement);

    expect(screen.queryByRole("link")).toBeNull();
  });
});
