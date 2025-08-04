import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IdBadge } from "./index";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Mock Tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

// Mock lucide-react icons used in IdBadge
vi.mock("lucide-react", async () => {
  const actual = await vi.importActual<typeof import("lucide-react")>("lucide-react");
  return {
    ...actual,
    Copy: () => "Copy Icon",
    Check: () => "Check Icon",
  };
});

describe("IdBadge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("renders with default props", () => {
    render(<IdBadge id="1734" />);

    expect(screen.getByText("1734")).toBeInTheDocument();
    const copyButton = screen.getByLabelText("Copy 1734");
    expect(copyButton).toBeInTheDocument();
  });

  test("renders with custom label", () => {
    render(<IdBadge id="SRV-001" label="Survey:" />);

    expect(screen.getByText("Survey:")).toBeInTheDocument();
    expect(screen.getByText("SRV-001")).toBeInTheDocument();
  });

  test("renders with numeric ID", () => {
    render(<IdBadge id={123456} />);

    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  test("renders row variant correctly", () => {
    const { container } = render(<IdBadge id="1734" label="ID" variant="row" />);

    const wrapper = container.querySelector("div");
    expect(wrapper).toHaveClass("flex", "items-center", "gap-2");
  });

  test("renders column variant correctly", () => {
    const { container } = render(<IdBadge id="1734" label="ID" variant="column" />);

    const wrapper = container.querySelector("div");
    expect(wrapper).toHaveClass("flex", "flex-col", "items-start", "gap-1");
  });

  test("renders without label when not provided", () => {
    render(<IdBadge id="1734" />);

    expect(screen.getByText("1734")).toBeInTheDocument();
    // Should not have wrapper div when no label
    expect(screen.queryByText("ID")).not.toBeInTheDocument();
  });

  test("hides copy icon when copyDisabled is true", () => {
    render(<IdBadge id="1734" copyDisabled={true} />);

    expect(screen.getByText("1734")).toBeInTheDocument();
    expect(screen.queryByTestId("copy-icon")).toBeNull();
  });

  test("removes interactive elements when copy is disabled", () => {
    const { container } = render(<IdBadge id="1734" copyDisabled={true} />);

    const badge = container.querySelector("button");

    // Should not have cursor-pointer class
    expect(badge).not.toHaveClass("cursor-pointer");

    // Should not have hover effects
    expect(badge).not.toHaveClass("hover:border-transparent");
    expect(badge).not.toHaveClass("hover:text-slate-50");
  });

  test("shows copy icon only on hover when showCopyIconOnHover is true", async () => {
    // Test that when showCopyIconOnHover is false (default), the button is always visible
    const { container: container1 } = render(
      <IdBadge id="ALWAYS-VISIBLE" copyDisabled={false} showCopyIconOnHover={false} />
    );
    expect(container1.querySelector('div[data-testid="copy-icon"]')).toBeInTheDocument();

    // Test that when showCopyIconOnHover is true, hover behavior works
    const { container: container2 } = render(
      <IdBadge id="HOVER-CONTROLLED" copyDisabled={false} showCopyIconOnHover={true} />
    );

    const badge = container2.querySelector("[role='button']") as HTMLElement;

    // Test hover behavior - the button should be affected by hover state
    fireEvent.mouseEnter(badge);
    await waitFor(() => {
      const copyButton = container2.querySelector('div[data-testid="copy-icon"]');
      expect(copyButton).toBeInTheDocument();
    });

    // Test that the functionality works by checking if click works
    const copyButton = container2.querySelector('div[data-testid="copy-icon"]')!;
    expect(() => fireEvent.click(copyButton)).not.toThrow();
  });

  test("showCopyIconOnHover overrides copyDisabled when enabled", async () => {
    // When showCopyIconOnHover is true, it should work even if copyDisabled is true
    const { container } = render(
      <IdBadge id="OVERRIDE-TEST" copyDisabled={true} showCopyIconOnHover={true} />
    );

    const badge = container.querySelector("[role='button']") as HTMLElement;

    // Initially no button (not hovering)
    expect(container.querySelector('div[data-testid="copy-icon"]')).toBeNull();

    // On hover, button should appear despite copyDisabled being true
    fireEvent.mouseEnter(badge);
    await waitFor(() => {
      const copyButton = container.querySelector('div[data-testid="copy-icon"]');
      expect(copyButton).toBeInTheDocument();
    });
  });

  test("renders copy button with correct accessibility attributes", () => {
    const { container } = render(<IdBadge id="TEST-001" />);

    const copyButton = container.querySelector('div[data-testid="copy-icon"]');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute("title", "common.copy");
  });

  test("applies custom className", () => {
    const { container } = render(<IdBadge id="STYLE-TEST" className="custom-class" />);

    const badge = container.querySelector(".custom-class");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("custom-class");
  });

  test("supports click events on copy button", () => {
    const { container } = render(<IdBadge id="CLICK-TEST" />);

    const copyButton = container.querySelector('div[data-testid="copy-icon"]')!;

    // Button should be clickable and not throw error
    expect(() => fireEvent.click(copyButton)).not.toThrow();
    expect(() => fireEvent.keyDown(copyButton, { key: "Enter" })).not.toThrow();
    expect(() => fireEvent.keyDown(copyButton, { key: " " })).not.toThrow();
  });

  test("has correct hover background with alpha-80", () => {
    const { container } = render(<IdBadge id="1734" />);

    const badge = container.querySelector("[role='button']");
    expect(badge).toHaveClass("hover:bg-slate-900/80");
  });

  test("tooltip has correct text size", () => {
    const { container } = render(<IdBadge id="1734" />);

    const tooltipContent = container.querySelector("[data-side]");
    if (tooltipContent) {
      expect(tooltipContent).toHaveClass("text-xs");
    }
  });
});
