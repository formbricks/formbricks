import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabContainer } from "./tab-container";

// Mock components
vi.mock("@/modules/ui/components/typography", () => ({
  H3: (props: { children: React.ReactNode }) => <h3 data-testid="h3">{props.children}</h3>,
  Small: (props: { color?: string; margin?: string; children: React.ReactNode }) => (
    <p data-testid="small" data-color={props.color} data-margin={props.margin}>
      {props.children}
    </p>
  ),
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

    const title = screen.getByTestId("h3");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Test Tab Title");
  });

  test("renders description with correct text and props", () => {
    render(<TabContainer {...defaultProps} />);

    const description = screen.getByTestId("small");
    expect(description).toBeInTheDocument();
    expect(description).toHaveTextContent("Test tab description");
    expect(description).toHaveAttribute("data-color", "muted");
    expect(description).toHaveAttribute("data-margin", "headerDescription");
  });

  test("renders children content", () => {
    render(<TabContainer {...defaultProps} />);

    const tabContent = screen.getByTestId("tab-content");
    expect(tabContent).toBeInTheDocument();
    expect(tabContent).toHaveTextContent("Tab content");
  });

  test("renders header with correct structure", () => {
    render(<TabContainer {...defaultProps} />);

    const header = screen.getByTestId("h3").parentElement;
    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByTestId("h3"));
    expect(header).toContainElement(screen.getByTestId("small"));
  });

  test("renders children directly in container", () => {
    render(<TabContainer {...defaultProps} />);

    const container = screen.getByTestId("h3").parentElement?.parentElement;
    expect(container).toContainElement(screen.getByTestId("tab-content"));
  });
});
