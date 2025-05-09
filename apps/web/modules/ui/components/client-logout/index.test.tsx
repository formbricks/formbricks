import { render } from "@testing-library/react";
import { signOut } from "next-auth/react";
import { describe, expect, test, vi } from "vitest";
import { ClientLogout } from "./index";

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
}));

describe("ClientLogout", () => {
  test("calls signOut on render", () => {
    render(<ClientLogout />);
    expect(signOut).toHaveBeenCalled();
  });

  test("renders null", () => {
    const { container } = render(<ClientLogout />);
    expect(container.firstChild).toBeNull();
  });
});
