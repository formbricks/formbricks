import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { GoBackButton } from "./index";

// Mock next/navigation
const mockRouter = {
  push: vi.fn(),
  back: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

describe("GoBackButton", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the back button with correct text", () => {
    render(<GoBackButton />);
    expect(screen.getByText("common.back")).toBeInTheDocument();
  });

  test("calls router.back when clicked without url prop", async () => {
    render(<GoBackButton />);

    const button = screen.getByText("common.back");
    await userEvent.click(button);

    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  test("calls router.push with the provided url when clicked", async () => {
    const testUrl = "/test-url";
    render(<GoBackButton url={testUrl} />);

    const button = screen.getByText("common.back");
    await userEvent.click(button);

    expect(mockRouter.push).toHaveBeenCalledWith(testUrl);
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
