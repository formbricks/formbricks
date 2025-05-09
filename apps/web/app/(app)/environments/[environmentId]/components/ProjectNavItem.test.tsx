import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectNavItem } from "./ProjectNavItem";

describe("ProjectNavItem", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    href: "/test-path",
    children: <span>Test Child</span>,
  };

  test("renders correctly when active", () => {
    render(<ProjectNavItem {...defaultProps} isActive={true} />);

    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");

    expect(linkElement).toHaveAttribute("href", "/test-path");
    expect(screen.getByText("Test Child")).toBeInTheDocument();
    expect(listItem).toHaveClass("bg-slate-50");
    expect(listItem).toHaveClass("font-semibold");
    expect(listItem).not.toHaveClass("hover:bg-slate-50");
  });

  test("renders correctly when inactive", () => {
    render(<ProjectNavItem {...defaultProps} isActive={false} />);

    const linkElement = screen.getByRole("link");
    const listItem = linkElement.closest("li");

    expect(linkElement).toHaveAttribute("href", "/test-path");
    expect(screen.getByText("Test Child")).toBeInTheDocument();
    expect(listItem).not.toHaveClass("bg-slate-50");
    expect(listItem).not.toHaveClass("font-semibold");
    expect(listItem).toHaveClass("hover:bg-slate-50");
  });
});
