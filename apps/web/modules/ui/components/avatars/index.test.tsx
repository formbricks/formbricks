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
    test("renders Boring Avatar", () => {
      render(<ProfileAvatar userId="user-123" />);

      const avatar = screen.getByTestId("boring-avatar-bauhaus");
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute("data-size", "40");
      expect(avatar).toHaveAttribute("data-name", "user-123");
    });
  });
});
