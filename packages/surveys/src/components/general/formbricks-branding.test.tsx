import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/preact";
import { describe, expect, test } from "vitest";
import { FormbricksBranding } from "./formbricks-branding";

describe("FormbricksBranding", () => {
  test("renders branding text with correct link", () => {
    render(<FormbricksBranding />);

    const link = screen.getByRole("link", { name: /powered by/i });
    expect(link).toHaveAttribute("href", "https://formbricks.com?utm_source=survey_branding");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener");

    expect(screen.getByText("Formbricks")).toBeInTheDocument();
  });
});
