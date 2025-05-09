import { cleanup, render } from "@testing-library/react";
import { redirect } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import Page from "./page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("Page", () => {
  afterEach(() => {
    cleanup();
  });

  test("should redirect to /", () => {
    render(<Page />);
    expect(vi.mocked(redirect)).toHaveBeenCalledWith("/");
  });
});
