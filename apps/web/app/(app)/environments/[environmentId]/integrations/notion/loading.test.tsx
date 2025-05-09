import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Loading from "./loading";

// Mock child components
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, className }: { children: React.ReactNode; className: string }) => (
    <button className={className}>{children}</button>
  ),
}));
vi.mock("@/modules/ui/components/go-back-button", () => ({
  GoBackButton: () => <div data-testid="go-back-button">Go Back</div>,
}));

// Mock @tolgee/react
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key, // Simple mock translation
  }),
}));

describe("Notion Integration Loading", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading state correctly", () => {
    render(<Loading />);

    // Check for GoBackButton mock
    expect(screen.getByTestId("go-back-button")).toBeInTheDocument();

    // Check for the disabled button
    const linkButton = screen.getByText("environments.integrations.notion.link_database");
    expect(linkButton).toBeInTheDocument();
    expect(linkButton.closest("button")).toHaveClass(
      "pointer-events-none animate-pulse cursor-not-allowed select-none bg-slate-200"
    );

    // Check for table headers
    expect(screen.getByText("common.survey")).toBeInTheDocument();
    expect(screen.getByText("environments.integrations.notion.database_name")).toBeInTheDocument();
    expect(screen.getByText("common.updated_at")).toBeInTheDocument();

    // Check for placeholder elements (skeleton loaders)
    // There should be 3 rows * 5 pulse divs per row = 15 pulse divs
    const pulseDivs = screen.getAllByText("", { selector: "div.animate-pulse" });
    expect(pulseDivs.length).toBeGreaterThanOrEqual(15); // Check if at least 15 pulse divs are rendered
  });
});
