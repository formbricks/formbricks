import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PictureSelectionResponse } from "./index";

// Mock next/image because it's not available in the test environment
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className: string }) => (
    <img src={src} alt={alt} className={className} />
  ),
}));

describe("PictureSelectionResponse", () => {
  afterEach(() => {
    cleanup();
  });

  const mockChoices = [
    {
      id: "choice1",
      imageUrl: "https://example.com/image1.jpg",
    },
    {
      id: "choice2",
      imageUrl: "https://example.com/image2.jpg",
    },
    {
      id: "choice3",
      imageUrl: "https://example.com/image3.jpg",
    },
  ];

  test("renders images for selected choices", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice3"]} />
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://example.com/image1.jpg");
    expect(images[1]).toHaveAttribute("src", "https://example.com/image3.jpg");
  });

  test("renders nothing when selected is not an array", () => {
    // @ts-ignore - Testing invalid prop type
    const { container } = render(<PictureSelectionResponse choices={mockChoices} selected="choice1" />);
    expect(container.firstChild).toBeNull();
  });

  test("handles expanded layout", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice2"]} isExpanded={true} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex-wrap");
  });

  test("handles non-expanded layout", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice2"]} isExpanded={false} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass("flex-wrap");
  });

  test("handles choices not in the mapping", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "nonExistentChoice"]} />
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1); // Only one valid image should be rendered
  });
});
