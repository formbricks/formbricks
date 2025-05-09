import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NavigationLink } from "./NavigationLink";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// Mock tooltip components
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

const defaultProps = {
  href: "/test-link",
  isActive: false,
  isCollapsed: false,
  children: <svg data-testid="icon" />,
  linkText: "Test Link Text",
  isTextVisible: true,
};

describe("NavigationLink", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders expanded link correctly (inactive, text visible)", () => {
    render(<NavigationLink {...defaultProps} />);
    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");
    const textSpan = screen.getByText(defaultProps.linkText);

    expect(linkElement).toHaveAttribute("href", defaultProps.href);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(textSpan).toBeInTheDocument();
    expect(textSpan).toHaveClass("opacity-0");
    expect(listItem).not.toHaveClass("bg-slate-50"); // inactiveClass check
    expect(listItem).toHaveClass("hover:bg-slate-50"); // inactiveClass check
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders expanded link correctly (active, text hidden)", () => {
    render(<NavigationLink {...defaultProps} isActive={true} isTextVisible={false} />);
    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");
    const textSpan = screen.getByText(defaultProps.linkText);

    expect(linkElement).toHaveAttribute("href", defaultProps.href);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(textSpan).toBeInTheDocument();
    expect(textSpan).toHaveClass("opacity-100");
    expect(listItem).toHaveClass("bg-slate-50"); // activeClass check
    expect(listItem).toHaveClass("border-brand-dark"); // activeClass check
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
  });

  test("renders collapsed link correctly (inactive)", () => {
    render(<NavigationLink {...defaultProps} isCollapsed={true} />);
    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");

    expect(linkElement).toHaveAttribute("href", defaultProps.href);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    // Check text is NOT directly within the list item
    expect(within(listItem!).queryByText(defaultProps.linkText)).not.toBeInTheDocument();
    expect(listItem).not.toHaveClass("bg-slate-50"); // inactiveClass check
    expect(listItem).toHaveClass("hover:bg-slate-50"); // inactiveClass check

    // Check tooltip elements
    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    // Check text IS within the tooltip content mock
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(defaultProps.linkText);
  });

  test("renders collapsed link correctly (active)", () => {
    render(<NavigationLink {...defaultProps} isCollapsed={true} isActive={true} />);
    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");

    expect(linkElement).toHaveAttribute("href", defaultProps.href);
    expect(screen.getByTestId("icon")).toBeInTheDocument();
    // Check text is NOT directly within the list item
    expect(within(listItem!).queryByText(defaultProps.linkText)).not.toBeInTheDocument();
    expect(listItem).toHaveClass("bg-slate-50"); // activeClass check
    expect(listItem).toHaveClass("border-brand-dark"); // activeClass check

    // Check tooltip elements
    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    // Check text IS within the tooltip content mock
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent(defaultProps.linkText);
  });
});
