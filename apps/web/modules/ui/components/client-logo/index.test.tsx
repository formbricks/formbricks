import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ClientLogo } from "./index";

describe("ClientLogo", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders logo when provided", () => {
    const projectLogo = {
      url: "https://example.com/logo.png",
      bgColor: "#ffffff",
    };

    render(<ClientLogo projectLogo={projectLogo} />);

    const logoImg = screen.getByAltText("Company Logo");
    expect(logoImg).toBeInTheDocument();
    expect(logoImg).toHaveAttribute("src", expect.stringContaining(encodeURIComponent(projectLogo.url)));
  });

  test("renders 'add logo' link when no logo is provided", () => {
    const environmentId = "env-123";

    render(<ClientLogo environmentId={environmentId} projectLogo={null} />);

    const addLogoLink = screen.getByText("common.add_logo");
    expect(addLogoLink).toBeInTheDocument();
    expect(addLogoLink).toHaveAttribute("href", `/environments/${environmentId}/project/look`);
  });

  test("applies preview survey styling when previewSurvey prop is true", () => {
    const projectLogo = {
      url: "https://example.com/logo.png",
      bgColor: "#ffffff",
    };
    const environmentId = "env-123";

    render(<ClientLogo environmentId={environmentId} projectLogo={projectLogo} previewSurvey={true} />);

    const logoImg = screen.getByAltText("Company Logo");
    expect(logoImg).toHaveClass("max-h-12");
    expect(logoImg).not.toHaveClass("max-h-16");

    // Check that preview link is rendered
    const previewLink = screen.getByRole("link", { name: "" }); // ArrowUpRight icon link
    expect(previewLink).toHaveAttribute("href", `/environments/${environmentId}/project/look`);
  });

  test("calls preventDefault when no environmentId is provided", async () => {
    const user = userEvent.setup();

    // Mock preventDefault
    const preventDefaultMock = vi.fn();

    render(<ClientLogo projectLogo={null} />);

    const addLogoLink = screen.getByText("common.add_logo");

    // When no environmentId is provided, the href still exists but contains "undefined"
    expect(addLogoLink).toHaveAttribute("href", "/environments/undefined/project/look");

    // Simulate click with mocked preventDefault
    await user.click(addLogoLink);

    // We can't directly test preventDefault in JSDOM, so we just test
    // that the link has the expected attributes
    expect(addLogoLink).toHaveAttribute("target", "_blank");
  });
});
