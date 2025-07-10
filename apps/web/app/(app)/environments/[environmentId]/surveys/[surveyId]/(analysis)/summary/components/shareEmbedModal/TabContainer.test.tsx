import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabContainer } from "./TabContainer";

// Mock components
vi.mock("@/modules/ui/components/title", () => ({
  Title: (props: { size?: string; children: React.ReactNode }) => (
    <h2 data-testid="title" data-size={props.size}>
      {props.children}
    </h2>
  ),
}));

vi.mock("@/modules/ui/components/description", () => ({
  Description: (props: { children: React.ReactNode }) => <p data-testid="description">{props.children}</p>,
}));

describe("TabContainer", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    title: "Test Tab Title",
    description: "Test tab description",
    children: <div data-testid="tab-content">Tab content</div>,
  };

  test("renders title with correct props", () => {
    render(<TabContainer {...defaultProps} />);

    const title = screen.getByTestId("title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Test Tab Title");
  });

  test("renders description with correct text", () => {
    render(<TabContainer {...defaultProps} />);

    const description = screen.getByTestId("description");
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent("Test tab description");
  });

  test("renders children content", () => {
    render(<TabContainer {...defaultProps} />);

    const tabContent = screen.getByTestId("tab-content");
    expect(tabContent).toBeInTheDocument();
    expect(tabContent).toHaveTextContent("Tab content");
  });

  test("renders with correct container structure", () => {
    render(<TabContainer {...defaultProps} />);

    const container = screen.getByTestId("title").parentElement?.parentElement;
    expect(container).toHaveClass("flex", "h-full", "grow", "flex-col", "items-start", "space-y-4");
  });

  test("renders header with correct structure", () => {
    render(<TabContainer {...defaultProps} />);

    const header = screen.getByTestId("title").parentElement;
    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByTestId("title"));
    expect(header).toContainElement(screen.getByTestId("description"));
  });

  test("renders children directly in container", () => {
    render(<TabContainer {...defaultProps} />);

    const container = screen.getByTestId("title").parentElement?.parentElement;
    expect(container).toContainElement(screen.getByTestId("tab-content"));
  });
});
