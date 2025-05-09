import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FormWrapper } from "./form-wrapper";

vi.mock("@/modules/ui/components/logo", () => ({
  Logo: () => <div data-testid="mock-logo">Logo</div>,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    target,
    rel,
  }: {
    children: React.ReactNode;
    href: string;
    target?: string;
    rel?: string;
  }) => (
    <a href={href} target={target} rel={rel} data-testid="mock-link">
      {children}
    </a>
  ),
}));

describe("FormWrapper", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders logo and children content", () => {
    render(
      <FormWrapper>
        <div data-testid="test-content">Test Content</div>
      </FormWrapper>
    );

    // Check if logo is rendered
    const logo = screen.getByTestId("mock-logo");
    expect(logo).toBeInTheDocument();

    // Check if logo link has correct attributes
    const logoLink = screen.getByTestId("mock-link");
    expect(logoLink).toHaveAttribute("href", "https://formbricks.com?utm_source=ce");
    expect(logoLink).toHaveAttribute("target", "_blank");
    expect(logoLink).toHaveAttribute("rel", "noopener noreferrer");

    // Check if children content is rendered
    const content = screen.getByTestId("test-content");
    expect(content).toBeInTheDocument();
    expect(content).toHaveTextContent("Test Content");
  });
});
