import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PersonAvatar, ProfileAvatar } from "./index";

// Mock boring-avatars component
vi.mock("boring-avatars", () => ({
  default: ({ size, name, variant, colors }: any) => (
    <div data-testid={`boring-avatar-${variant}`} data-size={size} data-name={name}>
      Mocked Avatar
    </div>
  ),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, width, height, className, alt }: any) => (
    <img src={src} width={width} height={height} className={className} alt={alt} data-testid="next-image" />
  ),
}));

describe("Avatar Components", () => {
  afterEach(() => {
    cleanup();
  });

  describe("PersonAvatar", () => {
    test("renders with the correct props", () => {
      render(<PersonAvatar personId="test-person-123" />);

      const avatar = screen.getByTestId("boring-avatar-beam");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("data-size", "40");
      expect(avatar).toHaveAttribute("data-name", "test-person-123");
    });

    test("renders with different personId", () => {
      render(<PersonAvatar personId="another-person-456" />);

      const avatar = screen.getByTestId("boring-avatar-beam");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("data-name", "another-person-456");
    });
  });

  describe("ProfileAvatar", () => {
    test("renders Boring Avatar when imageUrl is not provided", () => {
      render(<ProfileAvatar userId="user-123" />);

      const avatar = screen.getByTestId("boring-avatar-bauhaus");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("data-size", "40");
      expect(avatar).toHaveAttribute("data-name", "user-123");
    });

    test("renders Boring Avatar when imageUrl is null", () => {
      render(<ProfileAvatar userId="user-123" imageUrl={null} />);

      const avatar = screen.getByTestId("boring-avatar-bauhaus");
      expect(avatar).toBeInTheDocument();
    });

    test("renders Image component when imageUrl is provided", () => {
      render(<ProfileAvatar userId="user-123" imageUrl="https://example.com/avatar.jpg" />);

      const image = screen.getByTestId("next-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/avatar.jpg");
      expect(image).toHaveAttribute("width", "40");
      expect(image).toHaveAttribute("height", "40");
      expect(image).toHaveAttribute("alt", "Avatar placeholder");
      expect(image).toHaveClass("h-10", "w-10", "rounded-full", "object-cover");
    });

    test("renders Image component with different imageUrl", () => {
      render(<ProfileAvatar userId="user-123" imageUrl="https://example.com/different-avatar.png" />);

      const image = screen.getByTestId("next-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/different-avatar.png");
    });
  });
});
