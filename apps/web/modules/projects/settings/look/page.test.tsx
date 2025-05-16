import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectByEnvironmentId } from "@/modules/projects/settings/look/lib/project";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { ProjectLookSettingsPage } from "./page";

vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ children, ...props }: any) => (
    <div data-testid="settings-card" {...props}>
      {children}
    </div>
  ),
}));

vi.mock("@/lib/constants", () => ({
  SURVEY_BG_COLORS: ["#fff", "#000"],
  IS_FORMBRICKS_CLOUD: 1,
  UNSPLASH_ACCESS_KEY: "unsplash-key",
}));

vi.mock("@/lib/cn", () => ({
  cn: (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" "),
}));

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));

vi.mock("@/modules/ee/license-check/lib/utils", async () => ({
  getWhiteLabelPermission: vi.fn(),
}));

vi.mock("@/modules/ee/whitelabel/remove-branding/components/branding-settings-card", () => ({
  BrandingSettingsCard: () => <div data-testid="branding-settings-card" />,
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));

vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: (props: any) => <div data-testid="project-config-navigation" {...props} />,
}));

vi.mock("./components/edit-logo", () => ({
  EditLogo: () => <div data-testid="edit-logo" />,
}));
vi.mock("@/modules/projects/settings/look/lib/project", async () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="page-header">
      <div>{pageTitle}</div>
      {children}
    </div>
  ),
}));
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(() => {
    // Return a mock translator that just returns the key
    return (key: string) => key;
  }),
}));
vi.mock("./components/edit-placement-form", () => ({
  EditPlacementForm: () => <div data-testid="edit-placement-form" />,
}));
vi.mock("./components/theme-styling", () => ({
  ThemeStyling: () => <div data-testid="theme-styling" />,
}));

describe("ProjectLookSettingsPage", () => {
  const props = { params: Promise.resolve({ environmentId: "env1" }) };
  const mockOrg = {
    id: "org1",
    name: "Test Org",
    createdAt: new Date(),
    updatedAt: new Date(),
    billing: { plan: "pro" } as any,
  } as TOrganization;

  beforeEach(() => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      organization: mockOrg,
    } as any);
  });

  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and main UI elements", async () => {
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce({
      id: "project1",
      name: "Test Project",
      createdAt: new Date(),
      updatedAt: new Date(),
      environments: [],
    } as any);

    const Page = await ProjectLookSettingsPage(props);
    render(Page);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("project-config-navigation")).toBeInTheDocument();
    expect(screen.getAllByTestId("settings-card").length).toBe(3);
    expect(screen.getByTestId("theme-styling")).toBeInTheDocument();
    expect(screen.getByTestId("edit-logo")).toBeInTheDocument();
    expect(screen.getByTestId("edit-placement-form")).toBeInTheDocument();
    expect(screen.getByTestId("branding-settings-card")).toBeInTheDocument();
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
  });

  test("throws error if project is not found", async () => {
    vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);
    const props = { params: Promise.resolve({ environmentId: "env1" }) };
    await expect(ProjectLookSettingsPage(props)).rejects.toThrow("Project not found");
  });
});
