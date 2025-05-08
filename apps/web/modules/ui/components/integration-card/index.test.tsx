import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Card } from "./index";

vi.mock("next/link", () => ({
  default: ({ children, href, target }: { children: React.ReactNode; href: string; target?: string }) => (
    <a href={href} target={target} data-testid="mock-link">
      {children}
    </a>
  ),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, disabled, size, variant }: any) => (
    <button disabled={disabled} data-size={size} data-variant={variant} data-testid="mock-button">
      {children}
    </button>
  ),
}));

describe("Integration Card", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic card with label and description", () => {
    render(<Card label="Test Label" description="Test Description" />);

    expect(screen.getByText("Test Label")).toBeInTheDocument();
    expect(screen.getByText("Test Description")).toBeInTheDocument();
  });

  test("renders icon when provided", () => {
    const testIcon = <div data-testid="test-icon">Icon</div>;
    render(<Card label="Test Label" description="Test Description" icon={testIcon} />);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
  });

  test("renders connect button with link when connectHref is provided", () => {
    render(
      <Card label="Test Label" description="Test Description" connectText="Connect" connectHref="/connect" />
    );

    const button = screen.getByTestId("mock-button");
    expect(button).toBeInTheDocument();

    const link = screen.getByTestId("mock-link");
    expect(link).toHaveAttribute("href", "/connect");
    expect(link).toHaveTextContent("Connect");
  });

  test("renders docs button with link when docsHref is provided", () => {
    render(
      <Card label="Test Label" description="Test Description" docsText="Documentation" docsHref="/docs" />
    );

    const button = screen.getByTestId("mock-button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("data-variant", "secondary");

    const link = screen.getByTestId("mock-link");
    expect(link).toHaveAttribute("href", "/docs");
    expect(link).toHaveTextContent("Documentation");
  });

  test("renders both connect and docs buttons when both hrefs are provided", () => {
    render(
      <Card
        label="Test Label"
        description="Test Description"
        connectText="Connect"
        connectHref="/connect"
        docsText="Documentation"
        docsHref="/docs"
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    expect(buttons).toHaveLength(2);

    const links = screen.getAllByTestId("mock-link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/connect");
    expect(links[1]).toHaveAttribute("href", "/docs");
  });

  test("sets target to _blank when connectNewTab is true", () => {
    render(
      <Card
        label="Test Label"
        description="Test Description"
        connectText="Connect"
        connectHref="/connect"
        connectNewTab={true}
      />
    );

    const link = screen.getByTestId("mock-link");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("sets target to _blank when docsNewTab is true", () => {
    render(
      <Card
        label="Test Label"
        description="Test Description"
        docsText="Documentation"
        docsHref="/docs"
        docsNewTab={true}
      />
    );

    const link = screen.getByTestId("mock-link");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("renders status text with green indicator when connected is true", () => {
    render(
      <Card label="Test Label" description="Test Description" connected={true} statusText="Connected" />
    );

    expect(screen.getByText("Connected")).toBeInTheDocument();
    // Check for green indicator by inspecting the span with the animation class
    const container = screen.getByText("Connected").parentElement;
    const animatedSpan = container?.querySelector(".animate-ping-slow");
    expect(animatedSpan).toBeInTheDocument();
  });

  test("renders status text with gray indicator when connected is false", () => {
    render(
      <Card label="Test Label" description="Test Description" connected={false} statusText="Disconnected" />
    );

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    // Check for gray indicator by inspecting the span without the animation class
    const container = screen.getByText("Disconnected").parentElement;
    const graySpan = container?.querySelector(".bg-slate-400");
    expect(graySpan).toBeInTheDocument();
  });

  test("disables buttons when disabled prop is true", () => {
    render(
      <Card
        label="Test Label"
        description="Test Description"
        connectText="Connect"
        connectHref="/connect"
        docsText="Documentation"
        docsHref="/docs"
        disabled={true}
      />
    );

    const buttons = screen.getAllByTestId("mock-button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("disabled");
    });
  });
});
