import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/modules/ui/components/badge", () => ({
  Badge: ({ text }) => <div data-testid="mock-badge">{text}</div>,
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key) => key, // Mock t function to return the key
  }),
}));

describe("SettingsCard", () => {
  afterEach(() => {
    cleanup();
  });

  const defaultProps = {
    title: "Test Title",
    description: "Test Description",
    children: <div data-testid="child-content">Child Content</div>,
  };

  test("renders title, description, and children", () => {
    render(<SettingsCard {...defaultProps} />);
    expect(screen.getByText(defaultProps.title)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.description)).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  test("renders Beta badge when beta prop is true", () => {
    render(<SettingsCard {...defaultProps} beta />);
    const badgeElement = screen.getByTestId("mock-badge");
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveTextContent("Beta");
  });

  test("renders Soon badge when soon prop is true", () => {
    render(<SettingsCard {...defaultProps} soon />);
    const badgeElement = screen.getByTestId("mock-badge");
    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveTextContent("environments.settings.enterprise.coming_soon");
  });

  test("does not render badges when beta and soon props are false", () => {
    render(<SettingsCard {...defaultProps} />);
    expect(screen.queryByTestId("mock-badge")).not.toBeInTheDocument();
  });

  test("applies default padding when noPadding prop is false", () => {
    render(<SettingsCard {...defaultProps} />);
    const childrenContainer = screen.getByTestId("child-content").parentElement;
    expect(childrenContainer).toHaveClass("px-4 pt-4");
  });

  test("applies custom className to the root element", () => {
    const customClass = "my-custom-class";
    render(<SettingsCard {...defaultProps} className={customClass} />);
    const cardElement = screen.getByText(defaultProps.title).closest("div.relative");
    expect(cardElement).toHaveClass(customClass);
  });

  test("renders with default classes", () => {
    render(<SettingsCard {...defaultProps} />);
    const cardElement = screen.getByText(defaultProps.title).closest("div.relative");
    expect(cardElement).toHaveClass(
      "relative my-4 w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm"
    );
  });
});
