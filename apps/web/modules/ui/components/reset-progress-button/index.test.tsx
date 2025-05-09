import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ResetProgressButton } from "./index";

// Mock tolgee
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => (key === "common.restart" ? "Restart" : key),
  }),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Repeat2: () => <div data-testid="repeat-icon" />,
}));

describe("ResetProgressButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders button with correct text", () => {
    render(<ResetProgressButton onClick={() => {}} />);

    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Restart")).toBeInTheDocument();
    expect(screen.getByTestId("repeat-icon")).toBeInTheDocument();
  });

  test("button has correct styling", () => {
    render(<ResetProgressButton onClick={() => {}} />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-fit");
    expect(button).toHaveClass("bg-white");
    expect(button).toHaveClass("text-slate-500");
    expect(button).toHaveClass("px-2");
    expect(button).toHaveClass("py-0");
  });

  test("calls onClick handler when clicked", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<ResetProgressButton onClick={handleClick} />);

    await user.click(screen.getByRole("button"));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
