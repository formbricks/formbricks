import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NoMobileOverlay } from "./index";

// Mock the tolgee translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      switch (key) {
        case "common.mobile_overlay_title":
          return "Works best on desktop";
        case "common.mobile_overlay_app_works_best_on_desktop":
          return "The app works best on desktop.";
        case "common.mobile_overlay_surveys_look_good":
          return "Surveys still look good on mobile.";
        case "common.mobile_overlay_learn_more":
          return "Learn more";
        default:
          return key;
      }
    },
  }),
}));

describe("NoMobileOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders title and paragraphs", () => {
    render(<NoMobileOverlay />);

    expect(screen.getByRole("heading", { level: 1, name: "Works best on desktop" })).toBeInTheDocument();
    expect(screen.getByText("The app works best on desktop.")).toBeInTheDocument();
    expect(screen.getByText("Surveys still look good on mobile.")).toBeInTheDocument();
  });

  test("has proper overlay classes (z-index and responsive hide)", () => {
    render(<NoMobileOverlay />);

    const overlay = document.querySelector("div.fixed");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("z-[9999]");
    expect(overlay).toHaveClass("sm:hidden");
  });

  test("renders learn more link with correct href", () => {
    render(<NoMobileOverlay />);

    const link = screen.getByRole("link", { name: "Learn more" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://formbricks.com/docs/xm-and-surveys/overview");
  });

  test("stacks icons with maximize centered inside smartphone", () => {
    const { container } = render(<NoMobileOverlay />);

    const wrapper = container.querySelector("div.relative.h-16.w-16");
    expect(wrapper).toBeInTheDocument();

    const phoneSvg = wrapper?.querySelector("svg.h-16.w-16");
    expect(phoneSvg).toBeInTheDocument();

    const expandSvg = wrapper?.querySelector("svg.absolute");
    expect(expandSvg).toBeInTheDocument();
    expect(expandSvg).toHaveClass("left-1/2", "top-1/3", "-translate-x-1/2", "-translate-y-1/3");
  });
});
