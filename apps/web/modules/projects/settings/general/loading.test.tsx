import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GeneralSettingsLoading } from "./loading";

vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: (props: any) => <div data-testid="project-config-navigation" {...props} />,
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
vi.mock("@/app/(app)/components/LoadingCard", () => ({
  LoadingCard: (props: any) => (
    <div data-testid="loading-card">
      <p>{props.title}</p>
      <p>{props.description}</p>
    </div>
  ),
}));

describe("GeneralSettingsLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders all tolgee strings and main UI elements", () => {
    render(<GeneralSettingsLoading />);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toBeInTheDocument();
    expect(screen.getByTestId("project-config-navigation")).toBeInTheDocument();
    expect(screen.getAllByTestId("loading-card").length).toBe(3);
    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
    expect(screen.getByText("common.project_name")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.project_name_settings_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.project.general.recontact_waiting_time")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.recontact_waiting_time_settings_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.project.general.delete_project")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.general.delete_project_settings_description")
    ).toBeInTheDocument();
  });
});
