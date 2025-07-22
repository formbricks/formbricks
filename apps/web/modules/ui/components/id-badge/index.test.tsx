import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { IdBadge } from "./index";

// Mock react-hot-toast
vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock useTranslate
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations = {
        "common.copied_to_clipboard": "Copied to clipboard",
        "common.copy": "Copy",
      };
      return translations[key] || key;
    },
  }),
}));

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

  test("renders with custom prefix", () => {
    render(<IdBadge id="SRV-001" prefix="Survey:" />);

    expect(screen.getByText("Survey: SRV-001")).toBeInTheDocument();
    const copyButton = screen.getByLabelText("Copy Survey: SRV-001");
    expect(copyButton).toBeInTheDocument();
  });

  test("renders with numeric ID", () => {
    render(<IdBadge id={123456} />);

    expect(screen.getByText("123456")).toBeInTheDocument();
  });

  test("hides copy icon when showCopyIcon is false", () => {
    render(<IdBadge id="1734" showCopyIcon={false} />);

    expect(screen.getByText("1734")).toBeInTheDocument();
    expect(screen.queryByTestId("copy-button")).toBeNull();
  });

  test("shows copy icon only on hover when showCopyIconOnHover is true", () => {
    const { container } = render(<IdBadge id="HOVER-ID" showCopyIconOnHover />);

    const badge = container.querySelector("[data-state]") as HTMLElement;

    // Initially no button
    expect(container.querySelector("button")).toBeNull();

    // Mouse enter - button should appear
    fireEvent.mouseEnter(badge);
    const copyButton = container.querySelector('button[data-testid="copy-button"]');
    expect(copyButton).toBeInTheDocument();

    // Mouse leave - button should disappear
    fireEvent.mouseLeave(badge);
    expect(container.querySelector("button")).toBeNull();
  });

  test("renders copy button with correct accessibility attributes", () => {
    const { container } = render(<IdBadge id="TEST-001" />);

    const copyButton = container.querySelector('button[data-testid="copy-button"]');
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveAttribute("title", "Copy");
  });

  test("applies custom className", () => {
    const { container } = render(<IdBadge id="STYLE-TEST" className="custom-class" />);

    const badge = container.querySelector(".custom-class");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("custom-class");
  });

  test("supports click events on copy button", () => {
    const { container } = render(<IdBadge id="CLICK-TEST" />);

    const copyButton = container.querySelector('button[data-testid="copy-button"]')!;

    // Button should be clickable and not throw error
    expect(() => fireEvent.click(copyButton)).not.toThrow();
    expect(() => fireEvent.keyDown(copyButton, { key: "Enter" })).not.toThrow();
    expect(() => fireEvent.keyDown(copyButton, { key: " " })).not.toThrow();
  });

  test("supports click events on copy button", () => {
    const { container } = render(<IdBadge id="CLICK-TEST" />);

    const copyButton = container.querySelector('button[data-testid="copy-button"]')!;

    // Button should be clickable and not throw error
    expect(() => fireEvent.click(copyButton)).not.toThrow();
  });
  test("renders with long UUID correctly", () => {
    const longId = "abcd1234-ef56-7890-abcd-ef1234567890";
    render(<IdBadge id={longId} prefix="UUID:" />);

    expect(screen.getByText(`UUID: ${longId}`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Copy UUID: ${longId}` })).toBeInTheDocument();
  });
});
