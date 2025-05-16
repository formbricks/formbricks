import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { DefaultTag } from "./index";

describe("DefaultTag", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders with correct styling", () => {
    render(<DefaultTag />);

    const tagElement = screen.getByText("common.default");
    expect(tagElement).toBeInTheDocument();
    expect(tagElement.parentElement).toHaveClass(
      "flex",
      "h-6",
      "items-center",
      "justify-center",
      "rounded-xl",
      "bg-slate-200"
    );
    expect(tagElement).toHaveClass("text-xs");
  });

  test("uses tolgee translate function for text", () => {
    render(<DefaultTag />);

    // The @tolgee/react useTranslate hook is already mocked in vitestSetup.ts to return the key
    expect(screen.getByText("common.default")).toBeInTheDocument();
  });
});
