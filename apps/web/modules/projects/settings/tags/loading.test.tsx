import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TagsLoading } from "./loading";

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
  ProjectConfigNavigation: ({ activeId }: any) => (
    <div data-testid="project-config-navigation">{activeId}</div>
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

describe("TagsLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and skeletons", () => {
    render(<TagsLoading />);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("settings-card")).toBeInTheDocument();
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.manage_tags")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.manage_tags_description")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.tag")).toBeInTheDocument();
    expect(screen.getByText("environments.project.tags.count")).toBeInTheDocument();
    expect(screen.getByText("common.actions")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, node) => node!.className?.includes("animate-pulse")).length
    ).toBeGreaterThan(0);
  });
});
