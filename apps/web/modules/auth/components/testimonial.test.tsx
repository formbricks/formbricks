import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Testimonial } from "./testimonial";

vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(() =>
    Promise.resolve((k: string) => {
      const translations: Record<string, string> = {
        "auth.testimonial_title": "Testimonial Title",
        "auth.testimonial_all_features_included": "All features included",
        "auth.testimonial_free_and_open_source": "Free and open source",
        "auth.testimonial_no_credit_card_required": "No credit card required",
        "auth.testimonial_1": "Test testimonial quote",
      };
      return translations[k] || k;
    })
  ),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} data-testid="mock-image" />
  ),
}));

describe("Testimonial", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders testimonial content with translations", async () => {
    render(await Testimonial());

    // Check title
    expect(screen.getByText("Testimonial Title")).toBeInTheDocument();

    // Check feature points
    expect(screen.getByText("All features included")).toBeInTheDocument();
    expect(screen.getByText("Free and open source")).toBeInTheDocument();
    expect(screen.getByText("No credit card required")).toBeInTheDocument();

    // Check testimonial quote
    expect(screen.getByText("Test testimonial quote")).toBeInTheDocument();

    // Check testimonial author
    expect(screen.getByText("Peer Richelsen, Co-Founder Cal.com")).toBeInTheDocument();

    // Check images
    const images = screen.getAllByTestId("mock-image");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("alt", "Cal.com Co-Founder Peer Richelsen");
    expect(images[1]).toHaveAttribute("alt", "Cal.com Logo");
  });
});
