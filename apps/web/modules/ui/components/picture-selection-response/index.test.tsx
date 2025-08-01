import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PictureSelectionResponse } from "./index";

// Mock next/image because it's not available in the test environment
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className: string }) => (
    <img src={src} alt={alt} className={className} data-testid="choice-image" />
  ),
}));

// Mock the IdBadge component
vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
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
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice3"]} showId={false} />
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", "https://example.com/image1.jpg");
    expect(images[1]).toHaveAttribute("src", "https://example.com/image3.jpg");
  });

  test("renders nothing when selected is not an array", () => {
    // @ts-ignore - Testing invalid prop type
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected="choice1" showId={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  test("handles expanded layout", () => {
    const { container } = render(
      <PictureSelectionResponse
        choices={mockChoices}
        selected={["choice1", "choice2"]}
        isExpanded={true}
        showId={false}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex-wrap");
  });

  test("handles non-expanded layout", () => {
    const { container } = render(
      <PictureSelectionResponse
        choices={mockChoices}
        selected={["choice1", "choice2"]}
        isExpanded={false}
        showId={false}
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass("flex-wrap");
  });

  test("handles choices not in the mapping", () => {
    const { container } = render(
      <PictureSelectionResponse
        choices={mockChoices}
        selected={["choice1", "nonExistentChoice"]}
        showId={false}
      />
    );

    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(1); // Only one valid image should be rendered
  });

  test("shows IdBadge when showId=true", () => {
    render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice2"]} showId={true} />
    );

    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
  });

  test("does not show IdBadge when showId=false", () => {
    render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice2"]} showId={false} />
    );

    expect(screen.queryByTestId("id-badge")).not.toBeInTheDocument();
  });

  test("applies column layout when showId=true", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1"]} showId={true} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("flex-col");
  });

  test("does not apply column layout when showId=false", () => {
    const { container } = render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1"]} showId={false} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).not.toHaveClass("flex-col");
  });

  test("renders images and IdBadges in same container when showId=true", () => {
    render(
      <PictureSelectionResponse choices={mockChoices} selected={["choice1", "choice2"]} showId={true} />
    );

    const images = screen.getAllByTestId("choice-image");
    const idBadges = screen.getAllByTestId("id-badge");

    expect(images).toHaveLength(2);
    expect(idBadges).toHaveLength(2);

    // Both images and badges should be in the same container
    const containers = screen.getAllByText("ID: choice1")[0].closest("div");
    expect(containers).toBeInTheDocument();
  });

  test("handles default props correctly", () => {
    render(<PictureSelectionResponse choices={mockChoices} selected={["choice1"]} showId={false} />);

    const images = screen.getAllByTestId("choice-image");
    expect(images).toHaveLength(1);
    expect(screen.queryByTestId("id-badge")).not.toBeInTheDocument();
  });
});
