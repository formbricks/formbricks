import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { NoMobileOverlay } from "./index";

// Mock the tolgee translation
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) =>
      key === "common.mobile_overlay_text" ? "Please use desktop to access this section" : key,
  }),
}));

describe("NoMobileOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders overlay with correct text", () => {
    render(<NoMobileOverlay />);

    expect(screen.getByText("Please use desktop to access this section")).toBeInTheDocument();
  });

  test("has proper z-index for overlay", () => {
    render(<NoMobileOverlay />);

    const overlay = screen.getByText("Please use desktop to access this section").closest("div.fixed");
    expect(overlay).toHaveClass("z-[9999]");
  });

  test("has responsive layout with sm:hidden class", () => {
    render(<NoMobileOverlay />);

    const overlay = screen.getByText("Please use desktop to access this section").closest("div.fixed");
    expect(overlay).toHaveClass("sm:hidden");
  });
});
