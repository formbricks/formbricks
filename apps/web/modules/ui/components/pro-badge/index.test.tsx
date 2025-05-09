import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProBadge } from "./index";

// Mock lucide-react's CrownIcon
vi.mock("lucide-react", () => ({
  CrownIcon: () => <div data-testid="crown-icon" />,
}));

describe("ProBadge", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders the badge with correct elements", () => {
    render(<ProBadge />);

    // Check for container with correct classes
    const badgeContainer = screen.getByText("PRO").closest("div");
    expect(badgeContainer).toBeInTheDocument();
    expect(badgeContainer).toHaveClass("ml-2");
    expect(badgeContainer).toHaveClass("flex");
    expect(badgeContainer).toHaveClass("items-center");
    expect(badgeContainer).toHaveClass("justify-center");
    expect(badgeContainer).toHaveClass("rounded-lg");
    expect(badgeContainer).toHaveClass("border");
    expect(badgeContainer).toHaveClass("border-slate-200");
    expect(badgeContainer).toHaveClass("bg-slate-100");
    expect(badgeContainer).toHaveClass("p-0.5");
    expect(badgeContainer).toHaveClass("text-slate-500");
  });

  test("contains crown icon", () => {
    render(<ProBadge />);

    const crownIcon = screen.getByTestId("crown-icon");
    expect(crownIcon).toBeInTheDocument();
  });

  test("displays PRO text", () => {
    render(<ProBadge />);

    const proText = screen.getByText("PRO");
    expect(proText).toBeInTheDocument();
    expect(proText.tagName.toLowerCase()).toBe("span");
    expect(proText).toHaveClass("ml-1");
    expect(proText).toHaveClass("text-xs");
  });
});
