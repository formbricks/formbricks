import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { UpgradePrompt } from "./index";

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, asChild, variant }: any) => (
    <button onClick={onClick} data-as-child={asChild ? "true" : "false"} data-variant={variant || "default"}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  KeyIcon: () => <div data-testid="key-icon" />,
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, target, rel }: any) => (
    <a href={href} target={target} rel={rel}>
      {children}
    </a>
  ),
}));

describe("UpgradePrompt", () => {
  afterEach(() => {
    cleanup();
  });

  const mockProps = {
    title: "Upgrade Your Account",
    description: "Get access to premium features by upgrading your account.",
    buttons: [
      { text: "Upgrade Now", href: "/pricing" },
      { text: "Learn More", href: "/features" },
    ] as [any, any],
  };

  test("renders component with correct content", () => {
    render(<UpgradePrompt {...mockProps} />);

    // Check if title and description are rendered
    expect(screen.getByText("Upgrade Your Account")).toBeInTheDocument();
    expect(screen.getByText("Get access to premium features by upgrading your account.")).toBeInTheDocument();

    // Check if the KeyIcon is rendered
    expect(screen.getByTestId("key-icon")).toBeInTheDocument();

    // Check if buttons are rendered with correct text
    expect(screen.getByText("Upgrade Now")).toBeInTheDocument();
    expect(screen.getByText("Learn More")).toBeInTheDocument();
  });

  test("renders buttons with correct links", () => {
    render(<UpgradePrompt {...mockProps} />);

    // Check if buttons have correct href attributes
    const primaryLink = screen.getByText("Upgrade Now").closest("a");
    const secondaryLink = screen.getByText("Learn More").closest("a");

    expect(primaryLink).toHaveAttribute("href", "/pricing");
    expect(secondaryLink).toHaveAttribute("href", "/features");

    // Check if links have correct attributes
    expect(primaryLink).toHaveAttribute("target", "_blank");
    expect(primaryLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(secondaryLink).toHaveAttribute("target", "_blank");
    expect(secondaryLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("handles onClick for buttons without href", async () => {
    const primaryOnClick = vi.fn();
    const secondaryOnClick = vi.fn();
    const user = userEvent.setup();

    const propsWithClickHandlers = {
      ...mockProps,
      buttons: [
        { text: "Primary Action", onClick: primaryOnClick },
        { text: "Secondary Action", onClick: secondaryOnClick },
      ] as [any, any],
    };

    render(<UpgradePrompt {...propsWithClickHandlers} />);

    // Click the buttons and check if handlers are called
    await user.click(screen.getByText("Primary Action"));
    await user.click(screen.getByText("Secondary Action"));

    expect(primaryOnClick).toHaveBeenCalledTimes(1);
    expect(secondaryOnClick).toHaveBeenCalledTimes(1);
  });

  test("renders with mixed button types (href and onClick)", () => {
    const secondaryOnClick = vi.fn();

    const mixedProps = {
      ...mockProps,
      buttons: [
        { text: "Primary Link", href: "/primary" },
        { text: "Secondary Button", onClick: secondaryOnClick },
      ] as [any, any],
    };

    render(<UpgradePrompt {...mixedProps} />);

    // Check primary button is a link
    const primaryButton = screen.getByText("Primary Link");
    expect(primaryButton.closest("a")).toHaveAttribute("href", "/primary");

    // Check secondary button is not a link
    const secondaryButton = screen.getByText("Secondary Button");
    expect(secondaryButton.closest("a")).toBeNull();
  });

  test("applies asChild and variant correctly to buttons", () => {
    render(<UpgradePrompt {...mockProps} />);

    // In our mock, we're checking data attributes that represent the props
    const primaryButton = screen.getByText("Upgrade Now").closest("button");
    const secondaryButton = screen.getByText("Learn More").closest("button");

    expect(primaryButton).toHaveAttribute("data-as-child", "true");
    expect(primaryButton).toHaveAttribute("data-variant", "default");

    expect(secondaryButton).toHaveAttribute("data-as-child", "true");
    expect(secondaryButton).toHaveAttribute("data-variant", "secondary");
  });
});
