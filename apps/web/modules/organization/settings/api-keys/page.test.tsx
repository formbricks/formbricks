import { findMatchingLocale } from "@/lib/utils/locale";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { getProjectsByOrganizationId } from "@/modules/organization/settings/api-keys/lib/projects";
import { TOrganizationProject } from "@/modules/organization/settings/api-keys/types/api-keys";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { APIKeysPage } from "./page";

vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }) => <div data-testid="content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }) => (
    <div data-testid="page-header">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));
vi.mock(
  "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar",
  () => ({
    OrganizationSettingsNavbar: () => <div data-testid="org-navbar">OrgNavbar</div>,
  })
);
vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ title, description, children }) => (
    <div data-testid="settings-card">
      <span>{title}</span>
      <span>{description}</span>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/organization/settings/api-keys/lib/projects", () => ({
  getProjectsByOrganizationId: vi.fn(),
}));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/lib/utils/locale", () => ({
  findMatchingLocale: vi.fn(),
}));
vi.mock("./components/api-key-list", () => ({
  ApiKeyList: ({ organizationId, locale, isReadOnly, projects }) => (
    <div data-testid="api-key-list">
      {organizationId}-{locale}-{isReadOnly ? "readonly" : "editable"}-{projects.length}
    </div>
  ),
}));
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: true,
}));

// Mock the server-side translation function
vi.mock("@/tolgee/server", () => ({
  getTranslate: async () => (key: string) => key,
}));

const mockParams = { environmentId: "env-1" };
const mockLocale = "en-US";
const mockOrg = { id: "org-1" };
const mockMembership = { role: "owner" };
const mockProjects: TOrganizationProject[] = [
  { id: "p1", environments: [], name: "project1" },
  { id: "p2", environments: [], name: "project2" },
];

describe("APIKeysPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all main components and passes props", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      currentUserMembership: mockMembership,
      organization: mockOrg,
      isOwner: true,
    } as any);
    vi.mocked(findMatchingLocale).mockResolvedValue(mockLocale);
    vi.mocked(getProjectsByOrganizationId).mockResolvedValue(mockProjects);

    const props = { params: Promise.resolve(mockParams) };
    render(await APIKeysPage(props));
    expect(screen.getByTestId("content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("org-navbar")).toBeInTheDocument();
    expect(screen.getByTestId("settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("api-key-list")).toHaveTextContent("org-1-en-US-editable-2");
    expect(screen.getByText("environments.settings.general.organization_settings")).toBeInTheDocument();
    expect(screen.getByText("common.api_keys")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.api_keys.api_keys_description")).toBeInTheDocument();
  });

  test("throws error if not owner", async () => {
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      currentUserMembership: { role: "member" },
      organization: mockOrg,
    } as any);
    const props = { params: Promise.resolve(mockParams) };
    await expect(APIKeysPage(props)).rejects.toThrow("common.not_authorized");
  });
});
