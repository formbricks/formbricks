import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TagsPage } from "./page";

vi.mock("@/app/(app)/environments/[environmentId]/settings/components/SettingsCard", () => ({
  SettingsCard: ({ children, title, description }: any) => (
    <div data-testid="settings-card">
      <div>{title}</div>
      <div>{description}</div>
      {children}
    </div>
  ),
}));
vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: ({ environmentId, activeId }: any) => (
    <div data-testid="project-config-navigation">
      {environmentId}-{activeId}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="page-header">
      <div>{pageTitle}</div>
      {children}
    </div>
  ),
}));
vi.mock("./components/edit-tags-wrapper", () => ({
  EditTagsWrapper: () => <div data-testid="edit-tags-wrapper">edit-tags-wrapper</div>,
}));

const mockGetTranslate = vi.fn(async () => (key: string) => key);

vi.mock("@/tolgee/server", () => ({ getTranslate: () => mockGetTranslate() }));
vi.mock("@/modules/environments/lib/utils", () => ({
  getEnvironmentAuth: vi.fn(),
}));
vi.mock("@/lib/tag/service", () => ({
  getTagsByEnvironmentId: vi.fn(),
}));
vi.mock("@/lib/tagOnResponse/service", () => ({
  getTagsOnResponsesCount: vi.fn(),
}));

describe("TagsPage", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and main components", async () => {
    const props = { params: { environmentId: "env1" } };
    vi.mocked(getEnvironmentAuth).mockResolvedValue({
      isReadOnly: false,
      environment: {
        id: "env1",
        appSetupCompleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "project1",
        type: "development",
      },
    } as any);

    const Page = await TagsPage(props);
    render(Page);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("settings-card")).toBeInTheDocument();
    expect(screen.getByTestId("edit-tags-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("project-config-navigation")).toHaveTextContent("env1-tags");
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.manage_tags")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.manage_tags_description")).toBeInTheDocument();
  });
});
