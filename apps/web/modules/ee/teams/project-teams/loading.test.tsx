import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TeamsLoading } from "./loading";

vi.mock("@/modules/projects/settings/components/project-config-navigation", () => ({
  ProjectConfigNavigation: ({ activeId, loading }: any) => (
    <div data-testid="ProjectConfigNavigation">{`${activeId}-${loading}`}</div>
  ),
}));
vi.mock("@/modules/ui/components/page-content-wrapper", () => ({
  PageContentWrapper: ({ children }: any) => <div data-testid="PageContentWrapper">{children}</div>,
}));
vi.mock("@/modules/ui/components/page-header", () => ({
  PageHeader: ({ children, pageTitle }: any) => (
    <div data-testid="PageHeader">
      <span>{pageTitle}</span>
      {children}
    </div>
  ),
}));

describe("TeamsLoading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading skeletons and navigation", () => {
    render(<TeamsLoading />);
    expect(screen.getByTestId("PageContentWrapper")).toBeInTheDocument();
    expect(screen.getByTestId("PageHeader")).toBeInTheDocument();
    expect(screen.getByTestId("ProjectConfigNavigation")).toHaveTextContent("teams-true");

    // Check for the presence of multiple skeleton loaders (at least one)
    const skeletonLoaders = screen.getAllByRole("generic", { name: "" }); // Assuming skeleton divs don't have specific roles/names
    // Filter for elements with animate-pulse class
    const pulseElements = skeletonLoaders.filter((el) => el.classList.contains("animate-pulse"));
    expect(pulseElements.length).toBeGreaterThan(0);

    expect(screen.getByText("common.project_configuration")).toBeInTheDocument();
  });
});
