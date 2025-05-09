import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppConnectionLoading } from "./loading";

vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: ({ activeId, loading }: any) => (
    <div data-testid="project-config-navigation">
      {activeId} {loading ? "loading" : "not-loading"}
    </div>
  ),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="page-content-wrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ pageTitle, children }: any) => (
    <div data-testid="page-header">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));
vi.mock("@/app/(app)/components/LoadingCard", () => ({
  LoadingCard: (props: any) => (
    <div data-testid="loading-card">
      {props.title} {props.description}
    </div>
  ),
}));

describe("AppConnectionLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders wrapper, header, navigation, and all loading cards with correct tolgee keys", () => {
    render(<AppConnectionLoading />);
    expect(screen.getByTestId("page-content-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("page-header")).toHaveTextContent("common.project_configuration");
    expect(screen.getByTestId("project-config-navigation")).toHaveTextContent("app-connection loading");
    const cards = screen.getAllByTestId("loading-card");
    expect(cards.length).toBe(3);
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.app_connection");
    expect(cards[0]).toHaveTextContent("environments.project.app-connection.app_connection_description");
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.how_to_setup");
    expect(cards[1]).toHaveTextContent("environments.project.app-connection.how_to_setup_description");
    expect(cards[2]).toHaveTextContent("environments.project.app-connection.environment_id");
    expect(cards[2]).toHaveTextContent("environments.project.app-connection.environment_id_description");
  });

  test("renders the blue info bar", () => {
    render(<AppConnectionLoading />);
    expect(screen.getByText((_, element) => element!.className.includes("bg-blue-50"))).toBeInTheDocument();

    expect(
      screen.getByText((_, element) => element!.className.includes("animate-pulse"))
    ).toBeInTheDocument();
  });
});
