import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { Badge, badgeVariants } from "./badge";

describe("Badge", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with default variant", () => {
    const { container } = render(<Badge>Test Badge</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement.textContent).toBe("Test Badge");
    expect(badgeElement.className).toContain("bg-primary");
    expect(badgeElement.className).toContain("border-transparent");
    expect(badgeElement.className).toContain("text-primary-foreground");
  });

  test("renders with secondary variant", () => {
    const { container } = render(<Badge variant="secondary">Secondary Badge</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement.textContent).toBe("Secondary Badge");
    expect(badgeElement.className).toContain("bg-secondary");
    expect(badgeElement.className).toContain("text-secondary-foreground");
  });

  test("renders with destructive variant", () => {
    const { container } = render(<Badge variant="destructive">Destructive Badge</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement.textContent).toBe("Destructive Badge");
    expect(badgeElement.className).toContain("bg-destructive");
    expect(badgeElement.className).toContain("text-destructive-foreground");
  });

  test("renders with outline variant", () => {
    const { container } = render(<Badge variant="outline">Outline Badge</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement.textContent).toBe("Outline Badge");
    expect(badgeElement.className).toContain("text-foreground");
  });

  test("accepts additional className", () => {
    const { container } = render(<Badge className="custom-class">Custom Badge</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement.className).toContain("custom-class");
    expect(badgeElement.className).toContain("bg-primary"); // Default variant still applies
  });

  test("passes additional props", () => {
    const { container } = render(<Badge data-testid="test-badge">Props Test</Badge>);
    const badgeElement = container.firstChild as HTMLElement;

    expect(badgeElement).toBeInTheDocument();
    expect(badgeElement).toHaveAttribute("data-testid", "test-badge");
  });
});
